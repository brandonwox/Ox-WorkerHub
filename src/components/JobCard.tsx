import { Feather } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/StatusPill';
import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard, JobcardPriority } from '@/types';
import { formatJobWindow } from '@/utils/time';
import { usePulse } from '@/utils/usePulse';

const PRIORITY_META: Record<JobcardPriority, { bg: string; fg: string }> = {
  Low: { bg: colors.surfaceLight, fg: colors.textSecondary },
  Medium: { bg: colors.primaryDim, fg: colors.primary },
  High: { bg: colors.dangerDim, fg: colors.danger },
};

interface Props {
  jobcard: Jobcard;
  onPress: () => void;
  /** Shows a highlight border indicating the card can be tapped to clock in. */
  selectable?: boolean;
  /** The worker is currently clocked in on this jobcard — pulses the border. */
  active?: boolean;
}

export function JobCard({ jobcard, onPress, selectable, active }: Props) {
  const pulse = usePulse(active);
  const timeWindow = formatJobWindow(jobcard.startTime, jobcard.endTime);
  const priority = PRIORITY_META[jobcard.priority];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selectable && styles.selectable,
        pressed && styles.pressed,
      ]}
    >
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeBorder,
            {
              borderColor: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.primary, 'rgba(62, 150, 244, 0.3)'],
              }),
            },
          ]}
        />
      )}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {jobcard.title}
        </Text>
        <View style={[styles.priorityPill, { backgroundColor: priority.bg }]}>
          <Text style={[styles.priorityText, { color: priority.fg }]}>
            {jobcard.priority}
          </Text>
        </View>
        <StatusPill status={jobcard.status} />
      </View>
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={14} color={colors.textSecondary} />
        <Text style={styles.metaText} numberOfLines={1}>
          {jobcard.address}
        </Text>
      </View>
      {timeWindow && (
        <View style={styles.metaRow}>
          <Feather name="clock" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{timeWindow}</Text>
        </View>
      )}
      {jobcard.flashingMaterial ? (
        <View style={styles.metaRow}>
          <Feather name="layers" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {jobcard.flashingMaterial}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selectable: {
    borderColor: colors.primary,
  },
  activeBorder: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: radii.lg + 1.5,
    borderWidth: 2,
  },
  pressed: {
    backgroundColor: colors.surfaceLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  priorityPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
