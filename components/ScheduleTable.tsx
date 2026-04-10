/**
 * UpQuest – ScheduleTable Component
 * Renders the beautiful printer-style daily time-block table.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

interface Props {
  schedule:  Record<string, string>;
  dailyTip?: string;
}

// Classify time slots for color coding
function classifySlot(activity: string): {
  color: string;
  dot: string;
  icon: string;
} {
  const a = activity.toLowerCase();
  if (a.includes('workout') || a.includes('exercise') || a.includes('gym') || a.includes('lift') || a.includes('run') || a.includes('walk'))
    return { color: Colors.accentWarm + '22', dot: Colors.accentWarm, icon: '🏋️' };
  if (a.includes('meal') || a.includes('breakfast') || a.includes('lunch') || a.includes('dinner') || a.includes('eat') || a.includes('snack'))
    return { color: Colors.accent + '22', dot: Colors.accent, icon: '🥗' };
  if (a.includes('sleep') || a.includes('bed') || a.includes('wind down') || a.includes('meditat') || a.includes('relax'))
    return { color: Colors.primary + '22', dot: Colors.primary, icon: '😴' };
  if (a.includes('wake') || a.includes('morning') || a.includes('journal'))
    return { color: Colors.gold + '22', dot: Colors.gold, icon: '🌅' };
  if (a.includes('supplement') || a.includes('vitamin') || a.includes('protein'))
    return { color: '#8B5CF6' + '22', dot: '#8B5CF6', icon: '💊' };
  return { color: Colors.card, dot: Colors.textMuted, icon: '⏰' };
}

export default function ScheduleTable({ schedule, dailyTip }: Props) {
  const entries = Object.entries(schedule);

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No schedule data for this day.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {dailyTip && (
        <View style={styles.tipCard}>
          <Text style={styles.tipLabel}>💡 Daily Tip</Text>
          <Text style={styles.tipText}>{dailyTip}</Text>
        </View>
      )}

      {entries.map(([time, activity], i) => {
        const { color, dot, icon } = classifySlot(activity);
        const isLast = i === entries.length - 1;

        return (
          <View key={`${time}-${i}`} style={styles.row}>
            {/* Time column */}
            <View style={styles.timeCol}>
              <Text style={styles.timeText}>{time}</Text>
            </View>

            {/* Timeline line + dot */}
            <View style={styles.timelineCol}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              {!isLast && <View style={[styles.line, { borderColor: dot + '44' }]} />}
            </View>

            {/* Activity card */}
            <View style={[styles.activityCard, { backgroundColor: color }]}>
              <Text style={styles.activityIcon}>{icon}</Text>
              <Text style={styles.activityText}>{activity}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },

  tipCard: {
    backgroundColor: Colors.primary + '15',
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    marginBottom:    Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  tipLabel: { color: Colors.primary, fontSize: Typography.xs, fontWeight: Typography.bold, letterSpacing: 0.5, marginBottom: 4 },
  tipText:  { color: Colors.textSecondary, fontSize: Typography.sm, lineHeight: 20 },

  row: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    marginBottom:   Spacing.sm,
  },

  timeCol: {
    width:       68,
    paddingTop:  Spacing.sm + 2,
    alignItems:  'flex-end',
    paddingRight: Spacing.sm,
  },
  timeText: {
    color:      Colors.textMuted,
    fontSize:   Typography.xs,
    fontWeight: Typography.medium,
    lineHeight: 20,
  },

  timelineCol: {
    width:      20,
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  dot: {
    width:        10,
    height:       10,
    borderRadius: 5,
    zIndex:       1,
  },
  line: {
    width:        2,
    flex:         1,
    borderLeftWidth: 2,
    borderStyle:  'dashed',
    marginTop:    2,
    minHeight:    24,
  },

  activityCard: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'flex-start',
    borderRadius:  Radius.md,
    padding:       Spacing.sm,
    marginLeft:    Spacing.sm,
    gap:           Spacing.sm,
  },
  activityIcon: { fontSize: 16, marginTop: 1 },
  activityText: {
    flex:       1,
    color:      Colors.textSecondary,
    fontSize:   Typography.sm,
    lineHeight: 20,
  },

  empty:      { padding: Spacing.xl, alignItems: 'center' },
  emptyText:  { color: Colors.textMuted, fontSize: Typography.base },
});
