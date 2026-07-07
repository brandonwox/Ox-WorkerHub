import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { detectDoubleBookings } from '@/utils/doubleBookings';

/**
 * Persistent system messages pinned above the transient flash pill in the
 * sidebar. Unlike the flash (which fades), these stick around as long as the
 * underlying condition holds. Today that's schedule double-bookings; each row
 * expands to show the conflicting day, crews, and jobcards.
 */
export function SystemMessages() {
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const jobcards = useAppStore((s) => s.jobcards);
  const workers = useAppStore((s) => s.workers);

  const bookings = useMemo(
    () =>
      detectDoubleBookings({ crews, dailyCrews, assignments, jobcards, workers }),
    [crews, dailyCrews, assignments, jobcards, workers]
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = bookings.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Feather
          name="activity"
          size={12}
          color={count > 0 ? colors.warning : colors.textTertiary}
        />
        <Text style={styles.headerLabel}>System</Text>
        {count > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>

      {count === 0 ? (
        <Text style={styles.empty}>All clear — no active issues.</Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {bookings.map((b) => {
            const open = expanded.has(b.id);
            return (
              <View key={b.id} style={styles.msg}>
                <Pressable
                  onPress={() => toggle(b.id)}
                  style={({ pressed }) => [
                    styles.msgRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather
                    name="alert-triangle"
                    size={13}
                    color={colors.warning}
                  />
                  <Text style={styles.msgText} numberOfLines={1}>
                    {b.installerName} is double booked
                  </Text>
                  <Feather
                    name={open ? 'chevron-down' : 'chevron-right'}
                    size={14}
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
                        {crew.jobcards.map((jc) => (
                          <Text key={jc.id} style={styles.jobcardLine}>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
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
  empty: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 11,
    paddingHorizontal: spacing.xs,
  },
  list: {
    maxHeight: 260,
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
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  msgText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  details: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  detailDate: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  detailCrew: {
    gap: 1,
  },
  crewName: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  jobcardLine: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
    paddingLeft: spacing.xs,
  },
});
