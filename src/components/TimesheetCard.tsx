import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatHours, formatLogDate, formatTime } from '@/utils/time';

interface Props {
  log: TimesheetLog;
  projectName: string;
  onEdit: () => void;
}

export function TimesheetCard({ log, projectName, onEdit }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.main}>
        <Text style={styles.date}>{formatLogDate(log.date)}</Text>
        <Text style={styles.project} numberOfLines={1}>
          {projectName}
        </Text>
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
        <Text style={styles.hours}>{formatHours(log.totalHours)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  editButton: {
    padding: spacing.xs,
    borderRadius: radii.sm,
  },
  editPressed: {
    backgroundColor: colors.primaryDim,
  },
  hours: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
