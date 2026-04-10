/**
 * UpQuest – Upload Bloodwork Screen
 * Allows premium users to upload PDF lab reports for AI analysis.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../utils/supabase';
import { api } from '../utils/api';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import PremiumBanner from '../components/PremiumBanner';
import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface BloodworkUpload {
  id:           string;
  uploaded_at:  string;
  extracted_data: {
    values: Record<string, number>;
  };
}

// Lab value display config
const LAB_DISPLAY: Record<string, { label: string; unit: string; normal?: string }> = {
  triglycerides:    { label: 'Triglycerides',    unit: 'mg/dL', normal: '<150' },
  LDL:              { label: 'LDL Cholesterol',  unit: 'mg/dL', normal: '<100' },
  HDL:              { label: 'HDL Cholesterol',  unit: 'mg/dL', normal: '>40' },
  total_cholesterol:{ label: 'Total Cholesterol',unit: 'mg/dL', normal: '<200' },
  testosterone:     { label: 'Testosterone',     unit: 'ng/dL', normal: '300–1000' },
  free_testosterone:{ label: 'Free Testosterone',unit: 'ng/dL', normal: '9–30' },
  glucose:          { label: 'Glucose',          unit: 'mg/dL', normal: '70–100' },
  hba1c:            { label: 'HbA1c',            unit: '%',     normal: '<5.7' },
  TSH:              { label: 'TSH',              unit: 'mIU/L', normal: '0.5–4.5' },
  vitamin_d:        { label: 'Vitamin D',        unit: 'ng/mL', normal: '30–80' },
};

export default function UploadScreen() {
  const navigation  = useNavigation<Nav>();
  const [isPremium,  setIsPremium]  = useState(false);
  const [uploads,    setUploads]    = useState<BloodworkUpload[]>([]);
  const [uploading,  setUploading]  = useState(false);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;
    try {
      const [profileRes, uploadsRes] = await Promise.all([
        api.get('/profile', session.access_token),
        api.get('/bloodwork', session.access_token),
      ]);
      setIsPremium(profileRes.is_premium);
      setUploads(uploadsRes.uploads ?? []);
    } finally {
      setLoading(false);
    }
  };

  const pickAndUpload = async () => {
    if (!isPremium) {
      navigation.navigate('Paywall', { feature: 'Bloodwork Upload & AI Analysis' });
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];

      setUploading(true);
      const session = (await supabase.auth.getSession()).data.session!;

      const formData = new FormData();
      formData.append('file', {
        uri:  file.uri,
        name: file.name,
        type: 'application/pdf',
      } as any);

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/upload-bloodwork`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body:    formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Upload failed');
      }

      const data = await res.json();
      Alert.alert(
        '✅ Upload Successful',
        `Extracted ${Object.keys(data.extracted?.values ?? {}).length} lab values. Your next schedule will use these results.`,
      );
      await loadData();
    } catch (e: any) {
      Alert.alert('Upload Error', e.message ?? 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Lab Results</Text>
            <Text style={styles.headerSub}>Upload your bloodwork for AI-personalized routines</Text>
          </View>

          {/* Premium gate */}
          {!isPremium && (
            <PremiumBanner
              message="Upload bloodwork PDFs and unlock AI lab analysis."
              onPress={() => navigation.navigate('Paywall', { feature: 'Bloodwork Upload' })}
            />
          )}

          {/* Upload CTA */}
          <TouchableOpacity
            style={[styles.uploadCard, !isPremium && styles.uploadCardLocked, uploading && { opacity: 0.6 }]}
            onPress={pickAndUpload}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isPremium ? Colors.gradientAccent : ['#2A2A3E', '#1E1E2E']}
              style={styles.uploadGradient}
            >
              {uploading ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.uploadTitle}>Analyzing your labs…</Text>
                  <Text style={styles.uploadSub}>Grok is reading your results</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name={isPremium ? 'cloud-upload' : 'lock-closed'}
                    size={40}
                    color="#fff"
                  />
                  <Text style={styles.uploadTitle}>
                    {isPremium ? 'Upload Bloodwork PDF' : 'Premium Feature'}
                  </Text>
                  <Text style={styles.uploadSub}>
                    {isPremium
                      ? 'Supports most lab formats (Quest, LabCorp, etc.)'
                      : 'Upgrade to upload your labs and unlock AI analysis'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* How it works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            {[
              { icon: '📄', title: 'Upload your PDF', desc: 'Any standard bloodwork report from your doctor or lab.' },
              { icon: '🔬', title: 'AI extracts key values', desc: 'Grok reads triglycerides, testosterone, cholesterol, and more.' },
              { icon: '⚡', title: 'Plan auto-personalizes', desc: 'Your next weekly routine is optimized to your exact lab results.' },
            ].map((step, i) => (
              <View key={i} style={styles.howStep}>
                <Text style={styles.howIcon}>{step.icon}</Text>
                <View style={styles.howText}>
                  <Text style={styles.howTitle}>{step.title}</Text>
                  <Text style={styles.howDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Past uploads */}
          {uploads.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Lab History</Text>
              {uploads.map(upload => {
                const values = upload.extracted_data?.values ?? {};
                const keys   = Object.keys(values).filter(k => LAB_DISPLAY[k]);
                return (
                  <View key={upload.id} style={styles.uploadRecord}>
                    <View style={styles.uploadRecordHeader}>
                      <Ionicons name="document-text" size={20} color={Colors.accent} />
                      <Text style={styles.uploadDate}>
                        {new Date(upload.uploaded_at).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric',
                        })}
                      </Text>
                    </View>
                    {keys.length > 0 ? (
                      <View style={styles.labGrid}>
                        {keys.slice(0, 6).map(key => {
                          const cfg = LAB_DISPLAY[key];
                          return (
                            <View key={key} style={styles.labCell}>
                              <Text style={styles.labValue}>
                                {values[key]} <Text style={styles.labUnit}>{cfg.unit}</Text>
                              </Text>
                              <Text style={styles.labLabel}>{cfg.label}</Text>
                              {cfg.normal && (
                                <Text style={styles.labNormal}>Normal: {cfg.normal}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.noValues}>Could not extract values — try uploading again.</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <Text style={styles.disclaimer}>
            ⚕️ Not medical advice. UpQuest does not store your bloodwork beyond the session unless you opt in. Consult your physician before making health changes.
          </Text>
          <View style={{ height: Spacing['4xl'] }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header:    { padding: Spacing.xl, paddingTop: Spacing.lg },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography['2xl'], fontWeight: Typography.black },
  headerSub:   { color: Colors.textSecondary, fontSize: Typography.base, marginTop: Spacing.xs },

  uploadCard:       { marginHorizontal: Spacing.xl, marginBottom: Spacing.xl, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.lg },
  uploadCardLocked: { opacity: 0.85 },
  uploadGradient:   { padding: Spacing['3xl'], alignItems: 'center', gap: Spacing.md },
  uploadTitle:      { color: '#fff', fontSize: Typography.xl, fontWeight: Typography.bold, textAlign: 'center' },
  uploadSub:        { color: 'rgba(255,255,255,0.75)', fontSize: Typography.sm, textAlign: 'center' },

  section:      { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },

  howStep:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
  howIcon:  { fontSize: 28, marginRight: Spacing.md, marginTop: 2 },
  howText:  { flex: 1 },
  howTitle: { color: Colors.textPrimary, fontWeight: Typography.semibold, fontSize: Typography.base },
  howDesc:  { color: Colors.textSecondary, fontSize: Typography.sm, marginTop: 2, lineHeight: 20 },

  uploadRecord:       { backgroundColor: Colors.card, marginHorizontal: Spacing.xl, marginBottom: Spacing.md, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  uploadRecordHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 8 },
  uploadDate:         { color: Colors.textPrimary, fontWeight: Typography.semibold, fontSize: Typography.base },

  labGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  labCell:  { backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.md, minWidth: '45%', flex: 1 },
  labValue: { color: Colors.primary, fontSize: Typography.lg, fontWeight: Typography.bold },
  labUnit:  { color: Colors.textMuted, fontSize: Typography.xs, fontWeight: Typography.regular },
  labLabel: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  labNormal:{ color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  noValues: { color: Colors.textMuted, fontSize: Typography.sm, fontStyle: 'italic' },

  disclaimer: { color: Colors.textMuted, fontSize: Typography.xs, textAlign: 'center', paddingHorizontal: Spacing.xl, lineHeight: 18 },
});
