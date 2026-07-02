import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { Worker } from '@/types';

interface Props {
  /** Roster of project-manager workers to choose from. */
  projectManagers: Worker[];
  /** Currently selected PM ids. */
  selected: string[];
  onToggle: (id: string) => void;
}

/**
 * Chip multi-select for assigning Project Managers to a job. Mirrors the crew
 * installer-chips picker; a job may have any number of PMs (including none).
 */
export function PmPicker({ projectManagers, selected, onToggle }: Props) {
  if (projectManagers.length === 0) {
    return (
      <Text style={styles.muted}>No project managers on the roster.</Text>
    );
  }
  return (
    <View style={styles.chips}>
      {projectManagers.map((w) => {
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

const styles = StyleSheet.create({
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
});
