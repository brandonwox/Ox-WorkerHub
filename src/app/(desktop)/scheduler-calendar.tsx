import { Feather } from '@expo/vector-icons';
import { addMonths, subMonths } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { Backlog } from '@/components/desktop/scheduler/Backlog';
import { ManageCrewsModal } from '@/components/desktop/scheduler/ManageCrewsModal';
import { MonthCalendar } from '@/components/desktop/scheduler/MonthCalendar';
import { Toast } from '@/components/Toast';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Crew } from '@/types';
import { buildCrewColorMap, crewColorFrom, withAlpha } from '@/utils/crewColors';

export default function ScheduleScreen() {
  const role = useCurrentRole();
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const jobcards = useAppStore((s) => s.jobcards);
  const jobs = useAppStore((s) => s.jobs);
  const assignJobcard = useAppStore((s) => s.assignJobcard);
  const unassignJobcard = useAppStore((s) => s.unassignJobcard);

  // Crews toggled OFF in the calendar view. Empty = every crew is visible, so
  // crews added later show up automatically until the scheduler hides them.
  const [hiddenCrewIds, setHiddenCrewIds] = useState<Set<string>>(new Set());
  // The single crew a placed card is assigned to (the assign target).
  const [activeCrewId, setActiveCrewId] = useState<string | null>(null);
  const [placingCardId, setPlacingCardId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [toast, setToast] = useState<string | null>(null);

  // Distinct, stable color per crew for tinting cards and chips.
  const crewColorMap = useMemo(
    () => buildCrewColorMap(crews.map((c) => c.id)),
    [crews]
  );
  const colorForCrew = (crewId: string) => crewColorFrom(crewColorMap, crewId);

  const activeCrew = crews.find((c) => c.id === activeCrewId) ?? null;

  // Seed / repair the active crew: keep exactly one active while any crew is
  // visible, and never leave a stale id (e.g. after crews load or one is removed).
  useEffect(() => {
    if (activeCrew) return;
    const firstVisible = crews.find((c) => !hiddenCrewIds.has(c.id));
    if (firstVisible) setActiveCrewId(firstVisible.id);
  }, [crews, hiddenCrewIds, activeCrew]);

  // Cycle a crew chip: hidden → visible → active → hidden. This gives the
  // "click to show, click again to make it the assign target" behavior while a
  // third click removes it from the view.
  const cycleCrew = (id: string) => {
    if (hiddenCrewIds.has(id)) {
      // Hidden → visible.
      setHiddenCrewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setActiveCrewId((prev) => prev ?? id);
      return;
    }
    if (activeCrewId === id) {
      // Active → hidden; hand the active role to another visible crew (or none).
      const next = new Set(hiddenCrewIds);
      next.add(id);
      setHiddenCrewIds(next);
      setActiveCrewId(crews.find((c) => !next.has(c.id))?.id ?? null);
      return;
    }
    // Visible but not active → make it the assign target.
    setActiveCrewId(id);
  };

  const jobNameFor = (jobId?: string) =>
    jobs.find((j) => j.id === jobId)?.name ?? 'Unlinked job';

  // Backlog = jobcards with no assignment row anywhere.
  const unassigned = useMemo(
    () => jobcards.filter((c) => assignments.every((a) => a.jobcardId !== c.id)),
    [jobcards, assignments]
  );

  // Every assignment belonging to a visible (not toggled-off) crew.
  const visibleAssignments = useMemo(
    () => assignments.filter((a) => !hiddenCrewIds.has(a.crewId)),
    [assignments, hiddenCrewIds]
  );

  // Visual cues are scoped to the active crew (the one being worked on). A Daily
  // Crew sharing a member with it "pulls" that member away on its date
  // (override); if the active crew also has work that day, that member would be
  // double-booked.
  const { overrideDates, doubleBookedDates } = useMemo(() => {
    const override = new Set<string>();
    const doubled = new Set<string>();
    if (!activeCrew) return { overrideDates: override, doubleBookedDates: doubled };
    const members = new Set(activeCrew.installerIds);

    for (const dc of dailyCrews) {
      if (dc.installerIds.some((id) => members.has(id))) override.add(dc.date);
    }
    for (const a of assignments) {
      if (a.crewId === activeCrew.id) continue;
      const otherCrew =
        crews.find((c) => c.id === a.crewId) ??
        dailyCrews.find((d) => d.id === a.crewId);
      if (!otherCrew) continue;
      const sharesMember = otherCrew.installerIds.some((id) => members.has(id));
      const activeHasWorkThatDay = assignments.some(
        (b) => b.crewId === activeCrew.id && b.date === a.date
      );
      if (sharesMember && activeHasWorkThatDay) doubled.add(a.date);
    }
    return { overrideDates: override, doubleBookedDates: doubled };
  }, [activeCrew, dailyCrews, assignments, crews]);

  if (role !== 'scheduler') return <AccessDenied />;

  const assignToDate = (date: string) => {
    if (!placingCardId) return;
    if (!activeCrew) {
      setToast('Tap a crew to make it the assign target first.');
      return;
    }
    assignJobcard(placingCardId, activeCrew.id, date);
    const card = jobcards.find((c) => c.id === placingCardId);
    setPlacingCardId(null);
    setToast(`Assigned "${card?.title ?? 'jobcard'}" to ${activeCrew.name}`);
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
            crews.map((crew) => (
              <CrewChip
                key={crew.id}
                crew={crew}
                color={colorForCrew(crew.id)}
                visible={!hiddenCrewIds.has(crew.id)}
                active={activeCrewId === crew.id}
                onPress={() => cycleCrew(crew.id)}
              />
            ))
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
      {crews.length > 0 && (
        <Text style={styles.filterHint}>
          Tap a crew to show it · tap again to make it the assign target ·
          tap once more to hide it.
        </Text>
      )}

      <View style={styles.board}>
        <View style={styles.calCol}>
          <MonthCalendar
            month={month}
            onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setMonth((m) => addMonths(m, 1))}
            activeCrew={activeCrew}
            visibleAssignments={visibleAssignments}
            jobcards={jobcards}
            colorForCrew={colorForCrew}
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

/** A crew toggle: hidden → visible → active (assign target) → hidden. */
function CrewChip({
  crew,
  color,
  visible,
  active,
  onPress,
}: {
  crew: Crew;
  color: string;
  visible: boolean;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.crewChip,
        {
          borderColor: visible ? color : colors.border,
          backgroundColor: visible
            ? withAlpha(color, active ? 0.28 : 0.14)
            : 'transparent',
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.crewDot,
          { borderColor: color, backgroundColor: visible ? color : 'transparent' },
        ]}
      />
      <Text
        style={[
          styles.crewChipText,
          {
            color: visible ? colors.textPrimary : colors.textSecondary,
            fontFamily: active ? fonts.bold : fonts.medium,
          },
        ]}
      >
        {crew.name}
      </Text>
      {active && <Feather name="crosshair" size={12} color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 20,
  },
  toolbarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterHint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 11,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  crewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  crewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  crewChipText: {
    fontSize: 13,
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
