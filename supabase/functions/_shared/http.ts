import type { SupabaseClient, User } from '@supabase/supabase-js';

import { AiOutputError } from './anthropic.ts';
import { getUserClient } from './auth.ts';
import { corsHeaders, json } from './cors.ts';

export type Ctx = {
  req: Request;
  client: SupabaseClient;
  user: User;
  /** With `lazyQuota`, call this right before the AI call (so cached answers cost no quota). */
  useQuota: () => Promise<void>;
};

/** Error codes the app maps to translated messages. */
export type ErrorCode =
  'unauthorized' | 'rate_limited' | 'ai_invalid_output' | 'bad_request' | 'not_found' | 'internal';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Wraps an AI Edge Function: CORS, authentication (RLS-bound client), per-user quota
 * (consume_ai_quota, upfront unless `lazyQuota`), and uniform JSON errors: { error: { code, message } }.
 */
export function aiHandler(
  functionName: string,
  handler: (ctx: Ctx) => Promise<Response>,
  opts: { lazyQuota?: boolean } = {},
) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'bad_request', 'POST only');
      const auth = await getUserClient(req);
      if (!auth) throw new HttpError(401, 'unauthorized', 'Connexion requise.');

      let consumed = false;
      const useQuota = async () => {
        if (consumed) return;
        consumed = true;
        const { data: allowed, error } = await auth.client.rpc('consume_ai_quota', {
          p_function: functionName,
        });
        if (error) throw error;
        if (!allowed) {
          throw new HttpError(
            429,
            'rate_limited',
            'Tu as atteint la limite d’appels au coach. Réessaie plus tard.',
          );
        }
      };
      if (!opts.lazyQuota) await useQuota();
      return await handler({ req, ...auth, useQuota });
    } catch (e) {
      if (e instanceof HttpError)
        return json({ error: { code: e.code, message: e.message } }, e.status);
      if (e instanceof AiOutputError) {
        return json(
          { error: { code: 'ai_invalid_output', message: e.message, details: e.problems } },
          502,
        );
      }
      console.error(`[${functionName}]`, e);
      return json(
        { error: { code: 'internal', message: 'Erreur interne. Réessaie dans un instant.' } },
        500,
      );
    }
  };
}
