/**
 * UpQuest – Onboarding Screen
 * Covers: Auth (email magic link) → Stats form → Goal selector → Profile save
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../utils/supabase';
import { api } from '../utils/api';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { GOALS, GOAL_CATEGORIES } from '../constants/goals';
import GoalSelector from '../components/GoalSelector';
import StatInput    from '../components/StatInput';
import type { RootStackParamList } from '../App';
import { saveLifestyleProfile, type LifestyleProfile, LIFESTYLE_STORAGE_KEY } from './WeeklyCheckInScreen';

const { width } = Dimensions.get('window');

type Step = 'welcome' | 'auth' | 'stats' | 'goals' | 'lifestyle' | 'done';

const STEPS: Step[] = ['welcome', 'auth', 'stats', 'goals', 'lifestyle', 'done'];

interface StatsForm {
  age:            string;
  height_ft:      string;
  height_in:      string;
  weight_lbs:     string;
  sex:            'male' | 'female' | '';
  location:       string;
  activity_level: string;
  medical_notes:  string;
}

const DEFAULT_STATS: StatsForm = {
  age:            '',
  height_ft:      '',
  height_in:      '',
  weight_lbs:     '',
  sex:            '',
  location:       '',
  activity_level: 'moderate',
  medical_notes:  '',
};

const ACTIVITY_LEVELS = [
  { key: 'sedentary',   label: 'Sedentary',    desc: 'Little/no exercise' },
  { key: 'light',       label: 'Light',        desc: '1–3x / week' },
  { key: 'moderate',    label: 'Moderate',     desc: '3–5x / week' },
  { key: 'active',      label: 'Active',       desc: '6–7x / week' },
  { key: 'very_active', label: 'Very Active',  desc: 'Athlete / physical job' },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep]           = useState<Step>('welcome');
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState('');
  const [otpSent, setOtpSent]     = useState(false);
  const [stats, setStats]         = useState<StatsForm>(DEFAULT_STATS);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [lifestyle, setLifestyle] = useState({
    work_situation:  'full_time',
    work_days:       ['Monday','Tuesday','Wednesday','Thursday','Friday'] as string[],
    wake_time:       '7:00 AM',
    bedtime:         '10:30 PM',
    commute_minutes: 0,
    has_dependents:  false,
  });

  const stepIndex = STEPS.indexOf(step);
  const progress  = ((stepIndex) / (STEPS.length - 1)) * 100;

  // ── Auth ──────────────────────────────────────────────────────────────────

  const sendMagicLink = async () => {
    if (!email.includes('@')) return Alert.alert('Enter a valid email address.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) return Alert.alert('Error', error.message);
    setOtpSent(true);
  };

  const verifyOtp = async () => {
    if (otp.length < 6) return Alert.alert('Enter the 6-digit code.');
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email, token: otp, type: 'email',
    });
    setLoading(false);
    if (error) return Alert.alert('Invalid code', error.message);
    setStep('stats');
  };

  // ── Profile save ──────────────────────────────────────────────────────────

  const saveProfile = async () => {
    if (selectedGoals.length === 0) {
      return Alert.alert('Select at least one goal to continue.');
    }
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const heightInches =
        (parseFloat(stats.height_ft) || 0) * 12 + (parseFloat(stats.height_in) || 0);

      await api.post(
        '/profile',
        {
          stats: {
            age:            parseInt(stats.age, 10),
            height_inches:  heightInches,
            weight_lbs:     parseFloat(stats.weight_lbs),
            sex:            stats.sex,
            location:       stats.location,
            activity_level: stats.activity_level,
            medical_notes:  stats.medical_notes || null,
          },
          goals: selectedGoals,
        },
        session?.access_token,
      );
      // Save lifestyle profile locally
      const lifestyleProfile: LifestyleProfile = {
        ...lifestyle,
        last_checkin_date: null,
        checkin_history: [],
      };
      await saveLifestyleProfile(lifestyleProfile);
      setStep('done');
      setTimeout(() => navigation.replace('MainTabs'), 1200);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderProgress = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressText}>{stepIndex + 1} of {STEPS.length}</Text>
    </View>
  );

  // ── Welcome step ──────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.appName}>UpQuest</Text>
          <Text style={styles.tagline}>Upload your labs.{'\n'}Get your perfect daily routine.{'\n'}Stick to it with AI.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep('auth')}>
            <Text style={styles.primaryBtnText}>Get Started →</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>
            Not medical advice — consult your doctor before making health changes.
          </Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Auth step ─────────────────────────────────────────────────────────────
  if (step === 'auth') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
          <SafeAreaView style={styles.flex}>
            {renderProgress()}
            <ScrollView contentContainerStyle={styles.stepContent}>
              <Text style={styles.stepTitle}>Create your account</Text>
              <Text style={styles.stepSubtitle}>We'll send you a magic link — no password needed.</Text>

              {!otpSent ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={sendMagicLink}
                    disabled={loading}
                  >
                    <Text style={styles.primaryBtnText}>{loading ? 'Sending…' : 'Send Code'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.otpHint}>Check {email} for your 6-digit code.</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="000000"
                    placeholderTextColor={Colors.textMuted}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                    onPress={verifyOtp}
                    disabled={loading}
                  >
                    <Text style={styles.primaryBtnText}>{loading ? 'Verifying…' : 'Verify & Continue'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setOtpSent(false)}>
                    <Text style={styles.linkText}>← Change email</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  // ── Stats step ────────────────────────────────────────────────────────────
  if (step === 'stats') {
    const sexOptions = [
      { key: 'male', label: '♂ Male' },
      { key: 'female', label: '♀ Female' },
    ];

    const statsValid =
      stats.age && stats.height_ft && stats.weight_lbs && stats.sex;

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
          <SafeAreaView style={styles.flex}>
            {renderProgress()}
            <ScrollView contentContainerStyle={styles.stepContent}>
              <Text style={styles.stepTitle}>Your stats</Text>
              <Text style={styles.stepSubtitle}>Used to personalize every routine to your body.</Text>

              <StatInput label="Age" placeholder="36" unit="yrs"
                value={stats.age} onChangeText={v => setStats(s => ({ ...s, age: v }))}
                keyboardType="number-pad" />

              <View style={styles.row}>
                <StatInput label="Height" placeholder="5" unit="ft"
                  value={stats.height_ft} onChangeText={v => setStats(s => ({ ...s, height_ft: v }))}
                  keyboardType="number-pad" containerStyle={{ flex: 1, marginRight: 8 }} />
                <StatInput label=" " placeholder="10" unit="in"
                  value={stats.height_in} onChangeText={v => setStats(s => ({ ...s, height_in: v }))}
                  keyboardType="number-pad" containerStyle={{ flex: 1 }} />
              </View>

              <StatInput label="Weight" placeholder="185" unit="lbs"
                value={stats.weight_lbs} onChangeText={v => setStats(s => ({ ...s, weight_lbs: v }))}
                keyboardType="decimal-pad" />

              <Text style={styles.fieldLabel}>Biological Sex</Text>
              <View style={styles.row}>
                {sexOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.chip, stats.sex === opt.key && styles.chipActive, { flex: 1, marginHorizontal: 4 }]}
                    onPress={() => setStats(s => ({ ...s, sex: opt.key as 'male' | 'female' }))}
                  >
                    <Text style={[styles.chipText, stats.sex === opt.key && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <StatInput label="Location (optional)" placeholder="City, State"
                value={stats.location} onChangeText={v => setStats(s => ({ ...s, location: v }))}
                autoCapitalize="words" />

              <Text style={styles.fieldLabel}>Activity Level</Text>
              <View style={styles.activityRow}>
                {ACTIVITY_LEVELS.map(lvl => (
                  <TouchableOpacity
                    key={lvl.key}
                    style={[styles.activityChip, stats.activity_level === lvl.key && styles.chipActive]}
                    onPress={() => setStats(s => ({ ...s, activity_level: lvl.key }))}
                  >
                    <Text style={[styles.chipText, stats.activity_level === lvl.key && styles.chipTextActive]}>
                      {lvl.label}
                    </Text>
                    <Text style={styles.activityDesc}>{lvl.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <StatInput label="Medical Notes (optional)"
                placeholder="e.g. low testosterone, high cholesterol, on metformin…"
                value={stats.medical_notes}
                onChangeText={v => setStats(s => ({ ...s, medical_notes: v }))}
                multiline numberOfLines={3} />

              <TouchableOpacity
                style={[styles.primaryBtn, !statsValid && styles.btnDisabled]}
                onPress={() => setStep('goals')}
                disabled={!statsValid}
              >
                <Text style={styles.primaryBtnText}>Next: Choose Goals →</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  // ── Goals step ────────────────────────────────────────────────────────────
  if (step === 'goals') {
    return (
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
        <SafeAreaView style={styles.flex}>
          {renderProgress()}
          <ScrollView contentContainerStyle={styles.stepContent}>
            <Text style={styles.stepTitle}>What are you working toward?</Text>
            <Text style={styles.stepSubtitle}>
              Select all that apply — your AI routine will be tailored to every one.
            </Text>

            <GoalSelector
              selectedGoals={selectedGoals}
              onToggle={(key) =>
                setSelectedGoals(prev =>
                  prev.includes(key) ? prev.filter(g => g !== key) : [...prev, key]
                )
              }
            />

            <TouchableOpacity
              style={[styles.primaryBtn, selectedGoals.length === 0 && styles.btnDisabled]}
              onPress={() => setStep('lifestyle')}
              disabled={selectedGoals.length === 0}
            >
              <Text style={styles.primaryBtnText}>
                {`Next: Your Schedule (${selectedGoals.length} goals selected) →`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Lifestyle step ────────────────────────────────────────────────────────
  if (step === 'lifestyle') {
    const WORK_OPTIONS = [
      { key: 'full_time',    label: '💼 Full-time job' },
      { key: 'part_time',    label: '⏰ Part-time work' },
      { key: 'student',      label: '🎓 Student' },
      { key: 'stay_at_home', label: '🏠 Stay-at-home parent' },
      { key: 'entrepreneur', label: '🚀 Entrepreneur' },
      { key: 'retired',      label: '🌴 Retired' },
    ];
    const WAKE_TIMES = ['5:00 AM','6:00 AM','7:00 AM','8:00 AM','9:00 AM+'];
    const BEDTIMES   = ['8:30 PM','9:30 PM','10:30 PM','11:30 PM','12:30 AM+'];
    const COMMUTES   = [
      { val: 0,  label: 'None / WFH' },
      { val: 20, label: '< 30 min' },
      { val: 45, label: '30–60 min' },
      { val: 90, label: '1 hr+' },
    ];
    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const DAY_FULL: Record<string,string> = { Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday' };

    const toggleDay = (short: string) => {
      const full = DAY_FULL[short];
      setLifestyle(l => ({
        ...l,
        work_days: l.work_days.includes(full)
          ? l.work_days.filter(d => d !== full)
          : [...l.work_days, full],
      }));
    };

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
          <SafeAreaView style={styles.flex}>
            {renderProgress()}
            <ScrollView contentContainerStyle={styles.stepContent}>
              <Text style={styles.stepTitle}>Your weekly schedule</Text>
              <Text style={styles.stepSubtitle}>
                Helps your AI coach plan workouts around your real life — not an imaginary one.
              </Text>

              <Text style={styles.fieldLabel}>Work / Life Situation</Text>
              <View style={styles.activityRow}>
                {WORK_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.activityChip, lifestyle.work_situation === opt.key && styles.chipActive]}
                    onPress={() => setLifestyle(l => ({ ...l, work_situation: opt.key }))}
                  >
                    <Text style={[styles.chipText, lifestyle.work_situation === opt.key && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Typical Work / School Days</Text>
              <View style={styles.row}>
                {DAYS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.chip,
                      { flex: 1, marginHorizontal: 2, paddingHorizontal: 4 },
                      lifestyle.work_days.includes(DAY_FULL[d]) && styles.chipActive,
                    ]}
                    onPress={() => toggleDay(d)}
                  >
                    <Text style={[styles.chipText, lifestyle.work_days.includes(DAY_FULL[d]) && styles.chipTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Wake Time</Text>
              <View style={[styles.activityRow, { marginBottom: Spacing.lg }]}>
                {WAKE_TIMES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.activityChip, lifestyle.wake_time === t && styles.chipActive]}
                    onPress={() => setLifestyle(l => ({ ...l, wake_time: t }))}
                  >
                    <Text style={[styles.chipText, lifestyle.wake_time === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Bedtime</Text>
              <View style={[styles.activityRow, { marginBottom: Spacing.lg }]}>
                {BEDTIMES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.activityChip, lifestyle.bedtime === t && styles.chipActive]}
                    onPress={() => setLifestyle(l => ({ ...l, bedtime: t }))}
                  >
                    <Text style={[styles.chipText, lifestyle.bedtime === t && styles.chipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Daily Commute</Text>
              <View style={[styles.activityRow, { marginBottom: Spacing.lg }]}>
                {COMMUTES.map(c => (
                  <TouchableOpacity
                    key={c.val}
                    style={[styles.activityChip, lifestyle.commute_minutes === c.val && styles.chipActive]}
                    onPress={() => setLifestyle(l => ({ ...l, commute_minutes: c.val }))}
                  >
                    <Text style={[styles.chipText, lifestyle.commute_minutes === c.val && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Kids or dependents to care for?</Text>
              <View style={styles.row}>
                {[{ v: true, label: '👶 Yes' }, { v: false, label: 'No' }].map(opt => (
                  <TouchableOpacity
                    key={String(opt.v)}
                    style={[styles.chip, { flex: 1, marginHorizontal: 4 }, lifestyle.has_dependents === opt.v && styles.chipActive]}
                    onPress={() => setLifestyle(l => ({ ...l, has_dependents: opt.v }))}
                  >
                    <Text style={[styles.chipText, lifestyle.has_dependents === opt.v && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={saveProfile}
                disabled={loading}
              >
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Building your profile…' : 'Build My Quest →'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  // ── Done step ─────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
      <SafeAreaView style={[styles.flex, styles.center]}>
        <Text style={{ fontSize: 64 }}>🚀</Text>
        <Text style={styles.stepTitle}>You're all set!</Text>
        <Text style={styles.stepSubtitle}>Generating your personalized Quest…</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:        { flex: 1 },
  center:      { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  logo:        { fontSize: 72, marginBottom: Spacing.md },
  appName:     { fontSize: Typography['3xl'], fontWeight: Typography.black, color: Colors.textPrimary, letterSpacing: 2 },
  tagline:     { fontSize: Typography.lg, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, marginBottom: Spacing['3xl'], lineHeight: 28 },

  progressContainer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  progressTrack:     { height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill:      { height: '100%', backgroundColor: Colors.primary, borderRadius: Radius.full },
  progressText:      { color: Colors.textMuted, fontSize: Typography.xs, marginTop: Spacing.xs, textAlign: 'right' },

  stepContent:  { padding: Spacing.xl, paddingBottom: Spacing['5xl'] },
  stepTitle:    { fontSize: Typography['2xl'], fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  stepSubtitle: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing['2xl'], lineHeight: 22 },

  fieldLabel: { color: Colors.textSecondary, fontSize: Typography.sm, fontWeight: Typography.semibold, marginBottom: Spacing.sm, marginTop: Spacing.lg },

  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    color: Colors.textPrimary,
    fontSize: Typography.md,
    marginBottom: Spacing.lg,
  },
  otpInput:  { fontSize: 28, textAlign: 'center', letterSpacing: 12 },
  otpHint:   { color: Colors.textSecondary, marginBottom: Spacing.lg, textAlign: 'center' },

  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius:    Radius.lg,
    paddingVertical: Spacing.lg,
    alignItems:      'center',
    marginTop:       Spacing.lg,
  },
  primaryBtnText: { color: '#fff', fontSize: Typography.md, fontWeight: Typography.bold },
  btnDisabled:    { opacity: 0.4 },

  linkText: { color: Colors.primary, textAlign: 'center', marginTop: Spacing.lg, fontSize: Typography.sm },

  row:          { flexDirection: 'row', marginBottom: Spacing.sm },
  chip:         { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center', marginBottom: Spacing.sm },
  chipActive:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:     { color: Colors.textSecondary, fontWeight: Typography.semibold, fontSize: Typography.sm },
  chipTextActive: { color: '#fff' },

  activityRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.xl },
  activityChip: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center', minWidth: 80 },
  activityDesc: { color: Colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },

  disclaimer: { color: Colors.textMuted, fontSize: Typography.xs, textAlign: 'center', marginTop: Spacing['3xl'], lineHeight: 18 },
});
