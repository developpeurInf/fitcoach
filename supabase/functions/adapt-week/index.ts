// adapt-week: before each new program week (§3.6), the coach adjusts loads, volume and exercises
// from the profile, the last 10 sessions (summarised) and the latest measurements (§5.1 / §5.2).
// POST { today? } → 200 { report } (one adaptation per week; asking again returns it).
import { z } from 'zod';

import { generateStructured } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/auth.ts';
import { json } from '../_shared/cors.ts';
import { daysSinceLastSession, loadCoachContext, resolveToday } from '../_shared/coach/context.ts';
import { roundLoad } from '../_shared/coach/program-builder.ts';
import { adaptationSchema, checkAdaptation, isAdaptationDue } from '../_shared/coach/reports.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

const bodySchema = z.object({ today: z.string().optional() });

type PlannedRow = {
  id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps: string;
  duration_sec: number | null;
  suggested_load_kg: number | null;
  rest_sec: number | null;
  target_rpe: number | null;
  replaced_from: string | null;
  exercise: { name_fr: string; equipment: string[] } | null;
};

Deno.serve(
  aiHandler(
    'adapt-week',
    async ({ req, client, user, useQuota }) => {
      const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) throw new HttpError(400, 'bad_request', 'Requête invalide.');
      const today = resolveToday(parsed.data.today);

      const { data: program, error } = await client
        .from('programs')
        .select('id, name, ai_payload')
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      if (!program) throw new HttpError(404, 'not_found', 'Aucun programme actif.');

      const { data: upcoming, error: upError } = await client
        .from('workouts')
        .select('week_number')
        .eq('program_id', program.id)
        .eq('status', 'planned')
        .gte('scheduled_date', today)
        .order('scheduled_date')
        .limit(1)
        .maybeSingle();
      if (upError) throw upError;
      if (!upcoming)
        throw new HttpError(404, 'not_found', 'Plus de séance prévue dans ce programme.');
      const week = upcoming.week_number;
      if (week === 1) {
        throw new HttpError(400, 'bad_request', 'La première semaine vient d’être préparée.');
      }

      const { data: workouts, error: wError } = await client
        .from('workouts')
        .select(
          'id, title, scheduled_date, status, week_type, workout_exercises(id, exercise_id, position, sets, reps, duration_sec, suggested_load_kg, rest_sec, target_rpe, replaced_from, exercise:exercises!workout_exercises_exercise_id_fkey(name_fr, equipment))',
        )
        .eq('program_id', program.id)
        .eq('week_number', week)
        .order('scheduled_date');
      if (wError) throw wError;
      const weekStart = workouts[0]!.scheduled_date as string;
      const weekEnd = workouts.at(-1)!.scheduled_date as string;
      if (!isAdaptationDue(weekStart, today)) {
        throw new HttpError(400, 'bad_request', 'Trop tôt pour ajuster cette semaine.');
      }

      const { data: existing } = await client
        .from('coach_reports')
        .select('*')
        .eq('report_type', 'adaptation')
        .eq('period_start', weekStart)
        .is('workout_log_id', null)
        .maybeSingle();
      if (existing) return json({ report: existing });

      const planned = workouts.filter((w) => w.status === 'planned');
      const rows = planned.flatMap((w) => w.workout_exercises as unknown as PlannedRow[]);
      if (rows.length === 0)
        throw new HttpError(400, 'bad_request', 'Rien à ajuster cette semaine.');

      const ctx = await loadCoachContext(client, user.id, 10);
      const weekPlan = (
        program.ai_payload as { semaines?: { semaine: number }[] } | null
      )?.semaines?.find((s) => s.semaine === week);

      const { data: library, error: libError } = await client
        .from('exercises')
        .select('id, name_fr');
      if (libError) throw libError;
      const checkCtx = {
        plannedIds: new Set(rows.map((r) => r.id)),
        knownExerciseIds: new Set(library.map((e) => e.id as string)),
      };
      const names = new Map(library.map((e) => [e.id as string, e.name_fr as string]));

      await useQuota();
      const { data: adaptation, model } = await generateStructured({
        schema: adaptationSchema,
        check: (a) => checkAdaptation(a, checkCtx),
        maxTokens: 12000,
        prompt: buildPrompt({
          week,
          weekPlan,
          planned,
          ctx,
          daysSinceLast: daysSinceLastSession(ctx.history, today),
          today,
        }),
      });

      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const a of adaptation.ajustements) {
        const current = byId.get(a.workout_exercise_id)!;
        const { error: updError } = await client
          .from('workout_exercises')
          .update({
            exercise_id: a.exercise_id,
            replaced_from:
              a.exercise_id !== current.exercise_id
                ? (current.replaced_from ?? current.exercise_id)
                : current.replaced_from,
            sets: a.series,
            reps: a.repetitions,
            duration_sec: a.duree_sec,
            suggested_load_kg:
              a.charge_suggeree_kg != null ? roundLoad(a.charge_suggeree_kg) : null,
          })
          .eq('id', a.workout_exercise_id);
        if (updError) throw updError;
      }
      if (adaptation.decision_semaine === 'decharge') {
        await client
          .from('workouts')
          .update({ week_type: 'deload' })
          .in(
            'id',
            planned.map((w) => w.id),
          );
      }

      const { data: saved, error: saveError } = await adminClient()
        .from('coach_reports')
        .insert({
          user_id: user.id,
          report_type: 'adaptation',
          period_start: weekStart,
          period_end: weekEnd,
          payload: {
            type_rapport: 'adaptation',
            semaine: week,
            programme_id: program.id,
            ...adaptation,
            // Stored as applied: rounded loads, the exercise's name, and the previous one if replaced.
            ajustements: adaptation.ajustements.map((a) => {
              const before = byId.get(a.workout_exercise_id)!;
              return {
                ...a,
                charge_suggeree_kg:
                  a.charge_suggeree_kg != null ? roundLoad(a.charge_suggeree_kg) : null,
                nom: names.get(a.exercise_id),
                nom_avant:
                  a.exercise_id !== before.exercise_id ? before.exercise?.name_fr : undefined,
              };
            }),
          },
          model,
        })
        .select()
        .single();
      if (saveError) throw saveError;
      return json({ report: saved });
    },
    { lazyQuota: true },
  ),
);

function buildPrompt(input: {
  week: number;
  weekPlan: unknown;
  planned: {
    id: string;
    title: string;
    scheduled_date: string;
    week_type: string;
    workout_exercises: unknown;
  }[];
  ctx: Awaited<ReturnType<typeof loadCoachContext>>;
  daysSinceLast: number | null;
  today: string;
}) {
  const lines = input.planned.flatMap((w) =>
    (w.workout_exercises as unknown as PlannedRow[])
      .sort((a, b) => a.position - b.position)
      .map(
        (e) =>
          `- ${e.id} | ${w.scheduled_date} ${w.title} | ${e.exercise_id} (${e.exercise?.name_fr ?? ''}) | ${e.sets}×${e.duration_sec ? `${e.duration_sec}s` : e.reps} | ${e.suggested_load_kg ?? 'PDC'} kg | RPE ${e.target_rpe ?? '?'}`,
      ),
  );
  return `Mode données (JSON). Ajuste la semaine ${input.week} du programme avant qu'elle commence (§3.6), selon la surcharge progressive (§5.1) et les règles d'adaptation (§5.2).

Profil : ${JSON.stringify(input.ctx.profile)}

Plan prévu pour cette semaine (périodisation) : ${JSON.stringify(input.weekPlan ?? null)}

10 dernières séances (résumé, plus récente d'abord) : ${JSON.stringify(input.ctx.history)}
Jours depuis la dernière séance : ${input.daysSinceLast ?? 'aucune séance enregistrée'} (aujourd'hui : ${input.today})

Dernières mesures : ${JSON.stringify(input.ctx.measurements)}

Exercices prévus (workout_exercise_id | séance | exercice | volume | charge | RPE cible) :
${lines.join('\n')}

Consignes :
- "ajustements" : uniquement les exercices à modifier, avec leur workout_exercise_id ci-dessus et les nouvelles valeurs complètes (séries, répétitions, charge prudente arrondie, null au poids du corps).
- Pour remplacer un exercice (douleur, plateau 3–4 semaines), mets un exercise_id de la bibliothèque (§11) compatible avec le matériel ; sinon garde le même exercise_id.
- "decision_semaine" : progression, maintien, decharge (reps manquées 3+ séances / fatigue) ou reprise (absence > 7 jours : ~80 % des charges ; > 3 semaines : reprise progressive).
- "alertes" : perte de poids > 1 %/semaine, douleur persistante (avis médical), etc. Vide sinon.
- "message_coach" : 1 à 2 phrases, tutoiement, qui expliquent les changements.`;
}
