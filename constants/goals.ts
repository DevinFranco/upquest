/**
 * UpQuest – Predefined goal options shown during onboarding.
 * key: sent to the backend  |  label: displayed in UI  |  icon: emoji shorthand
 */

export interface Goal {
  key: string;
  label: string;
  icon: string;
  category: 'health' | 'fitness' | 'lifestyle' | 'mental';
}

export const GOALS: Goal[] = [
  // Health
  { key: 'lower_cholesterol',      label: 'Lower Cholesterol',       icon: '🫀', category: 'health' },
  { key: 'lower_triglycerides',    label: 'Lower Triglycerides',     icon: '🩸', category: 'health' },
  { key: 'boost_testosterone',     label: 'Boost Testosterone',      icon: '⚡', category: 'health' },
  { key: 'improve_blood_sugar',    label: 'Stabilize Blood Sugar',   icon: '📊', category: 'health' },
  { key: 'improve_thyroid',        label: 'Support Thyroid Health',  icon: '🦋', category: 'health' },
  { key: 'improve_gut_health',     label: 'Improve Gut Health',      icon: '🌿', category: 'health' },
  { key: 'optimize_vitamin_d',     label: 'Optimize Vitamin D',      icon: '☀️', category: 'health' },

  // Fitness
  { key: 'build_muscle',           label: 'Build Muscle',            icon: '💪', category: 'fitness' },
  { key: 'lose_fat',               label: 'Lose Body Fat',           icon: '🔥', category: 'fitness' },
  { key: 'improve_endurance',      label: 'Improve Endurance',       icon: '🏃', category: 'fitness' },
  { key: 'increase_strength',      label: 'Increase Strength',       icon: '🏋️', category: 'fitness' },
  { key: 'improve_flexibility',    label: 'Improve Flexibility',     icon: '🧘', category: 'fitness' },

  // Lifestyle
  { key: 'quit_cannabis',          label: 'Quit Cannabis',           icon: '🚫', category: 'lifestyle' },
  { key: 'quit_vaping',            label: 'Quit Vaping / Nicotine',  icon: '🚭', category: 'lifestyle' },
  { key: 'quit_alcohol',           label: 'Reduce Alcohol',          icon: '🍷', category: 'lifestyle' },
  { key: 'improve_sleep',          label: 'Improve Sleep Quality',   icon: '😴', category: 'lifestyle' },
  { key: 'improve_energy',         label: 'Boost Daily Energy',      icon: '⚡', category: 'lifestyle' },
  { key: 'improve_skin',           label: 'Improve Skin Health',     icon: '✨', category: 'lifestyle' },
  { key: 'improve_hydration',      label: 'Drink More Water',        icon: '💧', category: 'lifestyle' },

  // Mental
  { key: 'reduce_stress',          label: 'Reduce Stress',           icon: '🧠', category: 'mental' },
  { key: 'improve_focus',          label: 'Sharpen Focus',           icon: '🎯', category: 'mental' },
  { key: 'build_discipline',       label: 'Build Daily Discipline',  icon: '📅', category: 'mental' },
];

export const GOAL_CATEGORIES = ['health', 'fitness', 'lifestyle', 'mental'] as const;
