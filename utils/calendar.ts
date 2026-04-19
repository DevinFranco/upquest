/**
 * UpQuest – Calendar utility
 * Adds schedule events to the device calendar using expo-calendar.
 * Also supports downloading the .ics file for manual import.
 */

import * as Calendar from 'expo-calendar';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';

// ── Request calendar permissions ──────────────────────────────────────────────

async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// ── Get or create UpQuest calendar ───────────────────────────────────────────

async function getOrCreateCalendar(): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const existing  = calendars.find(c => c.title === 'UpQuest');

  if (existing) return existing.id;

  const defaultCalSource =
    Platform.OS === 'ios'
      ? calendars.find(c => c.source?.name === 'iCloud')?.source
          ?? { isLocalAccount: true, name: 'UpQuest', type: '' }
      : { isLocalAccount: true, name: 'UpQuest', type: '' };

  const calId = await Calendar.createCalendarAsync({
    title:           'UpQuest',
    color:           '#6C63FF',
    entityType:      Calendar.EntityTypes.EVENT,
    sourceDetails:   defaultCalSource as any,
    name:            'UpQuest',
    ownerAccount:    'personal',
    accessLevel:     Calendar.CalendarAccessLevel.OWNER,
  });

  return calId;
}

// ── Add schedule to device calendar ──────────────────────────────────────────

const DAY_OFFSET: Record<string, number> = {
  Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
  Friday: 4, Saturday: 5, Sunday: 6,
};

export async function addToCalendar(
  icalUrl:    string,
  authToken:  string,
  schedule:   any,
): Promise<void> {
  const hasPermission = await requestCalendarPermission();
  if (!hasPermission) {
    Alert.alert(
      'Calendar Permission Required',
      'Please allow UpQuest to access your calendar in Settings.',
    );
    return;
  }

  const calId     = await getOrCreateCalendar();
  const weekStart = schedule.week_start
    ? new Date(schedule.week_start)
    : new Date();

  const days  = schedule.days ?? {};
  let   count = 0;

  for (const [dayName, dayData] of Object.entries(days) as [string, any][]) {
    const offset  = DAY_OFFSET[dayName] ?? 0;
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + offset);

    const slots = dayData.schedule ?? {};

    for (const [timeSlot, activity] of Object.entries(slots) as [string, string][]) {
      try {
        const [hour, minute] = parseTime(timeSlot);
        const startDate = new Date(dayDate);
        startDate.setHours(hour, minute, 0, 0);
        const endDate = new Date(startDate);
        endDate.setMinutes(endDate.getMinutes() + 30);

        await Calendar.createEventAsync(calId, {
          title:     `UpQuest – ${activity.slice(0, 60)}`,
          notes:     activity,
          startDate,
          endDate,
          timeZone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
          alarms:    [{ relativeOffset: 0 }],   // alert fires at start time
        });
        count++;
      } catch { /* skip malformed time slots */ }
    }
  }

  if (count === 0) {
    // Fall back to downloading the .ics
    await downloadIcal(icalUrl, authToken);
  }
}

// ── Download & share iCal ─────────────────────────────────────────────────────

export async function downloadIcal(url: string, token: string): Promise<void> {
  const fileUri = FileSystem.cacheDirectory + 'upquest-schedule.ics';

  const download = await FileSystem.downloadAsync(url, fileUri, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (download.status !== 200) {
    throw new Error('Could not download calendar file.');
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/calendar',
      dialogTitle: 'Add UpQuest Schedule to Calendar',
    });
  } else {
    Alert.alert('Saved', `Calendar file saved to: ${fileUri}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTime(timeStr: string): [number, number] {
  const normalized = timeStr.trim().toUpperCase().replace(' ', '');
  const isPM = normalized.endsWith('PM');
  const cleaned = normalized.replace('AM', '').replace('PM', '');
  const [h, m = '0'] = cleaned.split(':');
  let hour   = parseInt(h, 10);
  const minute = parseInt(m, 10);
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  return [hour, minute];
}
