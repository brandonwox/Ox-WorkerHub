import { ClockCheck, ClockPlus, Pencil, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatElapsed } from '@/utils/time';

interface Props {
  /** While true the job cards on screen are selectable to clock in. */
  selectMode: boolean;
  onToggleSelectMode: () => void;
  onCustomPress: () => void;
  onSearchPress: () => void;
  onClockedOut: (log: TimesheetLog, projectName: string) => void;
}

/**
 * Floating clock controls. Clocked out: a clock-in FAB that expands Search /
 * Custom buttons and puts the on-screen job cards into select mode. Clocked
 * in: a red pill with a live timer — tapping it clocks out immediately.
 */
export function ClockControls({
  selectMode,
  onToggleSelectMode,
  onCustomPress,
  onSearchPress,
  onClockedOut,
}: Props) {
  const activeShift = useAppStore((s) => s.activeShift);
  const jobs = useAppStore((s) => s.jobs);
  const clockOut = useAppStore((s) => s.clockOut);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!activeShift) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  if (activeShift) {
    const projectName = activeShift.jobId
      ? jobs.find((j) => j.id === activeShift.jobId)?.title ?? 'Job'
      : activeShift.customProjectName ?? 'Custom Project';

    return (
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            styles.clockOut,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            const log = clockOut();
            if (log) onClockedOut(log, projectName);
          }}
        >
          <ClockCheck size={18} color={colors.textPrimary} />
          <Text style={styles.timer}>
            {formatElapsed(activeShift.startTime, now)}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {selectMode && (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.extButton,
              pressed && styles.pressed,
            ]}
            onPress={onSearchPress}
          >
            <Search size={15} color={colors.textPrimary} />
            <Text style={styles.extLabel}>Search</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.extButton,
              pressed && styles.pressed,
            ]}
            onPress={onCustomPress}
          >
            <Pencil size={15} color={colors.textPrimary} />
            <Text style={styles.extLabel}>Custom</Text>
          </Pressable>
        </>
      )}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          selectMode ? styles.cancel : styles.clockIn,
          pressed && styles.pressed,
        ]}
        onPress={onToggleSelectMode}
      >
        {selectMode ? (
          <X size={22} color={colors.textPrimary} />
        ) : (
          <ClockPlus size={22} color={colors.textPrimary} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    minHeight: 56,
    minWidth: 56,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  clockIn: {
    backgroundColor: colors.primary,
  },
  cancel: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clockOut: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  extButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  extLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  timer: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
});
