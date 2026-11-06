// swap-exercise: the coach replaces one exercise of a planned session (missing equipment, pain,
// too hard/easy). Only this session's exercise is changed; the original is kept in replaced_from.
// POST { workout_exercise_id, reason, note? } with the user's JWT
//   → 200 { workout_exercise, explanation } | 4xx/5xx { error: { code, message } }
import { generateStructured } from '../_shared/anthropic.ts';
import { json } from '../_shared/cors.ts';
import { roundLoad } from '../_shared/coach/program-builder.ts';
import { profileForCoach } from '../_shared/coach/profile-context.ts';
import {
  checkSwap,
  isUsable,
  type SwapRequest,
  swapRequestSchema,
  swapResultSchema,
  usableEquipment,
} from '../_shared/coach/swap.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

const EXERCISE_FIELDS =
  'id, name_fr, name_en, image_urls, gif_url, youtube_video_id, primary_muscles, equipment';
const MAX_CANDIDATES = 40;

const REASONS: Record<SwapRequest['reason'], string> = {
  equipment: 'le matériel nécessaire n’est pas disponible',
  pain: 'l’utilisateur ressent une douleur sur ce mouvement',
  too_hard: 'l’exercice est trop difficile pour lui aujourd’hui',
  too_easy: 'l’exercice est trop facile',
  other: 'autre raison',
};

Deno.serve(
  aiHandler('swap-exercise', async ({ req, client, user }) => {
    const parsed = swapRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'bad_request', 'Requête invalide.');
    const request = parsed.data;

    // RLS: only the user's own workouts are visible.
    const { data: current, error } = await client
      .from('workout_exercises')
      .select(
        `*, workout:workouts!inner(title, status), exercise:exercises!workout_exercises_exercise_id_fkey(${EXERCISE_FIELDS}, level, mechanic, category)`,
      )
      .eq('id', request.workout_exercise_id)
      .maybeSingle();
    if (error) throw error;
    if (!current) throw new HttpError(404, 'not_found', 'Exercice introuvable.');
    if (current.workout.status === 'completed') {
      throw new HttpError(400, 'bad_request', 'Cette séance est déjà terminée.');
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    // Same kind of exercise (strength, stretching…) and target muscles, doable with the user's equipment. Exercises of the coach's reference
    // library (French names) come first, then the closest level.
    const usable = usableEquipment(profile.equipment);
    const { data: library, error: libraryError } = await client
      .from('exercises')
      .select('id, name_fr, name_en, equipment, primary_muscles, level, mechanic, source')
      .eq('category', current.exercise.category)
      .overlaps('primary_muscles', current.exercise.primary_muscles)
      .neq('id', current.exercise_id);
    if (libraryError) throw libraryError;
    const candidates = library
      .filter((e) => isUsable(e.equipment, usable))
      .sort((a, b) => rank(b, current.exercise) - rank(a, current.exercise))
      .slice(0, MAX_CANDIDATES);
    if (candidates.length === 0) {
      throw new HttpError(404, 'not_found', 'Aucune variante compatible avec ton matériel.');
    }

    const { data: swap, model } = await generateStructured({
      schema: swapResultSchema,
      check: (r) =>
        checkSwap(r, {
          currentExerciseId: current.exercise_id,
          candidateIds: new Set(candidates.map((c) => c.id)),
        }),
      prompt: buildPrompt({ request, current, profile: profileForCoach(profile), candidates }),
      maxTokens: 4000,
      effort: 'low',
    });

    const { data: updated, error: updateError } = await client
      .from('workout_exercises')
      .update({
        exercise_id: swap.exercise_id,
        replaced_from: current.replaced_from ?? current.exercise_id,
        sets: swap.series,
        reps: swap.repetitions,
        duration_sec: swap.duree_sec,
        suggested_load_kg:
          swap.charge_suggeree_kg != null ? roundLoad(swap.charge_suggeree_kg) : null,
        tempo: swap.tempo,
        rest_sec: swap.repos_sec,
        target_rpe: swap.rpe_cible,
        notes: swap.notes || null,
      })
      .eq('id', current.id)
      .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey(${EXERCISE_FIELDS})`)
      .single();
    if (updateError) throw updateError;

    console.log(
      `[swap-exercise] ${current.exercise_id} → ${swap.exercise_id} (${request.reason}, ${model})`,
    );
    return json({ workout_exercise: updated, explanation: swap.explication });
  }),
);

type LibraryExercise = {
  level: string | null;
  mechanic: string | null;
  name_fr: string;
  name_en: string;
  source: string;
};

function rank(e: LibraryExercise, current: { level: string | null; mechanic: string | null }) {
  return (
    (e.source === 'custom' || e.name_fr !== e.name_en ? 4 : 0) +
    (e.mechanic && e.mechanic === current.mechanic ? 2 : 0) +
    (e.level && e.level === current.level ? 1 : 0)
  );
}

function buildPrompt(input: {
  request: SwapRequest;
  current: Record<string, unknown> & {
    exercise: Record<string, unknown>;
    workout: { title: string };
  };
  profile: ReturnType<typeof profileForCoach>;
  candidates: {
    id: string;
    name_fr: string;
    equipment: string[];
    primary_muscles: string[];
    level: string | null;
    mechanic: string | null;
  }[];
}) {
  const { request, current, profile, candidates } = input;
  return `Mode données (JSON). Remplace un exercice de la séance « ${current.workout.title} ».

Profil (schéma 8.1) :
${JSON.stringify(profile)}

Exercice actuel :
${JSON.stringify({
  exercise_id: current.exercise_id,
  nom: current.exercise.name_fr,
  muscles: current.exercise.primary_muscles,
  materiel: current.exercise.equipment,
  series: current.sets,
  repetitions: current.reps,
  duree_sec: current.duration_sec,
  charge_suggeree_kg: current.suggested_load_kg,
  tempo: current.tempo,
  repos_sec: current.rest_sec,
  rpe_cible: current.target_rpe,
})}

Raison du remplacement : ${REASONS[request.reason]}.${request.note ? `\nPrécision de l’utilisateur : « ${request.note} »` : ''}

Exercices possibles (choisis exercise_id UNIQUEMENT dans cette liste) :
${candidates.map((c) => `- ${c.id} | ${c.name_fr} | ${c.equipment.join(',') || 'aucun'} | ${c.primary_muscles.join(',')} | ${c.level ?? '?'} | ${c.mechanic ?? '?'}`).join('\n')}

Consignes :
- Choisis la variante qui garde le même objectif musculaire et la même place dans la séance.
${request.reason === 'pain' ? '- Douleur : choisis une variante qui ne sollicite pas la zone douloureuse, plus légère, avec amplitude contrôlée ; dans "explication", rappelle d’arrêter en cas de douleur vive et de consulter si elle persiste (§2).\n' : ''}${request.reason === 'too_hard' ? '- Choisis une variante plus facile (variante plus facile, charge ou levier réduits).\n' : ''}${request.reason === 'too_easy' ? '- Choisis une variante plus difficile, sans augmenter brutalement la charge.\n' : ''}- Adapte series, repetitions, charge_suggeree_kg (prudente, null au poids du corps), tempo, repos_sec et rpe_cible au nouvel exercice.
- "explication" : 1 à 2 phrases en français, tutoiement, pour dire pourquoi cette variante.`;
}
