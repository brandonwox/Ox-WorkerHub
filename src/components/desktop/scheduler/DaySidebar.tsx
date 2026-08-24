import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DragSource,
  DropLine,
  useDragBoard,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { WorkRequest, ScheduleAssignment } from '@/types';
import { buildDayItems } from '@/utils/daySchedule';
import { withAlpha } from '@/utils/crewColors';
import { effectivePriority } from '@/utils/priorityRange';

interface Props {
  /** The day being viewed (yyyy-MM-dd). */
  date: string;
  /** Assignments for `date`, already filtered to the visible crews. */
  assignments: ScheduleAssignment[];
  workRequests: WorkRequest[];
  jobNameFor: (card: WorkRequest) => string;
  colorForCrew: (crewId: string) => string;
  /** Crew display name (a single letter). */
  crewNameFor: (crewId: string) => string;
  onOpenCard: (workRequestId: string) => void;
  onClose: () => void;
}

/**
 * A day's schedule, opened by clicking that day in the month calendar. Sits
 * between the calendar and the Work Requests column; clicking a work request on the
 * main calendar closes it. The list is a drag target too — rows reorder and
 * requests can be dragged in/out just like the month cells.
 */
export function DaySidebar({
  date,
  assignments,
  workRequests,
  jobNameFor,
  colorForCrew,
  crewNameFor,
  onOpenCard,
  onClose,
}: Props) {
  const zoneId = `sidebar:${date}`;
  const board = useDragBoard();
  const { ref, hoverIndex } = useDropZone(zoneId, {
    type: 'day',
    surface: 'sidebar',
    date,
    priority: 2,
  });

  const items = buildDayItems(assignments, workRequests);
  // hoverIndex counts the day's rows EXCLUDING the dragged one (the drag
  // layer skips it, matching the drop's remove-then-insert renumbering) —
  // count line slots over the same filtered list so the line matches the
  // landing (see DayCell in MonthCalendar).
  let slot = 0;
  const lineAfter = items.map((item) =>
    board.draggingKey === `request:${item.card.id}` ? null : ++slot
  );

  return (
    <View style={styles.wrap} ref={ref} collapsable={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {format(parseISO(date), 'EEEE')}
          </Text>
          <Text style={styles.subtitle}>
            {format(parseISO(date), 'MMMM d, yyyy')}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          onPress={onClose}
          hitSlop={8}
        >
          <Feather name="x" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <Text style={styles.emptyText}>Nothing scheduled this day.</Text>
        ) : (
          <>
            {hoverIndex === 0 && <DropLine />}
            {items.map((item, i) => (
              <Fragment key={item.key}>
                <DragSource
                  item={{ kind: 'request', id: item.card.id }}
                  ghost={{
                    title: item.card.title,
                    color: colorForCrew(item.group[0].crewId),
                  }}
                  zoneId={zoneId}
                  onPress={() => onOpenCard(item.card.id)}
                  style={[
                    styles.row,
                    {
                      backgroundColor: withAlpha(
                        colorForCrew(item.group[0].crewId),
                        0.14
                      ),
                      borderColor: withAlpha(
                        colorForCrew(item.group[0].crewId),
                        0.5
                      ),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: effectivePriority(item.card).color },
                    ]}
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {item.card.title}
                    </Text>
                    <Text style={styles.rowJob} numberOfLines={1}>
                      {jobNameFor(item.card)}
                    </Text>
                  </View>
                  <Text style={styles.rowCrews}>
                    {item.group.map((a, j) => (
                      <Text key={a.id} style={{ color: colorForCrew(a.crewId) }}>
                        {j > 0 ? ' ' : ''}
                        {crewNameFor(a.crewId)}
                      </Text>
                    ))}
                  </Text>
                </DragSource>
                {hoverIndex === lineAfter[i] && <DropLine />}
              </Fragment>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    width: 280,
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
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  rowJob: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  rowCrews: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
}));
