// chat: conversation with the coach, streamed (server-sent events).
// POST { message, in_session?, today? } → text/event-stream:
//   event: delta { text }   (as the coach writes)
//   event: done  { id }     (assistant message saved)
//   event: error { code, message }
// Context sent each call (context §13): profile, 5 last sessions (summarised), latest
// measurements, the plan of the day, a rolling memory of older messages and the 20 latest ones.
import { z } from 'zod';

import { anthropic, baseRequest, coachSystem } from '../_shared/anthropic.ts';
import { adminClient } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  type ChatTurn,
  RECENT_MESSAGES,
  SUMMARIZE_AFTER,
  sse,
  toAlternating,
} from '../_shared/coach/chat.ts';
import { loadCoachContext, resolveToday } from '../_shared/coach/context.ts';
import { aiHandler, HttpError } from '../_shared/http.ts';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  in_session: z.boolean().optional(),
  today: z.string().optional(),
});

Deno.serve(
  aiHandler('chat', async ({ req, client, user }) => {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, 'bad_request', 'Message invalide.');
    const { message, in_session: inSession = false } = parsed.data;
    const today = resolveToday(parsed.data.today);

    // The user's message is saved with their own client (RLS: role 'user' only).
    const { error: insertError } = await client
      .from('chat_messages')
      .insert({ user_id: user.id, role: 'user', content: message });
    if (insertError) throw insertError;

    const [ctx, memory, recent, plan] = await Promise.all([
      loadCoachContext(client, user.id, 5),
      client.from('chat_memory').select('summary, summarized_until').maybeSingle(),
      client
        .from('chat_messages')
        .select('role, content, created_at')
        .order('created_at', { ascending: false })
        .limit(RECENT_MESSAGES),
      client
        .from('workouts')
        .select(
          'title, scheduled_date, status, week_type, workout_exercises(exercise_id, sets, reps, suggested_load_kg, rest_sec)',
        )
        .gte('scheduled_date', today)
        .order('scheduled_date')
        .limit(2),
    ]);
    if (recent.error) throw recent.error;
    const turns = toAlternating((recent.data as ChatTurn[]).reverse());

    const context = `Contexte de l'utilisateur (données de l'app, aujourd'hui ${today}) :
Profil : ${JSON.stringify(ctx.profile)}
Dernières séances (résumé) : ${JSON.stringify(ctx.history)}
Dernières mesures : ${JSON.stringify(ctx.measurements)}
Prochaines séances prévues : ${JSON.stringify(plan.data ?? [])}
${memory.data?.summary ? `Résumé des échanges précédents : ${memory.data.summary}` : ''}

Mode conversation (§8). ${
      inSession
        ? 'L’utilisateur est EN TRAIN de s’entraîner : réponds en 1 à 2 phrases maximum, sans détour (§10).'
        : 'Réponses courtes et concrètes, pas de longs paragraphes (§10).'
    }`;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(sse(event, data)));
        let text = '';
        try {
          const response = anthropic().beta.messages.stream({
            ...baseRequest(),
            system: [...coachSystem, { type: 'text', text: context }],
            max_tokens: inSession ? 400 : 1500,
            output_config: { effort: inSession ? 'low' : 'medium' },
            messages: turns,
          });
          response.on('text', (delta) => {
            text += delta;
            send('delta', { text: delta });
          });
          const final = await response.finalMessage();
          if (final.stop_reason === 'refusal' || !text.trim()) {
            send('error', {
              code: 'ai_invalid_output',
              message: 'Le coach n’a pas pu répondre. Reformule ta question.',
            });
            return;
          }
          const { data: saved, error } = await adminClient()
            .from('chat_messages')
            .insert({ user_id: user.id, role: 'assistant', content: text.trim() })
            .select('id')
            .single();
          if (error) throw error;
          send('done', { id: saved.id });
          await summarizeIfNeeded(user.id, memory.data?.summarized_until ?? null);
        } catch (e) {
          console.error('[chat]', e);
          send('error', {
            code: 'internal',
            message: 'Le coach est indisponible. Réessaie dans un instant.',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }),
);

/**
 * Keeps the history cheap: once more than SUMMARIZE_AFTER messages are not covered by the memory,
 * everything except the RECENT_MESSAGES latest is folded into the rolling summary.
 */
async function summarizeIfNeeded(userId: string, summarizedUntil: string | null) {
  const admin = adminClient();
  let query = admin
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (summarizedUntil) query = query.gt('created_at', summarizedUntil);
  const { data, error } = await query;
  if (error || !data || data.length <= SUMMARIZE_AFTER) return;

  const older = data.slice(0, data.length - RECENT_MESSAGES);
  const { data: memory } = await admin
    .from('chat_memory')
    .select('summary')
    .eq('user_id', userId)
    .maybeSingle();
  const message = await anthropic().beta.messages.create({
    ...baseRequest(),
    max_tokens: 800,
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: `Résume en 10 lignes maximum ce qu'il faut retenir de ces échanges pour coacher cet utilisateur (préférences, douleurs, objectifs, contraintes, décisions). Uniquement les faits, en français.

Résumé existant : ${memory?.summary ?? '(aucun)'}

Nouveaux échanges :
${older.map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Coach'} : ${m.content}`).join('\n')}`,
      },
    ],
  });
  const summary = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('')
    .trim()
    .slice(0, 4000);
  if (!summary) return;
  await admin.from('chat_memory').upsert({
    user_id: userId,
    summary,
    summarized_until: older.at(-1)!.created_at,
    updated_at: new Date().toISOString(),
  });
}
