import { ClockCheck, ClockPlus, Pencil, Plus, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { ShiftStartModal } from '@/components/ShiftStartModal';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatElapsed, formatTime } from '@/utils/time';
import { usePulse } from '@/utils/usePulse';

interface Props {
  /** While true the job cards on screen are selectable to clock in. */
  selectMode: boolean;
  /**
   * Show the floating pill naming the active project — used when the active
   * job's card isn't visible (custom project, another day, or scrolled away).
   */
  showProjectPill: boolean;
  onToggleSelectMode: () => void;
  onCustomPress: () => void;
  onSearchPress: () => void;
  onAddTimecardPress: () => void;
  onClockedOut: (log: TimesheetLog, projectName: string) => void;
}

/**
 * Floating clock controls. Clocked out: a "Clock in" FAB that expands Search /
 * Custom buttons and puts the on-screen job cards into select mode, plus a "+"
 * button to add a manual timecard. Clocked in: a red pill with a live timer —
 * tapping it clocks out — preceded by a start-time pill and, when the active
 * card isn't visible, a pill naming the project.
 */
export function ClockControls({
  selectMode,
  showProjectPill,
  onToggleSelectMode,
  onCustomPress,
  onSearchPress,
  onAddTimecardPress,
  onClockedOut,
}: Props) {
  const activeShift = useAppStore((s) => s.activeShift);
  const jobs = useAppStore((s) => s.jobs);
  const clockOut = useAppStore((s) => s.clockOut);
  const [now, setNow] = useState(() => new Date());
  const [editStartOpen, setEditStartOpen] = useState(false);
  const projectPulse = usePulse(!!activeShift && showProjectPill);

  useEffect(() => {
    if (!activeShift) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  if (activeShift) {
    const projectName = activeShift.jobId
      ? jobs.find((j) => j.id === activeShift.jobId)?.title ?? 'Job'
      : activeShift.customProjectName ?? 'Custom Project';

    const projectBorder = {
      borderColor: projectPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.danger, 'rgba(244, 98, 62, 0.3)'],
      }),
    };

    return (
      <>
        <View style={styles.row}>
          {showProjectPill && (
            <Animated.View style={[styles.projectPill, projectBorder]}>
              <View style={styles.projectDot} />
              <Text style={styles.projectText} numberOfLines={1}>
                {projectName}
              </Text>
            </Animated.View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.timePill,
              pressed && styles.pressed,
            ]}
            onPress={() => setEditStartOpen(true)}
          >
            <Pencil size={13} color={colors.textSecondary} />
            <Text style={styles.timePillText}>
              {formatTime(activeShift.startTime)}
            </Text>
          </Pressable>

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

        <ShiftStartModal
          visible={editStartOpen}
          onClose={() => setEditStartOpen(false)}
        />
      </>
    );
  }

  return (
    <View style={styles.row}>
      {selectMode ? (
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
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
          ]}
          onPress={onAddTimecardPress}
        >
          <Plus size={22} color={colors.textPrimary} />
        </Pressable>
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
          <>
            <ClockPlus size={20} color={colors.textPrimary} />
            <Text style={styles.clockInLabel}>Clock in</Text>
          </>
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
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    paddingHorizontal: spacing.xl,
  },
  clockInLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
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
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
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
  projectPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  projectDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
  },
  projectText: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  timePillText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
});
