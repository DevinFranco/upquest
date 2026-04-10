/**
 * UpQuest – StatInput Component
 * Labeled text input with optional unit suffix.
 */

import React from 'react';
import {
  View, Text, TextInput, StyleSheet, ViewStyle, TextInputProps,
} from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';

interface Props extends TextInputProps {
  label:          string;
  unit?:          string;
  containerStyle?: ViewStyle;
}

export default function StatInput({ label, unit, containerStyle, ...inputProps }: Props) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, unit && styles.inputWithUnit]}
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.primary}
          {...inputProps}
        />
        {unit && (
          <View style={styles.unitBadge}>
            <Text style={styles.unitText}>{unit}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.lg },
  label: {
    color:        Colors.textSecondary,
    fontSize:     Typography.sm,
    fontWeight:   Typography.semibold,
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  input: {
    flex:            1,
    backgroundColor: Colors.card,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    color:           Colors.textPrimary,
    fontSize:        Typography.md,
  },
  inputWithUnit: {
    borderTopRightRadius:    0,
    borderBottomRightRadius: 0,
    borderRightWidth:        0,
  },
  unitBadge: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth:     1,
    borderColor:     Colors.border,
    borderLeftWidth: 0,
    borderTopRightRadius:    Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    justifyContent:  'center',
  },
  unitText: {
    color:      Colors.textMuted,
    fontSize:   Typography.sm,
    fontWeight: Typography.medium,
  },
});
