import { Feather } from '@expo/vector-icons';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JobcardQuickView } from '@/components/desktop/JobcardQuickView';
import { Backlog } from '@/components/desktop/scheduler/Backlog';
import { ManageCrewsModal } from '@/components/desktop/scheduler/ManageCrewsModal';
import { MonthCalendar } from '@/components/desktop/scheduler/MonthCalendar';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { Crew, DailyCrew } from '@/types';
import { buildCrewColorMap, crewColorFrom, withAlpha } from '@/utils/crewColors';

interface Props {
  /**
   * Whether the viewer may place work onto crews. Schedulers can; Field Supers
   * share the same board read-only for crew assignment (they still open and edit
   * jobcards), so the Schedule / unassign / Manage crews controls are hidden.
   */
  canAssign: boolean;
}

/**
 * The month calendar + Work Requests board. Shared by the Scheduler
 * (`canAssign`) and the Field Super (read-only for crew assignment).
 */
export function CalendarBoard({ canAssign }: Props) {
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const jobcards = useAppStore((s) => s.jobcards);
  const jobs = useAppStore((s) => s.jobs);
  const assignJobcard = useAppStore((s) => s.assignJobcard);
  const unassignJobcard = useAppStore((s) => s.unassignJobcard);
  const deleteJobcard = useAppStore((s) => s.deleteJobcard);
  const flash = useAppStore((s) => s.flash);

  // Crews toggled OFF in the calendar view. Empty = every crew is visible, so
  // crews added later show up automatically until the scheduler hides them.
  const [hiddenCrewIds, setHiddenCrewIds] = useState<Set<string>>(new Set());
  // The crews a placed card is assigned to (the assign targets). Normally holds
  // exactly one; in "Assign Multiple" mode it can hold several.
  const [activeCrewIds, setActiveCrewIds] = useState<Set<string>>(new Set());
  // When on, tapping crews toggles them in/out of the assign-target set so a
  // placed card lands on every active crew at once.
  const [multiAssign, setMultiAssign] = useState(false);
  const [placingCardId, setPlacingCardId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());

  // Permanent crews plus every Daily Crew (one-day overrides), so daily crews
  // sit in the chip row and can be shown, hidden, and assigned to like any other
  // crew. Permanent crews stay first so their colors never shift.
  const allCrews = useMemo<(Crew | DailyCrew)[]>(
    () => [...crews, ...dailyCrews],
    [crews, dailyCrews]
  );

  // Distinct, stable color per crew for tinting cards and chips.
  const crewColorMap = useMemo(
    () => buildCrewColorMap(allCrews.map((c) => c.id)),
    [allCrews]
  );
  const colorForCrew = (crewId: string) => crewColorFrom(crewColorMap, crewId);

  const activeCrews = useMemo(
    () => allCrews.filter((c) => activeCrewIds.has(c.id)),
    [allCrews, activeCrewIds]
  );
  // The primary target, used for single-target visuals (banner tint, etc.).
  const activeCrew = activeCrews[0] ?? null;

  // Seed / repair the assign targets: drop stale ids (crew removed) and, when
  // the set empties, seed the first visible crew so there's always a target.
  useEffect(() => {
    setActiveCrewIds((prev) => {
      const valid = [...prev].filter((id) => allCrews.some((c) => c.id === id));
      if (valid.length === 0) {
        const firstVisible = allCrews.find((c) => !hiddenCrewIds.has(c.id));
        if (!firstVisible) return prev.size === 0 ? prev : new Set();
        return new Set([firstVisible.id]);
      }
      return valid.length === prev.size ? prev : new Set(valid);
    });
  }, [allCrews, hiddenCrewIds]);

  const setSoleActive = (id: string | null) =>
    setActiveCrewIds(id ? new Set([id]) : new Set());

  // Cycle a crew chip. In "Assign Multiple" mode a tap toggles the crew in/out
  // of the assign-target set (targets are always visible). Otherwise schedulers
  // get hidden → visible → active → hidden ("click to show, click again to make
  // it the assign target"); without assign rights it's a plain show/hide toggle.
  const cycleCrew = (id: string) => {
    if (multiAssign && canAssign) {
      setHiddenCrewIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setActiveCrewIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    if (hiddenCrewIds.has(id)) {
      // Hidden → visible.
      setHiddenCrewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setActiveCrewIds((prev) => (prev.size === 0 ? new Set([id]) : prev));
      return;
    }
    if (!canAssign) {
      // Visible → hidden (no assign target to cycle through).
      setHiddenCrewIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setActiveCrewIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    if (activeCrewIds.has(id)) {
      // Active → hidden; hand the active role to another visible crew (or none).
      const next = new Set(hiddenCrewIds);
      next.add(id);
      setHiddenCrewIds(next);
      setSoleActive(allCrews.find((c) => !next.has(c.id))?.id ?? null);
      return;
    }
    // Visible but not active → make it the sole assign target.
    setSoleActive(id);
  };

  // Toggle "Assign Multiple". Turning it off collapses back to a single target.
  const toggleMultiAssign = () => {
    setMultiAssign((on) => {
      if (on) {
        setActiveCrewIds((prev) => {
          const first = [...prev][0];
          return first ? new Set([first]) : prev;
        });
      }
      return !on;
    });
  };

  const jobNameFor = (jobId?: string) =>
    jobs.find((j) => j.id === jobId)?.name ?? 'Unlinked job';

  // Work Requests = jobcards with no assignment row anywhere.
  const unassigned = useMemo(
    () => jobcards.filter((c) => assignments.every((a) => a.jobcardId !== c.id)),
    [jobcards, assignments]
  );

  // Every assignment belonging to a visible (not toggled-off) crew.
  const visibleAssignments = useMemo(
    () => assignments.filter((a) => !hiddenCrewIds.has(a.crewId)),
    [assignments, hiddenCrewIds]
  );

  const assignToDate = (date: string) => {
    if (!placingCardId) return;
    if (activeCrews.length === 0) {
      flash(
        allCrews.length === 0
          ? 'Create a crew before assigning work.'
          : 'Tap a crew to make it the assign target first.',
        'warning'
      );
      return;
    }
    activeCrews.forEach((c) => assignJobcard(placingCardId, c.id, date));
    const card = jobcards.find((c) => c.id === placingCardId);
    setPlacingCardId(null);
    const names = activeCrews.map((c) => c.name).join(', ');
    flash(`Assigned "${card?.title ?? 'jobcard'}" to ${names}`, 'success');
  };

  // Removing a placed card from the calendar pulls it off EVERY crew it was
  // assigned to — a multi-crew placement is one logical placement, so unassigning
  // from one crew's view must not leave orphaned copies on the others.
  const handleUnassign = (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    if (!target) return;
    assignments
      .filter((a) => a.jobcardId === target.jobcardId)
      .forEach((a) => unassignJobcard(a.id));
  };

  const togglePlacing = (cardId: string) =>
    setPlacingCardId((prev) => (prev === cardId ? null : cardId));

  const handleDelete = (id: string) => {
    const title = jobcards.find((c) => c.id === id)?.title;
    deleteJobcard(id);
    flash(title ? `Jobcard "${title}" deleted` : 'Jobcard deleted', 'success');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          {allCrews.length === 0 ? (
            <Text style={styles.noCrews}>
              {canAssign
                ? 'No crews yet — create one to start scheduling.'
                : 'No crews yet.'}
            </Text>
          ) : (
            <>
              {canAssign && (
                <Pressable
                  onPress={toggleMultiAssign}
                  style={({ pressed }) => [
                    styles.multiBtn,
                    multiAssign && styles.multiBtnActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather
                    name="layers"
                    size={14}
                    color={multiAssign ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.multiText,
                      multiAssign && styles.multiTextActive,
                    ]}
                  >
                    Assign Multiple
                  </Text>
                </Pressable>
              )}
              {allCrews.map((crew) => (
                <CrewChip
                  key={crew.id}
                  crew={crew}
                  color={colorForCrew(crew.id)}
                  visible={!hiddenCrewIds.has(crew.id)}
                  active={canAssign && activeCrewIds.has(crew.id)}
                  dailyDate={'date' in crew ? crew.date : undefined}
                  onPress={() => cycleCrew(crew.id)}
                />
              ))}
            </>
          )}
        </View>
        {canAssign && (
          <Pressable
            style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
            onPress={() => setManageOpen(true)}
          >
            <Feather name="users" size={15} color={colors.textPrimary} />
            <Text style={styles.manageText}>Manage crews</Text>
          </Pressable>
        )}
      </View>
      {allCrews.length > 0 && (
        <Text style={styles.filterHint}>
          {!canAssign
            ? 'Tap a crew to show or hide it on the calendar.'
            : multiAssign
              ? 'Tap crews to add or remove them as assign targets — a placed card lands on all of them.'
              : 'Tap a crew to show it · tap again to make it the assign target · tap once more to hide it.'}
        </Text>
      )}

      <View style={styles.board}>
        <View style={styles.calCol}>
          <MonthCalendar
            month={month}
            onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setMonth((m) => addMonths(m, 1))}
            activeCrews={activeCrews}
            visibleAssignments={visibleAssignments}
            jobcards={jobcards}
            colorForCrew={colorForCrew}
            placing={canAssign && placingCardId !== null}
            onAssignToDate={assignToDate}
            onUnassign={handleUnassign}
            onOpenCard={setViewingId}
            canUnassign={canAssign}
          />
        </View>
        <View style={styles.backlogCol}>
          <Backlog
            cards={unassigned}
            jobNameFor={jobNameFor}
            placingCardId={placingCardId}
            onTogglePlacing={togglePlacing}
            onOpenCard={(card) => setViewingId(card.id)}
            canSchedule={canAssign}
            activeCrews={activeCrews.map((c) => ({
              id: c.id,
              name: c.name,
              color: colorForCrew(c.id),
            }))}
          />
        </View>
      </View>

      {canAssign && (
        <ManageCrewsModal
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
        />
      )}

      <JobcardQuickView
        jobcardId={viewingId}
        jobs={jobs}
        scheduled={
          viewingId != null && assignments.some((a) => a.jobcardId === viewingId)
        }
        onClose={() => setViewingId(null)}
        onDelete={handleDelete}
      />
    </View>
  );
}

/** A crew toggle: hidden → visible → active (assign target) → hidden. */
function CrewChip({
  crew,
  color,
  visible,
  active,
  dailyDate,
  onPress,
}: {
  crew: Crew;
  color: string;
  visible: boolean;
  active: boolean;
  /** yyyy-MM-dd when this is a Daily Crew, else undefined — drives the "Daily" tag. */
  dailyDate?: string;
  onPress: () => void;
}) {
  // The "Daily · date" tag only shows on hover to keep the chip row compact.
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
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
      {dailyDate && hovered && (
        <View style={[styles.dailyTag, { borderColor: withAlpha(color, 0.6) }]}>
          <Text style={[styles.dailyTagText, { color }]}>
            Daily · {format(parseISO(dailyDate), 'MMM d')}
          </Text>
        </View>
      )}
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
  dailyTag: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  dailyTagText: {
    fontFamily: fonts.semiBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  noCrews: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  multiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
  },
  multiText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  multiTextActive: {
    color: colors.primary,
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
