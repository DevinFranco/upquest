/**
 * UpQuest – Weekly Check-In Screen
 * A quick 6-step tap-through to update the user's weekly routine context.
 * Results are saved to AsyncStorage and fed into the AI plan generator.
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import type { RootStackParamList } from '../App';

const { width } = Dimensions.get('window');
type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyCheckIn {
  week_of:          string;   // ISO Monday date
  completed_at:     string;   // ISO timestamp
  last_week_rating: string;   // great | good | tough | very_tough
  energy_level:     string;   // high | normal | low
  stress_level:     string;   // low | moderate | high | very_high
  schedule_changes: string[]; // travel | work_busy | family_event | appointment | none
  rest_days:        string[]; // Sunday | Saturday | etc.
  focus_notes:      string;   // free text, optional
}

export interface LifestyleProfile {
  work_situation:    string;   // full_time | part_time | student | stay_at_home | retired | entrepreneur
  work_days:         string[]; // ['Monday','Tuesday',...]
  wake_time:         string;   // '6:00 AM'
  bedtime:           string;   // '10:00 PM'
  commute_minutes:   number;   // 0 | 20 | 45 | 90
  has_dependents:    boolean;
  last_checkin_date: string | null;
  checkin_history:   WeeklyCheckIn[];
}

export const LIFESTYLE_STORAGE_KEY = 'upquest_lifestyle';

export async function getLifestyleProfile(): Promise<LifestyleProfile | null> {
  const raw = await AsyncStorage.getItem(LIFESTYLE_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveLifestyleProfile(profile: LifestyleProfile): Promise<void> {
  await AsyncStorage.setItem(LIFESTYLE_STORAGE_KEY, JSON.stringify(profile));
}

/** Returns a plain-text summary of the lifestyle + latest check-in for the AI prompt */
export function lifestyleToText(profile: LifestyleProfile): string {
  const lines: string[] = [];

  // Static lifestyle
  const situationMap: Record<string, string> = {
    full_time: 'full-time employee', part_time: 'part-time worker',
    student: 'student', stay_at_home: 'stay-at-home parent',
    retired: 'retired', entrepreneur: 'entrepreneur/self-employed',
  };
  lines.push(`Lifestyle: ${situationMap[profile.work_situation] ?? profile.work_situation}`);
  if (profile.work_days.length) lines.push(`Work days: ${profile.work_days.join(', ')}`);
  lines.push(`Wake time: ${profile.wake_time} | Bedtime: ${profile.bedtime}`);
  if (profile.commute_minutes > 0) lines.push(`Daily commute: ~${profile.commute_minutes} min each way`);
  if (profile.has_dependents) lines.push('Has kids/dependents to care for');

  // Latest check-in
  const latest = profile.checkin_history?.[profile.checkin_history.length - 1];
  if (latest) {
    lines.push('');
    lines.push('Weekly check-in (this week):');
    const ratingMap: Record<string, string> = {
      great: 'Last week went great', good: 'Last week was good',
      tough: 'Last week was tough', very_tough: 'Last week was very tough',
    };
    lines.push(ratingMap[latest.last_week_rating] ?? '');
    lines.push(`Energy: ${latest.energy_level} | Stress: ${latest.stress_level}`);
    if (latest.schedule_changes.length && !latest.schedule_changes.includes('none')) {
      lines.push(`Schedule changes: ${latest.schedule_changes.join(', ')}`);
    }
    if (latest.rest_days.length) lines.push(`Rest days: ${latest.rest_days.join(', ')}`);
    if (latest.focus_notes) lines.push(`Focus this week: ${latest.focus_notes}`);
  }

  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ── Step configs ──────────────────────────────────────────────────────────────

const STEP_COUNT = 6;

// ── Main Component ────────────────────────────────────────────────────────────

export default function WeeklyCheckInScreen() {
  const navigation = useNavigation<Nav>();
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step answers
  const [lastWeekRating, setLastWeekRating] = useState('');
  const [energyLevel, setEnergyLevel]       = useState('');
  const [stressLevel, setStressLevel]       = useState('');
  const [scheduleChanges, setScheduleChanges] = useState<string[]>([]);
  const [restDays, setRestDays]             = useState<string[]>([]);
  const [focusNotes, setFocusNotes]         = useState('');
  const [saving, setSaving]                 = useState(false);

  const progress = ((step) / STEP_COUNT) * 100;

  const animateToNext = (fn: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      fn();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const goNext = () => animateToNext(() => setStep(s => s + 1));
  const goBack = () => animateToNext(() => setStep(s => s - 1));

  const toggleMulti = (
    val: string,
    current: string[],
    setter: (v: string[]) => void,
    exclusive?: string,
  ) => {
    if (exclusive && val === exclusive) {
      setter([exclusive]);
      return;
    }
    const withoutExclusive = current.filter(v => v !== exclusive);
    if (withoutExclusive.includes(val)) {
      setter(withoutExclusive.filter(v => v !== val));
    } else {
      setter([...withoutExclusive, val]);
    }
  };

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem(LIFESTYLE_STORAGE_KEY);
      const profile: LifestyleProfile = raw ? JSON.parse(raw) : {
        work_situation: 'full_time', work_days: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
        wake_time: '7:00 AM', bedtime: '10:30 PM', commute_minutes: 0,
        has_dependents: false, last_checkin_date: null, checkin_history: [],
      };

      const checkin: WeeklyCheckIn = {
        week_of: getMondayISO(),
        completed_at: new Date().toISOString(),
        last_week_rating: lastWeekRating,
        energy_level: energyLevel,
        stress_level: stressLevel,
        schedule_changes: scheduleChanges.length ? scheduleChanges : ['none'],
        rest_days: restDays,
        focus_notes: focusNotes,
      };

      // Keep last 8 weeks of history
      const history = [...(profile.checkin_history ?? []), checkin].slice(-8);
      profile.checkin_history = history;
      profile.last_checkin_date = new Date().toISOString();

      await saveLifestyleProfile(profile);
      setStep(STEP_COUNT); // done step
    } catch (e) {
      console.error('WeeklyCheckIn save error:', e);
    } finally {
      setSaving(false);
    }
  };

  // ── Progress bar ─────────────────────────────────────────────────────────

  const renderHeader = (title: string, subtitle: string) => (
    <View style={styles.header}>
      <View style={styles.progressRow}>
        {step > 0 && (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressLabel}>{step}/{STEP_COUNT}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
    </View>
  );

  const renderOptionRow = (
    options: { key: string; label: string; emoji?: string }[],
    selected: string,
    onSelect: (k: string) => void,
  ) => (
    <View style={styles.optionGrid}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.optionCard, selected === opt.key && styles.optionCardActive]}
          onPress={() => onSelect(opt.key)}
        >
          {opt.emoji ? <Text style={styles.optionEmoji}>{opt.emoji}</Text> : null}
          <Text style={[styles.optionLabel, selected === opt.key && styles.optionLabelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMultiRow = (
    options: { key: string; label: string; emoji?: string }[],
    selected: string[],
    onToggle: (k: string) => void,
  ) => (
    <View style={styles.chipWrap}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[styles.chip, selected.includes(opt.key) && styles.chipActive]}
          onPress={() => onToggle(opt.key)}
        >
          {opt.emoji ? <Text style={{ marginRight: 4 }}>{opt.emoji}</Text> : null}
          <Text style={[styles.chipText, selected.includes(opt.key) && styles.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Done screen ───────────────────────────────────────────────────────────
  if (step === STEP_COUNT) {
    return (
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]}>
          <Text style={{ fontSize: 72, marginBottom: Spacing.lg }}>🎯</Text>
          <Text style={styles.doneTitle}>Week updated!</Text>
          <Text style={styles.doneSubtitle}>
            Your AI coach has your new routine context.{'\n'}
            Generate a fresh Quest to put it to work.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              navigation.navigate('PlanChat', {});
            }}
          >
            <Text style={styles.primaryBtnText}>Generate This Week's Quest →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── Step 0: Last week rating ──────────────────────────────── */}
            {step === 0 && (
              <>
                {renderHeader('How did last week go?', 'Your coach uses this to calibrate intensity for this week.')}
                {renderOptionRow([
                  { key: 'great',     emoji: '🔥', label: 'Crushed it' },
                  { key: 'good',      emoji: '💪', label: 'Solid week' },
                  { key: 'tough',     emoji: '😤', label: 'Tough but managed' },
                  { key: 'very_tough', emoji: '😮‍💨', label: 'Really hard week' },
                ], lastWeekRating, setLastWeekRating)}
                <TouchableOpacity
                  style={[styles.primaryBtn, !lastWeekRating && styles.btnDisabled]}
                  onPress={goNext} disabled={!lastWeekRating}
                >
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 1: Energy level ──────────────────────────────────── */}
            {step === 1 && (
              <>
                {renderHeader("What's your energy like this week?", 'Honest answer = better Quest. Low energy weeks need lighter loads.')}
                {renderOptionRow([
                  { key: 'high',   emoji: '⚡', label: 'High — feeling great' },
                  { key: 'normal', emoji: '👍', label: 'Normal' },
                  { key: 'low',    emoji: '🪫', label: 'Low — running on fumes' },
                ], energyLevel, setEnergyLevel)}
                <TouchableOpacity
                  style={[styles.primaryBtn, !energyLevel && styles.btnDisabled]}
                  onPress={goNext} disabled={!energyLevel}
                >
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 2: Stress level ──────────────────────────────────── */}
            {step === 2 && (
              <>
                {renderHeader('Stress level this week?', 'High stress = your Quest adjusts recovery time accordingly.')}
                {renderOptionRow([
                  { key: 'low',       emoji: '😌', label: 'Low' },
                  { key: 'moderate',  emoji: '🙂', label: 'Moderate' },
                  { key: 'high',      emoji: '😬', label: 'High' },
                  { key: 'very_high', emoji: '🤯', label: 'Very High' },
                ], stressLevel, setStressLevel)}
                <TouchableOpacity
                  style={[styles.primaryBtn, !stressLevel && styles.btnDisabled]}
                  onPress={goNext} disabled={!stressLevel}
                >
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 3: Schedule changes ──────────────────────────────── */}
            {step === 3 && (
              <>
                {renderHeader('Any changes to your schedule this week?', 'Select all that apply — your Quest will work around them.')}
                {renderMultiRow([
                  { key: 'travel',        emoji: '✈️', label: 'Traveling' },
                  { key: 'work_busy',     emoji: '💼', label: 'Busy at work' },
                  { key: 'family_event',  emoji: '👨‍👩‍👧', label: 'Family event' },
                  { key: 'appointment',   emoji: '🏥', label: 'Medical appt' },
                  { key: 'holiday',       emoji: '🎉', label: 'Holiday / celebration' },
                  { key: 'none',          emoji: '✅', label: 'Normal week' },
                ], scheduleChanges, (k) => toggleMulti(k, scheduleChanges, setScheduleChanges, 'none'))}
                <TouchableOpacity
                  style={[styles.primaryBtn, !scheduleChanges.length && styles.btnDisabled]}
                  onPress={goNext} disabled={!scheduleChanges.length}
                >
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 4: Rest days ────────────────────────────────────── */}
            {step === 4 && (
              <>
                {renderHeader('Which days are rest days?', "These won't get intense workouts scheduled.")}
                {renderMultiRow(
                  DAYS.map(d => ({ key: d, label: d.slice(0, 3) })),
                  restDays,
                  (k) => toggleMulti(k, restDays, setRestDays),
                )}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={goNext}
                >
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── Step 5: Focus notes ───────────────────────────────────── */}
            {step === 5 && (
              <>
                {renderHeader('Anything to focus on this week?', 'Optional — e.g. "want to prioritize sleep", "knee is sore", "big presentation Thursday"')}
                <TextInput
                  style={styles.textArea}
                  placeholder="Type anything on your mind… or skip it"
                  placeholderTextColor={Colors.textMuted}
                  value={focusNotes}
                  onChangeText={setFocusNotes}
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity
                  style={[styles.primaryBtn, saving && styles.btnDisabled]}
                  onPress={saveAndFinish}
                  disabled={saving}
                >
                  <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : '✓ Update My Week'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipBtn} onPress={saveAndFinish} disabled={saving}>
                  <Text style={styles.skipText}>Skip this step</Text>
                </TouchableOpacity>
              </>
            )}

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  center:  { justifyContent: 'center', alignItems: 'center', padding: 24 },
  scrollContent: { padding: 20, paddingBottom: 80 },

  header: { marginBottom: 28 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  backBtn:     { marginRight: 10, padding: 4 },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#1E1E2E', borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#7C5CFF', borderRadius: 2 },
  progressLabel: { color: '#5A5A78', fontSize: 12, marginLeft: 10 },

  stepTitle:    { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: '#9090A8', lineHeight: 20 },

  optionGrid: { gap: 12, marginBottom: 24 },
  optionCard: {
    backgroundColor: '#14141E',
    borderWidth: 1,
    borderColor: '#2A2A3C',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCardActive: { borderColor: '#7C5CFF', backgroundColor: '#1A1530' },
  optionEmoji: { fontSize: 28 },
  optionLabel: { fontSize: 16, color: '#9090A8', fontWeight: '600', flex: 1 },
  optionLabelActive: { color: '#FFFFFF' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#14141E', borderWidth: 1, borderColor: '#2A2A3C',
    borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14,
  },
  chipActive:     { backgroundColor: '#1A1530', borderColor: '#7C5CFF' },
  chipText:       { color: '#9090A8', fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: '#FFFFFF' },

  textArea: {
    backgroundColor: '#14141E', borderWidth: 1, borderColor: '#2A2A3C',
    borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 15,
    minHeight: 120, textAlignVertical: 'top', marginBottom: 20,
  },

  primaryBtn: {
    backgroundColor: '#7C5CFF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnDisabled:    { opacity: 0.35 },

  secondaryBtn: {
    borderWidth: 1, borderColor: '#2A2A3C', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  secondaryBtnText: { color: '#9090A8', fontSize: 15, fontWeight: '600' },

  skipBtn:  { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: '#5A5A78', fontSize: 14 },

  doneTitle:    { fontSize: 28, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  doneSubtitle: { fontSize: 15, color: '#9090A8', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
});
