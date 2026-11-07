// Dynamic context added to coach calls (context §13): profile, summarised recent sessions,
// latest measurements. Built with the user's client, so RLS limits it to their own data.
import type { SupabaseClient } from '@supabase/supabase-js';

import { profileForCoach } from './profile-context.ts';

export async function loadCoachContext(client: SupabaseClient, userId: string, sessions = 10) {
  const [profile, history, measurement] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).single(),
    client.rpc('coach_history', { p_limit: sessions }),
    client
      .from('body_measurements')
      .select('measured_on, weight_kg, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm, body_fat_pct')
      .order('measured_on', { ascending: false })
      .limit(2),
  ]);
  if (profile.error) throw profile.error;
  if (history.error) throw history.error;
  if (measurement.error) throw measurement.error;
  return {
    profileRow: profile.data,
    profile: profileForCoach(profile.data),
    history: (history.data ?? []) as HistoryEntry[],
    measurements: measurement.data.map((m) =>
      Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)),
    ),
  };
}

export type HistoryEntry = {
  log_id: string;
  date: string;
  seance?: string;
  exercices: { exercise_id: string; nom: string }[];
} & Record<string, unknown>;

/** Days since the last logged session (null when there is none). */
export function daysSinceLastSession(history: HistoryEntry[], today: string): number | null {
  const last = history[0]?.date;
  if (!last) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 864e5);
}

/** Server "today" in the user's calendar when the app sends it (±36 h), else UTC. */
export function resolveToday(requested: unknown): string {
  const server = new Date();
  if (typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    const diff = Math.abs(Date.parse(`${requested}T12:00:00Z`) - server.getTime());
    if (diff < 36 * 3600 * 1000) return requested;
  }
  return server.toISOString().slice(0, 10);
}
