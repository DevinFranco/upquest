/**
 * UpQuest – Paywall / Upgrade Screen
 * Presents the 3 plan options and initiates Stripe Checkout.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack';

import { supabase } from '../utils/supabase';
import { Colors, Typography, Spacing, Radius, Shadow } from '../constants/theme';
import type { RootStackParamList } from '../App';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Paywall'>;
type Route = RouteProp<RootStackParamList, 'Paywall'>;

interface Plan {
  key:        'monthly' | 'yearly' | 'lifetime';
  name:       string;
  price:      string;
  sub:        string;
  badge?:     string;
  savings?:   string;
  highlight:  boolean;
}

const PLANS: Plan[] = [
  {
    key:       'monthly',
    name:      'Monthly',
    price:     '$9.99',
    sub:       'per month',
    highlight: false,
  },
  {
    key:       'yearly',
    name:      'Annual',
    price:     '$79',
    sub:       'per year · billed annually',
    badge:     'BEST VALUE',
    savings:   'Save $40/yr vs monthly',
    highlight: true,
  },
  {
    key:       'lifetime',
    name:      'Lifetime Forge',
    price:     '$199',
    sub:       'one-time · limited launch offer',
    badge:     'FOUNDER',
    highlight: false,
  },
];

const FEATURES = [
  { icon: '⚡', text: 'Unlimited AI-generated weekly schedules' },
  { icon: '🩸', text: 'Bloodwork PDF upload + auto-analysis' },
  { icon: '📅', text: 'Calendar sync (Google + Apple)' },
  { icon: '🔔', text: 'Smart daily push notifications' },
  { icon: '📊', text: 'Progress tracking + weekly re-optimization' },
  { icon: '💊', text: 'Personalized supplement stack' },
  { icon: '🛒', text: 'Weekly shopping list generation' },
  { icon: '🚫', text: 'Ad-free + priority Grok AI responses' },
];

export default function PaywallScreen() {
  const navigation  = useNavigation<Nav>();
  const route       = useRoute<Route>();
  const feature     = route.params?.feature;

  const [selected, setSelected] = useState<Plan['key']>('yearly');
  const [loading,  setLoading]  = useState(false);

  const handleUpgrade = async () => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      Alert.alert('Please sign in first.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/stripe/create-checkout`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan:    selected,
          user_id: session.user.id,
          email:   session.user.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? 'Could not create checkout.');

      // Open Stripe Checkout in the device browser
      await Linking.openURL(data.checkout_url);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0A0A0F', '#12121A']} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Dismiss */}
          <TouchableOpacity style={styles.dismiss} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>⭐</Text>
            <Text style={styles.headerTitle}>UpQuest Premium</Text>
            {feature && (
              <Text style={styles.featureGate}>
                Unlock "{feature}" and everything below.
              </Text>
            )}
            <Text style={styles.headerSub}>
              Your AI health coach, fully unleashed.
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresCard}>
            {FEATURES.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {/* Plan selector */}
          <Text style={styles.plansTitle}>Choose your plan</Text>
          {PLANS.map(plan => (
            <TouchableOpacity
              key={plan.key}
              style={[
                styles.planCard,
                selected === plan.key && styles.planCardSelected,
                plan.highlight && selected === plan.key && styles.planCardHighlight,
              ]}
              onPress={() => setSelected(plan.key)}
              activeOpacity={0.85}
            >
              {plan.badge && (
                <View style={[styles.planBadge, plan.highlight && styles.planBadgeBest]}>
                  <Text style={styles.planBadgeText}>{plan.badge}</Text>
                </View>
              )}
              <View style={styles.planLeft}>
                <View style={[
                  styles.radioOuter,
                  selected === plan.key && styles.radioSelected,
                ]}>
                  {selected === plan.key && <View style={styles.radioInner} />}
                </View>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.savings && (
                    <Text style={styles.planSavings}>{plan.savings}</Text>
                  )}
                </View>
              </View>
              <View style={styles.planRight}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planSub}>{plan.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.ctaBtn, loading && { opacity: 0.6 }]}
            onPress={handleUpgrade}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.ctaText}>
                    Start {PLANS.find(p => p.key === selected)?.name} →
                  </Text>
                  <Text style={styles.ctaSub}>Secure checkout via Stripe</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Social proof */}
          <View style={styles.socialProof}>
            <Text style={styles.socialProofText}>
              "I fixed my low T and cholesterol in 8 weeks using my UpQuest plan." – Beta user
            </Text>
          </View>

          {/* Fine print */}
          <Text style={styles.finePrint}>
            Cancel anytime from the Stripe billing portal. Lifetime plan is a one-time charge with no recurring fees.
            Not medical advice — consult your physician before making health changes.
          </Text>

          <View style={{ height: Spacing['4xl'] }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  dismiss: { alignSelf: 'flex-end', padding: Spacing.xl },

  header:     { alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing['2xl'] },
  headerEmoji:{ fontSize: 56, marginBottom: Spacing.sm },
  headerTitle:{ color: Colors.textPrimary, fontSize: Typography['3xl'], fontWeight: Typography.black, textAlign: 'center' },
  featureGate:{ color: Colors.primary, fontSize: Typography.base, marginTop: Spacing.sm, textAlign: 'center', fontWeight: Typography.semibold },
  headerSub:  { color: Colors.textSecondary, fontSize: Typography.base, marginTop: Spacing.xs, textAlign: 'center' },

  featuresCard: { backgroundColor: Colors.card, marginHorizontal: Spacing.xl, borderRadius: Radius.xl, padding: Spacing.xl, marginBottom: Spacing['2xl'], borderWidth: 1, borderColor: Colors.border },
  featureRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  featureIcon:  { fontSize: 20, marginRight: Spacing.md, width: 28 },
  featureText:  { flex: 1, color: Colors.textSecondary, fontSize: Typography.base, lineHeight: 22 },

  plansTitle: { color: Colors.textPrimary, fontSize: Typography.lg, fontWeight: Typography.bold, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },

  planCard:          { marginHorizontal: Spacing.xl, marginBottom: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.lg, backgroundColor: Colors.card, borderWidth: 2, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planCardSelected:  { borderColor: Colors.primary },
  planCardHighlight: { borderColor: Colors.gold, backgroundColor: Colors.gold + '0F' },

  planBadge:     { position: 'absolute', top: -10, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 2, paddingHorizontal: Spacing.sm },
  planBadgeBest: { backgroundColor: Colors.gold },
  planBadgeText: { color: '#000', fontSize: 10, fontWeight: Typography.bold, letterSpacing: 0.5 },

  planLeft:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  radioOuter:  { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  radioSelected:{ borderColor: Colors.primary },
  radioInner:  { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
  planName:    { color: Colors.textPrimary, fontWeight: Typography.bold, fontSize: Typography.base },
  planSavings: { color: Colors.accent, fontSize: Typography.xs, marginTop: 2 },

  planRight:  { alignItems: 'flex-end' },
  planPrice:  { color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.black },
  planSub:    { color: Colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'right' },

  ctaBtn:     { marginHorizontal: Spacing.xl, marginTop: Spacing.xl, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.lg },
  ctaGradient:{ paddingVertical: Spacing.xl, alignItems: 'center' },
  ctaText:    { color: '#fff', fontSize: Typography.lg, fontWeight: Typography.bold },
  ctaSub:     { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, marginTop: 4 },

  socialProof:     { backgroundColor: Colors.card, marginHorizontal: Spacing.xl, marginTop: Spacing.xl, borderRadius: Radius.lg, padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  socialProofText: { color: Colors.textSecondary, fontSize: Typography.sm, fontStyle: 'italic', lineHeight: 20 },

  finePrint: { color: Colors.textMuted, fontSize: Typography.xs, textAlign: 'center', paddingHorizontal: Spacing.xl, marginTop: Spacing.xl, lineHeight: 18 },
});
