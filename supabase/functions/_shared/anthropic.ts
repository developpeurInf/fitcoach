import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

import { COACH_SYSTEM_PROMPT } from './coach-context.ts';
import { serverEnv } from './env.ts';

let client: Anthropic | null = null;

/** Lazily created so a missing key fails the request, not the function boot. */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey(), maxRetries: 2 });
  return client;
}

/**
 * The coach context file is the system prompt of every call. It is large and identical across
 * requests, so it carries a cache breakpoint: later calls read it from the prompt cache.
 */
export const coachSystem: Anthropic.Beta.BetaTextBlockParam[] = [
  { type: 'text', text: COACH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
];

/**
 * Models that accept the server-side refusal fallback (`fallbacks: "default"`). If a safety
 * classifier declines a legitimate fitness request, the API re-runs it on a fallback model
 * inside the same call instead of failing.
 */
const FALLBACK_MODELS = [
  'claude-sonnet-5-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-fable-5-1',
];

/** Common request fields: model from CLAUDE_MODEL, cached coach system prompt, fallback when supported. */
export function baseRequest() {
  const model = serverEnv.claudeModel();
  const fallback = FALLBACK_MODELS.includes(model);
  return {
    model,
    system: coachSystem,
    ...(fallback
      ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
      : {}),
  };
}

/** Thrown when the model output still fails validation after the retry. */
export class AiOutputError extends Error {
  constructor(
    message: string,
    readonly problems: string[],
  ) {
    super(message);
  }
}

type StructuredOptions<S extends z.ZodType> = {
  schema: S;
  /** The request, in French; the user profile and history are embedded by the caller. */
  prompt: string;
  /** Extra business checks (unknown exercise ids, wrong number of weeks…). Returns problems. */
  check?: (data: z.infer<S>) => string[];
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high';
};

/**
 * One structured call to the coach:
 * 1. the JSON schema is enforced by the API (structured outputs);
 * 2. the result is re-validated with Zod (incl. constraints the API doesn't enforce) and `check`;
 * 3. on failure, one retry that shows the model its previous answer and the problems;
 * 4. after that, AiOutputError so the function can return a clear error.
 */
export async function generateStructured<S extends z.ZodType>(opts: StructuredOptions<S>) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: opts.prompt }];
  let problems: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Streamed so a long program doesn't hit HTTP timeouts; we only need the final message.
    const message = await anthropic()
      .beta.messages.stream({
        ...baseRequest(),
        max_tokens: opts.maxTokens ?? 32000,
        output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort ?? 'medium' },
        messages,
      })
      .finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new AiOutputError('Le coach a refusé de répondre à cette demande.', ['refusal']);
    }

    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    problems = validate(opts, text, message.stop_reason);
    if (problems.length === 0) {
      return {
        data: opts.schema.parse(JSON.parse(text)) as z.infer<S>,
        usage: message.usage,
        model: message.model,
      };
    }

    console.warn(`[ai] attempt ${attempt} invalid`, problems);
    messages.push(
      { role: 'assistant', content: text || '(réponse vide)' },
      {
        role: 'user',
        content:
          'Ta réponse ne respecte pas les contraintes :\n- ' +
          problems.join('\n- ') +
          '\nRenvoie le JSON complet corrigé, uniquement en JSON valide.',
      },
    );
  }
  throw new AiOutputError('La réponse du coach est invalide après un nouvel essai.', problems);
}

function validate<S extends z.ZodType>(
  opts: StructuredOptions<S>,
  text: string,
  stop: string | null,
): string[] {
  if (stop === 'max_tokens') return ['La réponse a été coupée (trop longue) : sois plus concis.'];
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return ['La réponse n’est pas du JSON valide.'];
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    return parsed.error.issues
      .slice(0, 15)
      .map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`);
  }
  return opts.check?.(parsed.data) ?? [];
}
