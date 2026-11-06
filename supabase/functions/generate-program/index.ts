// generate-program: builds the user's first (or a new) program from their profile.
// POST { start_date?: 'YYYY-MM-DD' } (the user's local date) with the user's JWT → 200 { program_id } | 4xx/5xx { error: { code, message } }
import { generateStructured } from '../_shared/anthropic.ts';
import { json } from '../_shared/cors.ts';
import { buildWorkouts } from '../_shared/coach/program-builder.ts';
import { checkProgram, generatedProgramSchema } from '../_shared/coach/program-schema.ts';
import { profileForCoach } from '../_shared/coach/profile-context.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

Deno.serve(
  aiHandler('generate-program', async ({ req, client, user }) => {
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    if (!profile.onboarding_completed_at || !profile.days_per_week) {
      throw new HttpError(400, 'bad_request', 'Termine ton profil avant de générer un programme.');
    }

    const { data: exercises, error: exError } = await client.from('exercises').select('id');
    if (exError) throw exError;
    const knownExerciseIds = new Set(exercises.map((e) => e.id as string));

    const startDate = resolveStartDate(await req.json().catch(() => ({})));
    const { data: program, model } = await generateStructured({
      schema: generatedProgramSchema,
      check: (p) => checkProgram(p, { daysPerWeek: profile.days_per_week, knownExerciseIds }),
      prompt: buildPrompt(profileForCoach(profile), startDate),
    });

    const { data: programId, error: saveError } = await client.rpc('create_program', {
      p_program: {
        name: program.nom,
        structure: program.structure,
        duration_weeks: program.duree_semaines,
        start_date: startDate,
        ai_payload: { ...program, model },
      },
      p_workouts: buildWorkouts(program, startDate),
    });
    if (saveError) throw saveError;

    return json({
      program_id: programId,
      warnings: program.avertissements,
      assumptions: program.hypotheses,
    });
  }),
);

/**
 * The program starts on the user's local "today", sent by the app (the server runs in UTC).
 * Anything more than a day away from the server date is ignored.
 */
function resolveStartDate(body: { start_date?: unknown }): string {
  const server = new Date();
  const requested = typeof body.start_date === 'string' ? body.start_date : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    const diff = Math.abs(new Date(`${requested}T12:00:00Z`).getTime() - server.getTime());
    if (diff < 36 * 3600 * 1000) return requested;
  }
  return server.toISOString().slice(0, 10);
}

function buildPrompt(profile: ReturnType<typeof profileForCoach>, startDate: string) {
  return `Mode données (JSON). Crée le programme d'entraînement de cet utilisateur.

Profil (schéma 8.1) :
${JSON.stringify(profile, null, 2)}

Date de début : ${startDate}

Consignes :
- Choisis la structure selon le tableau 4.1 et les paramètres selon l'objectif (4.2), le volume selon le niveau (4.3).
- Durée de 4 à 8 semaines (mésocycle, 4.5) avec au moins une semaine "deload". "semaines" liste chaque semaine dans l'ordre avec son type, son intensite_pct (charge en % des séances types) et son volume_pct (séries en %).
- "seances_types" : exactement ${profile.jours_dispo_semaine} séances, une par jour d'entraînement, chacune sur un jour différent (jour_semaine 1 = lundi … 7 = dimanche), en laissant au moins un jour de repos complet. Chaque séance doit tenir en ${profile.duree_seance_min} minutes environ, échauffement et retour au calme compris.
- Utilise uniquement des exercise_id de la bibliothèque de référence (§11) compatibles avec le matériel disponible.
- Évite tout mouvement qui sollicite les zones blessées listées ; choisis des variantes sûres.
- charge_suggeree_kg : estimation prudente pour la semaine 1 (null pour le poids du corps ou le cardio). Pour un exercice tenu en temps (gainage, étirement, cardio), mets repetitions à "1" et la durée dans duree_sec ; sinon duree_sec = null.
- Si l'utilisateur est mineur ou a une condition de santé, ajoute dans "avertissements" la recommandation de consulter un médecin avant de commencer (§2).
- "hypotheses" : les hypothèses prudentes que tu as faites sur les informations manquantes.`;
}
