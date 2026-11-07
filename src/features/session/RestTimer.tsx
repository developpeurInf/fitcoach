import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Vibration, View } from 'react-native';

import { ProgressBar, Text } from '@/components/ui';
import { cancelNotification, scheduleRestEnd } from '@/lib/notifications';
import { colors } from '@/theme/tokens';

import { formatClock, restSecondsLeft } from './logic';
import { useSession } from './store';

// Short synthesized beep (assets/sounds/rest-done.wav, generated for the app: no third-party audio).
const BEEP = require('../../../assets/sounds/rest-done.wav');

/**
 * Rest countdown shown after each set. The end time is stored, not a counter, so it stays right
 * if the app was in the background. At 0: vibration + haptic + sound.
 */
export function RestTimer() {
  const { t } = useTranslation();
  const restEndsAt = useSession((s) => s.active?.restEndsAt ?? null);
  const total = useSession((s) => s.active?.restTotalSec ?? 0);
  const addRest = useSession((s) => s.addRest);
  const skipRest = useSession((s) => s.skipRest);
  const player = useAudioPlayer(BEEP);
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (restEndsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  const left = restSecondsLeft(restEndsAt, now);

  // If the app goes to the background, the end of the rest still rings (mobile app).
  useEffect(() => {
    if (restEndsAt == null) return;
    let id: string | null = null;
    let cancelled = false;
    void scheduleRestEnd(restEndsAt, t('session.rest.done'), t('reminders.restBody')).then((n) => {
      if (cancelled && n) void cancelNotification(n);
      else id = n;
    });
    return () => {
      cancelled = true;
      if (id) void cancelNotification(id);
    };
  }, [restEndsAt, t]);

  useEffect(() => {
    if (restEndsAt == null || left > 0 || firedFor.current === restEndsAt) return;
    firedFor.current = restEndsAt;
    Vibration.vibrate(Platform.OS === 'android' ? [0, 400, 200, 400] : 400);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    try {
      void player.seekTo(0);
      player.play();
    } catch {
      // Sound is a bonus: vibration already signalled the end of the rest.
    }
    const id = setTimeout(skipRest, 2500);
    return () => clearTimeout(id);
  }, [left, restEndsAt, player, skipRest]);

  if (restEndsAt == null) return null;
  const finished = left === 0;

  return (
    <View
      className="gap-3 rounded-3xl border border-accent bg-white p-4 dark:bg-ink-900"
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        finished ? t('session.rest.done') : t('session.rest.label', { time: formatClock(left) })
      }
    >
      <View className="flex-row items-center justify-between">
        <Text variant="caption" className="font-semibold uppercase tracking-wide">
          {t('session.rest.title')}
        </Text>
        <Text
          variant="title"
          style={{ fontSize: 44, lineHeight: 52, fontVariant: ['tabular-nums'] }}
        >
          {finished ? t('session.rest.done') : formatClock(left)}
        </Text>
      </View>
      <ProgressBar value={total > 0 ? 1 - left / total : 1} />
      {!finished ? (
        <View className="flex-row gap-2">
          <RestButton label={t('session.rest.minus')} onPress={() => addRest(-15)} />
          <RestButton label={t('session.rest.plus')} onPress={() => addRest(15)} />
          <RestButton label={t('session.rest.skip')} onPress={skipRest} primary />
        </View>
      ) : null}
    </View>
  );
}

function RestButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`min-h-12 flex-1 items-center justify-center rounded-2xl active:opacity-70 ${
        primary ? 'bg-accent' : 'bg-ink-100 dark:bg-ink-800'
      }`}
    >
      <Text className="font-bold" style={primary ? { color: colors.accent.foreground } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}
