import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Worker } from '@/types';

interface Props {
  /** Roster of field-super workers to choose from. */
  fieldSupers: Worker[];
  /** Currently selected Field Super ids. */
  selected: string[];
  onToggle: (id: string) => void;
}

/**
 * Chip multi-select for assigning Field Supers to a job. Mirrors the crew
 * installer-chips picker; a job may have any number of Field Supers (including
 * none).
 */
export function FieldSuperPicker({ fieldSupers, selected, onToggle }: Props) {
  if (fieldSupers.length === 0) {
    return (
      <Text style={styles.muted}>No field supers on the roster.</Text>
    );
  }
  return (
    <View style={styles.chips}>
      {fieldSupers.map((w) => {
        const active = selected.includes(w.id);
        return (
          <Pressable
            key={w.id}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
            onPress={() => onToggle(w.id)}
          >
            {active && <Feather name="check" size={12} color={colors.primary} />}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {w.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  muted: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  pressed: {
    opacity: 0.6,
  },
}));
