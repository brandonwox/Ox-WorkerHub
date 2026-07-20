import { Feather } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MobileWorkRequestItem } from '@/components/mobile/MobileWorkRequestItem';
import { MonthCalendar } from '@/components/MonthCalendar';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Crew, DailyCrew, WorkRequest } from '@/types';
import { buildCrewColorMap, crewColorFrom, withAlpha } from '@/utils/crewColors';
import { jobDisplayNameById } from '@/utils/jobName';
import { comparePriority } from '@/utils/priorityRange';

interface Props {
  /** Scheduler gets assign/unassign controls; the Field Super views read-only. */
  canAssign: boolean;
}

/**
 * Phone-sized crew calendar: month grid on top, the selected day's crews and
 * their assigned work requests below. With `canAssign` the Scheduler can place a
 * backlog work request on a crew for the selected day (tap "Assign") and pull one
 * off (tap the ×) — the phone counterpart of the desktop drag-drop board.
 */
export function CrewCalendarMobile({ canAssign }: Props) {
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const workRequests = useAppStore((s) => s.workRequests);
  const jobs = useAppStore((s) => s.jobs);
  const assignWorkRequest = useAppStore((s) => s.assignWorkRequest);
  const unassignWorkRequest = useAppStore((s) => s.unassignWorkRequest);
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [assignTarget, setAssignTarget] = useState<Crew | DailyCrew | null>(null);

  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const markedDates = useMemo(
    () => new Set(assignments.map((a) => a.date)),
    [assignments]
  );

  // A Daily Crew only exists on its date; permanent crews are always shown.
  const dayCrews = useMemo<(Crew | DailyCrew)[]>(
    () => [...dailyCrews.filter((dc) => dc.date === dateKey), ...crews],
    [dailyCrews, crews, dateKey]
  );

  const crewColors = useMemo(
    () => buildCrewColorMap(dayCrews.map((c) => c.id)),
    [dayCrews]
  );

  const jobNameFor = (card: WorkRequest) =>
    jobDisplayNameById(card.jobId, jobs) || 'Unlinked job';

  // Work Requests = work requests with no assignment row anywhere (same rule as the
  // desktop board's backlog).
  const backlog = useMemo(
    () =>
      workRequests
        .filter((c) => assignments.every((a) => a.workRequestId !== c.id))
        .sort(comparePriority),
    [workRequests, assignments]
  );

  const confirmUnassign = (assignmentId: string, cardTitle: string) => {
    Alert.alert('Remove from calendar?', `“${cardTitle}” goes back to the backlog.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => unassignWorkRequest(assignmentId),
      },
    ]);
  };

  const dayLabel = isToday(selectedDate)
    ? 'Today'
    : format(selectedDate, 'EEEE, MMM d');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <MonthCalendar
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDates={markedDates}
        />

        <Text style={styles.dayLabel}>{dayLabel}</Text>

        {dayCrews.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No crews</Text>
            <Text style={styles.emptySubtitle}>
              Crews are managed from the desktop calendar.
            </Text>
          </View>
        ) : (
          dayCrews.map((crew) => {
            const color = crewColorFrom(crewColors, crew.id);
            const crewAssignments = assignments.filter(
              (a) => a.crewId === crew.id && a.date === dateKey
            );
            const isDaily = 'date' in crew;
            return (
              <View
                key={crew.id}
                style={[styles.crewCard, { borderLeftColor: color }]}
              >
                <View style={styles.crewHeader}>
                  <View style={styles.crewTitleWrap}>
                    <Text style={styles.crewName} numberOfLines={1}>
                      {crew.name}
                    </Text>
                    {isDaily && (
                      <View style={[styles.dailyPill, { backgroundColor: withAlpha(color, 0.16) }]}>
                        <Text style={[styles.dailyPillText, { color }]}>Daily</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.crewMeta}>
                    {crew.installerIds.length}{' '}
                    {crew.installerIds.length === 1 ? 'installer' : 'installers'}
                  </Text>
                </View>

                {crewAssignments.length === 0 ? (
                  <Text style={styles.crewEmpty}>Nothing assigned this day.</Text>
                ) : (
                  crewAssignments.map((assignment) => {
                    const card = workRequests.find((c) => c.id === assignment.workRequestId);
                    if (!card) return null;
                    return (
                      <View key={assignment.id} style={styles.assignedRow}>
                        <View style={styles.assignedCard}>
                          <MobileWorkRequestItem
                            workRequest={card}
                            jobName={jobNameFor(card)}
                            onPress={() => router.push(`/work-request/${card.id}`)}
                          />
                        </View>
                        {canAssign && (
                          <Pressable
                            hitSlop={8}
                            style={({ pressed }) => [
                              styles.unassignBtn,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => confirmUnassign(assignment.id, card.title)}
                          >
                            <Feather name="x" size={16} color={colors.textSecondary} />
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )}

                {canAssign && (
                  <Pressable
                    style={({ pressed }) => [styles.assignBtn, pressed && styles.pressed]}
                    onPress={() => setAssignTarget(crew)}
                  >
                    <Feather name="plus" size={15} color={colors.primary} />
                    <Text style={styles.assignBtnText}>Assign work request</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Backlog picker: tap a work request to place it on the chosen crew + day. */}
      <Modal
        visible={assignTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignTarget(null)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismiss} onPress={() => setAssignTarget(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                Assign to {assignTarget?.name} · {dayLabel}
              </Text>
              <Pressable hitSlop={8} onPress={() => setAssignTarget(null)}>
                <Feather name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <FlatList
              data={backlog}
              keyExtractor={(card) => card.id}
              contentContainerStyle={styles.sheetList}
              renderItem={({ item }) => (
                <MobileWorkRequestItem
                  workRequest={item}
                  jobName={jobNameFor(item)}
                  onPress={() => {
                    if (assignTarget) assignWorkRequest(item.id, assignTarget.id, dateKey);
                    setAssignTarget(null);
                  }}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Feather name="inbox" size={28} color={colors.textTertiary} />
                  <Text style={styles.emptyTitle}>Backlog is empty</Text>
                  <Text style={styles.emptySubtitle}>
                    Every work request is already on the calendar.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  crewCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.sm,
  },
  crewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  crewTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crewName: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
    flexShrink: 1,
  },
  dailyPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  dailyPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  crewMeta: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  crewEmpty: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingVertical: spacing.xs,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  assignedCard: {
    flex: 1,
  },
  unassignBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    backgroundColor: colors.primaryDim,
    paddingVertical: spacing.sm,
  },
  assignBtnText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheetDismiss: {
    flex: 1,
  },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  sheetList: {
    padding: spacing.lg,
    gap: spacing.md,
  },
}));
