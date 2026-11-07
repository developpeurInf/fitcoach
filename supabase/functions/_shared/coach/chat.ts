// Chat helpers shared by the chat Edge Function and the app tests. No dependencies.

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

/** Messages kept verbatim in each call; older ones live in the rolling summary. */
export const RECENT_MESSAGES = 20;
/** Unsummarised messages that trigger a new summary of everything but the recent ones. */
export const SUMMARIZE_AFTER = 40;

/**
 * The Messages API wants alternating turns starting with the user. Stored history can break that
 * (a failed reply leaves two user messages in a row), so consecutive turns of the same role are
 * merged and leading assistant turns dropped.
 */
export function toAlternating(turns: ChatTurn[]): ChatTurn[] {
  const out: ChatTurn[] = [];
  for (const t of turns) {
    const text = t.content.trim();
    if (!text) continue;
    const last = out.at(-1);
    if (!last && t.role === 'assistant') continue;
    if (last?.role === t.role) last.content += `\n\n${text}`;
    else out.push({ role: t.role, content: text });
  }
  return out;
}

/** Server-sent event frame. */
export const sse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** Parses the frames of a text/event-stream buffer; returns the frames and the unfinished rest. */
export function parseSse(buffer: string): {
  events: { event: string; data: unknown }[];
  rest: string;
} {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const events = parts.flatMap((frame) => {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return [];
    try {
      return [{ event, data: JSON.parse(data) as unknown }];
    } catch {
      return [];
    }
  });
  return { events, rest };
}
