// session-feedback: the coach's report after a session (context §9.2 "Quotidien"): what went
// well, one thing to improve, loads for next time. Records come from the database, not the model.
// POST { log_id } → 200 { report } (cached: asking twice returns the same report).
import { z } from 'zod';

import { generateStructured } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/auth.ts';
import { json } from '../_shared/cors.ts';
import { loadCoachContext } from '../_shared/coach/context.ts';
import { checkSessionReport, sessionReportSchema } from '../_shared/coach/reports.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

const bodySchema = z.object({ log_id: z.uuid() });

Deno.serve(
  aiHandler(
    'session-feedback',
    async ({ req, client, user, useQuota }) => {
      const parsed = bodySchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) throw new HttpError(400, 'bad_request', 'Requête invalide.');
      const logId = parsed.data.log_id;

      const { data: existing } = await client
        .from('coach_reports')
        .select('*')
        .eq('workout_log_id', logId)
        .maybeSingle();
      if (existing) return json({ report: existing });

      const { data: log, error } = await client
        .from('workout_logs')
        .select('id, performed_on, workout_id')
        .eq('id', logId)
        .maybeSingle();
      if (error) throw error;
      if (!log) throw new HttpError(404, 'not_found', 'Séance introuvable.');

      const ctx = await loadCoachContext(client, user.id, 6);
      const session = ctx.history.find((h) => h.log_id === logId);
      if (!session || session.exercices.length === 0) {
        throw new HttpError(400, 'bad_request', 'Aucune série enregistrée pour cette séance.');
      }
      const previous = ctx.history.filter((h) => h.log_id !== logId).slice(0, 5);

      const [records, next] = await Promise.all([
        client
          .from('personal_records')
          .select('exercise_id, record_type, value, reps, load_kg')
          .eq('achieved_on', log.performed_on)
          .in(
            'exercise_id',
            session.exercices.map((e) => e.exercise_id),
          ),
        client
          .from('workouts')
          .select(
            'title, scheduled_date, workout_exercises(exercise_id, sets, reps, suggested_load_kg)',
          )
          .eq('status', 'planned')
          .gt('scheduled_date', log.performed_on)
          .order('scheduled_date')
          .limit(1)
          .maybeSingle(),
      ]);
      if (records.error) throw records.error;

      await useQuota();
      const { data: report, model } = await generateStructured({
        schema: sessionReportSchema,
        check: (r) => checkSessionReport(r, new Set(session.exercices.map((e) => e.exercise_id))),
        maxTokens: 4000,
        effort: 'low',
        prompt: `Mode données (JSON). Fais le bilan de la séance que l'utilisateur vient de terminer (§9.2 « Quotidien »).

Profil : ${JSON.stringify(ctx.profile)}

Séance terminée : ${JSON.stringify(session)}

Records battus pendant cette séance (détectés par l'app) : ${JSON.stringify(records.data)}

Séances précédentes (résumé, plus récente d'abord) : ${JSON.stringify(previous)}

Prochaine séance prévue : ${JSON.stringify(next.data ?? null)}

Consignes :
- "bilan" : 3 à 4 phrases, tutoiement : ce qui s'est bien passé (cite un progrès réel des chiffres ci-dessus), un point à améliorer, la suite.
- Félicite les records s'il y en a ; n'invente aucun chiffre.
- "charges_prochaine_seance" : pour les exercices faits aujourd'hui, la charge conseillée la prochaine fois selon la double progression (§5.1) et les règles §5.2 (null au poids du corps).
- Si une douleur a été signalée, conseille une variante sans douleur et un avis médical si elle persiste (§2).`,
      });

      const { data: saved, error: saveError } = await adminClient()
        .from('coach_reports')
        .insert({
          user_id: user.id,
          report_type: 'session',
          period_start: log.performed_on,
          period_end: log.performed_on,
          workout_log_id: logId,
          payload: { type_rapport: 'seance', ...report, records_personnels: records.data },
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
