/**
 * UpQuest – Gamification Engine
 * XP, levels, streaks, achievements.
 * All state persisted to AsyncStorage under 'upquest_gamification'.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Achievement {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  xpReward:    number;
  unlockedAt?: string;
}

export interface GamificationState {
  xp:                 number;
  level:              number;
  streak:             number;
  longestStreak:      number;
  lastActiveDate:     string | null;
  totalActivities:    number;
  totalWorkouts:      number;
  totalHabits:        number;
  achievements:       string[];          // list of unlocked achievement IDs
  completedToday:     string[];          // activity keys completed today (reset daily)
  lastCompletedDate:  string | null;
}

export interface XpEvent {
  type:    string;
  amount:  number;
  label:   string;
}

// ── XP values ─────────────────────────────────────────────────────────────────

export const XP = {
  PLAN_GENERATED:       150,
  PLAN_MODIFIED:         75,
  ACTIVITY_COMPLETED:    10,
  WORKOUT_COMPLETED:     60,
  HABIT_COMPLETED:       15,
  MEAL_LOGGED:           12,
  WEIGHT_LOGGED:         20,
  HEALTH_SYNCED:         25,
  FULL_DAY_COMPLETE:    100,   // all habits + workout done in one day
  STREAK_3:              50,
  STREAK_7:             150,
  STREAK_14:            300,
  STREAK_30:            600,
} as const;

// ── Level thresholds ──────────────────────────────────────────────────────────

const LEVEL_NAMES = [
  'Newcomer', 'Initiate', 'Challenger', 'Warrior', 'Champion',
  'Veteran',  'Elite',    'Master',     'Legend',  'Mythic',
];

export function xpForLevel(level: number): number {
  // Exponential curve: L1=0, L2=200, L3=500, L4=900 …
  if (level <= 1) return 0;
  return Math.floor(100 * (level - 1) * (level + 2));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return Math.min(level, LEVEL_NAMES.length);
}

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
}

export function xpProgressInLevel(xp: number): { current: number; needed: number; pct: number } {
  const level   = levelFromXp(xp);
  const thisFlr = xpForLevel(level);
  const nextFlr = xpForLevel(level + 1);
  if (nextFlr <= thisFlr) return { current: xp - thisFlr, needed: 1, pct: 1 };
  const current = xp - thisFlr;
  const needed  = nextFlr - thisFlr;
  return { current, needed, pct: Math.min(current / needed, 1) };
}

// ── Achievement definitions ───────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_plan',      title: 'First Steps',        description: 'Generate your first AI plan',           icon: '🗺️',  xpReward: 50  },
  { id: 'first_workout',   title: 'Sweat Session',       description: 'Complete your first workout',           icon: '💪',  xpReward: 75  },
  { id: 'streak_3',        title: 'On a Roll',           description: 'Maintain a 3-day active streak',        icon: '🔥',  xpReward: 50  },
  { id: 'streak_7',        title: 'Week Warrior',        description: 'Maintain a 7-day active streak',        icon: '⚡',  xpReward: 150 },
  { id: 'streak_14',       title: 'Fortnight Fighter',   description: 'Maintain a 14-day streak',              icon: '🌟',  xpReward: 300 },
  { id: 'streak_30',       title: 'Iron Discipline',     description: 'Maintain a 30-day streak',              icon: '🏆',  xpReward: 600 },
  { id: 'habits_10',       title: 'Habit Builder',       description: 'Complete 10 habits total',              icon: '✅',  xpReward: 100 },
  { id: 'workouts_5',      title: 'Gym Rat',             description: 'Complete 5 workouts',                   icon: '🏋️', xpReward: 125 },
  { id: 'workouts_20',     title: 'Beast Mode',          description: 'Complete 20 workouts',                  icon: '🦁',  xpReward: 250 },
  { id: 'health_sync',     title: 'Data Driven',         description: 'Sync with Apple Health',                icon: '❤️',  xpReward: 75  },
  { id: 'level_3',         title: 'Rising Star',         description: 'Reach Level 3',                         icon: '⭐',  xpReward: 50  },
  { id: 'level_5',         title: 'Halfway Hero',        description: 'Reach Level 5',                         icon: '🎯',  xpReward: 100 },
  { id: 'perfect_day',     title: 'Perfect Day',         description: 'Complete all activities in a single day', icon: '💎', xpReward: 100 },
  { id: 'weight_tracker',  title: 'Accountable',         description: 'Log your weight for the first time',   icon: '⚖️',  xpReward: 50  },
  { id: 'plan_modified',   title: 'Adaptable',           description: 'Modify your plan with AI',              icon: '🔄',  xpReward: 50  },
];

export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// ── Storage ───────────────────────────────────────────────────────────────────

const KEY = 'upquest_gamification';

const DEFAULT_STATE: GamificationState = {
  xp:                0,
  level:             1,
  streak:            0,
  longestStreak:     0,
  lastActiveDate:    null,
  totalActivities:   0,
  totalWorkouts:     0,
  totalHabits:       0,
  achievements:      [],
  completedToday:    [],
  lastCompletedDate: null,
};

export async function loadGamification(): Promise<GamificationState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function saveGamification(state: GamificationState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

// ── Core award function ───────────────────────────────────────────────────────

export interface AwardResult {
  xpGained:          number;
  newLevel:          number | null;          // non-null if levelled up
  newAchievements:   Achievement[];
  newStreak:         number;
}

export async function awardXp(
  amount:       number,
  activityKey?: string,                     // unique key to prevent double-counting
): Promise<AwardResult> {
  const state = await loadGamification();
  const today = new Date().toISOString().slice(0, 10);

  // Deduplicate by activity key
  if (activityKey && state.completedToday.includes(activityKey)) {
    return { xpGained: 0, newLevel: null, newAchievements: [], newStreak: state.streak };
  }

  // Update streak
  let { streak, longestStreak, lastActiveDate } = state;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastActiveDate === today) {
    // same day — streak unchanged
  } else if (lastActiveDate === yesterday) {
    streak++;
  } else {
    streak = 1; // reset
  }
  longestStreak = Math.max(longestStreak, streak);

  // XP & level
  const oldLevel = state.level;
  const newXp    = state.xp + amount;
  const newLevel = levelFromXp(newXp);

  // Reset completedToday if it's a new day
  const completedToday = state.lastCompletedDate === today
    ? state.completedToday
    : [];
  if (activityKey) completedToday.push(activityKey);

  const newState: GamificationState = {
    ...state,
    xp:                newXp,
    level:             newLevel,
    streak,
    longestStreak,
    lastActiveDate:    today,
    completedToday,
    lastCompletedDate: today,
  };

  // Check achievements
  const newAchievements = checkAchievements(newState, oldLevel);
  let bonusXp = 0;
  for (const ach of newAchievements) {
    if (!newState.achievements.includes(ach.id)) {
      newState.achievements.push(ach.id);
      bonusXp += ach.xpReward;
    }
  }
  if (bonusXp > 0) newState.xp += bonusXp;
  newState.level = levelFromXp(newState.xp);

  await saveGamification(newState);

  return {
    xpGained:        amount + bonusXp,
    newLevel:        newLevel > oldLevel ? newLevel : null,
    newAchievements: newAchievements,
    newStreak:       streak,
  };
}

// ── Activity-specific helpers ─────────────────────────────────────────────────

export async function onPlanGenerated(): Promise<AwardResult> {
  const state  = await loadGamification();
  const isFirst = !state.achievements.includes('first_plan');
  const result  = await awardXp(XP.PLAN_GENERATED, 'plan_generated');
  if (isFirst) {
    // achievement handled inside checkAchievements
  }
  return result;
}

export async function onPlanModified(): Promise<AwardResult> {
  return awardXp(XP.PLAN_MODIFIED, 'plan_modified_' + new Date().toISOString().slice(0, 10));
}

export async function onActivityCompleted(activityKey: string): Promise<AwardResult> {
  const state = await loadGamification();
  const newState = { ...state, totalActivities: state.totalActivities + 1 };
  await saveGamification(newState);
  return awardXp(XP.ACTIVITY_COMPLETED, activityKey);
}

export async function onWorkoutCompleted(dateKey: string): Promise<AwardResult> {
  const state = await loadGamification();
  const newState = { ...state, totalWorkouts: state.totalWorkouts + 1 };
  await saveGamification(newState);
  return awardXp(XP.WORKOUT_COMPLETED, `workout_${dateKey}`);
}

export async function onHabitCompleted(habitKey: string): Promise<AwardResult> {
  const state = await loadGamification();
  const newState = { ...state, totalHabits: state.totalHabits + 1 };
  await saveGamification(newState);
  return awardXp(XP.HABIT_COMPLETED, habitKey);
}

export async function onWeightLogged(): Promise<AwardResult> {
  return awardXp(XP.WEIGHT_LOGGED, `weight_${new Date().toISOString().slice(0, 10)}`);
}

export async function onHealthSynced(): Promise<AwardResult> {
  return awardXp(XP.HEALTH_SYNCED, `health_${new Date().toISOString().slice(0, 10)}`);
}

export async function markFullDayComplete(dateKey: string): Promise<AwardResult> {
  return awardXp(XP.FULL_DAY_COMPLETE, `full_day_${dateKey}`);
}

// ── Achievement checker ───────────────────────────────────────────────────────

function checkAchievements(state: GamificationState, oldLevel: number): Achievement[] {
  const earned: Achievement[] = [];
  const has = (id: string) => state.achievements.includes(id);

  const check = (id: string, condition: boolean) => {
    if (condition && !has(id)) {
      const ach = getAchievement(id);
      if (ach) earned.push(ach);
    }
  };

  check('first_plan',    state.xp > 0);
  check('streak_3',      state.streak >= 3);
  check('streak_7',      state.streak >= 7);
  check('streak_14',     state.streak >= 14);
  check('streak_30',     state.streak >= 30);
  check('habits_10',     state.totalHabits >= 10);
  check('workouts_5',    state.totalWorkouts >= 5);
  check('workouts_20',   state.totalWorkouts >= 20);
  check('first_workout', state.totalWorkouts >= 1);
  check('weight_tracker',state.xp > XP.WEIGHT_LOGGED - 1);
  check('level_3',       state.level >= 3);
  check('level_5',       state.level >= 5);
  check('health_sync',   has('health_sync') || state.xp >= XP.HEALTH_SYNCED);

  return earned;
}
