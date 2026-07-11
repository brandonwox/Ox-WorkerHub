import { Feather } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';
import { Jobcard } from '@/types';
import { withAlpha } from '@/utils/crewColors';
import { priorityColor } from '@/utils/priority';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  /** The ready (readiness "Now") unassigned jobcards — the Work Requests pool. */
  cards: Jobcard[];
  jobNameFor: (jobId?: string) => string;
  /** Open a request's details (the same quick view the board uses). */
  onOpenCard: (card: Jobcard) => void;
  /** Collapse back to the Work Requests list. */
  onCollapse: () => void;
}

/**
 * The Work Requests pool expanded in place into a large month calendar: it
 * replaces the list inside the (widened) Work Requests column, with each open
 * request on its target date, colored by priority. Purely a viewing tool —
 * nothing here touches crew schedules; placing requests on crews still happens
 * from the collapsed list + main calendar.
 */
export function BacklogCalendar({
  cards,
  jobNameFor,
  onOpenCard,
  onCollapse,
}: Props) {
  const [month, setMonth] = useState(() => new Date());

  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart);

  const monthKey = format(month, 'yyyy-MM');
  const cardsByDate = useMemo(() => {
    const map = new Map<string, Jobcard[]>();
    for (const card of cards) {
      if (!card.date.startsWith(monthKey)) continue;
      const list = map.get(card.date) ?? [];
      list.push(card);
      map.set(card.date, list);
    }
    return map;
  }, [cards, monthKey]);
  const shownCount = [...cardsByDate.values()].reduce(
    (n, list) => n + list.length,
    0
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Work Requests — Calendar</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{cards.length}</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            Open requests by their target date. View-only — crew schedules
            aren&apos;t affected.
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.navBtns}>
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              onPress={() => setMonth((m) => subMonths(m, 1))}
              hitSlop={6}
            >
              <Feather name="chevron-left" size={18} color={colors.textSecondary} />
            </Pressable>
            <Text style={styles.monthLabel}>{format(month, 'MMMM yyyy')}</Text>
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              onPress={() => setMonth((m) => addMonths(m, 1))}
              hitSlop={6}
            >
              <Feather
                name="chevron-right"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
          <Pressable
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            onPress={onCollapse}
            hitSlop={6}
          >
            <Feather name="minimize-2" size={16} color={colors.textPrimary} />
            <Text style={styles.closeText}>Collapse</Text>
          </Pressable>
        </View>
      </View>

      {shownCount < cards.length && (
        <Text style={styles.offMonthNote}>
          {cards.length - shownCount} open request
          {cards.length - shownCount === 1 ? '' : 's'} dated outside this month.
        </Text>
      )}

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={styles.cellBlank} />
        ))}

        {days.map((dayDate) => {
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          const dayCards = cardsByDate.get(dateStr) ?? [];
          return (
            <View key={dateStr} style={styles.cell}>
              <Text
                style={[styles.dayNum, isToday(dayDate) && styles.dayNumToday]}
              >
                {format(parseISO(dateStr), 'd')}
              </Text>
              <View style={styles.cellCards}>
                {dayCards.map((card) => {
                  const accent = priorityColor(card.priority);
                  return (
                    <Pressable
                      key={card.id}
                      onPress={() => onOpenCard(card)}
                      style={({ pressed }) => [
                        styles.request,
                        {
                          backgroundColor: withAlpha(accent, 0.14),
                          borderColor: withAlpha(accent, 0.5),
                        },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[styles.requestDot, { backgroundColor: accent }]}
                      />
                      <View style={styles.requestText}>
                        <Text style={styles.requestTitle} numberOfLines={1}>
                          {card.title}
                        </Text>
                        <Text style={styles.requestJob} numberOfLines={1}>
                          {jobNameFor(card.jobId)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  hint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  navBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    minWidth: 120,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  closeText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  offMonthNote: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  weekRow: {
    flexDirection: 'row',
    paddingTop: spacing.xs,
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: spacing.sm,
  },
  cellBlank: {
    width: '14.2857%',
    minHeight: 110,
  },
  cell: {
    width: '14.2857%',
    minHeight: 110,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  dayNum: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  dayNumToday: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
  },
  cellCards: {
    gap: 3,
    marginTop: 3,
  },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  requestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  requestText: {
    flex: 1,
  },
  requestTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  requestJob: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 9,
  },
  pressed: {
    opacity: 0.8,
  },
});
