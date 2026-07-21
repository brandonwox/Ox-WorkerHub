import { Feather } from '@expo/vector-icons';
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  startOfMonth,
} from 'date-fns';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DragSource,
  DropLine,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { CalendarEvent, Crew, WorkRequest, ScheduleAssignment } from '@/types';
import { buildDayItems } from '@/utils/daySchedule';
import { withAlpha } from '@/utils/crewColors';
import { effectivePriority } from '@/utils/priorityRange';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  month: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** The crews a placed card is assigned to (the assign targets). */
  activeCrews: Crew[];
  /** Assignments already filtered to the visible (toggled-on) crews. */
  visibleAssignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  /** Scheduler day notes — rendered like request chips, crew-neutral. */
  calendarEvents: CalendarEvent[];
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
  /** Open an event's popup. */
  onOpenEvent: (eventId: string) => void;
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

/** Month grid showing the visible crews' assignments per day, colored by crew. */
export function MonthCalendar({
  month,
  onPrevMonth,
  onNextMonth,
  activeCrews,
  visibleAssignments,
  workRequests,
  calendarEvents,
  colorForCrew,
  placing,
  onAssignToDate,
  onUnassign,
  onOpenDay,
  highlightDate,
  onOpenCard,
  onOpenEvent,
  canUnassign = true,
  canAssign = true,
  crewNameFor,
}: Props) {
  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart); // 0 (Sun) … 6 (Sat)

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
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <View key={`blank-${i}`} style={styles.cellBlank} />
        ))}

        {days.map((dayDate) => {
          const dateStr = format(dayDate, 'yyyy-MM-dd');
          return (
            <DayCell
              key={dateStr}
              date={dateStr}
              today={isToday(dayDate)}
              highlight={dateStr === highlightDate}
              assignments={visibleAssignments.filter((a) => a.date === dateStr)}
              workRequests={workRequests}
              events={calendarEvents.filter((e) => e.date === dateStr)}
              colorForCrew={colorForCrew}
              crewNameFor={crewNameFor}
              placing={placing}
              onAssignToDate={onAssignToDate}
              onUnassign={onUnassign}
              onOpenDay={onOpenDay}
              onOpenCard={onOpenCard}
              onOpenEvent={onOpenEvent}
              canUnassign={canUnassign}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

interface DayCellProps {
  date: string;
  today: boolean;
  highlight: boolean;
  assignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  events: CalendarEvent[];
  colorForCrew: (crewId: string) => string;
  crewNameFor: (crewId: string) => string;
  placing: boolean;
  onAssignToDate: (date: string) => void;
  onUnassign: (assignmentId: string) => void;
  onOpenDay?: (date: string) => void;
  onOpenCard: (workRequestId: string) => void;
  onOpenEvent: (eventId: string) => void;
  canUnassign: boolean;
}

/**
 * One month-grid day: an ordered stack of request chips + event chips
 * (priorityOrder), a drop zone for drag & drop, and the click-to-place /
 * open-day behaviors on the cell background.
 */
function DayCell({
  date,
  today,
  highlight,
  assignments,
  workRequests,
  events,
  colorForCrew,
  crewNameFor,
  placing,
  onAssignToDate,
  onUnassign,
  onOpenDay,
  onOpenCard,
  onOpenEvent,
  canUnassign,
}: DayCellProps) {
  const zoneId = `cal:${date}`;
  const { ref, hovered, hoverIndex } = useDropZone(zoneId, {
    type: 'day',
    surface: 'calendar',
    date,
    priority: 2,
  });

  const items = buildDayItems(assignments, workRequests, events);

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

      <View style={styles.cellCards}>
        {hoverIndex === 0 && <DropLine />}
        {items.map((item, i) => (
          <Fragment key={item.key}>
            {item.kind === 'request' ? (
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
              </DragSource>
            ) : (
              <DragSource
                item={{ kind: 'event', id: item.event.id }}
                ghost={{ title: item.event.title, color: colors.textSecondary }}
                zoneId={zoneId}
                onPress={() => onOpenEvent(item.event.id)}
                style={styles.eventChip}
              >
                <Feather name="info" size={9} color={colors.textSecondary} />
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {item.event.title}
                </Text>
              </DragSource>
            )}
            {hoverIndex === i + 1 && <DropLine />}
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.sm,
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
  // Events: same rounded-rectangle chip as a request, crew-neutral colors.
  eventChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  eventTitle: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
  },
}));
