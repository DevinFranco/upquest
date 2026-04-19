/**
 * UpQuest – Apple Health / HealthKit utility
 *
 * Requires: react-native-health (^1.19.0)
 * Requires: EAS Build (custom dev client) — HealthKit does not work in Expo Go.
 *
 * Apple Watch data flows automatically through HealthKit — no separate Watch
 * app is needed.  Workout sessions, activity rings, heart rate, sleep, and
 * step counts recorded on the Watch are all readable here.
 */

import { Platform } from 'react-native';

let AppleHealthKit: any = null;
let Permissions: any    = null;

try {
  const mod       = require('react-native-health');
  AppleHealthKit  = mod.default ?? mod;
  Permissions     = mod.HealthKitConstants?.Permissions ?? AppleHealthKit?.Constants?.Permissions;
} catch {
  // Module not linked — all functions degrade gracefully
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const HEALTH_CACHE_KEY = 'upquest_health_cache';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealthSnapshot {
  // Activity
  stepsToday:            number | null;
  activeCaloriesToday:   number | null;
  standHoursToday:       number | null;
  exerciseMinutesToday:  number | null;
  // Heart
  restingHeartRate:      number | null;
  latestHRV:             number | null;   // Heart Rate Variability (ms)
  latestVO2Max:          number | null;   // mL/kg/min — from Watch workouts
  latestBloodOxygen:     number | null;   // SpO2 %
  // Body
  latestWeightLbs:       number | null;
  latestBodyFatPct:      number | null;
  latestBMI:             number | null;
  // Sleep
  lastNightSleepHrs:     number | null;
  lastNightDeepSleepHrs: number | null;
  lastNightREMSleepHrs:  number | null;
  // Training load
  workoutsThisWeek:      number;
  avgWorkoutMinutes:     number | null;
  totalActiveCalWeek:    number | null;
}

export interface WorkoutToWrite {
  type:       string;   // e.g. 'TraditionalStrengthTraining'
  startDate:  Date;
  endDate:    Date;
  calories?:  number;
  distance?:  number;   // meters
}

export interface HeartRateZone {
  zone:       1 | 2 | 3 | 4 | 5;
  label:      string;
  minPct:     number;   // % of max HR
  maxPct:     number;
  minutesThisWeek: number;
}

// ── Permission set ────────────────────────────────────────────────────────────

const READ_PERMS = [
  'StepCount', 'DistanceWalkingRunning',
  'ActiveEnergyBurned', 'BasalEnergyBurned',
  'AppleExerciseTime', 'AppleStandTime',
  'HeartRate', 'RestingHeartRate', 'HeartRateVariabilitySDNN',
  'VO2Max', 'OxygenSaturation',
  'BodyMass', 'BodyFatPercentage', 'BodyMassIndex', 'LeanBodyMass',
  'Height', 'DateOfBirth', 'BiologicalSex',
  'SleepAnalysis',
  'BloodPressureSystolic', 'BloodPressureDiastolic',
  'BloodGlucose',
  'Workout',
  'MindfulSession',
];

const WRITE_PERMS = [
  'Workout', 'ActiveEnergyBurned', 'StepCount',
  'BodyMass', 'MindfulSession',
];

let _initialised = false;
let _permitted   = false;

// ── Init ──────────────────────────────────────────────────────────────────────

export function isHealthAvailable(): boolean {
  return Platform.OS === 'ios' && !!AppleHealthKit;
}

export async function initHealthKit(): Promise<boolean> {
  if (!isHealthAvailable()) return false;
  if (_initialised)         return _permitted;

  return new Promise(resolve => {
    const permissions = {
      permissions: {
        read:  READ_PERMS.map(k => Permissions?.[k] ?? k),
        write: WRITE_PERMS.map(k => Permissions?.[k] ?? k),
      },
    };
    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      _initialised = true;
      _permitted   = !err;
      resolve(_permitted);
    });
  });
}

// ── Individual readers ────────────────────────────────────────────────────────

async function readStepsToday(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    AppleHealthKit.getStepCount({ date: new Date().toISOString() }, (e: any, r: any) =>
      resolve(e ? null : (r?.value ?? null)));
  });
}

async function readActiveCaloriesToday(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    const now = new Date(), start = new Date(now); start.setHours(0, 0, 0, 0);
    AppleHealthKit.getActiveEnergyBurned(
      { startDate: start.toISOString(), endDate: now.toISOString() },
      (e: any, r: any[]) => resolve(e || !r?.length ? null : r.reduce((s, x) => s + (x.value ?? 0), 0)),
    );
  });
}

async function readExerciseMinutesToday(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    const now = new Date(), start = new Date(now); start.setHours(0, 0, 0, 0);
    AppleHealthKit.getAppleExerciseTime?.(
      { startDate: start.toISOString(), endDate: now.toISOString() },
      (e: any, r: any) => resolve(e ? null : (r?.value ?? null)),
    ) ?? resolve(null);
  });
}

async function readRestingHR(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 7 * 86400000);
    AppleHealthKit.getRestingHeartRateSamples(
      { startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 1, ascending: false },
      (e: any, r: any[]) => resolve(e || !r?.length ? null : (r[0]?.value ?? null)),
    );
  });
}

async function readHRV(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 7 * 86400000);
    AppleHealthKit.getHeartRateVariabilitySamples?.(
      { startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 1, ascending: false },
      (e: any, r: any[]) => resolve(e || !r?.length ? null : (r[0]?.value ?? null)),
    ) ?? resolve(null);
  });
}

async function readVO2Max(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 30 * 86400000);
    AppleHealthKit.getVo2MaxSamples?.(
      { startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 1, ascending: false },
      (e: any, r: any[]) => resolve(e || !r?.length ? null : (r[0]?.value ?? null)),
    ) ?? resolve(null);
  });
}

async function readBloodOxygen(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 7 * 86400000);
    AppleHealthKit.getOxygenSaturationSamples?.(
      { startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 1, ascending: false },
      (e: any, r: any[]) => resolve(e || !r?.length ? null : Math.round((r[0]?.value ?? 0) * 100)),
    ) ?? resolve(null);
  });
}

async function readWeight(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    AppleHealthKit.getLatestWeight({ unit: 'pound' }, (e: any, r: any) =>
      resolve(e ? null : (r?.value ?? null)));
  });
}

async function readBodyFat(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    AppleHealthKit.getLatestBodyFatPercentage?.((e: any, r: any) =>
      resolve(e ? null : (r?.value != null ? +(r.value * 100).toFixed(1) : null))
    ) ?? resolve(null);
  });
}

async function readBMI(): Promise<number | null> {
  if (!_permitted) return null;
  return new Promise(resolve => {
    AppleHealthKit.getLatestBmi?.((e: any, r: any) =>
      resolve(e ? null : (r?.value != null ? +r.value.toFixed(1) : null))
    ) ?? resolve(null);
  });
}

async function readSleep(): Promise<{ total: number | null; deep: number | null; rem: number | null }> {
  const none = { total: null, deep: null, rem: null };
  if (!_permitted) return none;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 24 * 3600000);
    AppleHealthKit.getSleepSamples(
      { startDate: start.toISOString(), endDate: new Date().toISOString() },
      (e: any, r: any[]) => {
        if (e || !r?.length) { resolve(none); return; }
        const ms  = (type: string) => r.filter(s => s.value === type).reduce((acc, s) => acc + new Date(s.endDate).getTime() - new Date(s.startDate).getTime(), 0);
        const total = ms('ASLEEP') + ms('DEEP') + ms('REM');
        resolve({
          total: total > 0 ? +(total / 3600000).toFixed(1) : null,
          deep:  ms('DEEP') > 0 ? +(ms('DEEP') / 3600000).toFixed(1) : null,
          rem:   ms('REM')  > 0 ? +(ms('REM')  / 3600000).toFixed(1) : null,
        });
      },
    );
  });
}

async function readWeeklyWorkouts(): Promise<{ count: number; avgMinutes: number | null; totalCals: number | null }> {
  if (!_permitted) return { count: 0, avgMinutes: null, totalCals: null };
  return new Promise(resolve => {
    const start = new Date(Date.now() - 7 * 86400000);
    AppleHealthKit.getSamples?.(
      { startDate: start.toISOString(), endDate: new Date().toISOString(), type: 'Workout' },
      (e: any, r: any[]) => {
        if (e || !r?.length) { resolve({ count: 0, avgMinutes: null, totalCals: null }); return; }
        const durations = r.map(w => (new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000);
        const cals      = r.reduce((s, w) => s + (w.calories ?? 0), 0);
        resolve({
          count:      r.length,
          avgMinutes: durations.length ? +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0) : null,
          totalCals:  cals > 0 ? Math.round(cals) : null,
        });
      },
    ) ?? resolve({ count: 0, avgMinutes: null, totalCals: null });
  });
}

// ── Public snapshot ───────────────────────────────────────────────────────────

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const empty: HealthSnapshot = {
    stepsToday: null, activeCaloriesToday: null, standHoursToday: null, exerciseMinutesToday: null,
    restingHeartRate: null, latestHRV: null, latestVO2Max: null, latestBloodOxygen: null,
    latestWeightLbs: null, latestBodyFatPct: null, latestBMI: null,
    lastNightSleepHrs: null, lastNightDeepSleepHrs: null, lastNightREMSleepHrs: null,
    workoutsThisWeek: 0, avgWorkoutMinutes: null, totalActiveCalWeek: null,
  };
  if (!_permitted) return empty;

  const [steps, cals, exercise, rhr, hrv, vo2, spo2, weight, fat, bmi, sleep, workouts] = await Promise.all([
    readStepsToday(), readActiveCaloriesToday(), readExerciseMinutesToday(),
    readRestingHR(), readHRV(), readVO2Max(), readBloodOxygen(),
    readWeight(), readBodyFat(), readBMI(),
    readSleep(),
    readWeeklyWorkouts(),
  ]);

  return {
    stepsToday:            steps,
    activeCaloriesToday:   cals,
    standHoursToday:       null,   // requires HealthKit entitlement not available via react-native-health
    exerciseMinutesToday:  exercise,
    restingHeartRate:      rhr,
    latestHRV:             hrv,
    latestVO2Max:          vo2,
    latestBloodOxygen:     spo2,
    latestWeightLbs:       weight,
    latestBodyFatPct:      fat,
    latestBMI:             bmi,
    lastNightSleepHrs:     sleep.total,
    lastNightDeepSleepHrs: sleep.deep,
    lastNightREMSleepHrs:  sleep.rem,
    workoutsThisWeek:      workouts.count,
    avgWorkoutMinutes:     workouts.avgMinutes,
    totalActiveCalWeek:    workouts.totalCals,
  };
}

// ── Heart rate zones (calculated from resting HR) ─────────────────────────────

export function getHeartRateZones(restingHR: number, age: number): HeartRateZone[] {
  const maxHR = 220 - age;
  return [
    { zone: 1, label: 'Recovery',    minPct: 50, maxPct: 60, minutesThisWeek: 0 },
    { zone: 2, label: 'Aerobic',     minPct: 60, maxPct: 70, minutesThisWeek: 0 },
    { zone: 3, label: 'Tempo',       minPct: 70, maxPct: 80, minutesThisWeek: 0 },
    { zone: 4, label: 'Threshold',   minPct: 80, maxPct: 90, minutesThisWeek: 0 },
    { zone: 5, label: 'Max Effort',  minPct: 90, maxPct: 100, minutesThisWeek: 0 },
  ].map(z => ({
    ...z,
    minBPM: Math.round(restingHR + (maxHR - restingHR) * z.minPct / 100),
    maxBPM: Math.round(restingHR + (maxHR - restingHR) * z.maxPct / 100),
  } as any));
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function logWorkoutToHealth(workout: WorkoutToWrite): Promise<boolean> {
  if (!_permitted) return false;
  return new Promise(resolve => {
    AppleHealthKit.saveWorkout({
      type:             workout.type,
      startDate:        workout.startDate.toISOString(),
      endDate:          workout.endDate.toISOString(),
      energyBurned:     workout.calories ?? 300,
      energyBurnedUnit: 'calorie',
      distance:         workout.distance,
      distanceUnit:     'meter',
    }, (e: any) => resolve(!e));
  });
}

export async function logMindfulSession(minutes: number): Promise<boolean> {
  if (!_permitted) return false;
  return new Promise(resolve => {
    const end   = new Date();
    const start = new Date(end.getTime() - minutes * 60000);
    AppleHealthKit.saveMindfulSession?.({
      startDate: start.toISOString(),
      endDate:   end.toISOString(),
    }, (e: any) => resolve(!e)) ?? resolve(false);
  });
}

// ── Weight sync ───────────────────────────────────────────────────────────────

export async function syncWeightFromHealth(): Promise<number | null> {
  const weight = await readWeight();
  if (weight === null) return null;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const today        = new Date().toISOString().slice(0, 10);
    const raw          = await AsyncStorage.getItem('upquest_weight_log');
    const log: { date: string; weight: number }[] = raw ? JSON.parse(raw) : [];
    if (!log.some(e => e.date === today)) {
      log.push({ date: today, weight: +weight.toFixed(1) });
      await AsyncStorage.setItem('upquest_weight_log', JSON.stringify(log));
    }
  } catch {}
  return weight;
}

// ── Summary for AI ────────────────────────────────────────────────────────────

/**
 * Returns a compact plain-text summary of the user's health data
 * suitable for injecting into the AI plan generation prompt.
 */
export function healthSnapshotToText(snap: HealthSnapshot): string {
  const lines: string[] = [];
  if (snap.stepsToday != null)           lines.push(`Steps today: ${snap.stepsToday.toLocaleString()}`);
  if (snap.activeCaloriesToday != null)  lines.push(`Active calories today: ${Math.round(snap.activeCaloriesToday)} kcal`);
  if (snap.exerciseMinutesToday != null) lines.push(`Exercise minutes today: ${snap.exerciseMinutesToday} min`);
  if (snap.restingHeartRate != null)     lines.push(`Resting heart rate: ${Math.round(snap.restingHeartRate)} bpm`);
  if (snap.latestHRV != null)            lines.push(`HRV: ${Math.round(snap.latestHRV)} ms`);
  if (snap.latestVO2Max != null)         lines.push(`VO2 Max: ${snap.latestVO2Max.toFixed(1)} mL/kg/min`);
  if (snap.latestBloodOxygen != null)    lines.push(`Blood oxygen: ${snap.latestBloodOxygen}%`);
  if (snap.latestWeightLbs != null)      lines.push(`Weight: ${snap.latestWeightLbs.toFixed(1)} lbs`);
  if (snap.latestBodyFatPct != null)     lines.push(`Body fat: ${snap.latestBodyFatPct}%`);
  if (snap.lastNightSleepHrs != null)    lines.push(`Sleep last night: ${snap.lastNightSleepHrs}h total${snap.lastNightDeepSleepHrs ? `, ${snap.lastNightDeepSleepHrs}h deep` : ''}${snap.lastNightREMSleepHrs ? `, ${snap.lastNightREMSleepHrs}h REM` : ''}`);
  if (snap.workoutsThisWeek > 0)         lines.push(`Workouts this week: ${snap.workoutsThisWeek}${snap.avgWorkoutMinutes ? ` (avg ${snap.avgWorkoutMinutes} min)` : ''}`);
  return lines.length ? lines.join('\n') : '';
}
