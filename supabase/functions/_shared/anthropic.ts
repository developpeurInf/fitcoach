import Anthropic from 'npm:@anthropic-ai/sdk';

import { COACH_SYSTEM_PROMPT } from './coach-context.ts';
import { serverEnv } from './env.ts';

let client: Anthropic | null = null;

/** Lazily created so a missing key fails the request, not the function boot. */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey() });
  return client;
}

/**
 * The coach context file is sent as the system prompt on every call.
 * It is marked for prompt caching since it is large and identical across requests.
 */
export const coachSystem = [
  { type: 'text' as const, text: COACH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
];

export const model = () => serverEnv.claudeModel();
