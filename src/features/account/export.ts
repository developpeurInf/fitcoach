import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/** Tables exported (RLS returns only the user's rows). Photos are listed by path, not embedded. */
const TABLES = [
  'profiles',
  'programs',
  'workouts',
  'workout_exercises',
  'workout_logs',
  'set_logs',
  'personal_records',
  'body_measurements',
  'coach_reports',
  'chat_messages',
  'chat_memory',
] as const;

/** Everything stored about the user, as one JSON document (GDPR, right of access/portability). */
export async function collectUserData(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {
    format: 'fitcoach-export',
    version: 1,
    exported_at: new Date().toISOString(),
  };
  for (const table of TABLES) {
    const rows: unknown[] = [];
    // Page through: PostgREST returns at most 1000 rows per request.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 1000) break;
    }
    out[table] = rows;
  }
  return out;
}

export const exportFileName = (date = new Date()) =>
  `fitcoach-export-${date.toISOString().slice(0, 10)}.json`;

/** Web: downloads the file. Mobile: writes it to the cache and opens the share sheet. */
export async function saveExport(data: Record<string, unknown>) {
  const text = JSON.stringify(data, null, 2);
  const name = exportFileName();
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
}
