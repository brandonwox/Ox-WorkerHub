import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DragSource } from '@/components/desktop/scheduler/DragBoard';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { WorkRequest } from '@/types';
import { withAlpha } from '@/utils/crewColors';
import { comparePriority, effectivePriority } from '@/utils/priorityRange';

/**
 * Whether a request is ready for installers — only readiness 'Yes' shows in
 * the main Work Requests list/calendar. Legacy cards without a readiness stay
 * visible; a custom readiness string counts as not-ready until it's flipped
 * to 'Yes'.
 */
export function isReadyNow(card: WorkRequest): boolean {
  return card.readiness == null || card.readiness === 'Yes';
}

interface Props {
  /** Unassigned work requests (no row in `assignments`). */
  cards: WorkRequest[];
  jobNameFor: (jobId?: string) => string;
  placingCardId: string | null;
  onTogglePlacing: (cardId: string) => void;
  /** Open the work request to view / edit its details. */
  onOpenCard: (card: WorkRequest) => void;
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

/** Right-column pool of unassigned work requests waiting for a crew + date. */
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
  // Requests that aren't ready for installers sit in a collapsed section at the
  // bottom instead of the main list, so they don't silently vanish.
  const [notReadyOpen, setNotReadyOpen] = useState(false);
  // Most urgent first (earliest effective priority date — escalated cards
  // count as today); within a tie, the card that has been waiting longest
  // first (oldest createdAt). Legacy cards without a created-at fall back to
  // the target `date` as the wait-time proxy.
  const sorted = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const byPriority = comparePriority(a, b);
        if (byPriority !== 0) return byPriority;
        return (a.createdAt ?? a.date).localeCompare(b.createdAt ?? b.date);
      }),
    [cards]
  );
  const ready = useMemo(() => sorted.filter(isReadyNow), [sorted]);
  const notReady = useMemo(() => sorted.filter((c) => !isReadyNow(c)), [sorted]);

  const renderCard = (card: WorkRequest, showReadiness = false) => {
    const selected = placingCardId === card.id;
    return (
      // Draggable: schedulers can drag a request straight onto a calendar day
      // instead of the Schedule-then-click flow. The buttons inside still win
      // the touch, so Open/Schedule keep working.
      <DragSource
        key={card.id}
        item={{ kind: 'request', id: card.id }}
        ghost={{ title: card.title, color: effectivePriority(card).color }}
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
          <PriorityBadge card={card} />
        </View>
        <Text style={styles.cardJob} numberOfLines={1}>
          {jobNameFor(card.jobId)}
        </Text>
        {showReadiness && card.readiness ? (
          <Text style={styles.readinessNote} numberOfLines={1}>
            Ready for installers: {card.readiness}
          </Text>
        ) : null}

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
                // Solid primary fill while idle; translucent crew tint once
                // placing — so the label only reads "on accent" when idle.
                color={selected ? colors.textPrimary : colors.textOnAccent}
              />
              <Text
                style={[styles.actionText, !selected && styles.actionTextOnAccent]}
                numberOfLines={1}
              >
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
      </DragSource>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Work Requests</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{ready.length}</Text>
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
        {ready.length === 0 && notReady.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={24} color={colors.success} />
            <Text style={styles.emptyText}>
              No open work requests — everything is scheduled.
            </Text>
          </View>
        ) : (
          <>
            {ready.length === 0 ? (
              <Text style={styles.noReadyText}>
                No requests are ready for installers right now.
              </Text>
            ) : (
              ready.map((card) => renderCard(card))
            )}

            {/* Requests whose readiness isn't "Now" — kept out of the main
                list but never silently hidden. */}
            {notReady.length > 0 && (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.notReadyToggle,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setNotReadyOpen((open) => !open)}
                >
                  <Feather
                    name={notReadyOpen ? 'chevron-down' : 'chevron-right'}
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.notReadyTitle}>Not ready yet</Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{notReady.length}</Text>
                  </View>
                </Pressable>
                {notReadyOpen && notReady.map((card) => renderCard(card, true))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The priority badge on a request card: "Now" or the window's start date,
 * colored by urgency. Hovering a dated card reveals the full start–end range.
 */
function PriorityBadge({ card }: { card: WorkRequest }) {
  const [hovered, setHovered] = useState(false);
  const ep = effectivePriority(card);
  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.priorityBadge, { borderColor: ep.color }]}
    >
      <View style={[styles.priorityDot, { backgroundColor: ep.color }]} />
      <Text style={[styles.priorityText, { color: ep.color }]}>
        {hovered && ep.range ? ep.range : ep.short}
      </Text>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
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
  readinessNote: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  noReadyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  notReadyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  notReadyTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
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
  actionTextOnAccent: {
    color: colors.textOnAccent,
  },
  placingLabel: {
    color: colors.textSecondary,
  },
}));
