/**
 * UpQuest – GoalSelector Component
 * Multi-select grid of goal chips grouped by category.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { GOALS, GOAL_CATEGORIES } from '../constants/goals';

interface Props {
  selectedGoals: string[];
  onToggle:      (key: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  health:    '🫀 Health',
  fitness:   '💪 Fitness',
  lifestyle: '🌿 Lifestyle',
  mental:    '🧠 Mental',
};

export default function GoalSelector({ selectedGoals, onToggle }: Props) {
  return (
    <View>
      {GOAL_CATEGORIES.map(cat => {
        const catGoals = GOALS.filter(g => g.category === cat);
        return (
          <View key={cat} style={styles.category}>
            <Text style={styles.catLabel}>{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.goalGrid}>
              {catGoals.map(goal => {
                const isSelected = selectedGoals.includes(goal.key);
                return (
                  <TouchableOpacity
                    key={goal.key}
                    style={[styles.goalChip, isSelected && styles.goalChipActive]}
                    onPress={() => onToggle(goal.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.goalIcon}>{goal.icon}</Text>
                    <Text style={[styles.goalLabel, isSelected && styles.goalLabelActive]}>
                      {goal.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Text style={styles.checkmarkText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {selectedGoals.length > 0 && (
        <Text style={styles.count}>
          {selectedGoals.length} goal{selectedGoals.length !== 1 ? 's' : ''} selected
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  category: { marginBottom: Spacing.xl },
  catLabel: {
    color:        Colors.textMuted,
    fontSize:     Typography.sm,
    fontWeight:   Typography.bold,
    letterSpacing: 0.8,
    marginBottom:  Spacing.sm,
    textTransform: 'uppercase',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  goalChip: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.card,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap:             Spacing.xs,
  },
  goalChipActive: {
    backgroundColor: Colors.primary + '20',
    borderColor:     Colors.primary,
  },
  goalIcon:  { fontSize: 16 },
  goalLabel: {
    color:      Colors.textSecondary,
    fontSize:   Typography.sm,
    fontWeight: Typography.medium,
  },
  goalLabelActive: { color: Colors.primary, fontWeight: Typography.semibold },
  checkmark:     { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  checkmarkText: { color: '#fff', fontSize: 11, fontWeight: Typography.bold },

  count: {
    color:      Colors.accent,
    fontSize:   Typography.sm,
    fontWeight: Typography.semibold,
    textAlign:  'center',
    marginTop:  Spacing.md,
  },
});
