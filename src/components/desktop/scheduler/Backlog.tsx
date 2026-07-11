import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard } from '@/types';
import { withAlpha } from '@/utils/crewColors';
import { priorityColor, priorityRank } from '@/utils/priority';

interface Props {
  /** Unassigned jobcards (no row in `assignments`). */
  cards: Jobcard[];
  jobNameFor: (jobId?: string) => string;
  placingCardId: string | null;
  onTogglePlacing: (cardId: string) => void;
  /** Open the jobcard to view / edit its details. */
  onOpenCard: (card: Jobcard) => void;
  /** Expand the pool into the large month-calendar view. */
  onExpandCalendar?: () => void;
  /**
   * Whether the "Schedule" (activate calendar placement) button is shown. Field
   * Supers view the same board but can't assign work to crews, so it's hidden.
   */
  canSchedule?: boolean;
  /**
   * The crews a placed card is being assigned to (the assign targets), each with
   * its display color. Drives the "Placing — …" label (crew names in their own
   * colors) and the selected-card tint (a single crew's color, else neutral grey).
   */
  activeCrews?: { id: string; name: string; color: string }[];
}

/** Right-column pool of unassigned jobcards waiting for a crew + date. */
export function Backlog({
  cards,
  jobNameFor,
  placingCardId,
  onTogglePlacing,
  onOpenCard,
  onExpandCalendar,
  canSchedule = true,
  activeCrews = [],
}: Props) {
  // Single target → tint with that crew's color; several (multi-assign) or none
  // → stay neutral grey. The crew names themselves render in their own colors.
  const crewTint =
    activeCrews.length === 1 ? activeCrews[0].color : colors.textSecondary;
  // Highest priority first; within a priority, the card that has been waiting
  // longest first (oldest createdAt). Legacy cards without a created-at fall
  // back to the target `date` as the wait-time proxy.
  const sorted = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const rank = priorityRank(a.priority) - priorityRank(b.priority);
        if (rank !== 0) return rank;
        return (a.createdAt ?? a.date).localeCompare(b.createdAt ?? b.date);
      }),
    [cards]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Work Requests</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{cards.length}</Text>
        </View>
        {onExpandCalendar && (
          <Pressable
            style={({ pressed }) => [styles.expandBtn, pressed && styles.pressed]}
            onPress={onExpandCalendar}
            hitSlop={6}
          >
            <Feather name="maximize-2" size={13} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      <Text style={styles.hint}>
        {canSchedule
          ? 'Open a request to view details, or Schedule it onto the calendar.'
          : 'Open a request to view or edit its details.'}
      </Text>

      <ScrollView contentContainerStyle={styles.list}>
        {cards.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={24} color={colors.success} />
            <Text style={styles.emptyText}>
              No open work requests — everything is scheduled.
            </Text>
          </View>
        ) : (
          sorted.map((card) => {
            const selected = placingCardId === card.id;
            const accent = priorityColor(card.priority);
            return (
              <View
                key={card.id}
                style={[
                  styles.card,
                  selected && styles.cardSelected,
                  selected && {
                    borderColor: crewTint,
                    backgroundColor: withAlpha(crewTint, 0.14),
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {card.title}
                  </Text>
                  <View
                    style={[styles.priorityBadge, { borderColor: accent }]}
                  >
                    <View
                      style={[styles.priorityDot, { backgroundColor: accent }]}
                    />
                    <Text style={[styles.priorityText, { color: accent }]}>
                      {card.priority}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardJob} numberOfLines={1}>
                  {jobNameFor(card.jobId)}
                </Text>

                <View style={styles.cardActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onOpenCard(card)}
                  >
                    <Feather name="edit-2" size={10} color={colors.textPrimary} />
                    <Text style={styles.actionText}>Open</Text>
                  </Pressable>
                  {canSchedule && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.scheduleBtn,
                        selected && styles.scheduleBtnActive,
                        selected && {
                          backgroundColor: withAlpha(crewTint, 0.18),
                          borderColor: crewTint,
                        },
                        pressed && styles.pressed,
                      ]}
                      onPress={() => onTogglePlacing(card.id)}
                    >
                      <Feather
                        name={selected ? 'crosshair' : 'calendar'}
                        size={10}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.actionText} numberOfLines={1}>
                        {selected ? (
                          <>
                            <Text style={styles.placingLabel}>Placing — </Text>
                            {activeCrews.length > 0 ? (
                              activeCrews.map((c, i) => (
                                <Text key={c.id} style={{ color: c.color }}>
                                  {c.name}
                                  {i < activeCrews.length - 1 ? ', ' : ''}
                                </Text>
                              ))
                            ) : (
                              <Text style={styles.placingLabel}>pick a day</Text>
                            )}
                          </>
                        ) : (
                          'Schedule'
                        )}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  countPill: {
    minWidth: 22,
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  countText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  expandBtn: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: 2,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  pressed: {
    opacity: 0.85,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  cardJob: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  scheduleBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scheduleBtnActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  actionText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
  placingLabel: {
    color: colors.textSecondary,
  },
});
