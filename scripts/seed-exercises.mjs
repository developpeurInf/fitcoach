#!/usr/bin/env node
// Builds supabase/seed.sql from the open source free-exercise-db (public domain / Unlicense).
//
//   node scripts/seed-exercises.mjs            # writes supabase/seed.sql (used by `supabase db reset`)
//   npx supabase db reset                      # local: recreates the DB and runs the seed
//   psql "$DATABASE_URL" -f supabase/seed.sql  # remote: idempotent upsert
//
// Rules (spec §3.4): media URLs come only from the source dataset, never invented.
// The coach's reference slugs (context file §11) are mapped onto dataset entries so the AI's
// exercise_id always resolves to a real image. Two slugs have no match in the dataset and are
// inserted without media (burpee, shoulder-dislocates); the app falls back to the YouTube search.
//
// Optional: set FREE_EXERCISE_DB_REF to pin a git ref/commit of the dataset (default: main).

import { writeFileSync } from 'node:fs';

const REF = process.env.FREE_EXERCISE_DB_REF ?? 'main';
const BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${REF}`;

/** Coach reference slug → [free-exercise-db id | null, French name]. */
const REFERENCE = {
  // Pectoraux
  'barbell-bench-press': ['Barbell_Bench_Press_-_Medium_Grip', 'Développé couché à la barre'],
  'dumbbell-bench-press': ['Dumbbell_Bench_Press', 'Développé couché aux haltères'],
  'incline-dumbbell-press': ['Incline_Dumbbell_Press', 'Développé incliné aux haltères'],
  'push-up': ['Pushups', 'Pompes'],
  'cable-fly': ['Cable_Crossover', 'Écarté à la poulie'],
  'chest-dip': ['Dips_-_Chest_Version', 'Dips (pectoraux)'],
  // Dos
  'pull-up': ['Pullups', 'Tractions'],
  'lat-pulldown': ['Wide-Grip_Lat_Pulldown', 'Tirage vertical à la poulie'],
  'barbell-row': ['Bent_Over_Barbell_Row', 'Rowing barre buste penché'],
  'seated-cable-row': ['Seated_Cable_Rows', 'Tirage horizontal assis à la poulie'],
  'one-arm-dumbbell-row': ['One-Arm_Dumbbell_Row', 'Rowing haltère à un bras'],
  deadlift: ['Barbell_Deadlift', 'Soulevé de terre'],
  'face-pull': ['Face_Pull', 'Face pull'],
  'inverted-row': ['Inverted_Row', 'Rowing inversé'],
  // Épaules
  'overhead-press': ['Standing_Military_Press', 'Développé militaire debout'],
  'dumbbell-shoulder-press': ['Dumbbell_Shoulder_Press', 'Développé épaules aux haltères'],
  'lateral-raise': ['Side_Lateral_Raise', 'Élévations latérales'],
  'rear-delt-fly': ['Seated_Bent-Over_Rear_Delt_Raise', 'Oiseau (deltoïdes postérieurs)'],
  // Biceps
  'barbell-curl': ['Barbell_Curl', 'Curl à la barre'],
  'dumbbell-curl': ['Dumbbell_Bicep_Curl', 'Curl aux haltères'],
  'hammer-curl': ['Hammer_Curls', 'Curl marteau'],
  // Triceps
  'triceps-pushdown': ['Triceps_Pushdown', 'Extension triceps à la poulie'],
  'skull-crusher': ['EZ-Bar_Skullcrusher', 'Barre au front'],
  'bench-dip': ['Bench_Dips', 'Dips sur banc'],
  'overhead-triceps-extension': [
    'Cable_Rope_Overhead_Triceps_Extension',
    'Extension triceps au-dessus de la tête',
  ],
  // Jambes
  'barbell-squat': ['Barbell_Full_Squat', 'Squat à la barre'],
  'goblet-squat': ['Goblet_Squat', 'Goblet squat'],
  'leg-press': ['Leg_Press', 'Presse à cuisses'],
  'romanian-deadlift': ['Romanian_Deadlift', 'Soulevé de terre roumain'],
  'walking-lunge': ['Bodyweight_Walking_Lunge', 'Fentes marchées'],
  'bulgarian-split-squat': ['Split_Squat_with_Dumbbells', 'Squat bulgare'],
  'leg-extension': ['Leg_Extensions', 'Leg extension'],
  'leg-curl': ['Lying_Leg_Curls', 'Leg curl allongé'],
  'calf-raise': ['Standing_Calf_Raises', 'Extensions mollets debout'],
  'hip-thrust': ['Barbell_Hip_Thrust', 'Hip thrust à la barre'],
  // Abdos / gainage
  plank: ['Plank', 'Gainage (planche)'],
  'side-plank': ['Push_Up_to_Side_Plank', 'Gainage latéral'],
  'hanging-leg-raise': ['Hanging_Leg_Raise', 'Relevés de jambes suspendu'],
  crunch: ['Crunches', 'Crunch'],
  'russian-twist': ['Russian_Twist', 'Russian twist'],
  'dead-bug': ['Dead_Bug', 'Dead bug'],
  'ab-wheel-rollout': ['Ab_Roller', 'Roue abdominale'],
  // Cardio
  'treadmill-run': ['Running_Treadmill', 'Course sur tapis'],
  'rowing-machine': ['Rowing_Stationary', 'Rameur'],
  cycling: ['Bicycling_Stationary', 'Vélo'],
  'jump-rope': ['Rope_Jumping', 'Corde à sauter'],
  burpee: [null, 'Burpee'],
  'mountain-climber': ['Mountain_Climbers', 'Mountain climbers'],
  // Mobilité
  'cat-cow': ['Cat_Stretch', 'Chat-vache'],
  'worlds-greatest-stretch': ['Worlds_Greatest_Stretch', 'Le meilleur étirement du monde'],
  'hip-flexor-stretch': ['Kneeling_Hip_Flexor', 'Étirement des fléchisseurs de hanche'],
  'hamstring-stretch': ['Hamstring_Stretch', 'Étirement des ischio-jambiers'],
  'shoulder-dislocates': [null, 'Dislocations d’épaules au bâton'],
};

/** Manual entries for reference slugs missing from the dataset (no media on purpose). */
const MANUAL = {
  burpee: {
    name_en: 'Burpee',
    category: 'cardio',
    level: 'beginner',
    mechanic: 'compound',
    force: 'push',
    primary_muscles: ['quadriceps', 'chest'],
    secondary_muscles: ['shoulders', 'triceps', 'abdominals'],
    equipment: ['bodyweight'],
  },
  'shoulder-dislocates': {
    name_en: 'Shoulder Dislocates',
    category: 'stretching',
    level: 'beginner',
    mechanic: null,
    force: 'static',
    primary_muscles: ['shoulders'],
    secondary_muscles: ['chest'],
    equipment: ['other'],
  },
};

/** Easier / harder variants between reference exercises (shown on the exercise sheet). */
const VARIANTS = {
  'push-up': ['bench-dip', 'chest-dip'],
  'barbell-bench-press': ['dumbbell-bench-press', null],
  'pull-up': ['lat-pulldown', null],
  'barbell-squat': ['goblet-squat', null],
  'goblet-squat': [null, 'barbell-squat'],
  'bulgarian-split-squat': ['walking-lunge', null],
  'romanian-deadlift': [null, 'deadlift'],
  plank: [null, 'ab-wheel-rollout'],
  crunch: [null, 'hanging-leg-raise'],
  'inverted-row': [null, 'pull-up'],
};

const EQUIPMENT = {
  'body only': 'bodyweight',
  'e-z curl bar': 'ez-bar',
  kettlebells: 'kettlebell',
  'medicine ball': 'medicine-ball',
  'exercise ball': 'exercise-ball',
  'foam roll': 'foam-roller',
};

const LEVEL = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced' };

/** "Barbell_Bench_Press_-_Medium_Grip" → "barbell-bench-press-medium-grip" */
export function slugify(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const muscle = (m) => m.replace(/\s+/g, '-'); // "lower back" → "lower-back"

const sqlText = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const sqlArray = (arr) =>
  arr.length ? `array[${arr.map(sqlText).join(', ')}]::text[]` : `'{}'::text[]`;

async function main() {
  const res = await fetch(`${BASE}/dist/exercises.json`);
  if (!res.ok) throw new Error(`free-exercise-db download failed: HTTP ${res.status}`);
  /** @type {Array<Record<string, any>>} */
  const dataset = await res.json();
  const byId = new Map(dataset.map((x) => [x.id, x]));

  const rows = new Map(); // slug → row
  const sourceToSlug = new Map();

  // 1. Reference slugs first, so the coach's ids win over auto-generated ones.
  for (const [slug, [sourceId, nameFr]] of Object.entries(REFERENCE)) {
    if (sourceId) {
      const src = byId.get(sourceId);
      if (!src)
        throw new Error(`Reference ${slug} → ${sourceId} not found in dataset (ref ${REF})`);
      rows.set(slug, toRow(slug, src, nameFr));
      sourceToSlug.set(sourceId, slug);
    } else {
      const m = MANUAL[slug];
      rows.set(slug, {
        id: slug,
        name_fr: nameFr,
        ...m,
        instructions_en: [],
        image_urls: [],
        video_search_query: `${m.name_en} proper form tutorial`,
        source: 'custom',
        source_id: null,
        license: null,
      });
    }
  }

  // 2. The rest of the dataset, under slugified ids (skip ones already used as a reference).
  for (const src of dataset) {
    if (sourceToSlug.has(src.id)) continue;
    let slug = slugify(src.id);
    if (rows.has(slug)) slug = `${slug}-fedb`;
    rows.set(slug, toRow(slug, src, null));
  }

  for (const [slug, [easier, harder]] of Object.entries(VARIANTS)) {
    const row = rows.get(slug);
    if (!row) continue;
    row.easier_variant_id = easier;
    row.harder_variant_id = harder;
  }

  writeFileSync(new URL('../supabase/seed.sql', import.meta.url), toSql([...rows.values()]));
  console.log(
    `seed.sql: ${rows.size} exercises (${Object.keys(REFERENCE).length} coach references)`,
  );
}

function toRow(slug, src, nameFr) {
  return {
    id: slug,
    // Non-reference exercises keep their English name until translated (app falls back to name_en).
    name_fr: nameFr ?? src.name,
    name_en: src.name,
    category: src.category,
    level: LEVEL[src.level] ?? 'beginner',
    mechanic: src.mechanic ?? null,
    force: src.force ?? null,
    primary_muscles: src.primaryMuscles.map(muscle),
    secondary_muscles: src.secondaryMuscles.map(muscle),
    equipment: src.equipment ? [EQUIPMENT[src.equipment] ?? src.equipment] : [],
    instructions_en: src.instructions,
    image_urls: src.images.map((p) => `${BASE}/exercises/${p}`),
    video_search_query: `${src.name} proper form tutorial`,
    source: 'free-exercise-db',
    source_id: src.id,
    license: 'Unlicense',
  };
}

const COLUMNS = [
  'id',
  'name_fr',
  'name_en',
  'category',
  'level',
  'mechanic',
  'force',
  'primary_muscles',
  'secondary_muscles',
  'equipment',
  'instructions_en',
  'image_urls',
  'video_search_query',
  'source',
  'source_id',
  'license',
];
const ARRAY_COLUMNS = new Set([
  'primary_muscles',
  'secondary_muscles',
  'equipment',
  'instructions_en',
  'image_urls',
]);

function toSql(rows) {
  const values = rows
    .map(
      (r) =>
        `  (${COLUMNS.map((c) => (ARRAY_COLUMNS.has(c) ? sqlArray(r[c] ?? []) : c === 'level' ? `${sqlText(r[c])}::public.fitness_level` : sqlText(r[c]))).join(', ')})`,
    )
    .join(',\n');
  const update = COLUMNS.filter((c) => c !== 'id' && c !== 'name_fr')
    .map((c) => `${c} = excluded.${c}`)
    .join(',\n  ');
  const variants = rows
    .filter((r) => r.easier_variant_id || r.harder_variant_id)
    .map(
      (r) =>
        `update public.exercises set easier_variant_id = ${sqlText(r.easier_variant_id)}, harder_variant_id = ${sqlText(r.harder_variant_id)} where id = ${sqlText(r.id)};`,
    )
    .join('\n');

  return `-- AUTO-GENERATED by scripts/seed-exercises.mjs from free-exercise-db (${REF}). Do not edit by hand.
-- Idempotent: re-running upserts the library without touching user data.
-- name_fr is only overwritten for coach reference exercises, so manual translations survive re-seeding.

insert into public.exercises (${COLUMNS.join(', ')}) values
${values}
on conflict (id) do update set
  ${update},
  name_fr = case when exercises.name_fr = exercises.name_en then excluded.name_fr else exercises.name_fr end;

${variants}
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
