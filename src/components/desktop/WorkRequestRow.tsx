import { Feather } from '@expo/vector-icons';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { priorityMeta } from '@/lib/priority';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { WorkRequest } from '@/types';
import { effectivePriority } from '@/utils/priorityRange';

/** One work request as a list row. Shared by the Work Requests view and the job popup. */
export function WorkRequestRow({
  workRequest,
  jobName,
  scheduled,
  scheduledDate,
  onViewCalendar,
  onPress,
}: {
  workRequest: WorkRequest;
  jobName: string;
  scheduled: boolean;
  /**
   * The day the card is scheduled for (yyyy-MM-dd; next upcoming assignment) —
   * drives the "Today" / "Tomorrow" / date label instead of "On calendar".
   */
  scheduledDate?: string;
  /**
   * Jump to the calendar with this card's day highlighted. When set, hovering
   * the scheduled pill turns it into a "View on calendar" link.
   */
  onViewCalendar?: () => void;
  /** When provided, the row becomes pressable (e.g. the Field Super tapping to edit). */
  onPress?: () => void;
}) {
  const priority = effectivePriority(workRequest);
  const meta = priorityMeta(priority.label);
  const [statusHovered, setStatusHovered] = useState(false);

  const dateLabel = !scheduled
    ? 'Not on calendar'
    : scheduledDate
      ? isToday(parseISO(scheduledDate))
        ? 'Today'
        : isTomorrow(parseISO(scheduledDate))
          ? 'Tomorrow'
          : format(parseISO(scheduledDate), 'MMM d')
      : 'On calendar';
  const linkable = scheduled && onViewCalendar != null;

  const content = (
    <>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {workRequest.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {jobName}
          {workRequest.scopes && workRequest.scopes.length > 0
            ? `  ·  ${workRequest.scopes.join(', ')}`
            : ''}
        </Text>
      </View>

      {/* Flag + "Now" or the full start–end window (label when undated). */}
      <View style={[styles.priorityPill, { backgroundColor: meta.bg }]}>
        <Feather name="flag" size={12} color={meta.fg} />
        <Text style={[styles.priorityText, { color: meta.fg }]}>
          {priority.label === 'Now' ? 'Now' : (priority.range ?? priority.short)}
        </Text>
      </View>

      <Pressable
        disabled={!linkable}
        onPress={onViewCalendar}
        onHoverIn={() => setStatusHovered(true)}
        onHoverOut={() => setStatusHovered(false)}
        style={[
          styles.statusPill,
          scheduled ? styles.statusPillOn : styles.statusPillOff,
        ]}
      >
        <Feather
          name={scheduled ? 'calendar' : 'clock'}
          size={13}
          color={scheduled ? colors.success : colors.warning}
        />
        <Text
          style={[
            styles.statusText,
            { color: scheduled ? colors.success : colors.warning },
            linkable && statusHovered && styles.statusLink,
          ]}
        >
          {linkable && statusHovered ? 'View on calendar' : dateLabel}
        </Text>
      </Pressable>
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  priorityPill: {
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    width: 150,
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingVertical: 4,
  },
  statusPillOn: {
    backgroundColor: colors.successDim,
  },
  statusPillOff: {
    backgroundColor: colors.warningDim,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  statusLink: {
    textDecorationLine: 'underline',
  },
}));
