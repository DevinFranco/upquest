/**
 * UpQuest – Expo Notifications utility
 * Requests permissions, schedules daily reminders from the AI plan.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

// ── Init & Permission ─────────────────────────────────────────────────────────

export async function initNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('upquest', {
      name:        'UpQuest Reminders',
      importance:  Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}


// ── Schedule notifications from AI plan ──────────────────────────────────────

interface NotificationDef {
  label:   string;
  time:    string;    // e.g. "6:00 AM"
  days:    string[];  // e.g. ["Monday", "Tuesday", ...]
  message: string;
}

export async function scheduleNotificationsFromPlan(
  notifications: NotificationDef[],
): Promise<void> {
  // Cancel previous UpQuest notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const notif of notifications) {
    const [hour, minute] = parseTime(notif.time);

    for (const dayName of notif.days) {
      const weekday = DAY_MAP[dayName];
      if (weekday === undefined) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `UpQuest – ${notif.label}`,
          body:  notif.message,
          sound: true,
          data:  { type: 'routine', label: notif.label },
        },
        trigger: {
          weekday: weekday + 1, // Expo uses 1=Sun, 2=Mon, ..., 7=Sat
          hour,
          minute,
          repeats: true,
          channelId: Platform.OS === 'android' ? 'upquest' : undefined,
        } as any,
      });
    }
  }
}

// ── Cancel all ────────────────────────────────────────────────────────────────

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTime(timeStr: string): [number, number] {
  const normalized = timeStr.trim().toUpperCase().replace(' ', '');
  const isPM = normalized.endsWith('PM');
  const isAM = normalized.endsWith('AM');
  const cleaned = normalized.replace('AM', '').replace('PM', '');
  const [h, m = '0'] = cleaned.split(':');
  let hour = parseInt(h, 10);
  const minute = parseInt(m, 10);

  if (isPM && hour !== 12) hour += 12;
  if (isAM && hour === 12) hour = 0;

  return [hour, minute];
}
