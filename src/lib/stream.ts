import { fetch } from 'expo/fetch';

import { parseSse } from '@coach/chat';

import { env } from './env';
import { FunctionError, type FunctionErrorCode } from './functions';
import { supabase } from './supabase';

/**
 * Calls a streaming Edge Function (server-sent events) and hands each event to `onEvent`.
 * expo/fetch streams response bodies on iOS, Android and web alike (the global fetch of React
 * Native doesn't). Errors before the stream starts become a FunctionError, like callFunction.
 */
export async function streamFunction(
  name: string,
  body: object,
  onEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FunctionError('unauthorized', 'Connexion requise.');

  let response: Response;
  try {
    response = (await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal,
    })) as unknown as Response;
  } catch (e) {
    throw new FunctionError('network', e instanceof Error ? e.message : String(e));
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: FunctionErrorCode; message?: string };
    } | null;
    throw new FunctionError(
      payload?.error?.code ?? 'internal',
      payload?.error?.message ?? `HTTP ${response.status}`,
    );
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSse(buffer);
    buffer = rest;
    for (const e of events) onEvent(e.event, e.data);
  }
  const { events } = parseSse(`${buffer}\n\n`);
  for (const e of events) onEvent(e.event, e.data);
}
