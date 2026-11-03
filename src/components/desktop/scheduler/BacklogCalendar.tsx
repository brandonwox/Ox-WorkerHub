import { Feather } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  isWeekend,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { CalendarDays } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { isReadyNow } from '@/components/desktop/scheduler/Backlog';
import {
  DragSource,
  useDragBoard,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { FlashBorder } from '@/components/desktop/scheduler/FlashBorder';
import {
  CrewLetters,
  CrewSplitBorder,
  hoverProps,
} from '@/components/desktop/scheduler/MonthCalendar';
import { MonthDragNav } from '@/components/desktop/scheduler/MonthDragNav';
import {
  BAR_H,
  BAR_TOP,
  DateSpan,
  LANE_H,
  LaneSegment,
  lanesOver,
  packWeekSegments,
  useColRects,
  visibleWeekdayCols,
} from '@/components/desktop/scheduler/spanLanes';
import { useHoverColumn } from '@/components/desktop/scheduler/useHoverColumn';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { WorkRequest } from '@/types';
import { withAlpha } from '@/utils/crewColors';
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
  /** Distinct color for a crew id — pencilled-in crews tint their chips. */
  colorForCrew: (crewId: string) => string;
  /** Crew display name for the hover line (letter / daily initials / calendar name). */
  crewNameFor: (crewId: string) => string;
  /** The crews pencilled in on a card ("fake assigned"), stale ids dropped. */
  plannedCrewIdsFor: (card: WorkRequest) => string[];
  /**
   * Show Monday–Friday only (the same switch as the crew calendar). Requests
   * targeted only at hidden days are counted in a note under the header,
   * with a link that calls `onShowWeekends`.
   */
  hideWeekends?: boolean;
  onShowWeekends?: () => void;
  /**
   * At most this many single-day requests show in a day cell; the rest fold
   * behind a "+N more" row that unfolds the cell in place. Unset = no cap.
   */
  maxChipsPerDay?: number;
}

/** A pool request stretched over more than one target day. */
interface PoolSpan extends DateSpan {
  card: WorkRequest;
}

/**
 * The Work Requests pool expanded in place into a large month calendar: it
 * replaces the list inside the (half-width-expanded) Work Requests column,
 * with each open request on its target date, colored by priority — or
 * tinted (dashed) by the crew the Scheduler has pencilled in. Requests drag
 * between days here (changing their target date), out to the crew calendar
 * (scheduling them), and in from it (unassigning back to the pool). A
 * request meant to take several days stretches across them as one bar, the
 * same way the crew calendar draws scheduled stretches (the grip on its
 * right edge pulls the end day).
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
  colorForCrew,
  crewNameFor,
  plannedCrewIdsFor,
  hideWeekends = false,
  onShowWeekends,
  maxChipsPerDay,
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
  // The weekday columns on show (0 Sun … 6 Sat): all seven, or Mon–Fri.
  const visibleCols = visibleWeekdayCols(hideWeekends);
  const { ref: hoverRef, hoveredCol } = useHoverColumn(
    HOVER_COL_MIN,
    0,
    visibleCols.length
  );

  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart);

  // Week rows (nulls pad the month's edges) so columns can flex-resize —
  // a flex-wrapped percentage grid can't widen one column. With weekends
  // hidden each row keeps only its Mon–Fri cells, and a row that was nothing
  // but a weekend is dropped.
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = visibleCols.map((c) => cells[i + c]);
    if (row.some((d) => d !== null)) weeks.push(row);
  }

  const monthKey = format(month, 'yyyy-MM');
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(endOfMonth(month), 'yyyy-MM-dd');
  // Single-day requests by their target date; stretched ones (an end date
  // after the target date) become bars across every week they touch.
  const { singlesByDate, spans } = useMemo(() => {
    const map = new Map<string, WorkRequest[]>();
    const list: PoolSpan[] = [];
    for (const card of cards) {
      const end =
        card.endDate && card.endDate > card.date ? card.endDate : card.date;
      if (end !== card.date) {
        if (end < monthStartStr || card.date > monthEndStr) continue;
        list.push({ card, start: card.date, end });
        continue;
      }
      if (!card.date.startsWith(monthKey)) continue;
      const dayList = map.get(card.date) ?? [];
      dayList.push(card);
      map.set(card.date, dayList);
    }
    return { singlesByDate: map, spans: list };
  }, [cards, monthKey, monthStartStr, monthEndStr]);
  const shownCount =
    [...singlesByDate.values()].reduce((n, list) => n + list.length, 0) +
    spans.length;
  // With weekends hidden, requests targeted ONLY at this month's weekend
  // days have no cell to sit in — count them for the note under the header
  // (they still count as "in this month" above).
  const hiddenCount = useMemo(() => {
    if (!hideWeekends) return 0;
    let n = 0;
    for (const [date, list] of singlesByDate) {
      if (isWeekend(parseISO(date))) n += list.length;
    }
    for (const s of spans) {
      const from = s.start < monthStartStr ? monthStartStr : s.start;
      const to = s.end > monthEndStr ? monthEndStr : s.end;
      const inMonth = eachDayOfInterval({
        start: parseISO(from),
        end: parseISO(to),
      });
      if (inMonth.every((d) => isWeekend(d))) n++;
    }
    return n;
  }, [hideWeekends, singlesByDate, spans, monthStartStr, monthEndStr]);

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
            <MonthDragNav
              month={month}
              onSelectMonth={setMonth}
              zoneKey="pool-cal"
              textStyle={styles.monthLabel}
              align="center"
            />
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
      {hiddenCount > 0 && (
        <Pressable
          onPress={onShowWeekends}
          disabled={!onShowWeekends}
          accessibilityRole="button"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.hiddenNote}>
            {hiddenCount} targeted at hidden weekend day
            {hiddenCount === 1 ? '' : 's'}
            {onShowWeekends ? ' · Show weekends' : ''}
          </Text>
        </Pressable>
      )}

      <View ref={hoverRef} collapsable={false} style={styles.gridArea}>
        <View style={styles.weekRow}>
          {visibleCols.map((c, col) => (
            <Text
              key={WEEKDAYS[c]}
              style={[styles.weekday, hoveredCol === col && styles.colHovered]}
            >
              {WEEKDAYS[c]}
            </Text>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.grid}>
          {weeks.map((week, w) => (
            <PoolWeekRow
              key={w}
              week={week}
              spans={spans}
              singlesByDate={singlesByDate}
              hoveredCol={hoveredCol}
              jobNameFor={jobNameFor}
              onOpenCard={onOpenCard}
              flashCard={flashCard}
              onCreateRequest={onCreateRequest}
              colorForCrew={colorForCrew}
              crewNameFor={crewNameFor}
              plannedCrewIdsFor={plannedCrewIdsFor}
              maxChipsPerDay={maxChipsPerDay}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** Props every chip/bar needs to paint and open a request. */
interface ChipHostProps {
  jobNameFor: (card: WorkRequest) => string;
  onOpenCard: (card: WorkRequest) => void;
  flashCard?: { id: string; nonce: string } | null;
  colorForCrew: (crewId: string) => string;
  crewNameFor: (crewId: string) => string;
  plannedCrewIdsFor: (card: WorkRequest) => string[];
}

interface PoolWeekRowProps extends ChipHostProps {
  week: (Date | null)[];
  spans: PoolSpan[];
  singlesByDate: Map<string, WorkRequest[]>;
  hoveredCol: number | null;
  onCreateRequest?: (date: string) => void;
  maxChipsPerDay?: number;
}

/**
 * One calendar week: its day cells (seven, or Mon–Fri with weekends hidden)
 * plus the absolutely-positioned multi-day bars overlapping their borders.
 * Cells covered by bars reserve matching vertical space so single-day chips
 * start below them.
 */
function PoolWeekRow({
  week,
  spans,
  singlesByDate,
  hoveredCol,
  onCreateRequest,
  maxChipsPerDay,
  ...host
}: PoolWeekRowProps) {
  const [colRects, setColRect] = useColRects();
  const dateStrs = week.map((d) => (d ? format(d, 'yyyy-MM-dd') : null));
  const segments = packWeekSegments(spans, dateStrs, (s) => s.card.title);

  return (
    <View style={styles.week}>
      {week.map((dayDate, col) => {
        const dateStr = dateStrs[col];
        return (
          <View
            key={dateStr ?? `blank-${col}`}
            style={[styles.col, hoveredCol === col && styles.colHovered]}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setColRect(col, x, width);
            }}
          >
            {dayDate && dateStr ? (
              <BacklogDayCell
                date={dateStr}
                today={isToday(dayDate)}
                cards={singlesByDate.get(dateStr) ?? []}
                topPad={lanesOver(segments, col) * LANE_H}
                onCreateRequest={onCreateRequest}
                maxChipsPerDay={maxChipsPerDay}
                {...host}
              />
            ) : null}
          </View>
        );
      })}

      {segments.map((seg) => {
        const startRect = colRects[seg.startCol];
        const endRect = colRects[seg.endCol];
        if (!startRect || !endRect) return null;
        return (
          <PoolSpanBar
            key={`bar-${seg.span.card.id}`}
            seg={seg}
            left={startRect.x}
            width={endRect.x + endRect.w - startRect.x}
            {...host}
          />
        );
      })}
    </View>
  );
}

/**
 * How a pool chip/bar paints: neutral grey when nobody's pencilled in; a
 * DASHED border + light tint in the planned crew's color for one crew; the
 * split color ring (as on the crew calendar) for several. `color` is the
 * lead crew's color (the drag ghost + grip), unset when none.
 */
function chipTint(
  planned: string[],
  colorForCrew: (crewId: string) => string
): { style: StyleProp<ViewStyle>; multi: boolean; color?: string } {
  if (planned.length === 0) return { style: undefined, multi: false };
  const color = colorForCrew(planned[0]);
  if (planned.length === 1) {
    return {
      style: {
        backgroundColor: withAlpha(color, 0.14),
        borderColor: withAlpha(color, 0.75),
        borderStyle: 'dashed',
      },
      multi: false,
      color,
    };
  }
  return { style: styles.requestMulti, multi: true, color };
}

interface ChipContentProps extends ChipHostProps {
  card: WorkRequest;
  hovered: boolean;
  planned: string[];
  /** Show the stretch grip (not on a bar segment continuing past the week). */
  grip: boolean;
  gripColor: string;
  /** Square off the split ring's corners where a bar continues. */
  squareLeft?: boolean;
  squareRight?: boolean;
}

/**
 * The inside of a pool chip or bar: priority dot (or the slashed calendar
 * for a not-ready request), title, and under it the job name — swapped on
 * hover for the pencilled-in crew(s) and the jobsite address — plus the
 * stretch grip on the right edge when the viewer may drag.
 */
function PoolChipContent({
  card,
  hovered,
  planned,
  grip,
  gripColor,
  squareLeft,
  squareRight,
  jobNameFor,
  flashCard,
  colorForCrew,
  crewNameFor,
}: ChipContentProps) {
  const board = useDragBoard();
  const accent = effectivePriority(card).color;
  const ready = isReadyNow(card);
  // Nothing pencilled in and no address → the hover line has nothing to
  // say, so the job name stays.
  const hasHoverLine = planned.length > 0 || !!card.address.trim();
  return (
    <>
      {planned.length > 1 && (
        <CrewSplitBorder
          crewColors={planned.map(colorForCrew)}
          borderAlpha={0.6}
          squareLeft={squareLeft}
          squareRight={squareRight}
        />
      )}
      {flashCard?.id === card.id && <FlashBorder key={flashCard.nonce} />}
      {/* Not-ready swaps the priority dot for a slashed calendar in the same
          priority color (the sidebar menu's CalendarDays icon) — no text tag
          eating the title's space. */}
      {ready ? (
        <View style={[styles.requestDot, { backgroundColor: accent }]} />
      ) : (
        <View style={styles.notReadyIcon}>
          <CalendarDays size={11} color={accent} />
          <View
            style={[styles.notReadyIconSlash, { backgroundColor: accent }]}
          />
        </View>
      )}
      <View style={styles.requestText}>
        <Text style={styles.requestTitle} numberOfLines={1}>
          {card.title}
        </Text>
        {hovered && hasHoverLine ? (
          <CrewLetters
            crewIds={planned}
            colorForCrew={colorForCrew}
            crewNameFor={crewNameFor}
            address={card.address}
            style={styles.requestJob}
          />
        ) : (
          <Text style={styles.requestJob} numberOfLines={1}>
            {jobNameFor(card)}
          </Text>
        )}
      </View>
      {grip && board.canDrag({ kind: 'resize', id: card.id }) && (
        <DragSource
          item={{ kind: 'resize', id: card.id }}
          ghost={{ title: `Stretch — ${card.title}`, color: gripColor }}
          cursor="ew-resize"
          style={styles.resizeGrip}
        >
          <View
            style={[
              styles.resizeGripBar,
              { backgroundColor: withAlpha(gripColor, 0.9) },
            ]}
          />
        </DragSource>
      )}
    </>
  );
}

/** One single-day request chip in its day cell. */
function PoolRequestChip({ card, ...host }: ChipHostProps & { card: WorkRequest }) {
  const [hovered, setHovered] = useState(false);
  const planned = host.plannedCrewIdsFor(card);
  const tint = chipTint(planned, host.colorForCrew);
  const lead = tint.color ?? effectivePriority(card).color;
  return (
    <View {...hoverProps(setHovered)}>
      <DragSource
        item={{ kind: 'request', id: card.id }}
        ghost={{ title: card.title, color: lead }}
        onPress={() => host.onOpenCard(card)}
        // Neutral gray chip by default — priority already lives in the left
        // dot; a crew color appears only once a crew is pencilled in (dashed)
        // or, on the crew calendar, scheduled.
        style={[
          styles.request,
          tint.style,
          !isReadyNow(card) && styles.requestNotReady,
        ]}
      >
        <PoolChipContent
          card={card}
          hovered={hovered}
          planned={planned}
          grip
          gripColor={lead}
          {...host}
        />
      </DragSource>
    </View>
  );
}

interface PoolSpanBarProps extends ChipHostProps {
  seg: LaneSegment<PoolSpan>;
  /** Measured pixel geometry within the week row (tracks column resizing). */
  left: number;
  width: number;
}

/**
 * One week-row segment of a stretched pool request: a continuous bar across
 * its covered day cells. Dragging the bar moves the whole stretch to a new
 * target start (length preserved); the grip on the right edge drags the END
 * day. Continuation past a week edge squares that edge's corners off.
 */
function PoolSpanBar({ seg, left, width, ...host }: PoolSpanBarProps) {
  const [hovered, setHovered] = useState(false);
  const { card } = seg.span;
  const planned = host.plannedCrewIdsFor(card);
  const tint = chipTint(planned, host.colorForCrew);
  const lead = tint.color ?? effectivePriority(card).color;
  return (
    <View
      style={[styles.barSlot, { left, width, top: BAR_TOP + seg.lane * LANE_H }]}
      pointerEvents="box-none"
    >
      <View style={styles.barHoverWrap} {...hoverProps(setHovered)}>
        <DragSource
          item={{ kind: 'request', id: card.id }}
          ghost={{ title: card.title, color: lead }}
          onPress={() => host.onOpenCard(card)}
          style={[
            styles.bar,
            tint.style,
            seg.continuesBefore && styles.barContinuesBefore,
            seg.continuesAfter && styles.barContinuesAfter,
            !isReadyNow(card) && styles.requestNotReady,
          ]}
        >
          <PoolChipContent
            card={card}
            hovered={hovered}
            planned={planned}
            grip={!seg.continuesAfter}
            gripColor={lead}
            squareLeft={seg.continuesBefore}
            squareRight={seg.continuesAfter}
            {...host}
          />
        </DragSource>
      </View>
    </View>
  );
}

/** One day of the pool calendar: a "backlog-day" drop zone with drag chips. */
function BacklogDayCell({
  date,
  today,
  cards,
  topPad,
  onCreateRequest,
  maxChipsPerDay,
  ...host
}: ChipHostProps & {
  date: string;
  today: boolean;
  /** This day's single-day requests (stretched ones render as bars). */
  cards: WorkRequest[];
  /** Vertical space reserved for the week's bars covering this day. */
  topPad: number;
  onCreateRequest?: (date: string) => void;
  /** Chip cap before "+N more" folds the rest (see BacklogCalendar's prop). */
  maxChipsPerDay?: number;
}) {
  const { ref, hovered } = useDropZone(`bcal:${date}`, {
    type: 'backlog-day',
    date,
    priority: 2,
  });
  // Mouse-hover on the whole cell reveals the bottom create-＋ row.
  const [cellHovered, setCellHovered] = useState(false);
  // The chip cap: up to maxChipsPerDay requests, the rest folded behind
  // "+N more" (the pool has no day view, so the row unfolds the cell in
  // place; "Show less" folds it back). Folded chips aren't registered with
  // the drag layer, so drops still land among the shown ones.
  const [unfolded, setUnfolded] = useState(false);
  const overCap = maxChipsPerDay != null && cards.length > maxChipsPerDay;
  const shown =
    overCap && !unfolded ? cards.slice(0, maxChipsPerDay ?? cards.length) : cards;
  const hiddenCount = cards.length - shown.length;
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
      <View style={[styles.cellCards, topPad > 0 && { marginTop: 3 + topPad }]}>
        {shown.map((card) => (
          <PoolRequestChip key={card.id} card={card} {...host} />
        ))}
        {hiddenCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.moreRow,
              pressed && styles.moreRowHover,
            ]}
            onPress={() => setUnfolded(true)}
            accessibilityRole="button"
            accessibilityLabel={`${hiddenCount} more on ${date}`}
          >
            <Text style={styles.moreText}>+{hiddenCount} more</Text>
          </Pressable>
        )}
        {unfolded && overCap && (
          <Pressable
            style={({ pressed }) => [
              styles.moreRow,
              pressed && styles.moreRowHover,
            ]}
            onPress={() => setUnfolded(false)}
            accessibilityRole="button"
            accessibilityLabel="Show fewer"
          >
            <Text style={styles.moreText}>Show less</Text>
          </Pressable>
        )}

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
    // Expanded, this panel shares the board with the crew calendar, so on a
    // laptop-width window it is too narrow for the title AND the controls on
    // one line. Wrapping drops the controls under the title instead of
    // squeezing the title column to a word per line.
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
    // The month label's pick-a-month list unfolds over the grid below.
    zIndex: 10,
  },
  headerLeft: {
    flex: 1,
    // Room for the title + count on one line; narrower than this, the
    // controls wrap to their own line rather than this column shrinking.
    minWidth: 280,
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
    // On its own line the group stays at the right edge (space-between
    // would park a lone wrapped item at the left), and if even that line is
    // too narrow the Collapse pill drops under the month nav.
    marginLeft: 'auto',
    flexWrap: 'wrap',
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
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
  // "N targeted at hidden weekend days · Show weekends".
  hiddenNote: {
    color: colors.warning,
    fontFamily: fonts.medium,
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
    // Bars position against the week row.
    position: 'relative',
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
  // "+N more" / "Show less" under a capped chip stack: a quiet text row.
  moreRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  moreRowHover: {
    backgroundColor: colors.surfaceLight,
  },
  moreText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
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
  // Several crews pencilled in: the chip's own border + background go
  // transparent — CrewSplitBorder draws the segmented ring and the fill.
  requestMulti: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  requestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  requestText: {
    flex: 1,
    minWidth: 0,
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
  // Multi-day bars: absolutely positioned over the week row, overlapping the
  // day cells' borders as one continuous rounded rectangle (same geometry as
  // the crew calendar).
  barSlot: {
    position: 'absolute',
    height: BAR_H,
    paddingHorizontal: 2,
    zIndex: 5,
  },
  barHoverWrap: {
    flex: 1,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    paddingHorizontal: 5,
  },
  barContinuesBefore: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  barContinuesAfter: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  // The stretch grip on a chip/bar's right edge.
  resizeGrip: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginRight: -2,
  },
  resizeGripBar: {
    width: 3,
    borderRadius: 2,
    height: 12,
  },
}));
