import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  TextInput,
  View,
} from 'react-native';

import { Notice, Text } from '@/components/ui';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

import { useChat, useChatMessages } from './api';

type Props = {
  /** During a session: short answers, fewer messages shown, session suggestions. */
  inSession?: boolean;
  /** Rendered inside a scrolling sheet: no own scroll view. */
  embedded?: boolean;
};

/** Conversation with the coach: history, streamed reply, suggestions, input. */
export function ChatView({ inSession = false, embedded = false }: Props) {
  const { t } = useTranslation();
  const scale = useSettings((s) => s.fontScale);
  const messages = useChatMessages();
  const chat = useChat({ inSession });
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  const history = (messages.data ?? []).slice(embedded ? -4 : 0);
  const suggestions = t(inSession ? 'coach.chat.sessionSuggestions' : 'coach.chat.suggestions', {
    returnObjects: true,
  }) as string[];

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [history.length, chat.pending?.answer]);

  const send = (text: string) => {
    if (!text.trim() || chat.streaming) return;
    setDraft('');
    void chat.send(text);
  };

  const body = (
    <View className="gap-3">
      {messages.isPending ? <ActivityIndicator color={colors.accent.DEFAULT} /> : null}
      {history.length === 0 && !chat.pending && !messages.isPending ? (
        <View className="gap-2 py-4">
          <Text variant="heading">{t('coach.emptyTitle')}</Text>
          <Text variant="caption">{t('coach.emptyBody')}</Text>
        </View>
      ) : null}
      {history.map((m) => (
        <Bubble key={m.id} role={m.role} text={m.content} />
      ))}
      {chat.pending ? (
        <>
          <Bubble role="user" text={chat.pending.question} />
          {chat.pending.answer ? (
            <Bubble role="assistant" text={chat.pending.answer} />
          ) : (
            <Text variant="caption" accessibilityLiveRegion="polite">
              {t('coach.chat.typing')}
            </Text>
          )}
        </>
      ) : null}
      {chat.error ? (
        <Notice tone="danger">
          {chat.error.code === 'rate_limited'
            ? t('coach.chat.rateLimited')
            : chat.error.message || t('coach.chat.error')}
        </Notice>
      ) : null}
    </View>
  );

  return (
    <View className={embedded ? 'gap-3' : 'flex-1 gap-3'}>
      {embedded ? (
        body
      ) : (
        <ScrollView
          ref={scroll}
          className="flex-1"
          contentContainerClassName="pb-2"
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      )}
      {!chat.streaming && (history.length === 0 || inSession) ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => send(s)}
              accessibilityRole="button"
              className="min-h-12 justify-center rounded-2xl border border-ink-300 px-4 active:opacity-70 dark:border-ink-700"
            >
              <Text variant="caption" className="font-semibold">
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View className="flex-row items-end gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('coach.chat.placeholder')}
          placeholderTextColor={colors.ink[500]}
          accessibilityLabel={t('coach.chat.placeholder')}
          multiline
          maxLength={2000}
          onSubmitEditing={() => send(draft)}
          className="max-h-32 min-h-12 flex-1 rounded-2xl border border-ink-300 bg-white px-4 py-3 text-ink-950 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
          style={{ fontSize: 16 * scale }}
        />
        <Pressable
          onPress={() => send(draft)}
          disabled={!draft.trim() || chat.streaming}
          accessibilityRole="button"
          accessibilityLabel={t('coach.chat.send')}
          accessibilityState={{ disabled: !draft.trim() || chat.streaming }}
          className={`h-12 w-12 items-center justify-center rounded-2xl bg-accent ${
            !draft.trim() || chat.streaming ? 'opacity-50' : ''
          }`}
        >
          {chat.streaming ? (
            <ActivityIndicator color={colors.accent.foreground} />
          ) : (
            <Ionicons name="arrow-up" size={22} color={colors.accent.foreground} />
          )}
        </Pressable>
      </View>
      <Text variant="caption" className="text-center">
        {t('coach.chat.disclaimer')}
      </Text>
    </View>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const { t } = useTranslation();
  const mine = role === 'user';
  return (
    <View
      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        mine ? 'self-end bg-accent' : 'self-start bg-white dark:bg-ink-900'
      }`}
      accessible
      accessibilityLabel={`${mine ? t('coach.chat.you') : t('coach.chat.coach')} : ${text}`}
    >
      <Text style={mine ? { color: colors.accent.foreground } : undefined}>{text}</Text>
    </View>
  );
}
