import { Feather } from '@expo/vector-icons';
import { addMonths, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { Backlog } from '@/components/desktop/scheduler/Backlog';
import { ManageCrewsModal } from '@/components/desktop/scheduler/ManageCrewsModal';
import { MonthCalendar } from '@/components/desktop/scheduler/MonthCalendar';
import { Toast } from '@/components/Toast';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

export default function ScheduleScreen() {
  const role = useCurrentRole();
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const jobcards = useAppStore((s) => s.jobcards);
  const jobs = useAppStore((s) => s.jobs);
  const assignJobcard = useAppStore((s) => s.assignJobcard);
  const unassignJobcard = useAppStore((s) => s.unassignJobcard);

  const [viewingCrewId, setViewingCrewId] = useState(crews[0]?.id ?? '');
  const [placingCardId, setPlacingCardId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [toast, setToast] = useState<string | null>(null);

  // Tolerate a removed/stale viewing crew by falling back to the first one.
  const viewingCrew =
    crews.find((c) => c.id === viewingCrewId) ?? crews[0] ?? null;
  const effectiveCrewId = viewingCrew?.id ?? null;

  const jobNameFor = (jobId?: string) =>
    jobs.find((j) => j.id === jobId)?.name ?? 'Unlinked job';

  // Backlog = jobcards with no assignment row anywhere.
  const unassigned = useMemo(
    () => jobcards.filter((c) => assignments.every((a) => a.jobcardId !== c.id)),
    [jobcards, assignments]
  );

  const assignmentsForCrew = useMemo(
    () => assignments.filter((a) => a.crewId === effectiveCrewId),
    [assignments, effectiveCrewId]
  );

  // Visual cues. A Daily Crew sharing a member with the viewed crew "pulls"
  // that member away on its date (override); if the viewed crew also has work
  // that day, that member would be double-booked.
  const { overrideDates, doubleBookedDates } = useMemo(() => {
    const members = new Set(viewingCrew?.installerIds ?? []);
    const override = new Set<string>();
    const doubled = new Set<string>();
    if (!viewingCrew) return { overrideDates: override, doubleBookedDates: doubled };

    for (const dc of dailyCrews) {
      if (dc.installerIds.some((id) => members.has(id))) override.add(dc.date);
    }
    for (const a of assignments) {
      if (a.crewId === effectiveCrewId) continue;
      const otherCrew =
        crews.find((c) => c.id === a.crewId) ??
        dailyCrews.find((d) => d.id === a.crewId);
      if (!otherCrew) continue;
      const sharesMember = otherCrew.installerIds.some((id) => members.has(id));
      const viewedHasWorkThatDay = assignments.some(
        (b) => b.crewId === effectiveCrewId && b.date === a.date
      );
      if (sharesMember && viewedHasWorkThatDay) doubled.add(a.date);
    }
    return { overrideDates: override, doubleBookedDates: doubled };
  }, [viewingCrew, dailyCrews, assignments, crews, effectiveCrewId]);

  if (role !== 'scheduler') return <AccessDenied />;

  const assignToDate = (date: string) => {
    if (!placingCardId) return;
    if (!effectiveCrewId) {
      setToast('Create a crew before assigning work.');
      return;
    }
    assignJobcard(placingCardId, effectiveCrewId, date);
    const card = jobcards.find((c) => c.id === placingCardId);
    setPlacingCardId(null);
    setToast(`Assigned "${card?.title ?? 'jobcard'}" to ${viewingCrew?.name}`);
  };

  const togglePlacing = (cardId: string) =>
    setPlacingCardId((prev) => (prev === cardId ? null : cardId));

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          {crews.length === 0 ? (
            <Text style={styles.noCrews}>
              No crews yet — create one to start scheduling.
            </Text>
          ) : (
            <InlineSelect
              value={effectiveCrewId ?? ''}
              options={crews.map((c) => ({ value: c.id, label: c.name }))}
              onChange={setViewingCrewId}
              minWidth={200}
            />
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
          onPress={() => setManageOpen(true)}
        >
          <Feather name="users" size={15} color={colors.textPrimary} />
          <Text style={styles.manageText}>Manage crews</Text>
        </Pressable>
      </View>

      <View style={styles.board}>
        <View style={styles.calCol}>
          <MonthCalendar
            month={month}
            onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setMonth((m) => addMonths(m, 1))}
            viewingCrew={viewingCrew}
            assignmentsForCrew={assignmentsForCrew}
            jobcards={jobcards}
            overrideDates={overrideDates}
            doubleBookedDates={doubleBookedDates}
            placing={placingCardId !== null}
            onAssignToDate={assignToDate}
            onUnassign={unassignJobcard}
          />
        </View>
        <View style={styles.backlogCol}>
          <Backlog
            cards={unassigned}
            jobNameFor={jobNameFor}
            placingCardId={placingCardId}
            onTogglePlacing={togglePlacing}
          />
        </View>
      </View>

      <Toast message={toast} onDone={() => setToast(null)} />

      <ManageCrewsModal visible={manageOpen} onClose={() => setManageOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    zIndex: 20,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noCrews: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  manageText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  board: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    zIndex: 1,
  },
  calCol: {
    flex: 2,
  },
  backlogCol: {
    flex: 1,
    maxWidth: 360,
  },
});
