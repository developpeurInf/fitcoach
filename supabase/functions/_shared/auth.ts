import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

let admin: SupabaseClient | null = null;

/**
 * Service-role client (bypasses RLS). Only for rows users can read but not write: coach reports,
 * the coach's chat replies and chat memory. Callers always set user_id from the verified JWT.
 */
export function adminClient(): SupabaseClient {
  admin ??= createClient(serverEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
