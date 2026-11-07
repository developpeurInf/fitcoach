import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useActiveProgram, useProgramWorkouts } from '@/features/program/api';
import {
  clearWorkoutReminders,
  notificationsSupported,
  setWorkoutReminders,
} from '@/lib/notifications';
import { useSettings } from '@/stores/settings';

import { reminderSlots } from './logic';

/**
 * Keeps the local session reminders in line with the program (after generation, an adaptation
 * or a session) and the settings. Mounted once in the tabs layout.
 */
export function useWorkoutReminders() {
  const { t } = useTranslation();
  const enabled = useSettings((s) => s.reminders);
  const time = useSettings((s) => s.reminderTime);
  const program = useActiveProgram();
  const workouts = useProgramWorkouts(program.data?.id);

  useEffect(() => {
    if (!notificationsSupported) return;
    if (!enabled || !workouts.data) {
      if (!enabled) void clearWorkoutReminders();
      return;
    }
    const slots = reminderSlots(workouts.data, time, new Date()).map((s) => ({
      ...s,
      title: t('reminders.workoutTitle'),
      body: t('reminders.workoutBody', { title: s.title }),
    }));
    void setWorkoutReminders(slots);
  }, [enabled, time, workouts.data, t]);
}

/** Responses already handled during this app run (the "last response" survives remounts). */
const handled = new Set<string>();

/** Opens the session of a tapped reminder (also when the tap launched the app). */
export function useNotificationNavigation() {
  useEffect(() => {
    if (!notificationsSupported) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const key = `${r.notification.request.identifier}:${r.notification.date}`;
      if (handled.has(key)) return;
      handled.add(key);
      const url = (r.notification.request.content.data as { url?: string } | undefined)?.url;
      if (url?.startsWith('/workout/')) {
        router.push({ pathname: '/workout/[id]', params: { id: url.slice('/workout/'.length) } });
      }
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
