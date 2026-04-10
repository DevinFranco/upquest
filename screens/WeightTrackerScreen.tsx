import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────
interface WeightEntry { date: string; weight: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STORAGE_LOG  = 'upquest_weight_log';
const STORAGE_GOAL = 'upquest_weight_goal';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const todayISO = () => new Date().toISOString().split('T')[0];

/** Given current & goal, return milestone weights (every 5 lbs) with target dates. */
function buildMilestones(current: number, goal: number): { weight: number; date: string }[] {
  if (!goal || current === goal) return [];
  const losing   = goal < current;
  const ratePerWeek = losing ? 1.5 : 0.5;          // lbs/week — safe rates
  const step     = losing ? -5 : 5;
  const milestones: { weight: number; date: string }[] = [];
  const start    = new Date();

  let w = current + step;
  while (losing ? w >= goal : w <= goal) {
    const lbsToHere = Math.abs(current - w);
    const weeksOut  = lbsToHere / ratePerWeek;
    const d         = new Date(start);
    d.setDate(d.getDate() + Math.round(weeksOut * 7));
    milestones.push({ weight: Math.round(w * 10) / 10, date: d.toISOString().split('T')[0] });
    w += step;
  }
  // Final goal milestone
  const totalLbs  = Math.abs(current - goal);
  const weeksOut  = totalLbs / ratePerWeek;
  const goalDate  = new Date(start);
  goalDate.setDate(goalDate.getDate() + Math.round(weeksOut * 7));
  milestones.push({ weight: goal, date: goalDate.toISOString().split('T')[0] });

  return milestones;
}

// ─── Mini sparkline chart (pure RN Views, no SVG) ────────────────────────────
function SparkChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return (
    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Text style={{ color: '#5A5A70', fontSize: 13 }}>Log at least 2 entries to see your chart</Text>
    </View>
  );

  const recent  = [...entries].slice(-14);          // last 14 entries
  const weights = recent.map(e => e.weight);
  const minW    = Math.min(...weights);
  const maxW    = Math.max(...weights);
  const range   = maxW - minW || 1;
  const BAR_H   = 80;

  return (
    <View>
      {/* Y-axis labels */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        {recent.map((e, i) => {
          const heightPct = ((e.weight - minW) / range);
          const barHeight = Math.max(8, BAR_H * heightPct + 8);
          const isLast    = i === recent.length - 1;
          return (
            <View key={e.date} style={{ flex: 1, alignItems: 'center' }}>
              <View style={[
                styles.bar,
                { height: barHeight },
                isLast && { backgroundColor: '#7C3AED' },
              ]} />
            </View>
          );
        })}
      </View>
      {/* X-axis labels — first, middle, last */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={styles.axisLabel}>{fmtDate(recent[0].date)}</Text>
        {recent.length > 4 && (
          <Text style={styles.axisLabel}>{fmtDate(recent[Math.floor(recent.length / 2)].date)}</Text>
        )}
        <Text style={styles.axisLabel}>{fmtDate(recent[recent.length - 1].date)}</Text>
      </View>
      {/* Min / max */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={[styles.axisLabel, { color: '#10B981' }]}>Low: {minW} lbs</Text>
        <Text style={[styles.axisLabel, { color: '#EF4444' }]}>High: {maxW} lbs</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function WeightTrackerScreen() {
  const [entries,    setEntries]    = useState<WeightEntry[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [showModal,  setShowModal]  = useState<'log' | 'goal' | null>(null);
  const [inputVal,   setInputVal]   = useState('');
  const [inputDate,  setInputDate]  = useState(todayISO());

  // Load data on focus
  useFocusEffect(useCallback(() => {
    (async () => {
      const [logRaw, goalRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_LOG),
        AsyncStorage.getItem(STORAGE_GOAL),
      ]);
      if (logRaw)  setEntries(JSON.parse(logRaw));
      if (goalRaw) setGoalWeight(parseFloat(goalRaw));
    })();
  }, []));

  // ── Derived values ────────────────────────────────────────────────────────
  const sorted      = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest      = sorted[sorted.length - 1] ?? null;
  const startEntry  = sorted[0] ?? null;
  const currentW    = latest?.weight ?? null;
  const startW      = startEntry?.weight ?? null;
  const totalChange = currentW && startW ? +(currentW - startW).toFixed(1) : null;
  const toGoal      = currentW && goalWeight ? +(currentW - goalWeight).toFixed(1) : null;
  const progress    = currentW && goalWeight && startW
    ? Math.min(1, Math.max(0, Math.abs(startW - currentW) / Math.abs(startW - goalWeight)))
    : 0;
  const milestones  = currentW && goalWeight ? buildMilestones(currentW, goalWeight) : [];

  // ── Log weight ────────────────────────────────────────────────────────────
  const saveEntry = async () => {
    const w = parseFloat(inputVal);
    if (!w || w < 50 || w > 700) { Alert.alert('Enter a valid weight (50–700 lbs)'); return; }
    const newEntry: WeightEntry = { date: inputDate || todayISO(), weight: w };
    const updated = [...entries.filter(e => e.date !== newEntry.date), newEntry]
      .sort((a, b) => a.date.localeCompare(b.date));
    setEntries(updated);
    await AsyncStorage.setItem(STORAGE_LOG, JSON.stringify(updated));
    setShowModal(null);
    setInputVal('');
    setInputDate(todayISO());
  };

  // ── Save goal ─────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    const g = parseFloat(inputVal);
    if (!g || g < 50 || g > 700) { Alert.alert('Enter a valid goal weight (50–700 lbs)'); return; }
    setGoalWeight(g);
    await AsyncStorage.setItem(STORAGE_GOAL, String(g));
    setShowModal(null);
    setInputVal('');
  };

  const deleteEntry = (date: string) => {
    Alert.alert('Remove entry?', fmtDate(date), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const updated = entries.filter(e => e.date !== date);
        setEntries(updated);
        await AsyncStorage.setItem(STORAGE_LOG, JSON.stringify(updated));
      }},
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Text style={styles.title}>⚖️  Weight Tracker</Text>
          <Text style={styles.sub}>Log your weight and track progress toward your goal.</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { flex: 1 }]}>
              <Text style={styles.statLabel}>Current</Text>
              <Text style={styles.statVal}>{currentW ? `${currentW}` : '—'}</Text>
              <Text style={styles.statUnit}>lbs</Text>
              {totalChange !== null && (
                <Text style={[styles.changeBadge, { color: totalChange <= 0 ? '#10B981' : '#EF4444' }]}>
                  {totalChange > 0 ? '+' : ''}{totalChange} lbs total
                </Text>
              )}
            </View>

            <TouchableOpacity style={[styles.statCard, { flex: 1 }]} onPress={() => { setInputVal(goalWeight ? String(goalWeight) : ''); setShowModal('goal'); }}>
              <Text style={styles.statLabel}>Goal</Text>
              <Text style={[styles.statVal, { color: '#7C3AED' }]}>{goalWeight ?? '—'}</Text>
              <Text style={styles.statUnit}>lbs</Text>
              <Text style={{ color: '#7C3AED', fontSize: 11, marginTop: 4 }}>tap to set</Text>
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          {goalWeight && currentW && startW && startW !== goalWeight && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={styles.sectionTitle}>Progress to Goal</Text>
                <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 14 }}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              {toGoal !== null && (
                <Text style={{ color: '#9090A8', fontSize: 13, marginTop: 8 }}>
                  {Math.abs(toGoal)} lbs {toGoal > 0 ? 'to lose' : 'to gain'} to reach your goal
                </Text>
              )}
            </View>
          )}

          {/* Log button */}
          <TouchableOpacity style={styles.logBtn} onPress={() => { setInputVal(''); setInputDate(todayISO()); setShowModal('log'); }}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.logBtnTxt}>Log Today's Weight</Text>
          </TouchableOpacity>

          {/* Chart */}
          {sorted.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📈 Progress Chart</Text>
              <View style={{ marginTop: 16 }}>
                <SparkChart entries={sorted} />
              </View>
            </View>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>📅 Goal Milestones</Text>
              <Text style={{ color: '#5A5A70', fontSize: 12, marginBottom: 14, marginTop: 2 }}>
                Based on a healthy {goalWeight && currentW && goalWeight < currentW ? '1.5' : '0.5'} lb/week pace
              </Text>
              {milestones.map((m, i) => {
                const isGoal    = i === milestones.length - 1;
                const isPassed  = currentW ? (goalWeight! < currentW! ? currentW! <= m.weight : currentW! >= m.weight) : false;
                return (
                  <View key={m.weight} style={styles.milestone}>
                    <View style={[styles.milestoneDot, isPassed && styles.milestoneDotDone, isGoal && styles.milestoneDotGoal]} />
                    {i < milestones.length - 1 && <View style={styles.milestoneLine} />}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.milestoneWeight, isGoal && { color: '#7C3AED' }]}>
                        {isGoal ? '🎯 ' : ''}{m.weight} lbs
                      </Text>
                      <Text style={styles.milestoneDate}>{fmtDate(m.date)}</Text>
                    </View>
                    {isPassed && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                  </View>
                );
              })}
            </View>
          )}

          {/* History */}
          {sorted.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>🗓 History</Text>
              {[...sorted].reverse().map(e => (
                <TouchableOpacity key={e.date} style={styles.historyRow} onLongPress={() => deleteEntry(e.date)}>
                  <Text style={styles.historyDate}>{fmtDate(e.date)}</Text>
                  <Text style={styles.historyWeight}>{e.weight} lbs</Text>
                </TouchableOpacity>
              ))}
              <Text style={{ color: '#3A3A4A', fontSize: 11, marginTop: 10, textAlign: 'center' }}>
                Long-press an entry to remove it
              </Text>
            </View>
          )}

          {/* Empty state */}
          {sorted.length === 0 && (
            <View style={[styles.card, { alignItems: 'center', paddingVertical: 36 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>⚖️</Text>
              <Text style={{ color: '#F0F0FF', fontWeight: '700', fontSize: 16, marginBottom: 6 }}>No entries yet</Text>
              <Text style={{ color: '#5A5A70', fontSize: 14, textAlign: 'center' }}>
                Tap "Log Today's Weight" above to get started. Set a goal to unlock milestones and a progress chart.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Log / Goal Modal ────────────────────────────────────────────── */}
      <Modal visible={!!showModal} transparent animationType="slide" onRequestClose={() => setShowModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              {showModal === 'log' ? 'Log Weight' : 'Set Goal Weight'}
            </Text>

            {showModal === 'log' && (
              <>
                <Text style={styles.sheetLabel}>Date</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={inputDate}
                  onChangeText={setInputDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#3A3A4A"
                  keyboardType="numbers-and-punctuation"
                />
              </>
            )}

            <Text style={styles.sheetLabel}>
              {showModal === 'log' ? 'Weight (lbs)' : 'Goal Weight (lbs)'}
            </Text>
            <TextInput
              style={styles.sheetInput}
              value={inputVal}
              onChangeText={setInputVal}
              placeholder={showModal === 'log' ? '185.5' : '165'}
              placeholderTextColor="#3A3A4A"
              keyboardType="decimal-pad"
              autoFocus
            />

            <TouchableOpacity
              style={[styles.sheetBtn, !inputVal.trim() && { opacity: 0.4 }]}
              onPress={showModal === 'log' ? saveEntry : saveGoal}
              disabled={!inputVal.trim()}
            >
              <Text style={styles.sheetBtnTxt}>
                {showModal === 'log' ? 'Save Entry' : 'Set Goal'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowModal(null)} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: '#5A5A70', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page:          { padding: 20, paddingBottom: 60 },
  title:         { fontSize: 26, fontWeight: '800', color: '#F0F0FF', marginBottom: 6 },
  sub:           { fontSize: 14, color: '#5A5A70', marginBottom: 20, lineHeight: 20 },

  statsRow:      { flexDirection: 'row', gap: 12, marginBottom: 14 },
  statCard:      { backgroundColor: '#16161E', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2A2A38', alignItems: 'center' },
  statLabel:     { color: '#5A5A70', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  statVal:       { color: '#F0F0FF', fontSize: 32, fontWeight: '800' },
  statUnit:      { color: '#5A5A70', fontSize: 13 },
  changeBadge:   { fontSize: 12, fontWeight: '600', marginTop: 6 },

  card:          { backgroundColor: '#16161E', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#2A2A38' },
  sectionTitle:  { color: '#F0F0FF', fontWeight: '700', fontSize: 15 },

  progressTrack: { height: 10, backgroundColor: '#2A2A38', borderRadius: 5, overflow: 'hidden' },
  progressFill:  { height: 10, backgroundColor: '#7C3AED', borderRadius: 5, minWidth: 10 },

  logBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 15, marginBottom: 14 },
  logBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Chart
  bar:           { backgroundColor: '#4F46E5', borderRadius: 4, width: '100%' },
  axisLabel:     { color: '#5A5A70', fontSize: 11 },

  // Milestones
  milestone:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 0, position: 'relative', paddingBottom: 20 },
  milestoneDot:  { width: 14, height: 14, borderRadius: 7, backgroundColor: '#2A2A38', borderWidth: 2, borderColor: '#3A3A4A', marginTop: 2, zIndex: 1 },
  milestoneDotDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  milestoneDotGoal: { backgroundColor: '#7C3AED', borderColor: '#7C3AED', width: 16, height: 16, borderRadius: 8 },
  milestoneLine: { position: 'absolute', left: 6, top: 16, width: 2, bottom: -4, backgroundColor: '#2A2A38' },
  milestoneWeight:  { color: '#F0F0FF', fontWeight: '700', fontSize: 15 },
  milestoneDate:    { color: '#5A5A70', fontSize: 12, marginTop: 2 },

  // History
  historyRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1E2A' },
  historyDate:   { color: '#9090A8', fontSize: 14 },
  historyWeight: { color: '#F0F0FF', fontWeight: '600', fontSize: 14 },

  // Modal
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet:         { backgroundColor: '#16161E', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 44, borderTopWidth: 1, borderColor: '#2A2A38' },
  sheetHandle:   { width: 40, height: 4, backgroundColor: '#2A2A38', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle:    { color: '#F0F0FF', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  sheetLabel:    { color: '#9090A8', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  sheetInput:    { backgroundColor: '#0A0A0F', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, color: '#F0F0FF', fontSize: 22, fontWeight: '700' },
  sheetBtn:      { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  sheetBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 16 },
});
