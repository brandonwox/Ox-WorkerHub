import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { priorityMeta } from '@/lib/priority';
import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard } from '@/types';

/** One jobcard as a list row. Shared by the Jobcards view and the job popup. */
export function JobcardRow({
  jobcard,
  jobName,
  scheduled,
  onPress,
}: {
  jobcard: Jobcard;
  jobName: string;
  scheduled: boolean;
  /** When provided, the row becomes pressable (e.g. the PM tapping to edit). */
  onPress?: () => void;
}) {
  const meta = priorityMeta(jobcard.priority);

  const content = (
    <>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {jobcard.title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {jobName}
          {jobcard.scopes && jobcard.scopes.length > 0
            ? `  ·  ${jobcard.scopes.join(', ')}`
            : ''}
        </Text>
      </View>

      <View style={[styles.priorityPill, { backgroundColor: meta.bg }]}>
        <Text style={[styles.priorityText, { color: meta.fg }]}>
          {jobcard.priority}
        </Text>
      </View>

      <View
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
          ]}
        >
          {scheduled ? 'On calendar' : 'Not on calendar'}
        </Text>
      </View>
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

const styles = StyleSheet.create({
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
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
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
});
