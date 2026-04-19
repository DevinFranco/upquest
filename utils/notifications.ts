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
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
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

const MAX_NOTIFICATIONS = 60; // iOS hard limit is 64; leave buffer for check-in etc.

export async function scheduleNotificationsFromPlan(
  notifications: NotificationDef[],
  schedule?: any,   // full schedule object (with .days) for per-activity alerts
): Promise<void> {
  // Cancel all previously scheduled UpQuest notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  let count = 0;

  // ── 1. Schedule AI-defined key reminders (e.g. Morning Wake-Up) ────────────
  for (const notif of notifications) {
    if (count >= MAX_NOTIFICATIONS) break;
    const [hour, minute] = parseTime(notif.time);

    for (const dayName of notif.days) {
      if (count >= MAX_NOTIFICATIONS) break;
      const weekday = DAY_MAP[dayName];
      if (weekday === undefined) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚡ ${notif.label}`,
          body:  notif.message,
          sound: true,
          data:  { type: 'routine', label: notif.label, screen: 'Schedule', scheduleId: 'current' },
        },
        trigger: {
          weekday: weekday + 1, // Expo: 1=Sun, 2=Mon, ..., 7=Sat
          hour,
          minute,
          repeats: true,
          channelId: Platform.OS === 'android' ? 'upquest' : undefined,
        } as any,
      });
      count++;
    }
  }

  // ── 2. Schedule a notification for every activity time slot in the quest ────
  if (schedule?.days) {
    // Track already-scheduled day+time combos so we don't double-fire
    const scheduled = new Set(
      notifications.flatMap(n => n.days.map(d => `${d}|${n.time}`))
    );

    for (const [dayName, dayData] of Object.entries(schedule.days) as [string, any][]) {
      if (count >= MAX_NOTIFICATIONS) break;
      const weekday = DAY_MAP[dayName];
      if (weekday === undefined) continue;

      const slots = (dayData as any).schedule ?? {};
      for (const [timeSlot, activity] of Object.entries(slots) as [string, string][]) {
        if (count >= MAX_NOTIFICATIONS) break;
        const key = `${dayName}|${timeSlot}`;
        if (scheduled.has(key)) continue; // already covered by AI reminders
        scheduled.add(key);

        try {
          const [hour, minute] = parseTime(timeSlot);
          const body = String(activity).trim().slice(0, 100);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `⚡ Quest — ${timeSlot}`,
              body,
              sound: true,
              data:  { type: 'routine', screen: 'Schedule', scheduleId: 'current' },
            },
            trigger: {
              weekday: weekday + 1,
              hour,
              minute,
              repeats: true,
              channelId: Platform.OS === 'android' ? 'upquest' : undefined,
            } as any,
          });
          count++;
        } catch { /* skip malformed time slots */ }
      }
    }
  }
}

// ── Schedule weekly check-in reminder ────────────────────────────────────────

/**
 * Schedules a repeating Sunday evening notification reminding the user
 * to do their weekly check-in. Replaces any previously scheduled check-in reminder.
 */
export async function scheduleWeeklyCheckInReminder(
  hour = 18,
  minute = 0,
): Promise<void> {
  if (!Device.isDevice) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Cancel any existing check-in reminders
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === 'weekly_checkin') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚡ Weekly check-in time',
      body: 'Update your routine for the week ahead — takes 5 minutes.',
      sound: true,
      data: { type: 'weekly_checkin', screen: 'WeeklyCheckIn' },
    },
    trigger: {
      weekday: 1, // Sunday (Expo: 1=Sun)
      hour,
      minute,
      repeats: true,
      channelId: Platform.OS === 'android' ? 'upquest' : undefined,
    } as any,
  });
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
