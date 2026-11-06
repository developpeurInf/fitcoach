import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/** Error codes returned by our Edge Functions (see supabase/functions/_shared/http.ts). */
export type FunctionErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'ai_invalid_output'
  | 'bad_request'
  | 'not_found'
  | 'internal'
  | 'network';

export class FunctionError extends Error {
  constructor(
    readonly code: FunctionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Calls an Edge Function and turns its JSON error body into a typed FunctionError. */
export async function callFunction<T>(name: string, body: object = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as {
      error?: { code?: FunctionErrorCode; message?: string };
    } | null;
    throw new FunctionError(
      payload?.error?.code ?? 'internal',
      payload?.error?.message ?? error.message,
    );
  }
  throw new FunctionError('network', error.message);
}
