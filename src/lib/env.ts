import { z } from 'zod';

/**
 * Public (client-side) environment. Only EXPO_PUBLIC_* values are bundled into the app,
 * so nothing secret may ever live here: the Anthropic key stays in Supabase Edge Function secrets.
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so each key must be read literally.
 */
const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  throw new Error(
    'Variables d’environnement manquantes : copie .env.example vers .env et renseigne ' +
      'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const env = parsed.data;
