import {
  Clock,
  ClockCheck,
  ClockPlus,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react-native';
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
   * While true the worker is editing the in-progress shift: the merged pill and
   * timer give way to project + start-time editors, and on-screen job cards
   * become selectable to switch the active project.
   */
  editShiftMode: boolean;
  onToggleSelectMode: () => void;
  /** Enter/leave the edit-shift mode (only meaningful while clocked in). */
  onToggleEditShift: () => void;
  onCustomPress: () => void;
  onSearchPress: () => void;
  onAddTimecardPress: () => void;
  onClockedOut: (log: TimesheetLog, projectName: string) => void;
}

/**
 * Floating clock controls. Clocked out: a "Clock in" FAB that expands Search /
 * Custom buttons and puts the on-screen job cards into select mode, plus a "+"
 * button to add a manual timecard. Clocked in: a single pill naming the active
 * project and its start time (tap to edit either) beside a red live timer —
 * tapping the timer clocks out.
 */
export function ClockControls({
  selectMode,
  editShiftMode,
  onToggleSelectMode,
  onToggleEditShift,
  onCustomPress,
  onSearchPress,
  onAddTimecardPress,
  onClockedOut,
}: Props) {
  const activeShift = useAppStore((s) => s.activeShift);
  const jobcards = useAppStore((s) => s.jobcards);
  const clockOut = useAppStore((s) => s.clockOut);
  const [now, setNow] = useState(() => new Date());
  const [editStartOpen, setEditStartOpen] = useState(false);
  const projectPulse = usePulse(!!activeShift && !editShiftMode);

  useEffect(() => {
    if (!activeShift) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [activeShift]);

  if (activeShift) {
    const projectName = activeShift.jobcardId
      ? jobcards.find((j) => j.id === activeShift.jobcardId)?.title ?? 'Jobcard'
      : activeShift.customProjectName ?? 'Custom Project';

    // Editing the shift: project + start-time editors replace the pill/timer,
    // mirroring the clock-in flow (job cards selectable, Search, Custom).
    if (editShiftMode) {
      return (
        <>
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [
                styles.editStartPill,
                pressed && styles.pressed,
              ]}
              onPress={() => setEditStartOpen(true)}
            >
              <Clock size={14} color={colors.textSecondary} />
              <Text style={styles.editStartText} numberOfLines={1}>
                {formatTime(activeShift.startTime)}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.pressed,
              ]}
              onPress={onSearchPress}
            >
              <Search size={15} color={colors.textPrimary} />
              <Text style={styles.extLabel}>Search</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.editButton,
                pressed && styles.pressed,
              ]}
              onPress={onCustomPress}
            >
              <Pencil size={15} color={colors.textPrimary} />
              <Text style={styles.extLabel}>Custom</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.fab,
                styles.cancel,
                pressed && styles.pressed,
              ]}
              onPress={onToggleEditShift}
            >
              <X size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ShiftStartModal
            visible={editStartOpen}
            onClose={() => setEditStartOpen(false)}
          />
        </>
      );
    }

    const projectBorder = {
      borderColor: projectPulse.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.danger, 'rgba(244, 98, 62, 0.3)'],
      }),
    };

    return (
      <View style={styles.row}>
        <Animated.View style={[styles.mergedPill, projectBorder]}>
          <View style={styles.projectDot} />
          <Text style={styles.projectText} numberOfLines={1}>
            {projectName}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.timePillText}>
            {formatTime(activeShift.startTime)}
          </Text>
          <Pencil size={13} color={colors.textSecondary} />
          <Pressable
            style={({ pressed }) => [
              styles.mergedPillTap,
              pressed && styles.mergedPillPressed,
            ]}
            onPress={onToggleEditShift}
            accessibilityLabel="Edit project and start time"
          />
        </Animated.View>

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
  mergedPill: {
    position: 'relative',
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
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
  },
  mergedPillTap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mergedPillPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs - 2,
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
  timePillText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  editStartPill: {
    flexShrink: 1,
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
  editStartText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  editButton: {
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
});
