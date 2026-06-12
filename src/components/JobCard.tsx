import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/StatusPill';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job } from '@/types';
import { formatTimeWindow } from '@/utils/time';

interface Props {
  job: Job;
  onPress: () => void;
  /** Shows a highlight border indicating the card can be tapped to clock in. */
  selectable?: boolean;
}

export function JobCard({ job, onPress, selectable }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selectable && styles.selectable,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {job.title}
        </Text>
        <StatusPill status={job.status} />
      </View>
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={14} color={colors.textSecondary} />
        <Text style={styles.metaText} numberOfLines={1}>
          {job.address}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Feather name="clock" size={14} color={colors.textSecondary} />
        <Text style={styles.metaText}>
          {formatTimeWindow(job.startTime, job.endTime)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
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
