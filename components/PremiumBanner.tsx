/**
 * UpQuest – PremiumBanner Component
 * Inline upsell banner shown to free users.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

interface Props {
  message?: string;
  onPress:  () => void;
}

export default function PremiumBanner({
  message = 'Upgrade to Premium for unlimited AI plans, bloodwork uploads, calendar sync, and more.',
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={['#1E1A40', '#2A1F52']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconWrap}>
          <Text style={styles.star}>⭐</Text>
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>Unlock UpQuest Premium</Text>
          <Text style={styles.sub}>{message}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.gold} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.xl,
    marginBottom:     Spacing.lg,
    borderRadius:     Radius.lg,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      Colors.gold + '44',
  },
  gradient: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       Spacing.md,
    gap:           Spacing.md,
  },
  iconWrap: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: Colors.gold + '20',
    justifyContent:  'center',
    alignItems:      'center',
  },
  star:      { fontSize: 20 },
  textBlock: { flex: 1 },
  title:     { color: Colors.gold, fontWeight: Typography.bold, fontSize: Typography.sm },
  sub:       { color: Colors.textMuted, fontSize: Typography.xs, lineHeight: 16, marginTop: 2 },
});
