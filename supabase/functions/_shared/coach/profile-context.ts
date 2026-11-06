// Turns a profiles row into the compact JSON the coach expects (context §8.1, French keys).
// Only what the coach needs is sent: no email, no ids beyond the user's own.
type ProfileRow = {
  first_name: string | null;
  birth_year: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  level: string | null;
  main_goal: string | null;
  secondary_goals: string[];
  days_per_week: number | null;
  session_minutes: number | null;
  location: string | null;
  equipment: string[];
  injuries: string[];
  experience: string | null;
};

const LEVEL: Record<string, string> = {
  beginner: 'debutant',
  intermediate: 'intermediaire',
  advanced: 'avance',
};
const SEX: Record<string, string> = { male: 'homme', female: 'femme', other: 'non precise' };
const LOCATION: Record<string, string> = { gym: 'salle', home: 'maison', outdoor: 'exterieur' };

export function profileForCoach(p: ProfileRow, today = new Date()) {
  const injuries = p.injuries.filter((i) => !i.startsWith('condition:'));
  const conditions = p.injuries
    .filter((i) => i.startsWith('condition:'))
    .map((i) => i.slice('condition:'.length));
  return {
    prenom: p.first_name,
    age: p.birth_year ? today.getFullYear() - p.birth_year : null,
    sexe: p.sex ? SEX[p.sex] : null,
    taille_cm: p.height_cm,
    poids_kg: p.weight_kg,
    niveau: p.level ? LEVEL[p.level] : null,
    objectif_principal: p.main_goal,
    objectifs_secondaires: p.secondary_goals,
    jours_dispo_semaine: p.days_per_week,
    duree_seance_min: p.session_minutes,
    lieu: p.location ? LOCATION[p.location] : null,
    materiel: p.equipment,
    blessures: injuries,
    conditions_sante: conditions,
    experience: p.experience,
  };
}
