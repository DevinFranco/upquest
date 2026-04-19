import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { addToCalendar } from '../utils/calendar';
import {
  onActivityCompleted, onWorkoutCompleted, onHabitCompleted,
  markFullDayComplete, loadGamification,
  levelName, xpProgressInLevel,
} from '../utils/gamification';
import { logWorkoutToHealth, isHealthAvailable } from '../utils/health';
import type { RootStackParamList } from '../App';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Schedule'>;

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const TABS = ['Schedule','Meals','Workout','Habits'] as const;

function XpToast({ amount, label, onDone }: { amount: number; label: string; onDone: () => void }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(onDone);
  }, []);
  return (
    <Animated.View style={[xpStyle.toast, { opacity, transform: [{ translateY }] }]}>
      <Text style={xpStyle.xp}>+{amount} XP</Text>
      <Text style={xpStyle.lbl}>{label}</Text>
    </Animated.View>
  );
}
const xpStyle = StyleSheet.create({
  toast: { position:'absolute', top:60, alignSelf:'center', backgroundColor:'#7C3AED', borderRadius:20, paddingVertical:8, paddingHorizontal:18, flexDirection:'row', gap:8, alignItems:'center', zIndex:999, shadowColor:'#7C3AED', shadowOpacity:0.6, shadowRadius:12, elevation:10 },
  xp:   { color:'#FFD700', fontWeight:'800', fontSize:15 },
  lbl:  { color:'#fff', fontSize:13 },
});

export default function ScheduleScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { scheduleId } = route.params;

  const [plan,         setPlan]         = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeDay,    setActiveDay]    = useState(0);
  const [activeTab,    setActiveTab]    = useState<typeof TABS[number]>('Schedule');
  const [syncing,      setSyncing]      = useState(false);
  const [completed,    setCompleted]    = useState<Record<string, boolean>>({});
  const [xpToast,      setXpToast]      = useState<{ amount: number; label: string } | null>(null);
  const [gamification, setGamification] = useState<any>(null);

  useEffect(() => { loadPlan(); loadGamState(); loadCompleted(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { loadPlan(); loadGamState(); });
    return unsub;
  }, [navigation]);

  const loadGamState   = async () => { const g = await loadGamification(); setGamification(g); };
  const loadCompleted  = async () => { const r = await AsyncStorage.getItem('upquest_completed'); if (r) setCompleted(JSON.parse(r)); };
  const saveCompleted  = async (u: Record<string,boolean>) => { await AsyncStorage.setItem('upquest_completed', JSON.stringify(u)); };

  const loadPlan = async () => {
    try {
      const raw = await AsyncStorage.getItem('upquest_plan');
      if (raw) { const s = JSON.parse(raw); setPlan(s.schedule ?? s); }
      else { const res = await api.get(`/schedules/${scheduleId}`); setPlan(res.schedule?.full_schedule ?? res.schedule); }
    } catch { try { const res = await api.get(`/schedules/${scheduleId}`); setPlan(res.schedule?.full_schedule ?? res.schedule); } catch {} }
    finally { setLoading(false); }
  };

  const showXp = (result: any, label: string) => {
    if (!result?.xpGained) return;
    setXpToast({ amount: result.xpGained, label });
    if (result.newLevel) setTimeout(() => Alert.alert('🎉 Level Up!', `You reached Level ${result.newLevel}: ${levelName(result.newLevel)}!`), 2200);
    if (result.newAchievements?.length) result.newAchievements.forEach((a: any, i: number) => setTimeout(() => Alert.alert(`${a.icon} Achievement Unlocked!`, `${a.title}\n${a.description}`), 2400 + i * 600));
    loadGamState();
  };

  const toggleActivity = async (key: string, activity: string) => {
    if (completed[key]) return;
    const u = { ...completed, [key]: true }; setCompleted(u); await saveCompleted(u);
    showXp(await onActivityCompleted(key), activity.slice(0,30));
    checkFullDay(u);
  };

  const toggleWorkout = async (dayName: string, workout: any) => {
    const key = `workout_${dayName}`;
    if (completed[key]) return;
    const u = { ...completed, [key]: true }; setCompleted(u); await saveCompleted(u);
    if (isHealthAvailable() && workout?.duration_minutes) {
      const start = new Date(), end = new Date(start.getTime() + workout.duration_minutes * 60000);
      logWorkoutToHealth({ type:'TraditionalStrengthTraining', startDate:start, endDate:end, calories:workout.duration_minutes * 8 }).catch(()=>{});
    }
    showXp(await onWorkoutCompleted(dayName), `${workout?.type || 'Workout'} done!`);
    checkFullDay(u);
  };

  const toggleHabit = async (dayName: string, idx: number, habit: string) => {
    const key = `habit_${dayName}_${idx}`;
    if (completed[key]) return;
    const u = { ...completed, [key]: true }; setCompleted(u); await saveCompleted(u);
    showXp(await onHabitCompleted(key), habit.slice(0,30));
    checkFullDay(u);
  };

  const checkFullDay = async (c: Record<string,boolean>) => {
    const dn = DAYS[activeDay]; const day = (plan?.days ?? {})[dn] ?? {};
    const hKeys = (day.habits ?? []).map((_: any, i: number) => `habit_${dn}_${i}`);
    if (hKeys.length > 0 && hKeys.every((k: string) => c[k]) && (!day.workout || c[`workout_${dn}`])) {
      showXp(await markFullDayComplete(dn), 'Perfect day! 🏆');
    }
  };

  const syncCalendar = async () => {
    if (!plan) return; setSyncing(true);
    try { await addToCalendar('', '', plan); Alert.alert('📅 Synced!', 'Your Quest has been added to your iPhone calendar.'); }
    catch (e: any) { Alert.alert('Calendar Error', e.message ?? 'Could not sync.'); }
    finally { setSyncing(false); }
  };

  const progressData = gamification ? xpProgressInLevel(gamification.xp) : null;

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#0A0A0F' }}><ActivityIndicator color="#7C3AED" size="large" /></View>;
  if (!plan)   return <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#0A0A0F' }}><Text style={{ color:'#9090A8' }}>No Quest found.</Text><TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop:20 }}><Text style={{ color:'#7C3AED' }}>← Go back</Text></TouchableOpacity></View>;

  const days = plan.days ?? {}, dayName = DAYS[activeDay], day = days[dayName] ?? {};

  return (
    <LinearGradient colors={['#0A0A0F','#12121A']} style={{ flex:1 }}>
      <SafeAreaView style={{ flex:1 }}>

        {xpToast && <XpToast amount={xpToast.amount} label={xpToast.label} onDone={() => setXpToast(null)} />}

        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-down" size={26} color="#F0F0FF" /></TouchableOpacity>
          <Text style={s.topTitle}>Weekly Quest</Text>
          <TouchableOpacity style={s.calBtn} onPress={syncCalendar} disabled={syncing}>
            {syncing ? <ActivityIndicator size="small" color="#7C3AED" /> : <Ionicons name="calendar-outline" size={20} color="#7C3AED" />}
          </TouchableOpacity>
        </View>

        {gamification && (
          <View style={s.gamBar}>
            <View style={s.gamLeft}>
              <Text style={s.gamLevel}>Lv {gamification.level}</Text>
              <Text style={s.gamLevelName}>{levelName(gamification.level)}</Text>
            </View>
            <View style={s.gamXpWrap}>
              <View style={s.xpTrack}><View style={[s.xpFill, { width:`${Math.round((progressData?.pct??0)*100)}%` as any }]} /></View>
              <Text style={s.gamXpTxt}>{gamification.xp} XP · {progressData?.current}/{progressData?.needed} to next level</Text>
            </View>
            {gamification.streak > 0 && <View style={s.streakChip}><Text style={s.streakTxt}>🔥 {gamification.streak}</Text></View>}
          </View>
        )}

        {plan.week_summary ? <View style={s.summaryCard}><Text style={s.summaryTxt}>💡 {plan.week_summary}</Text></View> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight:52 }} contentContainerStyle={s.dayScroll}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i) => {
            const dn = DAYS[i]; const dd = days[dn] ?? {};
            const hk = (dd.habits??[]).map((_:any,j:number)=>`habit_${dn}_${j}`);
            const ok = hk.length>0 && hk.every((k:string)=>completed[k]) && (!dd.workout||completed[`workout_${dn}`]);
            return (
              <TouchableOpacity key={d} style={[s.dayChip, activeDay===i&&s.dayChipOn, ok&&s.dayChipComplete]} onPress={()=>setActiveDay(i)}>
                <Text style={[s.dayChipTxt, activeDay===i&&s.dayChipTxtOn]}>{d}</Text>
                {ok && <Text style={{ fontSize:8, color:'#10B981' }}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {day.theme ? <Text style={s.dayTheme}>{dayName} · {day.theme}</Text> : null}

        <View style={s.tabBar}>
          {TABS.map(t => <TouchableOpacity key={t} style={[s.tab, activeTab===t&&s.tabOn]} onPress={()=>setActiveTab(t)}><Text style={[s.tabTxt, activeTab===t&&s.tabTxtOn]}>{t}</Text></TouchableOpacity>)}
        </View>

        <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:20, paddingBottom:60 }}>

          {activeTab==='Schedule' && (
            Object.keys(day.schedule??{}).length > 0
              ? Object.entries(day.schedule).map(([time, activity]) => {
                  const key=`sched_${dayName}_${time}`, done=!!completed[key];
                  return (
                    <TouchableOpacity key={time} style={[s.schedRow, done&&{opacity:0.5}]} onPress={()=>toggleActivity(key, activity as string)} activeOpacity={0.7}>
                      <Text style={s.schedTime}>{time}</Text>
                      <Text style={[s.schedAct, done&&{textDecorationLine:'line-through'}]}>{activity as string}</Text>
                      <View style={[s.check, done&&s.checkDone]}>{done&&<Ionicons name="checkmark" size={12} color="#fff" />}</View>
                    </TouchableOpacity>
                  );
                })
              : <Text style={s.emptyTxt}>No schedule for this day.</Text>
          )}

          {activeTab==='Meals' && (
            day.meals
              ? (['breakfast','lunch','dinner'] as const).map(meal => {
                  const m = day.meals[meal]; if (!m) return null;
                  return (
                    <View key={meal} style={s.card}>
                      <Text style={s.mealLabel}>{meal.toUpperCase()}</Text>
                      <Text style={s.mealName}>{m.name}</Text>
                      {m.ingredients?.map((ing:string,i:number)=><Text key={i} style={s.ingredient}>• {ing}</Text>)}
                      {m.macros && (
                        <View style={s.macrosRow}>
                          {([['Protein',m.macros.protein_g+'g','#7C3AED'],['Carbs',m.macros.carbs_g+'g','#06B6D4'],['Fat',m.macros.fat_g+'g','#F59E0B'],['Cals',m.macros.calories+'','#10B981']] as [string,string,string][]).map(([l,v,c])=>(
                            <View key={l} style={{ alignItems:'center' }}><Text style={{ color:c, fontWeight:'700', fontSize:15 }}>{v}</Text><Text style={{ color:'#5A5A70', fontSize:11, marginTop:2 }}>{l}</Text></View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              : <Text style={s.emptyTxt}>No meal plan for this day.</Text>
          )}

          {activeTab==='Workout' && (
            day.workout ? (
              <View>
                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:'#F0F0FF', fontSize:20, fontWeight:'700' }}>{day.workout.type}</Text>
                    {day.workout.duration_minutes ? <Text style={{ color:'#F59E0B', fontSize:13, marginTop:2 }}>{day.workout.duration_minutes} min</Text> : null}
                  </View>
                  <TouchableOpacity style={[s.completeBtn, !!completed[`workout_${dayName}`]&&s.completeBtnDone]} onPress={()=>toggleWorkout(dayName, day.workout)} disabled={!!completed[`workout_${dayName}`]}>
                    {completed[`workout_${dayName}`]
                      ? <><Ionicons name="checkmark-circle" size={16} color="#10B981" /><Text style={[s.completeBtnTxt,{color:'#10B981'}]}> Done!</Text></>
                      : <><Ionicons name="barbell-outline" size={16} color="#fff" /><Text style={s.completeBtnTxt}> Log Workout</Text></>}
                  </TouchableOpacity>
                </View>
                {(day.workout.exercises??[]).map((ex:any,i:number)=>(
                  <View key={i} style={s.exerciseRow}>
                    <View style={s.exNum}><Text style={{ color:'#7C3AED', fontWeight:'700' }}>{i+1}</Text></View>
                    <View style={{ flex:1 }}><Text style={{ color:'#F0F0FF', fontWeight:'600', fontSize:15 }}>{ex.name}</Text><Text style={{ color:'#5A5A70', fontSize:13, marginTop:2 }}>{ex.sets} sets × {ex.reps}{ex.rest_seconds?`  ·  ${ex.rest_seconds}s rest`:''}</Text></View>
                  </View>
                ))}
                {!(day.workout.exercises?.length) && <Text style={s.emptyTxt}>🧘 Rest / Active Recovery Day</Text>}
                {isHealthAvailable() && completed[`workout_${dayName}`] && (
                  <View style={s.healthBadge}><Ionicons name="heart" size={14} color="#FF2D55" /><Text style={s.healthBadgeTxt}> Logged to Apple Health</Text></View>
                )}
              </View>
            ) : <Text style={s.emptyTxt}>🧘 Rest day — focus on recovery and sleep.</Text>
          )}

          {activeTab==='Habits' && (
            (day.habits??[]).length > 0
              ? (day.habits??[]).map((h:string,i:number) => {
                  const key=`habit_${dayName}_${i}`, done=!!completed[key];
                  return (
                    <TouchableOpacity key={i} style={[s.habitRow, done&&{opacity:0.6}]} onPress={()=>toggleHabit(dayName,i,h)} disabled={done} activeOpacity={0.7}>
                      <View style={[s.habitCircle, done&&s.habitCircleDone]}>{done&&<Ionicons name="checkmark" size={12} color="#fff" />}</View>
                      <Text style={{ flex:1, color:done?'#5A5A70':'#9090A8', fontSize:15, lineHeight:22, textDecorationLine:done?'line-through':'none' }}>{h}</Text>
                      {!done && <Text style={{ color:'#7C3AED66', fontSize:11 }}>+15 XP</Text>}
                    </TouchableOpacity>
                  );
                })
              : <Text style={s.emptyTxt}>No habits set for this day.</Text>
          )}

          {activeTab==='Meals' && (plan.supplement_stack??[]).length>0 && (
            <View style={{ marginTop:24 }}>
              <Text style={s.sectionTitle}>💊 Supplement Stack</Text>
              {plan.supplement_stack.map((sup:any,i:number)=>(
                <View key={i} style={s.card}>
                  <Text style={{ color:'#F0F0FF', fontWeight:'600', fontSize:15 }}>{sup.name} <Text style={{ color:'#7C3AED' }}>{sup.dose}</Text></Text>
                  <Text style={{ color:'#5A5A70', fontSize:13, marginTop:4 }}>⏰ {sup.timing}</Text>
                  {sup.reason&&<Text style={{ color:'#9090A8', fontSize:12, marginTop:4 }}>{sup.reason}</Text>}
                </View>
              ))}
            </View>
          )}

          {activeTab==='Meals' && plan.shopping_list && (
            <View style={{ marginTop:24 }}>
              <Text style={s.sectionTitle}>🛒 Shopping List</Text>
              {Object.entries(plan.shopping_list as Record<string,string[]>).map(([cat,items])=>(
                items.length>0 ? <View key={cat} style={{ marginBottom:12 }}><Text style={{ color:'#06B6D4', fontSize:11, fontWeight:'700', letterSpacing:1, marginBottom:6 }}>{cat.toUpperCase()}</Text>{items.map((item,i)=><Text key={i} style={{ color:'#9090A8', fontSize:14, lineHeight:22 }}>• {item}</Text>)}</View> : null
              ))}
            </View>
          )}

          <Text style={{ color:'#5A5A70', fontSize:11, textAlign:'center', marginTop:24, lineHeight:18 }}>⚕️ Not medical advice — consult your doctor before making health changes.</Text>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  topBar:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingVertical:12 },
  topTitle:        { color:'#F0F0FF', fontSize:18, fontWeight:'700' },
  calBtn:          { width:36, height:36, borderRadius:18, backgroundColor:'#7C3AED22', justifyContent:'center', alignItems:'center', borderWidth:1, borderColor:'#7C3AED44' },
  gamBar:          { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingBottom:12, gap:10 },
  gamLeft:         { alignItems:'center', minWidth:48 },
  gamLevel:        { color:'#7C3AED', fontSize:13, fontWeight:'800' },
  gamLevelName:    { color:'#5A5A70', fontSize:10, fontWeight:'600' },
  gamXpWrap:       { flex:1 },
  xpTrack:         { height:6, backgroundColor:'#1E1E2A', borderRadius:3, overflow:'hidden', marginBottom:3 },
  xpFill:          { height:6, backgroundColor:'#7C3AED', borderRadius:3 },
  gamXpTxt:        { color:'#5A5A70', fontSize:10 },
  streakChip:      { backgroundColor:'#FF6B2218', borderRadius:12, paddingVertical:4, paddingHorizontal:10, borderWidth:1, borderColor:'#FF6B2240' },
  streakTxt:       { color:'#FF6B22', fontSize:13, fontWeight:'700' },
  summaryCard:     { backgroundColor:'#16161E', marginHorizontal:20, marginBottom:12, borderRadius:12, padding:14, borderLeftWidth:3, borderLeftColor:'#7C3AED' },
  summaryTxt:      { color:'#9090A8', fontSize:13, lineHeight:20 },
  dayScroll:       { paddingHorizontal:20, gap:8, paddingVertical:8 },
  dayChip:         { backgroundColor:'#16161E', borderRadius:20, paddingVertical:6, paddingHorizontal:14, borderWidth:1, borderColor:'#2A2A38', alignItems:'center' },
  dayChipOn:       { backgroundColor:'#7C3AED', borderColor:'#7C3AED' },
  dayChipComplete: { borderColor:'#10B98150' },
  dayChipTxt:      { color:'#5A5A70', fontWeight:'600', fontSize:13 },
  dayChipTxtOn:    { color:'#fff' },
  dayTheme:        { color:'#7C3AED', fontSize:13, fontWeight:'600', paddingHorizontal:20, marginBottom:8 },
  tabBar:          { flexDirection:'row', paddingHorizontal:20, gap:6, marginBottom:14 },
  tab:             { flex:1, paddingVertical:8, alignItems:'center', borderRadius:8, backgroundColor:'#16161E' },
  tabOn:           { backgroundColor:'#7C3AED' },
  tabTxt:          { color:'#5A5A70', fontSize:12, fontWeight:'600' },
  tabTxtOn:        { color:'#fff' },
  schedRow:        { flexDirection:'row', paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#1E1E2A', gap:12, alignItems:'center' },
  schedTime:       { color:'#7C3AED', fontSize:13, fontWeight:'600', minWidth:72 },
  schedAct:        { color:'#9090A8', fontSize:14, flex:1, lineHeight:20 },
  check:           { width:22, height:22, borderRadius:11, borderWidth:1.5, borderColor:'#3A3A50', justifyContent:'center', alignItems:'center' },
  checkDone:       { backgroundColor:'#7C3AED', borderColor:'#7C3AED' },
  card:            { backgroundColor:'#16161E', borderRadius:12, padding:16, marginBottom:12, borderWidth:1, borderColor:'#2A2A38' },
  mealLabel:       { color:'#7C3AED', fontSize:11, fontWeight:'700', letterSpacing:1.2, marginBottom:6 },
  mealName:        { color:'#F0F0FF', fontSize:16, fontWeight:'600', marginBottom:8 },
  ingredient:      { color:'#9090A8', fontSize:14, lineHeight:22 },
  macrosRow:       { flexDirection:'row', justifyContent:'space-around', marginTop:12, paddingTop:12, borderTopWidth:1, borderTopColor:'#2A2A38' },
  completeBtn:     { flexDirection:'row', alignItems:'center', backgroundColor:'#7C3AED', borderRadius:10, paddingVertical:8, paddingHorizontal:14 },
  completeBtnDone: { backgroundColor:'#10B98118', borderWidth:1, borderColor:'#10B98140' },
  completeBtnTxt:  { color:'#fff', fontWeight:'700', fontSize:13 },
  exerciseRow:     { flexDirection:'row', backgroundColor:'#16161E', borderRadius:12, padding:14, marginBottom:10, borderWidth:1, borderColor:'#2A2A38', alignItems:'center', gap:12 },
  exNum:           { width:34, height:34, borderRadius:17, backgroundColor:'#7C3AED22', justifyContent:'center', alignItems:'center' },
  habitRow:        { flexDirection:'row', alignItems:'center', marginBottom:14, gap:12 },
  habitCircle:     { width:24, height:24, borderRadius:12, borderWidth:2, borderColor:'#7C3AED', justifyContent:'center', alignItems:'center' },
  habitCircleDone: { backgroundColor:'#7C3AED', borderColor:'#7C3AED' },
  sectionTitle:    { color:'#F0F0FF', fontSize:17, fontWeight:'700', marginBottom:14 },
  emptyTxt:        { color:'#5A5A70', fontSize:15, textAlign:'center', paddingVertical:40 },
  healthBadge:     { flexDirection:'row', alignItems:'center', backgroundColor:'#FF2D5510', borderRadius:8, paddingVertical:6, paddingHorizontal:12, marginTop:14, alignSelf:'flex-start', borderWidth:1, borderColor:'#FF2D5530' },
  healthBadgeTxt:  { color:'#FF2D55', fontSize:12, fontWeight:'600' },
});
