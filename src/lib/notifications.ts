import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Local notifications only exist in the iOS / Android apps (not on the web). */
export const notificationsSupported = Platform.OS !== 'web';

type Kind = 'workout' | 'rest';

if (notificationsSupported) {
  // In the foreground the rest timer already beeps and vibrates: only workout reminders show.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const show = (n.request.content.data as { kind?: Kind } | undefined)?.kind !== 'rest';
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function cancelKind(kind: Kind) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { kind?: Kind } | undefined)?.kind === kind)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Replaces every workout reminder with the given ones. */
export async function setWorkoutReminders(
  slots: { workoutId: string; title: string; body: string; at: Date }[],
) {
  if (!notificationsSupported) return;
  await cancelKind('workout');
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  for (const s of slots) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: s.title,
        body: s.body,
        data: { kind: 'workout', url: `/workout/${s.workoutId}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: s.at },
    });
  }
}

export const clearWorkoutReminders = () =>
  notificationsSupported ? cancelKind('workout') : Promise.resolve();

/** End-of-rest notification, for when the app is in the background. Returns its id. */
export async function scheduleRestEnd(
  at: number,
  title: string,
  body: string,
): Promise<string | null> {
  if (!notificationsSupported) return null;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted || at <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { kind: 'rest' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
  });
}

export const cancelNotification = (id: string) =>
  notificationsSupported ? Notifications.cancelScheduledNotificationAsync(id) : Promise.resolve();
