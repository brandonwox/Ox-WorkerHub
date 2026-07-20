import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';
import { TimesheetLog } from '@/types';
import {
  formatHours,
  formatLogDate,
  formatMoney,
  formatTime,
} from '@/utils/time';

interface Props {
  log: TimesheetLog;
  projectName: string;
  onEdit: () => void;
  /**
   * Hide the date line — used where cards already sit under a day heading
   * (the installer's activity log).
   */
  hideDate?: boolean;
  /** Parent job's name, shown under the work request name when provided. */
  jobName?: string;
  /** Show the money earned on this timecard next to the hours. */
  showEarned?: boolean;
}

export function TimesheetCard({
  log,
  projectName,
  onEdit,
  hideDate = false,
  jobName,
  showEarned = false,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.main}>
        {!hideDate && (
          <Text style={styles.date}>{formatLogDate(log.date)}</Text>
        )}
        <Text style={styles.project} numberOfLines={1}>
          {projectName}
        </Text>
        {!!jobName && (
          <Text style={styles.jobName} numberOfLines={1}>
            {jobName}
          </Text>
        )}
        <View style={styles.timeRow}>
          <Feather name="clock" size={13} color={colors.textSecondary} />
          <Text style={styles.timeText}>
            {formatTime(log.startTime)} – {formatTime(log.endTime)}
          </Text>
        </View>
      </View>
      <View style={styles.side}>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.editButton, pressed && styles.editPressed]}
        >
          <Feather name="edit-2" size={16} color={colors.primary} />
        </Pressable>
        <View style={styles.numbers}>
          <Text style={styles.hours}>{formatHours(log.totalHours)}</Text>
          {showEarned && (
            <Text style={styles.earned}>{formatMoney(log.earnedAmount)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  main: {
    flex: 1,
    gap: spacing.xs,
  },
  date: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  project: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  jobName: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  timeText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  side: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  editButton: {
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  editPressed: {
    backgroundColor: colors.primaryDim,
  },
  numbers: {
    alignItems: 'flex-end',
    gap: 1,
  },
  hours: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  earned: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
}));
