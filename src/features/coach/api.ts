import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { localDate } from '@/features/program/api';
import { callFunction, FunctionError } from '@/lib/functions';
import { streamFunction } from '@/lib/stream';
import { supabase } from '@/lib/supabase';
import type { ChatMessage, CoachReport } from '@/types/models';

import type { PeriodicType } from '@coach/reports';

export const coachKeys = {
  reports: ['coach', 'reports'] as const,
  report: (id: string) => ['coach', 'report', id] as const,
  sessionReport: (logId: string) => ['coach', 'session-report', logId] as const,
  messages: ['coach', 'messages'] as const,
};

type ReportResponse = { report: CoachReport };

export function useReports() {
  return useQuery({
    queryKey: coachKeys.reports,
    queryFn: async (): Promise<CoachReport[]> => {
      const { data, error } = await supabase
        .from('coach_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: coachKeys.report(id),
    queryFn: async (): Promise<CoachReport> => {
      const { data, error } = await supabase
        .from('coach_reports')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/** Report after a session: generated on first request, cached by the server afterwards. */
export function useSessionReport(logId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: coachKeys.sessionReport(logId ?? ''),
    enabled: !!logId,
    retry: (count, e) => count < 1 && !(e instanceof FunctionError && e.code === 'rate_limited'),
    staleTime: Infinity,
    queryFn: async () => {
      const res = await callFunction<ReportResponse>('session-feedback', { log_id: logId });
      void queryClient.invalidateQueries({ queryKey: coachKeys.reports });
      return res.report;
    },
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: PeriodicType) =>
      callFunction<ReportResponse>('periodic-report', { type, today: localDate() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: coachKeys.reports }),
  });
}

/** Weekly adaptation; the server returns the existing one if the week was already adjusted. */
export function useAdaptWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => callFunction<ReportResponse>('adapt-week', { today: localDate() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: coachKeys.reports });
      void queryClient.invalidateQueries({ queryKey: ['program'] });
      void queryClient.invalidateQueries({ queryKey: ['workout'] });
    },
  });
}

export function useChatMessages() {
  return useQuery({
    queryKey: coachKeys.messages,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return data.reverse();
    },
  });
}

/**
 * Sends a chat message and streams the reply. While streaming, `pending` holds the user's message
 * and the reply so far; once done, the saved history is refetched.
 */
export function useChat({ inSession = false } = {}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<{ question: string; answer: string } | null>(null);
  const [error, setError] = useState<FunctionError | null>(null);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || abort.current) return;
      setError(null);
      setPending({ question: text, answer: '' });
      abort.current = new AbortController();
      try {
        await streamFunction(
          'chat',
          { message: text, in_session: inSession, today: localDate() },
          (event, data) => {
            if (event === 'delta') {
              const delta = (data as { text: string }).text;
              setPending((p) => (p ? { ...p, answer: p.answer + delta } : p));
            } else if (event === 'error') {
              const d = data as { code: FunctionError['code']; message: string };
              setError(new FunctionError(d.code, d.message));
            }
          },
          abort.current.signal,
        );
      } catch (e) {
        setError(e instanceof FunctionError ? e : new FunctionError('network', String(e)));
      } finally {
        abort.current = null;
        await queryClient.invalidateQueries({ queryKey: coachKeys.messages });
        setPending(null);
      }
    },
    [inSession, queryClient],
  );

  return { send, pending, error, streaming: pending !== null };
}
