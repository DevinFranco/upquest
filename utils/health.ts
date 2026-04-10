/**
 * UpQuest – Apple Health / HealthKit utility
 *
 * Uses react-native-health (requires EAS Build / custom dev client — will not
 * work inside Expo Go).  All functions gracefully no-op when HealthKit is
 * unavailable so the rest of the app remains functional on Android / simulators.
 *
 * Install:  npm install react-native-health
 * Then rebuild with:  eas build --platform ios
 */

import { Platform } from 'react-native';

// Lazy-import so the app doesn't crash if the native module isn't linked yet
let AppleHealthKit: any = null;
let HealthKitConstants: any = null;

try {
  const mod = require('react-native-health');
  AppleHealthKit    = mod.default ?? mod;
  HealthKitConstants = mod.HealthKitConstants ?? AppleHealthKit?.Constants;
} catch {
  // react-native-health not installed or not linked — degrade gracefully
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealthSnapshot {
  stepsToday:        number | null;
  activeCaloriesToday: number | null;
  latestWeightLbs:   number | null;
  lastNightSleepHrs: number | null;
  restingHeartRate:  number | null;
  workoutsThisWeek:  number;
}

export interface WorkoutToWrite {
  type:              string;   // e.g. 'TraditionalStrengthTraining'
  startDate:         Date;
  endDate:           Date;
  calories?:         number;
}

// ── Permission set ────────────────────────────────────────────────────────────

const READ_TYPES = [
  'StepCount', 'ActiveEnergyBurned', 'BasalEnergyBurned',
  'BodyMass', 'SleepAnalysis', 'HeartRate', 'RestingHeartRate',
  'Workout', 'DateOfBirth', 'BiologicalSex',
  'Height', 'BodyMassIndex', 'BloodPressureSystolic', 'BloodPressureDiastolic',
];

const WRITE_TYPES = [
  'Workout', 'ActiveEnergyBurned', 'StepCount',
];

let _initialised = false;
let _permitted   = false;

// ── Init & permission ─────────────────────────────────────────────────────────

export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !AppleHealthKit) return false;
  if (_initialised) return _permitted;

  return new Promise(resolve => {
    const permissions = {
      permissions: {
        read:  READ_TYPES.map(t => HealthKitConstants?.Permissions?.[t] ?? t),
        write: WRITE_TYPES.map(t => HealthKitConstants?.Permissions?.[t] ?? t),
      },
    };
    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      _initialised = true;
      _permitted   = !err;
      resolve(_permitted);
    });
  });
}

export function isHealthAvailable(): boolean {
  return Platform.OS === 'ios' && !!AppleHealthKit;
}

// ── Read helpers ──────────────────────────────────────────────────────────────

async function readStepsToday(): Promise<number | null> {
  if (!_permitted || !AppleHealthKit) return null;
  return new Promise(resolve => {
    const opts = { date: new Date().toISOString() };
    AppleHealthKit.getStepCount(opts, (err: any, results: any) => {
      resolve(err ? null : (results?.value ?? null));
    });
  });
}

async function readActiveCaloriesToday(): Promise<number | null> {
  if (!_permitted || !AppleHealthKit) return null;
  return new Promise(resolve => {
    const now   = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    AppleHealthKit.getActiveEnergyBurned(
      { startDate: start.toISOString(), endDate: now.toISOString() },
      (err: any, results: any[]) => {
        if (err || !results?.length) { resolve(null); return; }
        resolve(results.reduce((s, r) => s + (r.value ?? 0), 0));
      },
    );
  });
}

async function readLatestWeight(): Promise<number | null> {
  if (!_permitted || !AppleHealthKit) return null;
  return new Promise(resolve => {
    AppleHealthKit.getLatestWeight({ unit: 'pound' }, (err: any, result: any) => {
      resolve(err ? null : (result?.value ?? null));
    });
  });
}

async function readLastSleep(): Promise<number | null> {
  if (!_permitted || !AppleHealthKit) return null;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 24 * 3600000);
    AppleHealthKit.getSleepSamples(
      { startDate: start.toISOString(), endDate: new Date().toISOString() },
      (err: any, results: any[]) => {
        if (err || !results?.length) { resolve(null); return; }
        // Sum 'ASLEEP' samples
        const totalMs = results
          .filter(r => r.value === 'ASLEEP')
          .reduce((s, r) => s + (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()), 0);
        resolve(totalMs > 0 ? +(totalMs / 3600000).toFixed(1) : null);
      },
    );
  });
}

async function readRestingHeartRate(): Promise<number | null> {
  if (!_permitted || !AppleHealthKit) return null;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 7 * 24 * 3600000);
    AppleHealthKit.getRestingHeartRateSamples(
      { startDate: start.toISOString(), endDate: new Date().toISOString(), limit: 1, ascending: false },
      (err: any, results: any[]) => {
        resolve((err || !results?.length) ? null : (results[0]?.value ?? null));
      },
    );
  });
}

async function readWorkoutsThisWeek(): Promise<number> {
  if (!_permitted || !AppleHealthKit) return 0;
  return new Promise(resolve => {
    const start = new Date(Date.now() - 7 * 24 * 3600000);
    AppleHealthKit.getSamples(
      {
        startDate:  start.toISOString(),
        endDate:    new Date().toISOString(),
        type:       HealthKitConstants?.Activities?.TraditionalStrengthTraining ?? 'HKWorkoutActivityTypeTraditionalStrengthTraining',
      },
      (err: any, results: any[]) => { resolve(err ? 0 : (results?.length ?? 0)); },
    );
  });
}

// ── Public snapshot ───────────────────────────────────────────────────────────

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  if (!_permitted) {
    return { stepsToday: null, activeCaloriesToday: null, latestWeightLbs: null, lastNightSleepHrs: null, restingHeartRate: null, workoutsThisWeek: 0 };
  }
  const [steps, cals, weight, sleep, hr, workouts] = await Promise.all([
    readStepsToday(),
    readActiveCaloriesToday(),
    readLatestWeight(),
    readLastSleep(),
    readRestingHeartRate(),
    readWorkoutsThisWeek(),
  ]);
  return {
    stepsToday:          steps,
    activeCaloriesToday: cals,
    latestWeightLbs:     weight,
    lastNightSleepHrs:   sleep,
    restingHeartRate:    hr,
    workoutsThisWeek:    workouts,
  };
}

// ── Write helpers ─────────────────────────────────────────────────────────────

export async function logWorkoutToHealth(workout: WorkoutToWrite): Promise<boolean> {
  if (!_permitted || !AppleHealthKit) return false;
  return new Promise(resolve => {
    const opts = {
      type:      workout.type,
      startDate: workout.startDate.toISOString(),
      endDate:   workout.endDate.toISOString(),
      energyBurned:      workout.calories ?? 300,
      energyBurnedUnit:  'calorie',
    };
    AppleHealthKit.saveWorkout(opts, (err: any) => resolve(!err));
  });
}

// ── Sync weight back to app ───────────────────────────────────────────────────

/**
 * If HealthKit has a more recent weight than AsyncStorage,
 * update the local weight log and return the new value (in lbs).
 */
export async function syncWeightFromHealth(): Promise<number | null> {
  const weight = await readLatestWeight();
  if (weight === null) return null;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const today        = new Date().toISOString().slice(0, 10);
    const raw          = await AsyncStorage.getItem('upquest_weight_log');
    const log: { date: string; weight: number }[] = raw ? JSON.parse(raw) : [];
    const alreadyToday = log.some(e => e.date === today);
    if (!alreadyToday) {
      log.push({ date: today, weight: +weight.toFixed(1) });
      await AsyncStorage.setItem('upquest_weight_log', JSON.stringify(log));
    }
  } catch { /* non-critical */ }
  return weight;
}
