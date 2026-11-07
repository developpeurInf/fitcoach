// Filters of the exercise library and the French words people type when searching. The library
// (free-exercise-db) tags muscles and equipment in English.

export const MUSCLE_GROUPS = {
  chest: ['chest'],
  back: ['lats', 'middle-back', 'lower-back', 'traps'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'],
  core: ['abdominals'],
} as const;
export type MuscleGroup = keyof typeof MUSCLE_GROUPS;

export const EQUIPMENT_FILTERS = {
  bodyweight: ['bodyweight'],
  dumbbell: ['dumbbell'],
  barbell: ['barbell', 'ez-bar'],
  machine: ['machine'],
  cable: ['cable'],
  kettlebell: ['kettlebell'],
  bands: ['bands'],
} as const;
export type EquipmentFilter = keyof typeof EQUIPMENT_FILTERS;

/** French search words → library muscle tags (accents and plural ignored). */
const MUSCLE_WORDS: Record<string, string[]> = {
  pec: ['chest'],
  pecs: ['chest'],
  pectoraux: ['chest'],
  poitrine: ['chest'],
  dos: ['lats', 'middle-back'],
  dorsaux: ['lats'],
  lombaires: ['lower-back'],
  trapezes: ['traps'],
  epaules: ['shoulders'],
  deltoides: ['shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  bras: ['biceps', 'triceps'],
  'avant-bras': ['forearms'],
  quadriceps: ['quadriceps'],
  quadris: ['quadriceps'],
  cuisses: ['quadriceps', 'hamstrings'],
  jambes: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  ischios: ['hamstrings'],
  'ischio-jambiers': ['hamstrings'],
  fessiers: ['glutes'],
  mollets: ['calves'],
  abdos: ['abdominals'],
  abdominaux: ['abdominals'],
  gainage: ['abdominals'],
  adducteurs: ['adductors'],
  abducteurs: ['abductors'],
  cou: ['neck'],
};

/** French equipment words → library equipment tags. */
const EQUIPMENT_WORDS: Record<string, string[]> = {
  haltere: ['dumbbell'],
  halteres: ['dumbbell'],
  barre: ['barbell', 'ez-bar'],
  poulie: ['cable'],
  poulies: ['cable'],
  machine: ['machine'],
  machines: ['machine'],
  kettlebell: ['kettlebell'],
  elastique: ['bands'],
  elastiques: ['bands'],
};

/** Equipment tags of a single search word ("haltères" → dumbbell), or an empty list. */
export function equipmentInWord(word: string): string[] {
  return EQUIPMENT_WORDS[normalize(word)] ?? [];
}

export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Muscle tags matching the French words of a search ("pecs haltères" → chest). */
export function musclesInQuery(query: string): string[] {
  const out = new Set<string>();
  for (const word of normalize(query).split(/\s+/)) {
    const tags =
      MUSCLE_WORDS[word] ?? MUSCLE_WORDS[word.replace(/s$/, '')] ?? MUSCLE_WORDS[`${word}s`];
    tags?.forEach((t) => out.add(t));
  }
  return [...out];
}

/** Text safe inside a PostgREST `ilike` filter: wildcards and filter separators removed. */
export function likeTerm(query: string): string {
  return query
    .toLowerCase()
    .replace(/[%_*,()."'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
