import { Feather } from '@expo/vector-icons';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import { WorkRequestQuickView } from '@/components/desktop/WorkRequestQuickView';
import { Backlog } from '@/components/desktop/scheduler/Backlog';
import { BacklogCalendar } from '@/components/desktop/scheduler/BacklogCalendar';
import {
  CalendarEventModal,
  EventModalState,
} from '@/components/desktop/scheduler/CalendarEventModal';
import { DaySidebar } from '@/components/desktop/scheduler/DaySidebar';
import {
  DragBoardProvider,
  DragItem,
  DropTarget,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { ManageCrewsModal } from '@/components/desktop/scheduler/ManageCrewsModal';
import { MonthCalendar } from '@/components/desktop/scheduler/MonthCalendar';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Crew, DailyCrew, WorkRequest } from '@/types';
import { buildCrewColorMap, crewColorFrom, withAlpha } from '@/utils/crewColors';
import { buildDayItems } from '@/utils/daySchedule';
import { workRequestJobsLabel } from '@/utils/workRequestJobs';

interface Props {
  /**
   * Whether the viewer may place work onto crews. Schedulers can; Field Supers
   * share the same board read-only for crew assignment (they still open and edit
   * work requests), so the Schedule / unassign / Manage crews controls are hidden.
   */
  canAssign: boolean;
  /**
   * Jump the calendar to this day's month and flash the day for a few seconds
   * (the work requests page's "View on calendar" link). yyyy-MM-dd.
   */
  highlightDate?: string;
  /** Changes on every jump so repeating the same date re-fires the flash. */
  highlightNonce?: string;
  /**
   * Open this work request's quick view on arrival (a "New Priority Work Request"
   * notification click). Ignored when the id no longer matches a card.
   */
  openCardId?: string;
  /** Changes on every jump so re-clicking the same notification re-opens it. */
  openCardNonce?: string;
}

/**
 * The month calendar + Work Requests board. Shared by the Scheduler
 * (`canAssign`) and the Field Super (read-only for crew assignment).
 */
export function CalendarBoard({
  canAssign,
  highlightDate,
  highlightNonce,
  openCardId,
  openCardNonce,
}: Props) {
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const workRequests = useAppStore((s) => s.workRequests);
  const jobs = useAppStore((s) => s.jobs);
  const assignWorkRequest = useAppStore((s) => s.assignWorkRequest);
  const unassignWorkRequest = useAppStore((s) => s.unassignWorkRequest);
  const deleteWorkRequest = useAppStore((s) => s.deleteWorkRequest);
  const updateWorkRequest = useAppStore((s) => s.updateWorkRequest);
  const calendarEvents = useAppStore((s) => s.calendarEvents);
  const updateCalendarEvent = useAppStore((s) => s.updateCalendarEvent);
  const reorderDaySchedule = useAppStore((s) => s.reorderDaySchedule);
  const flash = useAppStore((s) => s.flash);
  const role = useCurrentRole();

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
  // The Work Requests column expanded in place into its large month-calendar
  // view (the crew calendar squeezes down to make room).
  const [backlogExpanded, setBacklogExpanded] = useState(false);
  // The day whose schedule shows in the sidebar, or null when closed.
  const [dayFocus, setDayFocus] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  // The Event popup: creating on a day, or viewing/editing an existing one.
  const [eventModal, setEventModal] = useState<EventModalState | null>(null);
  // A work request popup's parent-job link opens the job dashboard OVER the popup;
  // its back arrow returns to the (still-open) work request.
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());
  // The day currently flashing from a "View on calendar" jump (clears itself).
  const [flashDate, setFlashDate] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightDate) return;
    void highlightNonce; // dep only — a repeat jump to the same date re-fires
    setMonth(parseISO(highlightDate));
    setFlashDate(highlightDate);
    const timer = setTimeout(() => setFlashDate(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightDate, highlightNonce]);

  // A notification click lands here with the work request to open (skips ids that
  // no longer resolve — e.g. the card was deleted since the ping).
  useEffect(() => {
    if (!openCardId) return;
    void openCardNonce; // dep only — re-clicking the same notification re-opens
    if (useAppStore.getState().workRequests.some((c) => c.id === openCardId)) {
      setViewingId(openCardId);
    }
  }, [openCardId, openCardNonce]);

  // 0 = collapsed layout, 1 = expanded. Animates the two columns' flex so the
  // Work Requests container visibly grows leftward across the board.
  const expandAnim = useRef(new Animated.Value(0)).current;
  // Expanded, the two calendars split the board 50/50 (equal flex).
  const calFlex = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 1],
  });
  const backlogFlex = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1],
  });
  const backlogMaxWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [360, 4000],
  });

  // The expanded requests calendar and the day sidebar share the board's width,
  // so opening one closes the other. Expanding also cancels a pending placement
  // (its "Placing" indicator lives in the hidden list).
  const toggleBacklogExpanded = (open: boolean) => {
    setBacklogExpanded(open);
    if (open) {
      setDayFocus(null);
      setPlacingCardId(null);
    }
    Animated.timing(expandAnim, {
      toValue: open ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const openDay = (date: string) => {
    setDayFocus(date);
    if (backlogExpanded) toggleBacklogExpanded(false);
  };

  // Permanent crews plus every Daily Crew (one-day overrides), so daily crews
  // sit in the chip row and can be shown, hidden, and assigned to like any other
  // crew. Permanent crews stay first so their colors never shift.
  const allCrews = useMemo<(Crew | DailyCrew)[]>(
    () => [...crews, ...dailyCrews],
    [crews, dailyCrews]
  );

  // Calendar tags show just the crew's letter — legacy names like "Crew A"
  // drop the "Crew" prefix (new names are single letters already).
  const crewTagFor = (crewId: string) => {
    const name = allCrews.find((c) => c.id === crewId)?.name ?? '?';
    return name.replace(/^crew\s+/i, '');
  };

  // Distinct, stable color per crew for tinting cards and chips (a crew's
  // scheduler-picked color wins over the automatic palette).
  const crewColorMap = useMemo(() => buildCrewColorMap(allCrews), [allCrews]);
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

  const jobNameFor = (card: WorkRequest) =>
    workRequestJobsLabel(card, jobs) || 'No parent job';

  // Work Requests = work requests with no assignment row anywhere.
  const unassigned = useMemo(
    () => workRequests.filter((c) => assignments.every((a) => a.workRequestId !== c.id)),
    [workRequests, assignments]
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
    activeCrews.forEach((c) => assignWorkRequest(placingCardId, c.id, date));
    const card = workRequests.find((c) => c.id === placingCardId);
    setPlacingCardId(null);
    const names = activeCrews.map((c) => c.name).join(', ');
    flash(`Assigned "${card?.title ?? 'work request'}" to ${names}`, 'success');
  };

  // Removing a placed card from the calendar pulls it off EVERY crew it was
  // assigned to — a multi-crew placement is one logical placement, so unassigning
  // from one crew's view must not leave orphaned copies on the others.
  const handleUnassign = (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    if (!target) return;
    assignments
      .filter((a) => a.workRequestId === target.workRequestId)
      .forEach((a) => unassignWorkRequest(a.id));
  };

  const togglePlacing = (cardId: string) =>
    setPlacingCardId((prev) => (prev === cardId ? null : cardId));

  const handleDelete = (id: string) => {
    const title = workRequests.find((c) => c.id === id)?.title;
    deleteWorkRequest(id);
    flash(title ? `Work Request "${title}" deleted` : 'Work Request deleted', 'success');
  };

  // Drag & drop is a scheduler tool on the web console (mouse-driven); field
  // supers and native fall back to plain taps.
  const dragEnabled = canAssign && Platform.OS === 'web';

  /**
   * Renumber `date`'s schedule with `moved` inserted at `index` (the index
   * is counted against the day's items EXCLUDING the moved one — exactly how
   * the drag layer computed it). Reads fresh store state: the drop handler
   * may have just created/moved assignments synchronously.
   */
  const applyDayOrder = (
    date: string,
    moved: { kind: 'request' | 'event'; id: string },
    index: number
  ) => {
    const s = useAppStore.getState();
    const items = buildDayItems(
      s.assignments.filter((a) => a.date === date),
      s.workRequests,
      s.calendarEvents.filter((e) => e.date === date)
    )
      .map((item) => ({
        kind: item.kind,
        id: item.kind === 'request' ? item.card.id : item.event.id,
      }))
      .filter((item) => !(item.kind === moved.kind && item.id === moved.id));
    const clamped = Math.max(0, Math.min(index, items.length));
    items.splice(clamped, 0, moved);
    reorderDaySchedule(date, items);
  };

  /** Every completed drag lands here (see DragBoard's DropTarget). */
  const handleDrop = (item: DragItem, target: DropTarget) => {
    if (item.kind === 'event') {
      // Events live on days — the pool is not a valid target for them.
      if (target.kind !== 'day') {
        flash('Events sit on calendar days — drop them on a day.', 'info');
        return;
      }
      const event = calendarEvents.find((e) => e.id === item.id);
      if (!event) return;
      if (event.date !== target.date) {
        updateCalendarEvent(item.id, { date: target.date });
      }
      applyDayOrder(target.date, { kind: 'event', id: item.id }, target.index);
      return;
    }

    const card = workRequests.find((c) => c.id === item.id);
    if (!card) return;
    const existing = assignments.filter((a) => a.workRequestId === item.id);

    if (target.kind === 'backlog') {
      // Into the pool = off the calendar entirely (every crew, every date).
      if (existing.length === 0) return;
      existing.forEach((a) => unassignWorkRequest(a.id));
      flash(`"${card.title}" moved back to Work Requests`, 'success');
      return;
    }

    if (target.kind === 'backlog-day') {
      // A specific pool day: unassign (if placed) and retarget the request.
      existing.forEach((a) => unassignWorkRequest(a.id));
      if (card.date !== target.date) {
        updateWorkRequest(item.id, { date: target.date });
      }
      flash(
        existing.length > 0
          ? `"${card.title}" unassigned — target date ${target.date}`
          : `"${card.title}" target date moved to ${target.date}`,
        'success'
      );
      return;
    }

    // A crew-calendar (or day-sidebar) day.
    if (existing.length > 0) {
      // Move: keep the same crews, land on the new date. A shared card moves
      // everywhere at once (same rule as unassigning).
      const crewIds = [...new Set(existing.map((a) => a.crewId))];
      existing
        .filter((a) => a.date !== target.date)
        .forEach((a) => unassignWorkRequest(a.id));
      crewIds.forEach((crewId) => assignWorkRequest(item.id, crewId, target.date));
    } else {
      // From the pool: same crew-target rules as the Schedule button.
      if (activeCrews.length === 0) {
        flash(
          allCrews.length === 0
            ? 'Create a crew before assigning work.'
            : 'Tap a crew to make it the assign target first.',
          'warning'
        );
        return;
      }
      activeCrews.forEach((c) => assignWorkRequest(item.id, c.id, target.date));
      const names = activeCrews.map((c) => c.name).join(', ');
      flash(`Assigned "${card.title}" to ${names}`, 'success');
    }
    applyDayOrder(target.date, { kind: 'request', id: item.id }, target.index);
  };

  return (
    <DragBoardProvider enabled={dragEnabled} onDrop={handleDrop}>
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
                    color={
                      multiAssign ? colors.textPrimary : colors.textSecondary
                    }
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
          <View style={styles.toolbarRight}>
            <Pressable
              style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
              onPress={() =>
                setEventModal({
                  mode: 'create',
                  date: format(new Date(), 'yyyy-MM-dd'),
                })
              }
            >
              <Feather name="plus" size={15} color={colors.textPrimary} />
              <Text style={styles.manageText}>Event</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.manageBtn, pressed && styles.pressed]}
              onPress={() => setManageOpen(true)}
            >
              <Feather name="users" size={15} color={colors.textPrimary} />
              <Text style={styles.manageText}>Manage crews</Text>
            </Pressable>
          </View>
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
        <Animated.View style={[styles.calCol, { flex: calFlex }]}>
          <MonthCalendar
            month={month}
            onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setMonth((m) => addMonths(m, 1))}
            activeCrews={activeCrews}
            visibleAssignments={visibleAssignments}
            workRequests={workRequests}
            calendarEvents={calendarEvents}
            colorForCrew={colorForCrew}
            placing={canAssign && placingCardId !== null}
            onAssignToDate={assignToDate}
            onUnassign={handleUnassign}
            onOpenDay={openDay}
            highlightDate={flashDate}
            onOpenCard={(id) => {
              // Opening a card from the main calendar also closes the day
              // sidebar.
              setViewingId(id);
              setDayFocus(null);
            }}
            onOpenEvent={(id) => setEventModal({ mode: 'view', eventId: id })}
            canUnassign={canAssign}
            canAssign={canAssign}
            crewNameFor={crewTagFor}
          />
        </Animated.View>

        {dayFocus != null && (
          <DaySidebar
            date={dayFocus}
            assignments={visibleAssignments.filter((a) => a.date === dayFocus)}
            workRequests={workRequests}
            calendarEvents={calendarEvents}
            jobNameFor={jobNameFor}
            colorForCrew={colorForCrew}
            crewNameFor={crewTagFor}
            onOpenCard={setViewingId}
            onOpenEvent={(id) => setEventModal({ mode: 'view', eventId: id })}
            onCreateEvent={
              canAssign
                ? () => setEventModal({ mode: 'create', date: dayFocus })
                : undefined
            }
            onClose={() => setDayFocus(null)}
          />
        )}

        <Animated.View
          style={[
            styles.backlogCol,
            { flex: backlogFlex, maxWidth: backlogMaxWidth },
          ]}
        >
          <BacklogDropColumn>
          {backlogExpanded ? (
            <BacklogCalendar
              cards={unassigned}
              jobNameFor={jobNameFor}
              onOpenCard={(card) => setViewingId(card.id)}
              onCollapse={() => toggleBacklogExpanded(false)}
            />
          ) : (
            <Backlog
              cards={unassigned}
              jobNameFor={jobNameFor}
              placingCardId={placingCardId}
              onTogglePlacing={togglePlacing}
              onOpenCard={(card) => setViewingId(card.id)}
              onExpandCalendar={() => toggleBacklogExpanded(true)}
              canSchedule={canAssign}
              activeCrews={activeCrews.map((c) => ({
                id: c.id,
                name: c.name,
                color: colorForCrew(c.id),
              }))}
            />
          )}
          </BacklogDropColumn>
        </Animated.View>
      </View>

      {canAssign && (
        <ManageCrewsModal
          visible={manageOpen}
          onClose={() => setManageOpen(false)}
        />
      )}

      <CalendarEventModal
        state={eventModal}
        canEdit={canAssign}
        onClose={() => setEventModal(null)}
      />

      <WorkRequestQuickView
        workRequestId={viewingId}
        jobs={jobs}
        onClose={() => {
          setViewingId(null);
          setViewingJobId(null);
        }}
        onDelete={handleDelete}
        onOpenJob={setViewingJobId}
      />

      {/* The popup's parent-job link opens the job dashboard over it (its own
          Modal stacks above the popup's); back returns to the work request. */}
      {viewingJobId != null && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setViewingJobId(null)}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setViewingJobId(null)}
          />
          <JobDashboardSidebar
            job={jobs.find((j) => j.id === viewingJobId) ?? null}
            onClose={() => setViewingJobId(null)}
            onBack={() => setViewingJobId(null)}
            editable={role === 'field_super'}
            // Both roles that render this board (Scheduler + Field Super) may
            // set flashing material and create work requests; RLS matches.
            canEditFlashing
            canCreateWorkRequests
            quickViewJobs={jobs}
            onOpenJob={setViewingJobId}
          />
        </Modal>
      )}
    </View>
    </DragBoardProvider>
  );
}

/**
 * The Work Requests column as a drop target: dragging a placed request onto
 * it (list or expanded calendar, outside a specific pool day) pulls it off
 * the calendar entirely. Day cells inside register their own higher-priority
 * zones, so they win when the pointer is over one.
 */
function BacklogDropColumn({ children }: { children: ReactNode }) {
  const { ref, hovered } = useDropZone('backlog', {
    type: 'backlog',
    priority: 1,
  });
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.backlogDropWrap, hovered && styles.backlogDropHover]}
    >
      {children}
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

const styles = themed(() => StyleSheet.create({
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
    borderColor: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
  },
  multiText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  multiTextActive: {
    color: colors.textPrimary,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backlogDropWrap: {
    flex: 1,
    borderRadius: radii.lg,
  },
  backlogDropHover: {
    // A subtle outline says "drop here to unassign".
    borderWidth: 2,
    borderColor: colors.primary,
    margin: -2,
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
}));
