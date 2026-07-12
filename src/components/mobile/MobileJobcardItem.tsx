import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { priorityMeta } from '@/lib/priority';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Jobcard } from '@/types';
import { effectivePriority } from '@/utils/priorityRange';

interface Props {
  jobcard: Jobcard;
  jobName: string;
  /** Omit to hide the on/off-calendar chip (e.g. in an all-unscheduled list). */
  scheduled?: boolean;
  onPress?: () => void;
}

/**
 * One jobcard as a stacked phone-width card: title + priority pill on top,
 * job name below, optional calendar-status chip. The mobile counterpart of the
 * desktop JobcardRow, which lays the same info out in fixed-width columns.
 */
export function MobileJobcardItem({ jobcard, jobName, scheduled, onPress }: Props) {
  // "Now" (incl. escalated windows) or the priority window's start date.
  const priority = effectivePriority(jobcard);
  const meta = priorityMeta(priority.label);

  const content = (
    <>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {jobcard.title}
        </Text>
        <View style={[styles.priorityPill, { backgroundColor: meta.bg }]}>
          <Text style={[styles.priorityText, { color: meta.fg }]}>
            {priority.short}
          </Text>
        </View>
      </View>
      <Text style={styles.sub} numberOfLines={1}>
        {jobName}
        {jobcard.scopes && jobcard.scopes.length > 0
          ? `  ·  ${jobcard.scopes.join(', ')}`
          : ''}
      </Text>
      {scheduled !== undefined && (
        <View style={styles.statusRow}>
          <Feather
            name={scheduled ? 'calendar' : 'clock'}
            size={12}
            color={scheduled ? colors.success : colors.warning}
          />
          <Text
            style={[
              styles.statusText,
              { color: scheduled ? colors.success : colors.warning },
            ]}
          >
            {scheduled ? 'On calendar' : 'Not on calendar'}
          </Text>
        </View>
      )}
    </>
  );

  if (!onPress) return <View style={styles.card}>{content}</View>;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
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
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
}));
