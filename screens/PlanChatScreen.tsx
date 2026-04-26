import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { scheduleNotificationsFromPlan } from '../utils/notifications';
import { addToCalendar } from '../utils/calendar';
import { onPlanGenerated, onPlanModified } from '../utils/gamification';
import { initHealthKit, getHealthSnapshot, healthSnapshotToText, isHealthAvailable, HEALTH_CACHE_KEY } from '../utils/health';
import { getLifestyleProfile, lifestyleToText } from './WeeklyCheckInScreen';
import type { RootStackParamList } from '../App';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PlanChat'>;

interface Msg { id: string; role: 'user' | 'assistant'; content: string; }

const C = { primary: '#7C3AED', surface: '#1A1A24', border: '#2A2A38', textPrimary: '#F0F0FF', textMuted: '#5A5A70', textSecondary: '#9090A8' };

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Load Apple Health data — uses cache if fresh, otherwise inits HealthKit and fetches live. */
async function loadCachedHealthData(): Promise<string | null> {
  if (!isHealthAvailable()) return null;
  try {
    // Check cache first
    const cached = await AsyncStorage.getItem(HEALTH_CACHE_KEY);
    if (cached) {
      const { text, cachedAt } = JSON.parse(cached);
      if (text && (Date.now() - cachedAt) < SIX_HOURS) return text;
    }
    // No cache or stale — ensure HealthKit is initialised, then fetch live
    const granted = await initHealthKit();
    if (!granted) return null;
    const snap = await getHealthSnapshot();
    const txt  = healthSnapshotToText(snap);
    if (txt) {
      await AsyncStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify({ text: txt, cachedAt: Date.now() }));
      return txt;
    }
  } catch {}
  return null;
}

export default function PlanChatScreen() {
  const navigation  = useNavigation<Nav>();
  const route       = useRoute<Route>();
  const { stats, goals, labs, mode = 'onboarding', currentPlan } = route.params ?? {};

  const [msgs,        setMsgs]        = useState<Msg[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [healthData,  setHealthData]  = useState<string | null>(null);
  const [healthReady, setHealthReady] = useState(false);
  // In modify mode the button is available immediately; in onboarding mode unlock after first reply
  const [canGenerate, setCanGenerate] = useState(mode === 'modify');
  const scrollRef = useRef<ScrollView>(null);

  // ── Load health data after all navigation animations settle ─────────────────
  // InteractionManager.runAfterInteractions() waits until the screen transition
  // is fully complete before firing HealthKit queries. Calling native HealthKit
  // methods during a navigation animation crashes the old bridge.
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadCachedHealthData().then(hd => {
        setHealthData(hd);
        setHealthReady(true);
      });
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (!healthReady) return; // wait until health check completes

    let opener: string;
    if (mode === 'modify') {
      opener = "I have your current Quest open. What would you like to change?\n\nYou can say things like \"shorten my workouts\", \"add a rest day on Wednesday\", or \"I want to focus more on sleep\".";
    } else if (healthData) {
      opener = "I've already pulled your Apple Health & Watch data — I can see your sleep patterns, step count, heart rate, HRV, and workout history. I won't ask you about any of that.\n\nWhat I need from you: tell me about your eating habits and what your main health goal is right now.";
    } else {
      opener = "I have your profile. Before I build your Quest, I want to make sure it fits your real life.\n\nHow would you describe your sleep lately — quality, how many hours you get, and whether you wake up feeling rested?";
    }

    setMsgs([{ id: '0', role: 'assistant', content: opener }]);
  }, [healthReady, mode]);

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { id: Date.now().toString(), role: 'user', content: input.trim() };
    const updated = [...msgs, userMsg];
    setMsgs(updated);
    setInput('');
    setLoading(true);
    scrollDown();
    try {
      const res = await api.post('/plan-chat', { messages: updated.map(m => ({ role: m.role, content: m.content })), stats, goals, labs: labs ?? null, current_plan: currentPlan ?? null, action: 'chat', health_data: healthData });
      setMsgs(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: res.message }]);
      if (updated.filter(m => m.role === 'user').length >= 1) setCanGenerate(true);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not connect. Try again.');
    } finally {
      setLoading(false);
      scrollDown();
    }
  };

  const generate = async () => {
    setGenerating(true);
    // Show a chat message immediately so the user knows it's working
    const waitMsg: Msg = {
      id: 'wait_' + Date.now(),
      role: 'assistant',
      content: mode === 'modify'
        ? '✏️ Updating your Quest now — this usually takes 15–30 seconds…'
        : '✨ Building your personalized Quest now — this usually takes 15–30 seconds. Hang tight!',
    };
    setMsgs(prev => [...prev, waitMsg]);
    scrollDown();
    try {
      // health_data already loaded into state at component mount — reuse it.
      // If somehow still null (e.g. stale cache), try one more live fetch.
      let health_data = healthData;
      if (!health_data && isHealthAvailable()) {
        try {
          const snap = await getHealthSnapshot();
          const txt  = healthSnapshotToText(snap);
          if (txt) {
            health_data = txt;
            await AsyncStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify({ text: txt, cachedAt: Date.now() }));
          }
        } catch {}
      }

      // Grab weekly lifestyle / routine context
      let routine_data: string | null = null;
      try {
        const lifestyle = await getLifestyleProfile();
        if (lifestyle) routine_data = lifestyleToText(lifestyle);
      } catch {}

      const res = await api.post('/plan-chat', {
        messages:     msgs.map(m => ({ role: m.role, content: m.content })),
        stats,
        goals,
        labs:         labs ?? null,
        current_plan: currentPlan ?? null,
        action:       mode === 'modify' ? 'modify' : 'generate',
        health_data,
        routine_data,
      });
      const schedule = res.schedule ?? {};
      await AsyncStorage.setItem('upquest_plan', JSON.stringify({ schedule, generated_at: new Date().toISOString() }));

      // Award XP
      if (mode === 'modify') await onPlanModified();
      else await onPlanGenerated();

      // Schedule push notifications — AI-defined reminders + every activity time slot
      try {
        await scheduleNotificationsFromPlan(schedule.notifications ?? [], schedule);
      } catch {}

      // Auto-sync to calendar (best-effort — prompt happens inside addToCalendar)
      if (schedule.days) {
        try { await addToCalendar('', '', schedule); } catch {}
      }

      setMsgs(prev => [...prev, { id: 'done', role: 'assistant', content: mode === 'modify' ? '✅ Your Quest has been updated! Heading back…' : '✅ Your Quest is ready! Taking you there now…' }]);
      scrollDown();
      setTimeout(() => navigation.replace('MainTabs'), 1600);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not generate plan. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#F0F0FF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>{mode === 'modify' ? 'Modify Quest' : 'Build My Quest'}</Text>
              <Text style={styles.headerSub}>AI Health Coach</Text>
            </View>
            {canGenerate && (
              <TouchableOpacity style={[styles.genBtn, generating && { opacity: 0.5 }]} onPress={generate} disabled={generating}>
                {generating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.genBtnTxt}>{mode === 'modify' ? 'Update ✓' : 'Generate ✓'}</Text>}
              </TouchableOpacity>
            )}
          </View>

          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.chat} keyboardShouldPersistTaps="handled">
            {msgs.map(m => (
              <View key={m.id} style={[styles.bubbleRow, m.role === 'user' ? styles.rowUser : styles.rowAI]}>
                {m.role === 'assistant' && <View style={styles.avatar}><Text style={{ fontSize: 14 }}>⚡</Text></View>}
                <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
                  <Text style={{ fontSize: 15, lineHeight: 22, color: m.role === 'user' ? '#fff' : '#F0F0FF' }}>{m.content}</Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={[styles.bubbleRow, styles.rowAI]}>
                <View style={styles.avatar}><Text style={{ fontSize: 14 }}>⚡</Text></View>
                <View style={[styles.bubble, styles.bubbleAI, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                  <ActivityIndicator size="small" color="#7C3AED" />
                  <Text style={{ color: C.textMuted, fontSize: 14 }}>Thinking…</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {canGenerate && !generating && (
            <View style={styles.hint}>
              <Text style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                💡 Tap <Text style={{ fontWeight: '700' }}>{mode === 'modify' ? '"Update ✓"' : '"Generate ✓"'}</Text> above, or keep chatting to refine.
              </Text>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Type a message…" placeholderTextColor={C.textMuted} multiline onSubmitEditing={send} blurOnSubmit={false} />
            <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]} onPress={send} disabled={!input.trim() || loading}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A38' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#F0F0FF' },
  headerSub:   { fontSize: 11, color: '#5A5A70', marginTop: 2 },
  genBtn:      { backgroundColor: '#7C3AED', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14, minWidth: 95, alignItems: 'center' },
  genBtnTxt:   { color: '#fff', fontWeight: '700', fontSize: 13 },
  chat:        { padding: 16, paddingBottom: 24, gap: 14 },
  bubbleRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowAI:       { alignSelf: 'flex-start', maxWidth: '88%' },
  rowUser:     { alignSelf: 'flex-end', flexDirection: 'row-reverse', maxWidth: '80%' },
  avatar:      { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1A24', borderWidth: 1, borderColor: '#2A2A38', justifyContent: 'center', alignItems: 'center' },
  bubble:      { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleAI:    { backgroundColor: '#1A1A24', borderWidth: 1, borderColor: '#2A2A38' },
  bubbleUser:  { backgroundColor: '#7C3AED' },
  hint:        { backgroundColor: '#1A1A24', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A2A38' },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2A2A38', gap: 8 },
  input:       { flex: 1, backgroundColor: '#1A1A24', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, color: '#F0F0FF', fontSize: 15, maxHeight: 120 },
  sendBtn:     { backgroundColor: '#7C3AED', borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
});
