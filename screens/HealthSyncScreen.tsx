/**
 * UpQuest – HealthSyncScreen
 * Full Apple Health + Apple Watch dashboard.
 * All data auto-refreshes on focus. Pull-to-refresh also works.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initHealthKit, getHealthSnapshot, healthSnapshotToText, isHealthAvailable,
  getHeartRateZones, HEALTH_CACHE_KEY,
  type HealthSnapshot,
} from '../utils/health';
import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = {
  bg:      '#0A0A0F',
  surface: '#16161E',
  card:    '#1A1A24',
  border:  '#2A2A38',
  primary: '#7C3AED',
  green:   '#22C55E',
  amber:   '#F59E0B',
  red:     '#EF4444',
  blue:    '#3B82F6',
  cyan:    '#06B6D4',
  purple:  '#8B5CF6',
  text:    '#F0F0FF',
  muted:   '#5A5A70',
  sub:     '#9090A8',
};

// ── Ring Progress component ───────────────────────────────────────────────────

function RingProgress({ pct, color, label, value, unit, icon }: {
  pct: number; color: string; label: string;
  value: string | null; unit: string; icon: string;
}) {
  const clamped = Math.min(Math.max(pct, 0), 1);
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={styles.ringWrap}>
        {/* Background ring */}
        <View style={[styles.ringBg, { borderColor: `${color}22` }]} />
        {/* Progress overlay — simplified via opacity-scaled fill */}
        <View style={[styles.ringFill, { borderColor: color, opacity: clamped > 0 ? 0.2 + clamped * 0.8 : 0 }]} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
          <Text style={{ color: C.text, fontSize: 14, fontWeight: '800', marginTop: 2 }}>
            {value ?? '—'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 10 }}>{unit}</Text>
        </View>
      </View>
      <Text style={{ color: C.sub, fontSize: 12, marginTop: 6, textAlign: 'center' }}>{label}</Text>
      {/* Linear progress bar below ring */}
      <View style={{ height: 3, width: 68, backgroundColor: `${color}22`, borderRadius: 2, marginTop: 4 }}>
        <View style={{ height: 3, width: `${clamped * 100}%`, backgroundColor: color, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, unit, color, sub }: {
  icon: string; label: string; value: string | null;
  unit: string; color: string; sub?: string;
}) {
  return (
    <View style={[styles.metricCard, { borderColor: `${color}30` }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[styles.metricVal, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.metricUnit}>{unit}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {sub ? <Text style={[styles.metricSub, { color: `${color}BB` }]}>{sub}</Text> : null}
    </View>
  );
}

// ── Sleep stage bar ───────────────────────────────────────────────────────────

function SleepStage({ label, hours, color, target }: {
  label: string; hours: number | null; color: string; target: number;
}) {
  const pct = hours != null ? Math.min(hours / target, 1) : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ height: 64, width: 12, backgroundColor: `${color}22`, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' }}>
        <View style={{ height: `${pct * 100}%`, backgroundColor: color, borderRadius: 6 }} />
      </View>
      <Text style={{ color, fontSize: 14, fontWeight: '800', marginTop: 6 }}>
        {hours != null ? `${hours}h` : '—'}
      </Text>
      <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: `${color}15`, borderRadius: 12, padding: 14,
      alignItems: 'center', borderWidth: 1, borderColor: `${color}30` }}>
      <Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

// ── Category helpers ──────────────────────────────────────────────────────────

function hrCategory(bpm: number) {
  if (bpm < 50) return 'Athlete ⚡';
  if (bpm < 60) return 'Excellent';
  if (bpm < 70) return 'Good';
  if (bpm < 80) return 'Average';
  return 'Above avg';
}
function hrvCategory(ms: number) {
  if (ms > 80) return 'Excellent';
  if (ms > 60) return 'Good';
  if (ms > 40) return 'Average';
  return 'Low — recover';
}
function vo2Category(v: number) {
  if (v >= 55) return 'Superior 🏆';
  if (v >= 45) return 'Excellent';
  if (v >= 38) return 'Good';
  if (v >= 30) return 'Fair';
  return 'Poor';
}
function spo2Category(pct: number) {
  if (pct >= 98) return 'Normal ✓';
  if (pct >= 95) return 'Acceptable';
  return '⚠️ Consult doctor';
}
function bmiCategory(bmi: number) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25)   return 'Normal ✓';
  if (bmi < 30)   return 'Overweight';
  return 'Obese';
}
function sleepCategory(hrs: number) {
  if (hrs >= 8) return '😴 Excellent';
  if (hrs >= 7) return '✅ Good';
  if (hrs >= 6) return '⚠️ Short';
  return '❌ Too little';
}
function sleepBg(hrs: number) {
  if (hrs >= 7) return C.green;
  if (hrs >= 6) return C.amber;
  return C.red;
}
function zoneColor(zone: number): string {
  const map: Record<number, string> = { 1: '#06B6D4', 2: '#22C55E', 3: '#F59E0B', 4: '#EF4444', 5: '#7C3AED' };
  return map[zone] ?? C.primary;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HealthSyncScreen() {
  const navigation = useNavigation<Nav>();

  const [snap,            setSnap]            = useState<HealthSnapshot | null>(null);
  const [profile,         setProfile]         = useState<any>(null);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [lastSync,        setLastSync]        = useState<string | null>(null);
  const [permDenied,      setPermDenied]      = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await AsyncStorage.getItem('upquest_profile');
      setProfile(p ? JSON.parse(p) : null);

      if (isHealthAvailable()) {
        // Always call initHealthKit first — it's idempotent and resolves instantly
        // if already initialised, but ensures _permitted is set before reading data.
        const granted = await initHealthKit();
        if (!granted) {
          setPermDenied(true);
          return;
        }
        setPermDenied(false);
        const snapshot = await getHealthSnapshot();
        setSnap(snapshot);
        // Write to cache so PlanChatScreen can read it without making native calls
        try {
          const txt = healthSnapshotToText(snapshot);
          if (txt) {
            await AsyncStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify({ text: txt, cachedAt: Date.now() }));
          }
        } catch {}
        setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.warn('HealthSyncScreen error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const stepGoal     = profile?.dailyStepGoal   ?? 10000;
  const calGoal      = profile?.dailyCalGoal    ?? 500;
  const exerciseGoal = profile?.exerciseMinGoal ?? 30;
  const age          = profile?.age             ?? 30;

  const zones = snap?.restingHeartRate
    ? getHeartRateZones(snap.restingHeartRate, age)
    : null;

  // ── Not on iOS / not linked ───────────────────────────────────────────────

  if (!isHealthAvailable()) {
    return (
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <Ionicons name="arrow-back" size={24} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Health Sync</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:32 }}>
            <Text style={{ fontSize: 56, marginBottom: 18 }}>🍎</Text>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 10 }}>
              Apple Health Not Available
            </Text>
            <Text style={{ color: C.sub, textAlign: 'center', lineHeight: 22, fontSize: 15 }}>
              HealthKit requires a native iOS build. Run{' '}
              <Text style={{ color: C.primary, fontWeight: '700' }}>eas build --platform ios</Text>
              {' '}in your terminal to unlock the full experience.
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Permissions denied state ────────────────────────────────────────────────

  if (isHealthAvailable() && permDenied && !loading) {
    return (
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <Ionicons name="arrow-back" size={24} color={C.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>Health Sync</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>
          <View style={{ flex:1, justifyContent:'center', alignItems:'center', padding:32 }}>
            <Text style={{ fontSize: 56, marginBottom: 18 }}>🔒</Text>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
              Health Access Needed
            </Text>
            <Text style={{ color: C.sub, textAlign: 'center', lineHeight: 22, fontSize: 15, marginBottom: 28 }}>
              UpQuest needs permission to read your Apple Health data. Please enable it in Settings.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
              onPress={() => {
                // Open iOS Settings → UpQuest → Health
                const { Linking } = require('react-native');
                Linking.openURL('app-settings:').catch(() => {});
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => { setLoading(true); load(); }}>
              <Text style={{ color: C.primary, fontSize: 14 }}>Try again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
            <Ionicons name="arrow-back" size={24} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Health Sync</Text>
            {lastSync && (
              <Text style={styles.headerSub}>Synced {lastSync} · Apple Health &amp; Watch</Text>
            )}
          </View>
          <TouchableOpacity onPress={onRefresh} disabled={refreshing} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
            <Ionicons name="refresh" size={22} color={refreshing ? C.muted : C.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Loading ── */}
        {loading ? (
          <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
            <ActivityIndicator size="large" color={C.primary} />
            <Text style={{ color: C.muted, marginTop: 14, fontSize: 14 }}>Reading Apple Health…</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
            }
          >
            {/* ── Today's Activity Rings ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏃 Today's Activity</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 16, paddingBottom: 6 }}>
                <RingProgress
                  pct={snap?.stepsToday ? snap.stepsToday / stepGoal : 0}
                  color={C.green} icon="👣" label="Steps"
                  value={snap?.stepsToday != null ? Math.round(snap.stepsToday).toLocaleString() : null}
                  unit={`/${stepGoal.toLocaleString()}`}
                />
                <RingProgress
                  pct={snap?.activeCaloriesToday ? snap.activeCaloriesToday / calGoal : 0}
                  color={C.amber} icon="🔥" label="Active Cal"
                  value={snap?.activeCaloriesToday != null ? Math.round(snap.activeCaloriesToday).toString() : null}
                  unit={`/${calGoal} kcal`}
                />
                <RingProgress
                  pct={snap?.exerciseMinutesToday ? snap.exerciseMinutesToday / exerciseGoal : 0}
                  color={C.cyan} icon="⚡" label="Exercise"
                  value={snap?.exerciseMinutesToday?.toString() ?? null}
                  unit={`/${exerciseGoal} min`}
                />
              </View>
            </View>

            {/* ── Heart & Cardio ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>❤️ Heart &amp; Cardio</Text>
              <View style={styles.metricGrid}>
                <MetricCard icon="💓" label="Resting HR" color={C.red}
                  value={snap?.restingHeartRate != null ? Math.round(snap.restingHeartRate).toString() : null}
                  unit="bpm"
                  sub={snap?.restingHeartRate ? hrCategory(snap.restingHeartRate) : undefined}
                />
                <MetricCard icon="📊" label="HRV" color={C.purple}
                  value={snap?.latestHRV != null ? Math.round(snap.latestHRV).toString() : null}
                  unit="ms SDNN"
                  sub={snap?.latestHRV ? hrvCategory(snap.latestHRV) : undefined}
                />
                <MetricCard icon="🏔️" label="VO2 Max" color={C.blue}
                  value={snap?.latestVO2Max != null ? snap.latestVO2Max.toFixed(1) : null}
                  unit="mL/kg/min"
                  sub={snap?.latestVO2Max ? vo2Category(snap.latestVO2Max) : undefined}
                />
                <MetricCard icon="🩸" label="Blood O₂" color={C.cyan}
                  value={snap?.latestBloodOxygen?.toString() ?? null}
                  unit="%"
                  sub={snap?.latestBloodOxygen ? spo2Category(snap.latestBloodOxygen) : undefined}
                />
              </View>
            </View>

            {/* ── Body Composition ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚖️ Body Composition</Text>
              <View style={styles.metricGrid}>
                <MetricCard icon="⚖️" label="Weight" color={C.green}
                  value={snap?.latestWeightLbs != null ? snap.latestWeightLbs.toFixed(1) : null}
                  unit="lbs"
                />
                <MetricCard icon="📐" label="BMI" color={C.amber}
                  value={snap?.latestBMI?.toFixed(1) ?? null}
                  unit="kg/m²"
                  sub={snap?.latestBMI ? bmiCategory(snap.latestBMI) : undefined}
                />
                <MetricCard icon="💪" label="Body Fat" color={C.primary}
                  value={snap?.latestBodyFatPct != null ? `${snap.latestBodyFatPct.toFixed(1)}` : null}
                  unit="%"
                />
              </View>
            </View>

            {/* ── Sleep ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>😴 Last Night's Sleep</Text>
              {snap?.lastNightSleepHrs != null ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 }}>
                    <Text style={{ color: C.blue, fontSize: 40, fontWeight: '800' }}>
                      {snap.lastNightSleepHrs}
                    </Text>
                    <Text style={{ color: C.sub, fontSize: 16 }}>hrs total</Text>
                    <View style={{ marginLeft: 6, backgroundColor: `${sleepBg(snap.lastNightSleepHrs)}22`,
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: sleepBg(snap.lastNightSleepHrs), fontSize: 13, fontWeight: '600' }}>
                        {sleepCategory(snap.lastNightSleepHrs)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
                    <SleepStage label="Deep" hours={snap.lastNightDeepSleepHrs} color="#6366F1" target={1.5} />
                    <SleepStage label="REM"  hours={snap.lastNightREMSleepHrs}  color={C.purple} target={1.5} />
                    <SleepStage
                      label="Light"
                      hours={
                        snap.lastNightSleepHrs != null
                          ? +((snap.lastNightSleepHrs - (snap.lastNightDeepSleepHrs ?? 0) - (snap.lastNightREMSleepHrs ?? 0)).toFixed(1))
                          : null
                      }
                      color={C.blue}
                      target={4}
                    />
                    <SleepStage label="Total" hours={snap.lastNightSleepHrs} color={C.cyan} target={8} />
                  </View>

                  <Text style={{ color: C.muted, fontSize: 12, marginTop: 14 }}>
                    💡 7–9 hrs recommended · Deep + REM &gt; 25% is ideal
                  </Text>
                </>
              ) : (
                <Text style={{ color: C.muted, marginTop: 14, fontSize: 14, lineHeight: 20 }}>
                  No sleep data found.{'\n'}Wear your Apple Watch while sleeping to track sleep stages automatically.
                </Text>
              )}
            </View>

            {/* ── Weekly Training ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏋️ This Week's Training</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <StatPill
                  label="Workouts" color={C.green}
                  value={(snap?.workoutsThisWeek ?? 0).toString()}
                />
                <StatPill
                  label="Avg Duration" color={C.blue}
                  value={snap?.avgWorkoutMinutes ? `${snap.avgWorkoutMinutes}m` : '—'}
                />
                <StatPill
                  label="Active Cal" color={C.amber}
                  value={snap?.totalActiveCalWeek ? snap.totalActiveCalWeek.toLocaleString() : '—'}
                />
              </View>

              {/* Weekly goal progress bar */}
              {(snap?.workoutsThisWeek ?? 0) > 0 && (
                <View style={{ marginTop: 18 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: C.sub, fontSize: 12 }}>Weekly workout goal</Text>
                    <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>
                      {snap!.workoutsThisWeek}/5
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: `${C.green}22`, borderRadius: 4 }}>
                    <View style={{
                      height: 8, borderRadius: 4, backgroundColor: C.green,
                      width: `${Math.min((snap!.workoutsThisWeek / 5) * 100, 100)}%`,
                    }} />
                  </View>
                </View>
              )}
            </View>

            {/* ── Heart Rate Zones ── */}
            {zones && snap?.restingHeartRate && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📈 Heart Rate Zones</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                  Resting HR {Math.round(snap.restingHeartRate)} bpm · Age {age}
                </Text>
                <View style={{ marginTop: 14, gap: 12 }}>
                  {zones.map((z: any) => (
                    <View key={z.zone}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={{ color: C.text, fontSize: 13 }}>
                          <Text style={{ fontWeight: '700', color: zoneColor(z.zone) }}>Z{z.zone}</Text>
                          {'  '}{z.label}
                        </Text>
                        <Text style={{ color: C.muted, fontSize: 12 }}>
                          {z.minBPM}–{z.maxBPM} bpm
                        </Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: `${zoneColor(z.zone)}22`, borderRadius: 3 }}>
                        {/* Each zone = 20% of bar as placeholder — real minutes need HR samples */}
                        <View style={{ height: 6, width: '20%', backgroundColor: zoneColor(z.zone), borderRadius: 3 }} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Apple Health attribution ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, marginTop: 4, opacity: 0.5 }}>
              <Text style={{ fontSize: 16 }}>🍎</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                Data sourced from Apple Health &amp; Apple Watch
              </Text>
            </View>

          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
                 paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },
  headerSub:   { textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 2 },
  scroll:      { padding: 16, paddingBottom: 48, gap: 14 },
  card:        { backgroundColor: C.card, borderRadius: 16, padding: 16,
                 borderWidth: 1, borderColor: C.border },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: 0.2 },
  metricGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metricCard:  { flex: 1, minWidth: '44%', backgroundColor: C.surface, borderRadius: 12,
                 padding: 12, alignItems: 'center', borderWidth: 1, gap: 2 },
  metricVal:   { fontSize: 24, fontWeight: '800', marginTop: 6 },
  metricUnit:  { fontSize: 11, color: C.muted, marginTop: 1 },
  metricLabel: { fontSize: 12, color: C.sub, marginTop: 2 },
  metricSub:   { fontSize: 11, marginTop: 3 },
  ringWrap:    { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  ringBg:      { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 8 },
  ringFill:    { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 8 },
});
