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
import { CalendarDays } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isReadyNow } from '@/components/desktop/scheduler/Backlog';
import {
  DragSource,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { FlashBorder } from '@/components/desktop/scheduler/FlashBorder';
import { hoverProps } from '@/components/desktop/scheduler/MonthCalendar';
import { useHoverColumn } from '@/components/desktop/scheduler/useHoverColumn';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { WorkRequest } from '@/types';
import { effectivePriority } from '@/utils/priorityRange';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  /**
   * EVERY unassigned work request — ready ones render normally, not-ready
   * ones muted with a "Not ready" tag so schedulers see what's coming.
   */
  cards: WorkRequest[];
  jobNameFor: (card: WorkRequest) => string;
  /** Open a request's details (the same quick view the board uses). */
  onOpenCard: (card: WorkRequest) => void;
  /** Collapse back to the Work Requests list. */
  onCollapse: () => void;
  /**
   * Jump the calendar to this day's month ("Show in calendar" for an
   * unscheduled request). The nonce re-fires a repeat jump to the same date.
   */
  focusDate?: string | null;
  focusNonce?: string;
  /** Blink this card's chip; the nonce keys the animation for replays. */
  flashCard?: { id: string; nonce: string } | null;
  /**
   * Hovering a day cell shows a bottom ＋ row that creates a work request
   * targeted at that day (Schedulers AND Field Supers).
   */
  onCreateRequest?: (date: string) => void;
}

/**
 * The Work Requests pool expanded in place into a large month calendar: it
 * replaces the list inside the (half-width-expanded) Work Requests column,
 * with each open request on its target date, colored by priority. Requests
 * drag between days here (changing their target date), out to the crew
 * calendar (scheduling them), and in from it (unassigning back to the pool).
 */
// The hovered day column widens to at least this (same rule as the crew
// calendar) so the requests inside it are readable.
const HOVER_COL_MIN = 180;

export function BacklogCalendar({
  cards,
  jobNameFor,
  onOpenCard,
  onCollapse,
  focusDate,
  focusNonce,
  flashCard,
  onCreateRequest,
}: Props) {
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    if (!focusDate) return;
    void focusNonce; // dep only — a repeat jump to the same date re-fires
    setMonth(parseISO(focusDate));
  }, [focusDate, focusNonce]);
  // The weekday column under the pointer — widens across every week row.
  // Position-tracked (not element hover) so it follows the COLUMN no matter
  // which request chip the mouse is over. No horizontal grid padding here.
  const { ref: hoverRef, hoveredCol } = useHoverColumn(HOVER_COL_MIN, 0);

  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart);

  // Week rows (nulls pad the month's edges) so columns can flex-resize —
  // a flex-wrapped percentage grid can't widen one column.
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthKey = format(month, 'yyyy-MM');
  const cardsByDate = useMemo(() => {
    const map = new Map<string, WorkRequest[]>();
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
            Open requests by their target date. Drag between days to retarget,
            or across to the crew calendar to schedule.
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

      <View ref={hoverRef} collapsable={false} style={styles.gridArea}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((d, col) => (
            <Text
              key={d}
              style={[styles.weekday, hoveredCol === col && styles.colHovered]}
            >
              {d}
            </Text>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.grid}>
          {weeks.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((dayDate, col) => {
                const dateStr = dayDate ? format(dayDate, 'yyyy-MM-dd') : null;
                return (
                  <View
                    key={dateStr ?? `blank-${col}`}
                    style={[
                      styles.col,
                      hoveredCol === col && styles.colHovered,
                    ]}
                  >
                    {dayDate && dateStr ? (
                      <BacklogDayCell
                        date={dateStr}
                        today={isToday(dayDate)}
                        cards={cardsByDate.get(dateStr) ?? []}
                        jobNameFor={jobNameFor}
                        onOpenCard={onOpenCard}
                        flashCard={flashCard}
                        onCreateRequest={onCreateRequest}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** One day of the pool calendar: a "backlog-day" drop zone with drag chips. */
function BacklogDayCell({
  date,
  today,
  cards,
  jobNameFor,
  onOpenCard,
  flashCard,
  onCreateRequest,
}: {
  date: string;
  today: boolean;
  cards: WorkRequest[];
  jobNameFor: (card: WorkRequest) => string;
  onOpenCard: (card: WorkRequest) => void;
  flashCard?: { id: string; nonce: string } | null;
  onCreateRequest?: (date: string) => void;
}) {
  const { ref, hovered } = useDropZone(`bcal:${date}`, {
    type: 'backlog-day',
    date,
    priority: 2,
  });
  // Mouse-hover on the whole cell reveals the bottom create-＋ row.
  const [cellHovered, setCellHovered] = useState(false);
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.cell,
        today && styles.cellToday,
        hovered && styles.cellDropHover,
      ]}
      {...(onCreateRequest ? hoverProps(setCellHovered) : {})}
    >
      <Text style={[styles.dayNum, today && styles.dayNumToday]}>
        {format(parseISO(date), 'd')}
      </Text>
      <View style={styles.cellCards}>
        {cards.map((card) => {
          const accent = effectivePriority(card).color;
          const ready = isReadyNow(card);
          return (
            <DragSource
              key={card.id}
              item={{ kind: 'request', id: card.id }}
              ghost={{ title: card.title, color: accent }}
              onPress={() => onOpenCard(card)}
              // Neutral gray chip — priority already lives in the left dot;
              // color belongs to the crew calendar once it's scheduled.
              style={[styles.request, !ready && styles.requestNotReady]}
            >
              {flashCard?.id === card.id && (
                <FlashBorder key={flashCard.nonce} />
              )}
              {/* Not-ready swaps the priority dot for a slashed calendar in
                  the same priority color (the sidebar menu's CalendarDays
                  icon) — no text tag eating the title's space. */}
              {ready ? (
                <View style={[styles.requestDot, { backgroundColor: accent }]} />
              ) : (
                <View style={styles.notReadyIcon}>
                  <CalendarDays size={11} color={accent} />
                  <View
                    style={[
                      styles.notReadyIconSlash,
                      { backgroundColor: accent },
                    ]}
                  />
                </View>
              )}
              <View style={styles.requestText}>
                <Text style={styles.requestTitle} numberOfLines={1}>
                  {card.title}
                </Text>
                <Text style={styles.requestJob} numberOfLines={1}>
                  {jobNameFor(card)}
                </Text>
              </View>
            </DragSource>
          );
        })}

        {/* Hover-only ＋ row IN the chip stack — right below the last work
            request (top of the stack when the day is empty). Creates a work
            request targeted at this day. */}
        {onCreateRequest && cellHovered && (
          <Pressable
            style={({ pressed }) => [
              styles.addRequestRow,
              pressed && styles.pressed,
            ]}
            onPress={() => onCreateRequest(date)}
            accessibilityRole="button"
            accessibilityLabel={`Create a work request on ${date}`}
          >
            <Feather name="plus" size={13} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  gridArea: {
    flex: 1,
  },
  grid: {
    paddingBottom: spacing.sm,
  },
  week: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  colHovered: {
    minWidth: HOVER_COL_MIN,
  },
  cell: {
    flex: 1,
    minHeight: 110,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  // Today's cell: a quietly stronger border so the eye finds it (the
  // drop-hover border still wins over it).
  cellToday: {
    borderColor: colors.textTertiary,
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
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
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
  cellDropHover: {
    borderColor: colors.primary,
  },
  requestNotReady: {
    opacity: 0.55,
  },
  // Hover-only ＋ row flowing in the chip stack: creates a work request on
  // that day.
  addRequestRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Slashed-calendar stand-in for the priority dot on not-ready requests.
  notReadyIcon: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notReadyIconSlash: {
    position: 'absolute',
    width: 14,
    height: 1,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
}));
