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
import { Colors } from '../constants/theme';
import {
  loadGamification, levelName, xpProgressInLevel, ACHIEVEMENTS,
} from '../utils/gamification';
import {
  initHealthKit, getHealthSnapshot, syncWeightFromHealth,
  isHealthAvailable,
} from '../utils/health';
import type { RootStackParamList } from '../App';

interface WeightEntry { date: string; weight: number; }
type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = { bg:'#0A0A0F', surface:'#16161E', border:'#2A2A38', primary:'#7C3AED', text:'#F0F0FF', muted:'#5A5A70', sub:'#9090A8' };

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();

  const [profile,      setProfile]      = useState<any>(null);
  const [plan,         setPlan]         = useState<any>(null);
  const [weightLog,    setWeightLog]    = useState<WeightEntry[]>([]);
  const [goalWeight,   setGoalWeight]   = useState<number | null>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [health,       setHealth]       = useState<any>(null);
  const [completed,    setCompleted]    = useState<Record<string,boolean>>({});
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [healthLoading,setHealthLoading]= useState(false);

  const load = useCallback(async () => {
    const [p, s, wLog, wGoal, gam, comp] = await Promise.all([
      AsyncStorage.getItem('upquest_profile'),
      AsyncStorage.getItem('upquest_plan'),
      AsyncStorage.getItem('upquest_weight_log'),
      AsyncStorage.getItem('upquest_weight_goal'),
      loadGamification(),
      AsyncStorage.getItem('upquest_completed'),
    ]);
    setProfile(p ? JSON.parse(p) : null);
    setPlan(s ? JSON.parse(s) : null);
    setWeightLog(wLog ? JSON.parse(wLog) : []);
    setGoalWeight(wGoal ? parseFloat(wGoal) : null);
    setGamification(gam);
    setCompleted(comp ? JSON.parse(comp) : {});
    setLoading(false);
    setRefreshing(false);

    // Health data — attempt in background
    if (isHealthAvailable()) {
      setHealthLoading(true);
      try {
        const ok = await initHealthKit();
        if (ok) {
          const [snap] = await Promise.all([
            getHealthSnapshot(),
            syncWeightFromHealth(),
          ]);
          setHealth(snap);
          // Refresh weight log after potential sync
          const updatedW = await AsyncStorage.getItem('upquest_weight_log');
          if (updatedW) setWeightLog(JSON.parse(updatedW));
        }
      } catch {}
      setHealthLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // How many activities has the user completed today?
  const todayProgress = (() => {
    if (!plan?.schedule?.days) return null;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const day   = plan.schedule.days?.[today] ?? {};
    const slots = Object.keys(day.schedule ?? {}).length;
    const habits = (day.habits ?? []).length;
    const total  = slots + habits + (day.workout ? 1 : 0);
    if (!total) return null;
    const done   = Object.keys(completed).filter(k => k.includes(today.slice(0,3))).length;
    return { done: Math.min(done, total), total };
  })();

  const lastAchievement = gamification?.achievements?.length
    ? ACHIEVEMENTS.find(a => a.id === gamification.achievements[gamification.achievements.length - 1])
    : null;

  if (loading) return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:C.bg }}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );

  const progressData = gamification ? xpProgressInLevel(gamification.xp) : null;
  const sorted  = [...weightLog].sort((a,b)=>a.date.localeCompare(b.date));
  const latestW = sorted[sorted.length - 1];
  const toGoal  = latestW && goalWeight ? +(latestW.weight - goalWeight).toFixed(1) : null;

  return (
    <LinearGradient colors={['#0A0A0F','#12121A']} style={{ flex:1 }}>
      <SafeAreaView style={{ flex:1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={C.primary} />}
        >

          {/* ── Header ── */}
          <View style={st.header}>
            <View>
              <Text style={st.greeting}>{greeting()}, {profile?.name ?? 'Champion'} 👋</Text>
              <Text style={st.appName}>UpQuest</Text>
            </View>
            {gamification && gamification.streak > 0 && (
              <View style={st.streakBadge}>
                <Text style={st.streakEmoji}>🔥</Text>
                <Text style={st.streakNum}>{gamification.streak}</Text>
                <Text style={st.streakLbl}>day streak</Text>
              </View>
            )}
          </View>

          {/* ── Gamification bar (only when there's a profile) ── */}
          {profile && gamification && (
            <View style={st.gamCard}>
              <View style={st.gamRow}>
                <View style={st.levelBadge}>
                  <Text style={st.levelNum}>{gamification.level}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
                    <Text style={st.levelName}>{levelName(gamification.level)}</Text>
                    <Text style={st.xpText}>{gamification.xp} XP</Text>
                  </View>
                  <View style={st.xpTrack}>
                    <View style={[st.xpFill, { width:`${Math.round((progressData?.pct??0)*100)}%` as any }]} />
                  </View>
                  <Text style={st.xpSub}>{progressData?.current} / {progressData?.needed} XP to Level {(gamification.level??0)+1}</Text>
                </View>
              </View>

              {/* Achievements row */}
              {gamification.achievements?.length > 0 && (
                <View style={st.achRow}>
                  {ACHIEVEMENTS.filter(a => gamification.achievements.includes(a.id)).slice(-5).map(a => (
                    <View key={a.id} style={st.achChip}>
                      <Text style={{ fontSize:16 }}>{a.icon}</Text>
                    </View>
                  ))}
                  {lastAchievement && (
                    <Text style={st.lastAch}>Latest: {lastAchievement.title}</Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* ── Today's progress ── */}
          {profile && plan && todayProgress && (
            <View style={st.todayCard}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <Text style={st.todayTitle}>Today's Progress</Text>
                <Text style={[st.todayPct, { color: todayProgress.done === todayProgress.total ? '#10B981' : C.primary }]}>
                  {todayProgress.done}/{todayProgress.total}
                </Text>
              </View>
              <View style={st.progressTrack}>
                <View style={[st.progressFill, {
                  width: `${Math.round((todayProgress.done/todayProgress.total)*100)}%` as any,
                  backgroundColor: todayProgress.done === todayProgress.total ? '#10B981' : C.primary,
                }]} />
              </View>
              {todayProgress.done === todayProgress.total
                ? <Text style={{ color:'#10B981', fontSize:12, marginTop:6 }}>✅ Perfect day — all activities complete!</Text>
                : <Text style={{ color:C.muted, fontSize:12, marginTop:6 }}>{todayProgress.total - todayProgress.done} activities remaining</Text>
              }
            </View>
          )}

          {/* ── Apple Health card ── */}
          {isHealthAvailable() && (
            <View style={st.healthCard}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  <Ionicons name="heart" size={18} color="#FF2D55" />
                  <Text style={st.healthTitle}>Apple Health</Text>
                </View>
                {healthLoading && <ActivityIndicator size="small" color="#FF2D55" />}
              </View>
              {health ? (
                <View style={st.healthGrid}>
                  <HealthStat icon="footsteps" label="Steps" value={health.stepsToday != null ? health.stepsToday.toLocaleString() : '—'} color="#30D158" />
                  <HealthStat icon="flame"     label="Active Cal" value={health.activeCaloriesToday != null ? Math.round(health.activeCaloriesToday)+'kcal' : '—'} color="#FF9F0A" />
                  <HealthStat icon="moon"      label="Sleep"   value={health.lastNightSleepHrs != null ? health.lastNightSleepHrs+'h' : '—'} color="#5E5CE6" />
                  <HealthStat icon="heart-circle" label="Resting HR" value={health.restingHeartRate != null ? Math.round(health.restingHeartRate)+' bpm' : '—'} color="#FF2D55" />
                  {health.latestWeightLbs && (
                    <HealthStat icon="scale"   label="Weight"  value={health.latestWeightLbs.toFixed(1)+' lbs'} color="#64D2FF" />
                  )}
                  {health.workoutsThisWeek > 0 && (
                    <HealthStat icon="barbell" label="Workouts" value={`${health.workoutsThisWeek} this week`} color="#7C3AED" />
                  )}
                </View>
              ) : !healthLoading ? (
                <Text style={{ color:C.muted, fontSize:13 }}>Pull down to sync Apple Health data</Text>
              ) : null}
            </View>
          )}

          {/* ── No profile ── */}
          {!profile && (
            <View style={st.card}>
              <Text style={st.emoji}>👤</Text>
              <Text style={st.cardTitle}>Build your profile</Text>
              <Text style={st.cardSub}>Takes 2 minutes. No account needed.</Text>
              <TouchableOpacity style={st.btn} onPress={() => navigation.navigate('ProfileSetup', {})}>
                <Text style={st.btnTxt}>Get Started →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Has profile, no plan ── */}
          {profile && !plan && (
            <TouchableOpacity style={st.heroBtnWrap} onPress={() => navigation.navigate('ProfileSetup', {})} activeOpacity={0.85}>
              <LinearGradient colors={['#7C3AED','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={st.heroBtn}>
                <Text style={st.heroBtnEmoji}>⚡</Text>
                <Text style={st.heroBtnTitle}>Build My Plan with AI</Text>
                <Text style={st.heroBtnSub}>Chat with AI to get a personalized weekly routine</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ── Has plan ── */}
          {profile && plan && (
            <>
              <TouchableOpacity style={st.heroBtnWrap} onPress={() => navigation.navigate('Schedule', { scheduleId:'local' })} activeOpacity={0.85}>
                <LinearGradient colors={['#7C3AED','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={st.heroBtn}>
                  <Text style={st.heroBtnEmoji}>📋</Text>
                  <Text style={st.heroBtnTitle}>View My Plan</Text>
                  <Text style={st.heroBtnSub}>
                    Generated {plan.generated_at ? new Date(plan.generated_at).toLocaleDateString() : 'recently'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={st.modifyRow}
                onPress={() => navigation.navigate('PlanChat', { stats:profile.stats, goals:profile.goals, mode:'modify', currentPlan:plan })}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses" size={22} color={C.primary} />
                <View style={{ flex:1 }}>
                  <Text style={st.modifyTitle}>Modify My Plan with AI</Text>
                  <Text style={st.modifySub}>Chat to adjust workouts, sleep, nutrition & more</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </TouchableOpacity>

              <TouchableOpacity style={st.rebuildBtn} onPress={() => navigation.navigate('ProfileSetup', {})}>
                <Text style={st.rebuildTxt}>⚡  Build a New Plan</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Weight tracker ── */}
          {profile && (
            <TouchableOpacity style={st.weightCard} onPress={() => navigation.navigate('WeightTracker')} activeOpacity={0.85}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <Text style={{ fontSize:22 }}>⚖️</Text>
                  <View>
                    <Text style={st.weightCardTitle}>Weight Tracker</Text>
                    <Text style={st.weightCardSub}>
                      {latestW
                        ? `Last logged: ${latestW.weight} lbs${toGoal !== null ? ` · ${Math.abs(toGoal)} lbs to go` : ''}`
                        : 'Tap to log your weight & set a goal'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.muted} />
              </View>
            </TouchableOpacity>
          )}

          <View style={{ height:60 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function HealthStat({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={hst.stat}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={hst.val}>{value}</Text>
      <Text style={hst.lbl}>{label}</Text>
    </View>
  );
}

const hst = StyleSheet.create({
  stat: { alignItems:'center', backgroundColor:'#1A1A24', borderRadius:12, padding:12, minWidth:80, gap:4, borderWidth:1, borderColor:'#2A2A38' },
  val:  { color:'#F0F0FF', fontWeight:'700', fontSize:14, marginTop:2 },
  lbl:  { color:'#5A5A70', fontSize:10, fontWeight:'600' },
});

const st = StyleSheet.create({
  header:       { paddingHorizontal:24, paddingTop:16, paddingBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  greeting:     { color:'#5A5A70', fontSize:13 },
  appName:      { color:'#F0F0FF', fontSize:28, fontWeight:'900' },
  streakBadge:  { alignItems:'center', backgroundColor:'#FF6B2215', borderRadius:14, paddingVertical:8, paddingHorizontal:14, borderWidth:1, borderColor:'#FF6B2240' },
  streakEmoji:  { fontSize:20 },
  streakNum:    { color:'#FF6B22', fontWeight:'800', fontSize:20, lineHeight:24 },
  streakLbl:    { color:'#FF6B22', fontSize:10, fontWeight:'600' },

  gamCard:      { marginHorizontal:20, marginBottom:16, backgroundColor:'#16161E', borderRadius:16, padding:16, borderWidth:1, borderColor:'#2A2A38' },
  gamRow:       { flexDirection:'row', alignItems:'center', gap:14 },
  levelBadge:   { width:52, height:52, borderRadius:26, backgroundColor:'#7C3AED', justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#9F68FF' },
  levelNum:     { color:'#fff', fontWeight:'900', fontSize:20 },
  levelName:    { color:'#F0F0FF', fontWeight:'700', fontSize:15 },
  xpText:       { color:'#7C3AED', fontWeight:'700', fontSize:13 },
  xpTrack:      { height:8, backgroundColor:'#1E1E2A', borderRadius:4, overflow:'hidden' },
  xpFill:       { height:8, backgroundColor:'#7C3AED', borderRadius:4 },
  xpSub:        { color:'#5A5A70', fontSize:11, marginTop:4 },
  achRow:       { flexDirection:'row', alignItems:'center', gap:8, marginTop:14, paddingTop:14, borderTopWidth:1, borderTopColor:'#2A2A38' },
  achChip:      { width:34, height:34, borderRadius:17, backgroundColor:'#1E1E2A', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'#2A2A38' },
  lastAch:      { color:'#5A5A70', fontSize:11, flex:1 },

  todayCard:    { marginHorizontal:20, marginBottom:16, backgroundColor:'#16161E', borderRadius:14, padding:16, borderWidth:1, borderColor:'#2A2A38' },
  todayTitle:   { color:'#F0F0FF', fontWeight:'700', fontSize:15 },
  todayPct:     { fontWeight:'800', fontSize:15 },
  progressTrack:{ height:8, backgroundColor:'#1E1E2A', borderRadius:4, overflow:'hidden' },
  progressFill: { height:8, borderRadius:4 },

  healthCard:   { marginHorizontal:20, marginBottom:16, backgroundColor:'#16161E', borderRadius:14, padding:16, borderWidth:1, borderColor:'#FF2D5520' },
  healthTitle:  { color:'#F0F0FF', fontWeight:'700', fontSize:15 },
  healthGrid:   { flexDirection:'row', flexWrap:'wrap', gap:8 },

  card:         { margin:24, backgroundColor:'#16161E', borderRadius:16, padding:32, alignItems:'center', borderWidth:1, borderColor:'#2A2A38' },
  emoji:        { fontSize:48, marginBottom:12 },
  cardTitle:    { color:'#F0F0FF', fontSize:20, fontWeight:'700', marginBottom:8 },
  cardSub:      { color:'#9090A8', fontSize:14, marginBottom:24, textAlign:'center' },
  btn:          { backgroundColor:'#7C3AED', borderRadius:12, paddingVertical:14, paddingHorizontal:32 },
  btnTxt:       { color:'#fff', fontWeight:'700', fontSize:16 },

  heroBtnWrap:  { marginHorizontal:20, marginBottom:16, borderRadius:16, overflow:'hidden' },
  heroBtn:      { padding:28, alignItems:'center' },
  heroBtnEmoji: { fontSize:40, marginBottom:10 },
  heroBtnTitle: { color:'#fff', fontSize:20, fontWeight:'700', textAlign:'center', marginBottom:6 },
  heroBtnSub:   { color:'rgba(255,255,255,0.75)', fontSize:14, textAlign:'center' },

  modifyRow:    { flexDirection:'row', alignItems:'center', backgroundColor:'#16161E', marginHorizontal:20, marginBottom:12, padding:18, borderRadius:14, borderWidth:1, borderColor:'#7C3AED44', gap:14 },
  modifyTitle:  { color:'#F0F0FF', fontWeight:'700', fontSize:15 },
  modifySub:    { color:'#5A5A70', fontSize:12, marginTop:2 },
  rebuildBtn:   { marginHorizontal:20, padding:16, borderRadius:12, borderWidth:1, borderColor:'#2A2A38', alignItems:'center' },
  rebuildTxt:   { color:'#9090A8', fontWeight:'600', fontSize:14 },

  weightCard:     { marginHorizontal:20, marginTop:8, backgroundColor:'#16161E', borderRadius:14, padding:16, borderWidth:1, borderColor:'#2A2A38' },
  weightCardTitle:{ color:'#F0F0FF', fontWeight:'700', fontSize:15 },
  weightCardSub:  { color:'#5A5A70', fontSize:12, marginTop:2 },
});
