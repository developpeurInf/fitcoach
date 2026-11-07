// Server-only secrets. Set them with `supabase secrets set` (prod) or supabase/functions/.env (local).
function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const serverEnv = {
  anthropicApiKey: () => required('ANTHROPIC_API_KEY'),
  // Latest Sonnet by default; override without redeploying code via the CLAUDE_MODEL secret.
  claudeModel: () => Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5-5',
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseAnonKey: () => required('SUPABASE_ANON_KEY'),
  // Provided automatically to hosted Edge Functions. Only used to write what users must not forge
  // (coach reports, the coach's chat replies), always for the authenticated user's own id.
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),
};
