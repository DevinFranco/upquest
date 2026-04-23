import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { RootStackParamList } from '../App';
import { initHealthKit, isHealthAvailable, getHealthInitError, resetHealthInit } from '../utils/health';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ProfileSetup'>;

type Step = 'stats' | 'goals' | 'labs' | 'health';

const ACTIVITY = [
  { key: 'sedentary',   label: 'Sedentary',   sub: 'Little/no exercise' },
  { key: 'light',       label: 'Light',       sub: '1–3x / week' },
  { key: 'moderate',    label: 'Moderate',    sub: '3–5x / week' },
  { key: 'active',      label: 'Active',      sub: '6–7x / week' },
  { key: 'very_active', label: 'Very Active', sub: 'Athlete / physical job' },
];

const GOALS = [
  { key: 'lose_weight',      label: '🔥 Lose Weight' },
  { key: 'build_muscle',     label: '💪 Build Muscle' },
  { key: 'improve_sleep',    label: '😴 Better Sleep' },
  { key: 'more_energy',      label: '⚡ More Energy' },
  { key: 'reduce_stress',    label: '🧘 Reduce Stress' },
  { key: 'better_nutrition', label: '🥗 Better Nutrition' },
  { key: 'run_faster',       label: '🏃 Run Faster' },
  { key: 'flexibility',      label: '🤸 Flexibility' },
];

const C = { primary: '#7C3AED', card: '#16161E', border: '#2A2A38', bg: '#0A0A0F', textPrimary: '#F0F0FF', textSecondary: '#9090A8', textMuted: '#5A5A70' };

export default function ProfileSetupScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const editing    = route.params?.editing ?? false;

  const [step,        setStep]       = useState<Step>('stats');
  const [saving,      setSaving]     = useState(false);
  const [sex,         setSex]        = useState('');
  const [age,         setAge]        = useState('');
  const [hFt,         setHFt]        = useState('');
  const [hIn,         setHIn]        = useState('');
  const [weight,      setWeight]     = useState('');
  const [activity,    setActivity]   = useState('moderate');
  const [goals,       setGoals]      = useState<string[]>([]);
  const [labFiles,     setLabFiles]    = useState<{ name: string; uri: string; size?: number }[]>([]);
  const [labUploading, setLabUploading] = useState(false);
  // Health step state
  const [healthConnecting, setHealthConnecting] = useState(false);
  const [healthConnected,  setHealthConnected]  = useState(false);
  const [healthDenied,     setHealthDenied]     = useState(false);
  const [healthError,      setHealthError]      = useState<string | null>(null);

  // Pre-fill fields from any previously saved profile so returning users
  // don't have to re-enter everything when rebuilding or editing their plan.
  useEffect(() => {
    AsyncStorage.getItem('upquest_profile').then(raw => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        if (p.stats) {
          if (p.stats.sex)            setSex(p.stats.sex);
          if (p.stats.age)            setAge(String(p.stats.age));
          if (p.stats.weight_lbs)     setWeight(String(p.stats.weight_lbs));
          if (p.stats.activity_level) setActivity(p.stats.activity_level);
          if (p.stats.height_inches) {
            const totalIn = p.stats.height_inches;
            setHFt(String(Math.floor(totalIn / 12)));
            setHIn(String(totalIn % 12));
          }
        }
        if (Array.isArray(p.goals)) setGoals(p.goals);
      } catch {}
    });
  }, []);

  const toggleGoal = (k: string) =>
    setGoals(p => p.includes(k) ? p.filter(g => g !== k) : [...p, k]);

  const pickFromFiles = async () => {
    setLabUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (!result.canceled && result.assets?.length) {
        const incoming = result.assets.map(a => ({ name: a.name, uri: a.uri, size: a.size }));
        setLabFiles(prev => {
          const existing = new Set(prev.map(f => f.uri));
          return [...prev, ...incoming.filter(f => !existing.has(f.uri))];
        });
      }
    } catch (e: any) {
      Alert.alert('Could not open Files', e?.message ?? 'Please try again.');
    } finally {
      setLabUploading(false);
    }
  };

  const pickFromPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Go to Settings → UpQuest → Photos and allow access.');
      return;
    }
    setLabUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.length) {
        const incoming = result.assets.map(a => ({
          name: a.fileName ?? `photo_${Date.now()}.jpg`,
          uri:  a.uri,
          size: a.fileSize,
        }));
        setLabFiles(prev => {
          const existing = new Set(prev.map(f => f.uri));
          return [...prev, ...incoming.filter(f => !existing.has(f.uri))];
        });
      }
    } catch (e: any) {
      Alert.alert('Could not open Photos', e?.message ?? 'Please try again.');
    } finally {
      setLabUploading(false);
    }
  };

  // Native Alert lets iOS properly sequence the dismissal before opening
  // a system picker — avoids the modal conflict that caused stuck spinners.
  const showUploadOptions = () => {
    Alert.alert(
      'Add Lab Files',
      'Choose how to add your bloodwork',
      [
        { text: '📷  Choose from Photos', onPress: pickFromPhotos },
        { text: '📄  Choose from Files',  onPress: pickFromFiles },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const removeFile = (uri: string) => setLabFiles(prev => prev.filter(f => f.uri !== uri));

  const statsOK = !!(sex && age && hFt && weight);
  const goalsOK = goals.length > 0;

  const saveAndContinue = async () => {
    if (!goalsOK) { Alert.alert('Pick at least one goal.'); return; }
    setSaving(true);
    const profile = {
      stats: { sex, age: parseInt(age), height_inches: parseInt(hFt) * 12 + parseInt(hIn || '0'), weight_lbs: parseFloat(weight), activity_level: activity },
      goals,
    };
    await AsyncStorage.setItem('upquest_profile', JSON.stringify(profile));
    setSaving(false);
    if (editing) { navigation.goBack(); return; }
    setStep('labs');
  };

  const saveLabs = async (withLabs = true) => {
    const raw     = await AsyncStorage.getItem('upquest_profile');
    const profile = raw ? JSON.parse(raw) : { stats: { sex, age: parseInt(age), height_inches: parseInt(hFt)*12+parseInt(hIn||'0'), weight_lbs: parseFloat(weight), activity_level: activity }, goals };
    if (withLabs && labFiles.length > 0) {
      profile.labs = labFiles.map(f => ({ fileName: f.name, uri: f.uri, uploadedAt: new Date().toISOString() }));
      await AsyncStorage.setItem('upquest_profile', JSON.stringify(profile));
    }
    // If on iOS and health not yet connected, go to health step
    if (!editing && isHealthAvailable()) {
      setStep('health');
    } else {
      goToChat();
    }
  };

  const connectHealth = async () => {
    setHealthConnecting(true);
    setHealthDenied(false);
    setHealthError(null);
    resetHealthInit(); // clear any prior init state so iOS dialog can fire again
    try {
      const granted = await initHealthKit();
      if (granted) {
        setHealthConnected(true);
        // Don't fetch health data here — PlanChatScreen handles it when building the Quest.
        // Fetching immediately after permission grant causes native bridge crashes.
      } else {
        setHealthDenied(true);
        setHealthError(getHealthInitError());
      }
    } catch (e: any) {
      setHealthDenied(true);
      setHealthError(e?.message ?? String(e));
    } finally {
      setHealthConnecting(false);
    }
  };

  const goToChat = async () => {
    const raw     = await AsyncStorage.getItem('upquest_profile');
    const profile = raw ? JSON.parse(raw) : { stats: { sex, age: parseInt(age), height_inches: parseInt(hFt)*12+parseInt(hIn||'0'), weight_lbs: parseFloat(weight), activity_level: activity }, goals };
    navigation.replace('PlanChat', {
      stats: profile.stats,
      goals: profile.goals,
      labs:  profile.labs ?? null,
      mode:  'onboarding',
    });
  };

  if (step === 'stats') return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>About You</Text>
            <Text style={styles.sub}>Personalizes your Quest — no account needed.</Text>

            <Text style={styles.label}>Biological Sex</Text>
            <View style={styles.row}>
              {[['male','♂  Male'],['female','♀  Female']].map(([k,l]) => (
                <TouchableOpacity key={k} style={[styles.chip, sex===k && styles.chipOn, { flex:1, marginHorizontal:4 }]} onPress={() => setSex(k)}>
                  <Text style={[styles.chipTxt, sex===k && styles.chipTxtOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Age</Text>
            <View style={styles.inputRow}><TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="32" placeholderTextColor={C.textMuted} /><Text style={styles.unit}>yrs</Text></View>

            <Text style={styles.label}>Height</Text>
            <View style={styles.row}>
              <View style={[styles.inputRow, { flex:1, marginRight:8 }]}><TextInput style={styles.input} value={hFt} onChangeText={setHFt} keyboardType="number-pad" placeholder="5" placeholderTextColor={C.textMuted} /><Text style={styles.unit}>ft</Text></View>
              <View style={[styles.inputRow, { flex:1 }]}><TextInput style={styles.input} value={hIn} onChangeText={setHIn} keyboardType="number-pad" placeholder="10" placeholderTextColor={C.textMuted} /><Text style={styles.unit}>in</Text></View>
            </View>

            <Text style={styles.label}>Weight</Text>
            <View style={styles.inputRow}><TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="185" placeholderTextColor={C.textMuted} /><Text style={styles.unit}>lbs</Text></View>

            <Text style={styles.label}>Activity Level</Text>
            <View style={{ gap: 8, marginBottom: 28 }}>
              {ACTIVITY.map(a => (
                <TouchableOpacity key={a.key} style={[styles.actRow, activity===a.key && styles.chipOn]} onPress={() => setActivity(a.key)}>
                  <Text style={[styles.chipTxt, activity===a.key && styles.chipTxtOn]}>{a.label}</Text>
                  <Text style={[{ color: C.textMuted, fontSize: 12 }, activity===a.key && { color: 'rgba(255,255,255,0.65)' }]}>{a.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.btn, !statsOK && { opacity: 0.4 }]} onPress={() => setStep('goals')} disabled={!statsOK}>
              <Text style={styles.btnTxt}>Next: Choose Goals →</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );

  if (step === 'goals') return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setStep('stats')} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.primary }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Your Goals</Text>
          <Text style={styles.sub}>Select everything that applies.</Text>

          <View style={styles.goalsGrid}>
            {GOALS.map(g => (
              <TouchableOpacity key={g.key} style={[styles.goalChip, goals.includes(g.key) && styles.chipOn]} onPress={() => toggleGoal(g.key)}>
                <Text style={[styles.chipTxt, goals.includes(g.key) && styles.chipTxtOn]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.btn, (!goalsOK || saving) && { opacity: 0.4 }]} onPress={saveAndContinue} disabled={!goalsOK || saving}>
            <Text style={styles.btnTxt}>{saving ? 'Saving…' : editing ? 'Save Profile' : 'Next: Lab Work (optional) →'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );

  // Health step (iOS only — shown after labs)
  if (step === 'health') return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setStep('labs')} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.primary }}>← Back</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={[styles.labUploadIcon, { width: 80, height: 80, borderRadius: 40, marginBottom: 0 }]}>
              <Ionicons name="heart" size={40} color="#FF2D55" />
            </View>
          </View>

          <Text style={styles.title}>Connect Apple Health</Text>
          <Text style={styles.sub}>
            UpQuest reads your historical health data to build a truly personalised Quest — not just guesses.
          </Text>

          {/* What gets read */}
          <View style={[styles.benefitsList, { marginBottom: 24 }]}>
            {[
              { icon: 'footsteps-outline',     text: 'Daily steps & activity — last 30 days' },
              { icon: 'bed-outline',            text: 'Sleep duration & quality — last 30 days' },
              { icon: 'heart-outline',          text: 'Resting heart rate & HRV' },
              { icon: 'barbell-outline',        text: 'Workout history — last 90 days' },
              { icon: 'scale-outline',          text: 'Weight & body composition trends' },
              { icon: 'fitness-outline',        text: 'VO2 Max & blood oxygen' },
            ].map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Ionicons name={b.icon as any} size={18} color={C.primary} style={{ marginRight: 10, marginTop: 1 }} />
                <Text style={{ color: C.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 }}>{b.text}</Text>
              </View>
            ))}
          </View>

          <Text style={{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 24, lineHeight: 18 }}>
            Data stays on your device and is only used to personalise your Quest. UpQuest never stores or sells your health data.
          </Text>

          {healthConnected ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52,199,89,0.15)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginBottom: 20 }}>
                <Ionicons name="checkmark-circle" size={22} color="#34C759" style={{ marginRight: 8 }} />
                <Text style={{ color: '#34C759', fontWeight: '700', fontSize: 15 }}>Apple Health connected!</Text>
              </View>
              <TouchableOpacity style={styles.btn} onPress={goToChat}>
                <Text style={styles.btnTxt}>Build My Quest →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {healthDenied && (
                <View style={{ backgroundColor: 'rgba(255,59,48,0.12)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <Text style={{ color: '#FF3B30', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                    Permission was denied. You can enable Apple Health access in{' '}
                    <Text style={{ fontWeight: '700' }}>Settings → Privacy → Health → UpQuest</Text>.
                  </Text>
                  {healthError && (
                    <Text style={{ color: '#FF6B6B', fontSize: 11, textAlign: 'center', marginTop: 8, fontFamily: 'monospace' }}>
                      Debug: {healthError}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.btn, healthConnecting && { opacity: 0.6 }]}
                onPress={connectHealth}
                disabled={healthConnecting}
              >
                {healthConnecting ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.btnTxt}>Requesting access…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnTxt}>
                    {healthDenied ? 'Try Again' : '❤️  Connect Apple Health'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={goToChat} style={{ marginTop: 16 }}>
                <Text style={{ color: C.textSecondary, textAlign: 'center', fontSize: 14 }}>
                  Skip — I'll add health data later
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );

  // Labs step
  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => setStep('goals')} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.primary }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Upload Lab Work</Text>
          <Text style={styles.sub}>Blood work lets the AI add biomarker-specific recommendations — completely optional.</Text>

          {/* Uploaded files list */}
          {labFiles.length > 0 && (
            <View style={{ marginBottom: 16, gap: 10 }}>
              {labFiles.map(f => (
                <View key={f.uri} style={styles.fileRow}>
                  <Ionicons name="document-attach-outline" size={20} color={C.primary} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F0F0FF', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{f.name}</Text>
                    {f.size ? <Text style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{(f.size / 1024).toFixed(0)} KB</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => removeFile(f.uri)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={20} color="#5A5A70" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Add files button */}
          <TouchableOpacity
            style={[styles.labCard, labFiles.length > 0 && { paddingVertical: 18 }]}
            onPress={showUploadOptions}
            disabled={labUploading}
          >
            {labUploading ? (
              <ActivityIndicator color={C.primary} size="large" />
            ) : (
              <>
                <View style={styles.labUploadIcon}>
                  <Ionicons name={labFiles.length > 0 ? 'add-circle-outline' : 'cloud-upload-outline'} size={32} color={C.primary} />
                </View>
                <Text style={{ color: C.textPrimary, fontWeight: '600', fontSize: 16, marginTop: 12 }}>
                  {labFiles.length > 0 ? 'Add more files' : 'Upload bloodwork'}
                </Text>
                <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                  PDF, photo, or image — multiple files OK
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.benefitsList}>
            {[
              { icon: 'water-outline',        text: 'Nutrition matched to your actual biomarkers' },
              { icon: 'medkit-outline',        text: 'Supplement gaps filled from real deficiencies' },
              { icon: 'barbell-outline',       text: 'Workout intensity tuned to your hormone levels' },
              { icon: 'trending-up-outline',   text: 'Targeted goals based on metabolic markers' },
            ].map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <Ionicons name={b.icon as any} size={18} color={C.primary} style={{ marginRight: 10, marginTop: 1 }} />
                <Text style={{ color: C.textSecondary, fontSize: 14, lineHeight: 20, flex: 1 }}>{b.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.btn, { marginTop: 20 }]} onPress={() => saveLabs(true)}>
            <Text style={styles.btnTxt}>
              {labFiles.length > 0
                ? `Continue with ${labFiles.length} file${labFiles.length > 1 ? 's' : ''} →`
                : 'Continue →'}
            </Text>
          </TouchableOpacity>
          {labFiles.length === 0 && (
            <TouchableOpacity onPress={() => saveLabs(false)}>
              <Text style={{ color: C.primary, textAlign: 'center', marginTop: 16, fontSize: 14 }}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  content:   { padding: 24, paddingBottom: 60 },
  title:     { fontSize: 26, fontWeight: '800', color: '#F0F0FF', marginBottom: 8 },
  sub:       { fontSize: 15, color: '#9090A8', marginBottom: 24, lineHeight: 22 },
  label:     { fontSize: 13, fontWeight: '600', color: '#9090A8', marginBottom: 8, marginTop: 16 },
  row:       { flexDirection: 'row', marginBottom: 4 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161E', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 10, paddingHorizontal: 14, marginBottom: 4 },
  input:     { flex: 1, color: '#F0F0FF', fontSize: 18, paddingVertical: 14 },
  unit:      { color: '#5A5A70', fontSize: 14, marginLeft: 6 },
  chip:      { backgroundColor: '#16161E', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  chipOn:    { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipTxt:   { color: '#9090A8', fontWeight: '600', fontSize: 14 },
  chipTxtOn: { color: '#fff' },
  actRow:    { backgroundColor: '#16161E', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  goalChip:  { backgroundColor: '#16161E', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  btn:       { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnTxt:    { color: '#fff', fontWeight: '700', fontSize: 16 },
  labCard:       { backgroundColor: '#16161E', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 24 },
  labUploadIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  benefitsList:  { gap: 12, marginBottom: 4 },
  benefitRow:    { flexDirection: 'row', alignItems: 'flex-start' },

  fileRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161E', borderWidth: 1, borderColor: '#2A2A38', borderRadius: 10, padding: 12 },

});
