import { Feather } from '@expo/vector-icons';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DragSource,
  DropLine,
  useDragBoard,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Crew, WorkRequest, ScheduleAssignment } from '@/types';
import { buildDayItems } from '@/utils/daySchedule';
import { withAlpha } from '@/utils/crewColors';
import { effectivePriority } from '@/utils/priorityRange';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Multi-day bar geometry: bars overlay the week row at fixed lane slots, and
// every covered cell reserves the same vertical space so its single-day chips
// start below the bars.
const LANE_H = 24; // one lane's slot (bar + gap)
const BAR_H = 21;
// Distance from the week row's top to lane 0: cell padding + day number line.
const BAR_TOP = 25;

interface Props {
  month: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** The crews a placed card is assigned to (the assign targets). */
  activeCrews: Crew[];
  /** Assignments already filtered to the visible (toggled-on) crews. */
  visibleAssignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  /** Distinct color for a crew id, used to tint that crew's cards. */
  colorForCrew: (crewId: string) => string;
  /** True when a work request is selected and waiting to be placed. */
  placing: boolean;
  onAssignToDate: (date: string) => void;
  onUnassign: (assignmentId: string) => void;
  /** Open a day's schedule (the sidebar). Fires only when not placing. */
  onOpenDay?: (date: string) => void;
  /** Day to flash (yyyy-MM-dd) after a "View on calendar" jump, or null. */
  highlightDate?: string | null;
  /** Open a placed work request (same quick view the Work Requests pages use). */
  onOpenCard: (workRequestId: string) => void;
  /** Whether placed cards can be removed from the calendar (Scheduler only). */
  canUnassign?: boolean;
  /**
   * Whether the viewer assigns work. Field Supers only look at the calendar,
   * so the "Assigning to …" header line is hidden for them.
   */
  canAssign?: boolean;
  /** Crew display name (a single letter) for the multi-crew tags on cards. */
  crewNameFor: (crewId: string) => string;
}

/**
 * A placed request's full scheduled range, derived from its assignment rows
 * (one row per crew per covered day — the write paths keep the days
 * contiguous, so min…max IS the stretch).
 */
interface SpanInfo {
  card: WorkRequest;
  /** Every visible assignment row of the request (all days, all crews). */
  group: ScheduleAssignment[];
  start: string;
  end: string;
}

/** One week-row slice of a multi-day span, with its allocated lane. */
interface SpanSegment {
  span: SpanInfo;
  startCol: number;
  endCol: number;
  /** The span continues past this week's edge(s). */
  continuesBefore: boolean;
  continuesAfter: boolean;
  lane: number;
}

/**
 * Month grid showing the visible crews' assignments per day, colored by crew.
 * Multi-day requests render as ONE continuous bar overlapping the day borders
 * (Google Calendar style); dragging a bar moves the whole stretch, and the
 * grip on its right edge stretches/shrinks the end day.
 */
export function MonthCalendar({
  month,
  onPrevMonth,
  onNextMonth,
  activeCrews,
  visibleAssignments,
  workRequests,
  colorForCrew,
  placing,
  onAssignToDate,
  onUnassign,
  onOpenDay,
  highlightDate,
  onOpenCard,
  canUnassign = true,
  canAssign = true,
  crewNameFor,
}: Props) {
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart); // 0 (Sun) … 6 (Sat)

  // Chunk the month into week rows (nulls pad the month's edges) so each row
  // can host its own multi-day bar overlay.
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Group the visible assignments per request and derive each one's range.
  const spanByCard = new Map<string, SpanInfo>();
  for (const a of visibleAssignments) {
    const info = spanByCard.get(a.workRequestId);
    if (info) {
      info.group.push(a);
      if (a.date < info.start) info.start = a.date;
      if (a.date > info.end) info.end = a.date;
      continue;
    }
    const card = workRequests.find((c) => c.id === a.workRequestId);
    if (card) {
      spanByCard.set(a.workRequestId, {
        card,
        group: [a],
        start: a.date,
        end: a.date,
      });
    }
  }
  // Requests stretching over more than one day become bars; the rest stay
  // ordinary chips inside their day cell.
  const multiDaySpans = [...spanByCard.values()].filter(
    (s) => s.start !== s.end
  );
  const multiDayIds = new Set(multiDaySpans.map((s) => s.card.id));

  // Placing cues take on the active crew's color when there's a single target;
  // with several (multi-assign) or none they stay neutral grey — the crew names
  // themselves are always rendered in their own colors.
  const activeColor =
    activeCrews.length === 1
      ? colorForCrew(activeCrews[0].id)
      : colors.textSecondary;

  // The active crew names as inline, per-crew-colored spans for use inside a
  // parent <Text> (e.g. "Assigning to Alpha, Bravo").
  const crewNameSpans = activeCrews.map((c, i) => (
    <Text key={c.id} style={{ color: colorForCrew(c.id) }}>
      {c.name}
      {i < activeCrews.length - 1 ? ', ' : ''}
    </Text>
  ));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.monthLabel}>{format(month, 'MMMM yyyy')}</Text>
          {canAssign && (
            <Text style={styles.viewing}>
              {activeCrews.length > 0 ? (
                <>Assigning to {crewNameSpans}</>
              ) : (
                'No active crew — tap one to assign'
              )}
            </Text>
          )}
        </View>
        <View style={styles.navBtns}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={onPrevMonth}
            hitSlop={6}
          >
            <Feather name="chevron-left" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={onNextMonth}
            hitSlop={6}
          >
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {placing && (
        <View style={[styles.placingBanner, { backgroundColor: withAlpha(activeColor, 0.18) }]}>
          <Feather name="crosshair" size={14} color={activeColor} />
          <Text style={styles.placingText}>
            Click a day to assign the selected work request
            {activeCrews.length > 0 ? <> to {crewNameSpans}</> : ''}.
          </Text>
        </View>
      )}

      <View style={styles.weekRow}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {weeks.map((week, w) => (
          <WeekRow
            key={w}
            week={week}
            spans={multiDaySpans}
            multiDayIds={multiDayIds}
            visibleAssignments={visibleAssignments}
            workRequests={workRequests}
            colorForCrew={colorForCrew}
            crewNameFor={crewNameFor}
            placing={placing}
            onAssignToDate={onAssignToDate}
            onUnassign={onUnassign}
            onOpenDay={onOpenDay}
            highlightDate={highlightDate}
            onOpenCard={onOpenCard}
            canUnassign={canUnassign}
          />
        ))}
      </ScrollView>
    </View>
  );
}

interface WeekRowProps {
  week: (Date | null)[];
  spans: SpanInfo[];
  multiDayIds: Set<string>;
  visibleAssignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  colorForCrew: (crewId: string) => string;
  crewNameFor: (crewId: string) => string;
  placing: boolean;
  onAssignToDate: (date: string) => void;
  onUnassign: (assignmentId: string) => void;
  onOpenDay?: (date: string) => void;
  highlightDate?: string | null;
  onOpenCard: (workRequestId: string) => void;
  canUnassign: boolean;
}

/**
 * One calendar week: seven day cells plus the absolutely-positioned multi-day
 * bars overlapping their borders. Cells covered by bars reserve matching
 * vertical space so single-day chips start below them.
 */
function WeekRow({
  week,
  spans,
  multiDayIds,
  visibleAssignments,
  workRequests,
  colorForCrew,
  crewNameFor,
  placing,
  onAssignToDate,
  onUnassign,
  onOpenDay,
  highlightDate,
  onOpenCard,
  canUnassign,
}: WeekRowProps) {
  const dateStrs = week.map((d) => (d ? format(d, 'yyyy-MM-dd') : null));
  const firstCol = dateStrs.findIndex((d) => d !== null);
  const lastCol = 6 - [...dateStrs].reverse().findIndex((d) => d !== null);
  const weekStart = dateStrs[firstCol];
  const weekEnd = dateStrs[lastCol];

  // This week's slice of every intersecting span, then greedy lane packing
  // (earlier starts first, longer spans first among equals) so overlapping
  // bars stack instead of colliding.
  const segments: SpanSegment[] = [];
  if (weekStart && weekEnd) {
    for (const span of spans) {
      if (span.end < weekStart || span.start > weekEnd) continue;
      const segStart = span.start < weekStart ? weekStart : span.start;
      const segEnd = span.end > weekEnd ? weekEnd : span.end;
      segments.push({
        span,
        startCol: getDay(parseISO(segStart)),
        endCol: getDay(parseISO(segEnd)),
        continuesBefore: span.start < segStart,
        continuesAfter: span.end > segEnd,
        lane: 0,
      });
    }
  }
  segments.sort(
    (a, b) =>
      a.startCol - b.startCol ||
      b.endCol - a.endCol ||
      a.span.card.title.localeCompare(b.span.card.title)
  );
  const laneEnds: number[] = []; // last occupied column per lane
  for (const seg of segments) {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.endCol);
    } else {
      laneEnds[lane] = seg.endCol;
    }
    seg.lane = lane;
  }

  /** Vertical bar slots a cell must reserve (deepest lane covering it + 1). */
  const lanesOver = (col: number) => {
    let lanes = 0;
    for (const seg of segments) {
      if (col >= seg.startCol && col <= seg.endCol) {
        lanes = Math.max(lanes, seg.lane + 1);
      }
    }
    return lanes;
  };

  return (
    <View style={styles.week}>
      {week.map((dayDate, col) => {
        const dateStr = dateStrs[col];
        if (!dayDate || !dateStr) {
          return <View key={`blank-${col}`} style={styles.cellBlank} />;
        }
        return (
          <DayCell
            key={dateStr}
            date={dateStr}
            today={isToday(dayDate)}
            highlight={dateStr === highlightDate}
            assignments={visibleAssignments.filter(
              (a) => a.date === dateStr && !multiDayIds.has(a.workRequestId)
            )}
            workRequests={workRequests}
            colorForCrew={colorForCrew}
            crewNameFor={crewNameFor}
            placing={placing}
            onAssignToDate={onAssignToDate}
            onUnassign={onUnassign}
            onOpenDay={onOpenDay}
            onOpenCard={onOpenCard}
            canUnassign={canUnassign}
            topPad={lanesOver(col) * LANE_H}
          />
        );
      })}

      {segments.map((seg) => (
        <SpanBar
          key={`bar-${seg.span.card.id}`}
          seg={seg}
          colorForCrew={colorForCrew}
          crewNameFor={crewNameFor}
          onOpenCard={onOpenCard}
          onUnassign={onUnassign}
          canUnassign={canUnassign}
        />
      ))}
    </View>
  );
}

interface SpanBarProps {
  seg: SpanSegment;
  colorForCrew: (crewId: string) => string;
  crewNameFor: (crewId: string) => string;
  onOpenCard: (workRequestId: string) => void;
  onUnassign: (assignmentId: string) => void;
  canUnassign: boolean;
}

/**
 * One week-row segment of a multi-day request: a continuous bar across its
 * covered day cells. Dragging the bar moves the whole stretch (its length is
 * preserved by the drop handler); the grip on the right edge drags the END
 * day to stretch or shrink it. Continuation past a week edge squares that
 * edge's corners off.
 */
function SpanBar({
  seg,
  colorForCrew,
  crewNameFor,
  onOpenCard,
  onUnassign,
  canUnassign,
}: SpanBarProps) {
  const board = useDragBoard();
  const { span } = seg;
  const crewIds = [...new Set(span.group.map((a) => a.crewId))];
  const color = colorForCrew(crewIds[0]);
  const width = seg.endCol - seg.startCol + 1;

  return (
    <View
      style={[
        styles.barSlot,
        {
          left: `${(seg.startCol / 7) * 100}%`,
          width: `${(width / 7) * 100}%`,
          top: BAR_TOP + seg.lane * LANE_H,
        },
      ]}
      pointerEvents="box-none"
    >
      <DragSource
        item={{ kind: 'request', id: span.card.id }}
        ghost={{ title: span.card.title, color }}
        onPress={() => onOpenCard(span.card.id)}
        style={[
          styles.bar,
          {
            backgroundColor: withAlpha(color, 0.28),
            borderColor: withAlpha(color, 0.6),
          },
          seg.continuesBefore && styles.barContinuesBefore,
          seg.continuesAfter && styles.barContinuesAfter,
        ]}
      >
        <View
          style={[
            styles.placedDot,
            { backgroundColor: effectivePriority(span.card).color },
          ]}
        />
        <Text style={styles.placedTitle} numberOfLines={1}>
          {span.card.title}
        </Text>
        {crewIds.length > 1 && (
          <Text style={styles.placedCrews} numberOfLines={1}>
            {crewIds.map((crewId, j) => (
              <Text key={crewId} style={{ color: colorForCrew(crewId) }}>
                {j > 0 ? ' ' : ''}
                {crewNameFor(crewId)}
              </Text>
            ))}
          </Text>
        )}
        {canUnassign && (
          <Pressable
            // Unassigning removes the request's WHOLE stretch from every crew
            // (the handler fans out from any assignment).
            onPress={() => onUnassign(span.group[0].id)}
            hitSlop={6}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Feather name="x" size={12} color={colors.textTertiary} />
          </Pressable>
        )}
        {board.enabled && !seg.continuesAfter && (
          <DragSource
            item={{ kind: 'resize', id: span.card.id }}
            ghost={{ title: `Stretch — ${span.card.title}`, color }}
            cursor="ew-resize"
            style={styles.resizeGrip}
          >
            <View style={[styles.resizeGripBar, { backgroundColor: withAlpha(color, 0.9) }]} />
          </DragSource>
        )}
      </DragSource>
    </View>
  );
}

interface DayCellProps {
  date: string;
  today: boolean;
  highlight: boolean;
  /** This day's assignments EXCLUDING multi-day requests (those render as bars). */
  assignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  colorForCrew: (crewId: string) => string;
  crewNameFor: (crewId: string) => string;
  placing: boolean;
  onAssignToDate: (date: string) => void;
  onUnassign: (assignmentId: string) => void;
  onOpenDay?: (date: string) => void;
  onOpenCard: (workRequestId: string) => void;
  canUnassign: boolean;
  /** Vertical space reserved for the week's bars covering this day. */
  topPad: number;
}

/**
 * One month-grid day: an ordered stack of single-day request chips
 * (priorityOrder), a drop zone for drag & drop, and the click-to-place /
 * open-day behaviors on the cell background.
 */
function DayCell({
  date,
  today,
  highlight,
  assignments,
  workRequests,
  colorForCrew,
  crewNameFor,
  placing,
  onAssignToDate,
  onUnassign,
  onOpenDay,
  onOpenCard,
  canUnassign,
  topPad,
}: DayCellProps) {
  const board = useDragBoard();
  const zoneId = `cal:${date}`;
  const { ref, hovered, hoverIndex } = useDropZone(zoneId, {
    type: 'day',
    surface: 'calendar',
    date,
    priority: 2,
  });
  // Insertion lines mean nothing while a stretch grip is being dragged — the
  // drop only re-dates the end day.
  const resizing = board.draggingKey?.startsWith('resize:') ?? false;

  const items = buildDayItems(assignments, workRequests);

  return (
    <Pressable
      ref={ref}
      style={[
        styles.cell,
        highlight && styles.cellHighlight,
        hovered && styles.cellDropHover,
      ]}
      onPress={
        placing
          ? () => onAssignToDate(date)
          : onOpenDay
            ? () => onOpenDay(date)
            : undefined
      }
    >
      <View style={styles.cellHead}>
        <Text style={[styles.dayNum, today && styles.dayNumToday]}>
          {format(new Date(`${date}T00:00:00`), 'd')}
        </Text>
      </View>

      <View style={[styles.cellCards, topPad > 0 && { marginTop: 3 + topPad }]}>
        {hoverIndex === 0 && !resizing && <DropLine />}
        {items.map((item, i) => (
          <Fragment key={item.key}>
            <DragSource
              item={{ kind: 'request', id: item.card.id }}
              ghost={{
                title: item.card.title,
                color: colorForCrew(item.group[0].crewId),
              }}
              zoneId={zoneId}
              onPress={
                placing ? () => onAssignToDate(date) : () => onOpenCard(item.card.id)
              }
              style={[
                styles.placed,
                {
                  backgroundColor: withAlpha(colorForCrew(item.group[0].crewId), 0.18),
                  borderColor: withAlpha(colorForCrew(item.group[0].crewId), 0.55),
                },
              ]}
            >
              <View
                style={[
                  styles.placedDot,
                  { backgroundColor: effectivePriority(item.card).color },
                ]}
              />
              <Text style={styles.placedTitle} numberOfLines={1}>
                {item.card.title}
              </Text>
              {item.group.length > 1 && (
                <Text style={styles.placedCrews} numberOfLines={1}>
                  {item.group.map((a, j) => (
                    <Text key={a.id} style={{ color: colorForCrew(a.crewId) }}>
                      {j > 0 ? ' ' : ''}
                      {crewNameFor(a.crewId)}
                    </Text>
                  ))}
                </Text>
              )}
              {canUnassign && (
                <Pressable
                  // Unassigning a shared card removes it from every
                  // crew (the handler fans out from any assignment).
                  onPress={() => onUnassign(item.group[0].id)}
                  hitSlop={6}
                  style={({ pressed }) => pressed && styles.pressed}
                >
                  <Feather name="x" size={12} color={colors.textTertiary} />
                </Pressable>
              )}
              {board.enabled && (
                <DragSource
                  item={{ kind: 'resize', id: item.card.id }}
                  ghost={{
                    title: `Stretch — ${item.card.title}`,
                    color: colorForCrew(item.group[0].crewId),
                  }}
                  cursor="ew-resize"
                  style={styles.resizeGrip}
                >
                  <View
                    style={[
                      styles.resizeGripBar,
                      {
                        backgroundColor: withAlpha(
                          colorForCrew(item.group[0].crewId),
                          0.9
                        ),
                      },
                    ]}
                  />
                </DragSource>
              )}
            </DragSource>
            {hoverIndex === i + 1 && !resizing && <DropLine />}
          </Fragment>
        ))}
      </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  viewing: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 2,
  },
  navBtns: {
    flexDirection: 'row',
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
  pressed: {
    opacity: 0.6,
  },
  placingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Neutral fallback — the inline style tints it with the active crew's
    // color (grey when several crews are targeted).
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  placingText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
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
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
  },
  week: {
    flexDirection: 'row',
    // Bars position against the week row.
    position: 'relative',
  },
  cellBlank: {
    width: '14.2857%',
    minHeight: 116,
  },
  cell: {
    width: '14.2857%',
    minHeight: 116,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  cellHighlight: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.12),
  },
  cellDropHover: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.08),
  },
  cellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  placed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  placedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  placedTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  placedCrews: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  // Multi-day bars: absolutely positioned over the week row, overlapping the
  // day cells' borders as one continuous rounded rectangle.
  barSlot: {
    position: 'absolute',
    height: BAR_H,
    paddingHorizontal: 2,
    zIndex: 5,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 4,
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
