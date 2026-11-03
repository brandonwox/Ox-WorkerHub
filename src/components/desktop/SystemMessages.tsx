import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { detectDoubleBookings, DoubleBooking } from '@/utils/doubleBookings';

/**
 * The persistent system issues for the current user. Unlike a notification
 * (which is dismissed) or the flash pill (which fades), these stick around as
 * long as the underlying condition holds. Today that's schedule
 * double-bookings — a scheduling concern, so only the Scheduler gets them;
 * every other role gets an empty list.
 */
export function useSystemIssues(): DoubleBooking[] {
  const role = useCurrentRole();
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const workRequests = useAppStore((s) => s.workRequests);
  const workers = useAppStore((s) => s.workers);

  return useMemo(
    () =>
      role === 'scheduler'
        ? detectDoubleBookings({
            crews,
            dailyCrews,
            assignments,
            workRequests,
            workers,
          })
        : [],
    [role, crews, dailyCrews, assignments, workRequests, workers]
  );
}

interface Props {
  issues: DoubleBooking[];
}

/**
 * The "System" section at the top of the notification bell's dropdown: the
 * persistent issues from {@link useSystemIssues}, each row expanding to show
 * the conflicting day, crews, and work requests. Renders nothing when there
 * are no issues, so the panel is just the notifications.
 */
export function SystemMessages({ issues }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const count = issues.length;
  if (count === 0) return null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Feather name="activity" size={12} color={colors.warning} />
        <Text style={styles.headerLabel}>System</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {issues.map((b) => {
          const open = expanded.has(b.id);
          return (
            <View key={b.id} style={styles.msg}>
              <Pressable
                onPress={() => toggle(b.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={({ pressed }) => [
                  styles.msgRow,
                  pressed && styles.pressed,
                ]}
              >
                <Feather
                  name="alert-triangle"
                  size={14}
                  color={colors.warning}
                />
                <Text style={styles.msgText} numberOfLines={1}>
                  {b.installerName} is double booked
                </Text>
                <Feather
                  name={open ? 'chevron-down' : 'chevron-right'}
                  size={15}
                  color={colors.textTertiary}
                />
              </Pressable>

              {open && (
                <View style={styles.details}>
                  <Text style={styles.detailDate}>
                    {format(parseISO(b.date), 'EEE, MMM d, yyyy')}
                  </Text>
                  {b.crews.map((crew) => (
                    <View key={crew.crewId} style={styles.detailCrew}>
                      <Text style={styles.crewName}>
                        {crew.crewName}
                        {crew.isDaily ? ' · Daily' : ''}
                      </Text>
                      {crew.workRequests.map((jc) => (
                        <Text key={jc.id} style={styles.workRequestLine}>
                          • {jc.title}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  // Sits between the panel header and the notification controls; the divider
  // under it separates it from the dismissable notifications below.
  section: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerLabel: {
    flex: 1,
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  countPill: {
    minWidth: 18,
    alignItems: 'center',
    backgroundColor: colors.warningDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  countText: {
    color: colors.warning,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  // Capped so a pile of conflicts leaves room for the notifications beneath.
  list: {
    flexGrow: 0,
    maxHeight: 240,
  },
  msg: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  msgText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  details: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailDate: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  detailCrew: {
    gap: 1,
  },
  crewName: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  workRequestLine: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingLeft: spacing.xs,
  },
}));
