import { createClient } from 'npm:@supabase/supabase-js@2';

import { serverEnv } from './env.ts';

/**
 * Builds a Supabase client that acts as the calling user (their JWT), so every query
 * still goes through Row Level Security. Returns null when the request is unauthenticated.
 */
export async function getUserClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const client = createClient(serverEnv.supabaseUrl(), serverEnv.supabaseAnonKey(), {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, user: data.user };
}
