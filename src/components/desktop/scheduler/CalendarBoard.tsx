import { Feather } from '@expo/vector-icons';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  subMonths,
} from 'date-fns';
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

import { CalendarTaskSheet } from '@/components/CalendarTaskSheet';
import { JobDashboardSidebar } from '@/components/desktop/JobDashboardSidebar';
import {
  NewWorkRequestInput,
  WorkRequestQuickView,
} from '@/components/desktop/WorkRequestQuickView';
import { Backlog } from '@/components/desktop/scheduler/Backlog';
import { BacklogCalendar } from '@/components/desktop/scheduler/BacklogCalendar';
import { DaySidebar } from '@/components/desktop/scheduler/DaySidebar';
import {
  DragBoardProvider,
  DragItem,
  DropTarget,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { ManageCrewsModal } from '@/components/desktop/scheduler/ManageCrewsModal';
import { MonthCalendar } from '@/components/desktop/scheduler/MonthCalendar';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
  useMyCalendarTasks,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Crew, DailyCrew, WorkRequest } from '@/types';
import { buildCrewColorMap, crewColorFrom, withAlpha } from '@/utils/crewColors';
import { dailyCrewInitials } from '@/utils/dailyCrewName';
import { buildDayItems } from '@/utils/daySchedule';
import { activeJobs, activeWorkRequests } from '@/utils/jobArchive';
import { newWorkRequestPayload } from '@/utils/workRequestCreate';
import { workRequestJobsLabel } from '@/utils/workRequestJobs';

/** Width of a Field Super's shrunken crew calendar (the arrow strip). */
const STRIP_W = 48;

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
  /**
   * Reveal this work request on the board ("Show in calendar" from the quick
   * view): jump to the month it's scheduled in — or, when unscheduled, expand
   * the Work Requests calendar on its target month — and blink its chip.
   */
  showCardId?: string;
  /** Changes on every reveal so repeating the same card re-fires it. */
  showCardNonce?: string;
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
  showCardId,
  showCardNonce,
}: Props) {
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const workers = useAppStore((s) => s.workers);
  const assignments = useAppStore((s) => s.assignments);
  const allWorkRequests = useAppStore((s) => s.workRequests);
  const jobs = useAppStore((s) => s.jobs);
  // Archived jobs' cards vanish from the whole board (calendar, pool, day
  // sidebar) — they live only behind the jobs pages' Archived section.
  const workRequests = useMemo(
    () => activeWorkRequests(allWorkRequests, jobs),
    [allWorkRequests, jobs]
  );
  const assignWorkRequest = useAppStore((s) => s.assignWorkRequest);
  const unassignWorkRequest = useAppStore((s) => s.unassignWorkRequest);
  const deleteWorkRequest = useAppStore((s) => s.deleteWorkRequest);
  const updateWorkRequest = useAppStore((s) => s.updateWorkRequest);
  const addWorkRequest = useAppStore((s) => s.addWorkRequest);
  const updateCalendarTask = useAppStore((s) => s.updateCalendarTask);
  const reorderDaySchedule = useAppStore((s) => s.reorderDaySchedule);
  const flash = useAppStore((s) => s.flash);
  const role = useCurrentRole();
  const me = useCurrentWorker();

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
  // A work request popup's parent-job link opens the job dashboard OVER the popup;
  // its back arrow returns to the (still-open) work request.
  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());
  // The day currently flashing from a "View on calendar" jump (clears itself).
  const [flashDate, setFlashDate] = useState<string | null>(null);
  // A day cell's hover-＋ was clicked: the creation popup opens with this
  // target date preset (null = closed). `assign` = it came from the MAIN
  // calendar, so the created card also schedules onto the active crew(s)
  // that day (the pool calendar's ＋ just targets the date).
  const [createTarget, setCreateTarget] = useState<{
    date: string;
    assign: boolean;
  } | null>(null);
  // The Field Super's calendar task sheet: a day cell's hover-＋ opens it
  // for creation on that day; clicking a task chip opens that task to edit.
  const [taskSheet, setTaskSheet] = useState<{
    date: string;
    taskId?: string;
  } | null>(null);
  // The viewer's own calendar tasks (Field Super) — day notes with optional
  // checklists and reminders, rendered as chips on the main calendar.
  const myCalendarTasks = useMyCalendarTasks();
  const showTasks = role === 'field_super';
  const openTaskSheet = taskSheet?.taskId
    ? (myCalendarTasks.find((t) => t.id === taskSheet.taskId) ?? null)
    : null;
  // The card whose chip is blinking from a "Show in calendar" reveal, and the
  // month the pool calendar should jump to for an unscheduled one.
  const [flashCard, setFlashCard] = useState<{
    id: string;
    nonce: string;
  } | null>(null);
  const [backlogFocusDate, setBacklogFocusDate] = useState<string | null>(null);

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

  // "Show in calendar": get the card visibly on the board, then blink its
  // chip. Scheduled → the crew calendar on its (next) scheduled month, pool
  // calendar collapsed out of the way. Unscheduled → the pool's expanded
  // calendar on the card's target month. Either way the quick view closes —
  // it would cover the reveal.
  useEffect(() => {
    if (!showCardId || !showCardNonce) return;
    const s = useAppStore.getState();
    const card = s.workRequests.find((c) => c.id === showCardId);
    if (!card) return;
    setViewingId(null);
    setViewingJobId(null);
    setDayFocus(null);
    const dates = [
      ...new Set(
        s.assignments
          .filter((a) => a.workRequestId === showCardId)
          .map((a) => a.date)
      ),
    ].sort();
    if (dates.length > 0) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const target = dates.find((d) => d >= today) ?? dates[dates.length - 1];
      setMonth(parseISO(target));
      toggleBacklogExpanded(false);
      // A hidden crew's chips don't render — un-hide the card's crews so the
      // reveal actually has something to blink.
      const cardCrewIds = new Set(
        s.assignments
          .filter((a) => a.workRequestId === showCardId)
          .map((a) => a.crewId)
      );
      setHiddenCrewIds((prev) => {
        const next = [...prev].filter((id) => !cardCrewIds.has(id));
        return next.length === prev.size ? prev : new Set(next);
      });
    } else {
      const target = card.date || format(new Date(), 'yyyy-MM-dd');
      setBacklogFocusDate(target);
      toggleBacklogExpanded(true);
    }
    setFlashCard({ id: showCardId, nonce: showCardNonce });
    // Long enough for the blink + fade; then the overlay unmounts.
    const timer = setTimeout(() => setFlashCard(null), 4000);
    return () => clearTimeout(timer);
    // toggleBacklogExpanded is stable-in-behavior; re-running on it would
    // re-fire the reveal on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCardId, showCardNonce]);

  // 0 = collapsed layout, 1 = expanded. Animates the two columns' flex so the
  // Work Requests container visibly grows leftward across the board.
  const expandAnim = useRef(new Animated.Value(0)).current;
  // Expanded, the Scheduler's two calendars split the board 50/50 (equal
  // flex) — they drag requests across. Field Supers don't, so THEIR expanded
  // Work Requests calendar takes (almost) the whole board: the crew calendar
  // shrinks to a slim strip with just an arrow to bring it back.
  const stripMode = !canAssign;
  const calFlex = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, stripMode ? 0.0001 : 1],
  });
  const calMinWidth = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, stripMode ? STRIP_W : 0],
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

  // The calendar chips' hover crew line is tight — a DAILY crew shows as its
  // members' initials ("BW & TB") instead of the full auto-name ("Brandon W &
  // Timothy B"). Permanent crews keep their letter.
  const crewHoverTagFor = (crewId: string) => {
    const daily = dailyCrews.find((c) => c.id === crewId);
    if (daily) return dailyCrewInitials(daily.installerIds, workers, daily.name);
    return crewTagFor(crewId);
  };

  // Distinct, stable color per crew for tinting cards and chips (a crew's
  // scheduler-picked color wins over the automatic palette).
  const crewColorMap = useMemo(() => buildCrewColorMap(allCrews), [allCrews]);
  const colorForCrew = (crewId: string) => crewColorFrom(crewColorMap, crewId);

  const activeCrews = useMemo(
    () => allCrews.filter((c) => activeCrewIds.has(c.id)),
    [allCrews, activeCrewIds]
  );

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

  // The crews pencilled in on a card ("fake assigned" while it sits in the
  // pool) — ids of removed crews are dropped, never shown or assigned.
  const plannedCrewIdsFor = (card: WorkRequest) =>
    (card.plannedCrewIds ?? []).filter((id) =>
      allCrews.some((c) => c.id === id)
    );

  // The crews a pool card lands on when it's scheduled: its pencilled-in
  // crews when it has any, else the board's assign target(s).
  const targetCrewsFor = (card: WorkRequest): (Crew | DailyCrew)[] => {
    const planned = plannedCrewIdsFor(card);
    return planned.length > 0
      ? allCrews.filter((c) => planned.includes(c.id))
      : activeCrews;
  };

  /**
   * The run of days a pool card covers once it lands on `start`: its target
   * span's length (date…endDate) carries over, so a request planned as three
   * days schedules as three days.
   */
  const spanDaysFrom = (card: WorkRequest, start: string) => {
    const length =
      card.endDate && card.endDate > card.date
        ? differenceInCalendarDays(parseISO(card.endDate), parseISO(card.date))
        : 0;
    return eachDayOfInterval({
      start: parseISO(start),
      end: addDays(parseISO(start), length),
    }).map((d) => format(d, 'yyyy-MM-dd'));
  };

  // Creation scope for the hover-＋ popup: a Field Super creates only within
  // their own jobs; the Scheduler within every active job.
  const creationJobs = useMemo(() => {
    const active = activeJobs(jobs);
    return role === 'field_super' && me
      ? jobsForFieldSuper(active, me.id)
      : active;
  }, [jobs, role, me]);

  const handleCreate = (input: NewWorkRequestInput) => {
    const created = addWorkRequest(newWorkRequestPayload(input, jobs));
    // The main calendar's ＋ also schedules the new card right onto the
    // clicked day, assigned to the current assign target crew(s).
    if (createTarget?.assign && canAssign && activeCrews.length > 0) {
      activeCrews.forEach((c) =>
        assignWorkRequest(created.id, c.id, createTarget.date)
      );
      const names = activeCrews.map((c) => c.name).join(', ');
      flash(
        `Work Request "${input.title}" created — assigned to ${names}`,
        'success'
      );
      return;
    }
    if (createTarget?.assign && canAssign) {
      // No assign target picked — the card still exists, just unscheduled.
      flash(
        `Work Request "${input.title}" created in the pool — tap a crew to make it the assign target, then schedule it.`,
        'warning'
      );
      return;
    }
    flash(`Work Request "${input.title}" created`, 'success');
  };

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
    const card = workRequests.find((c) => c.id === placingCardId);
    if (!card) return;
    // A pencilled-in crew wins over the board's assign target(s).
    const targets = targetCrewsFor(card);
    if (targets.length === 0) {
      flash(
        allCrews.length === 0
          ? 'Create a crew before assigning work.'
          : 'Tap a crew to make it the assign target first.',
        'warning'
      );
      return;
    }
    const days = spanDaysFrom(card, date);
    targets.forEach((c) =>
      days.forEach((d) => assignWorkRequest(card.id, c.id, d))
    );
    setPlacingCardId(null);
    const names = targets.map((c) => c.name).join(', ');
    flash(`Assigned "${card.title}" to ${names}`, 'success');
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

  // "Pencil in" from the pool list: plan the board's assign target(s) on the
  // card WITHOUT scheduling it — or, on an already-planned card, clear the
  // plan. The card stays in Work Requests either way; it lands on the
  // pencilled-in crew(s) when it's finally moved onto the calendar.
  const handlePlanCrews = (cardId: string) => {
    const card = workRequests.find((c) => c.id === cardId);
    if (!card) return;
    if (plannedCrewIdsFor(card).length > 0) {
      updateWorkRequest(cardId, { plannedCrewIds: undefined });
      flash(`"${card.title}" — pencilled-in crew cleared`, 'success');
      return;
    }
    if (activeCrews.length === 0) {
      flash(
        allCrews.length === 0
          ? 'Create a crew before pencilling in work.'
          : 'Tap a crew to make it the assign target first.',
        'warning'
      );
      return;
    }
    updateWorkRequest(cardId, {
      plannedCrewIds: activeCrews.map((c) => c.id),
    });
    const names = activeCrews.map((c) => c.name).join(', ');
    flash(
      `"${card.title}" pencilled in for ${names} — it stays in Work Requests until it's moved over`,
      'success'
    );
  };

  // Drag & drop lives on the web console (mouse-driven); native falls back to
  // plain taps. The Scheduler drags work requests; a Field Super drags only
  // their own calendar task chips (`allowDrag` keeps their work requests put).
  const dragEnabled = Platform.OS === 'web' && (canAssign || showTasks);
  const allowDrag = (item: DragItem) =>
    item.kind === 'task' ? showTasks : canAssign;

  /**
   * Renumber `date`'s schedule with the moved request inserted at `index`
   * (the index is counted against the day's items EXCLUDING the moved one —
   * exactly how the drag layer computed it). Reads fresh store state: the
   * drop handler may have just created/moved assignments synchronously.
   */
  const applyDayOrder = (date: string, movedId: string, index: number) => {
    const s = useAppStore.getState();
    const ids = buildDayItems(
      s.assignments.filter((a) => a.date === date),
      s.workRequests
    )
      .map((item) => item.card.id)
      .filter((id) => id !== movedId);
    const clamped = Math.max(0, Math.min(index, ids.length));
    ids.splice(clamped, 0, movedId);
    reorderDaySchedule(date, ids);
  };

  /**
   * Rewrite a placed request's covered days to exactly `start`…`end` on every
   * crew it's assigned to: missing day rows are created (assign is idempotent)
   * and rows outside the range are removed. This is what keeps a stretched
   * request CONTIGUOUS — every write path funnels through a full range.
   */
  const applySpan = (workRequestId: string, start: string, end: string) => {
    const s = useAppStore.getState();
    const rows = s.assignments.filter((a) => a.workRequestId === workRequestId);
    const crewIds = [...new Set(rows.map((a) => a.crewId))];
    const wanted = new Set(
      eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map(
        (d) => format(d, 'yyyy-MM-dd')
      )
    );
    rows
      .filter((a) => !wanted.has(a.date))
      .forEach((a) => unassignWorkRequest(a.id));
    crewIds.forEach((crewId) =>
      wanted.forEach((date) => assignWorkRequest(workRequestId, crewId, date))
    );
  };

  /** Every completed drag lands here (see DragBoard's DropTarget). */
  const handleDrop = (item: DragItem, target: DropTarget) => {
    if (item.kind === 'task') {
      // A Field Super's calendar task: dropping on a day (main calendar or
      // the day sidebar) moves it to that day. A reminder keeps its time of
      // day but follows the task to the new date.
      const task = myCalendarTasks.find((t) => t.id === item.id);
      if (!task) return;
      if (target.kind !== 'day') {
        flash('Drop the task on a calendar day.', 'info');
        return;
      }
      if (target.date === task.date) return;
      let reminderAt = task.reminderAt;
      let reminderDropped = false;
      if (task.reminderAt) {
        const old = parseISO(task.reminderAt);
        const moved = parseISO(target.date);
        moved.setHours(old.getHours(), old.getMinutes(), 0, 0);
        if (moved.getTime() <= Date.now()) {
          // The new date+time is already behind us — the sweep would fire
          // it on its next pass, so the reminder comes off instead.
          reminderAt = undefined;
          reminderDropped = true;
        } else {
          reminderAt = moved.toISOString();
        }
      }
      updateCalendarTask(item.id, {
        date: target.date,
        ...(reminderAt !== task.reminderAt ? { reminderAt } : {}),
      });
      const dayLabel = format(parseISO(target.date), 'EEEE, MMM d');
      flash(
        reminderDropped
          ? `Task "${task.title}" moved to ${dayLabel} — its reminder was removed (that time has passed)`
          : `Task "${task.title}" moved to ${dayLabel}`,
        reminderDropped ? 'warning' : 'success'
      );
      return;
    }

    const card = workRequests.find((c) => c.id === item.id);
    if (!card) return;
    const existing = assignments.filter((a) => a.workRequestId === item.id);

    if (item.kind === 'resize') {
      if (existing.length === 0) {
        // An UNSCHEDULED request's grip re-dates the END of its target span
        // on the Work Requests calendar (never before its target date — that
        // collapses back to one day).
        if (target.kind !== 'backlog-day') {
          flash(
            'Drop the stretch handle on a day of the Work Requests calendar.',
            'info'
          );
          return;
        }
        const end = target.date < card.date ? card.date : target.date;
        const nextEnd = end === card.date ? undefined : end;
        if (nextEnd !== card.endDate) {
          updateWorkRequest(item.id, { endDate: nextEnd });
        }
        flash(
          nextEnd
            ? `"${card.title}" planned ${card.date} – ${end}`
            : `"${card.title}" planned for ${card.date} only`,
          'success'
        );
        return;
      }
      // The stretch grip: dropping on a day re-dates the END of the request's
      // stretch (never before its start — that collapses back to one day).
      if (target.kind !== 'day') {
        flash('Drop the stretch handle on a calendar day.', 'info');
        return;
      }
      const start = existing.map((a) => a.date).sort()[0];
      const end = target.date < start ? start : target.date;
      applySpan(item.id, start, end);
      flash(
        end === start
          ? `"${card.title}" scheduled for ${start} only`
          : `"${card.title}" stretched ${start} – ${end}`,
        'success'
      );
      return;
    }

    if (target.kind === 'backlog') {
      // Into the pool = off the calendar entirely (every crew, every date).
      if (existing.length === 0) return;
      existing.forEach((a) => unassignWorkRequest(a.id));
      flash(`"${card.title}" moved back to Work Requests`, 'success');
      return;
    }

    if (target.kind === 'backlog-day') {
      // A specific pool day: unassign (if placed) and retarget the request,
      // keeping its length — a 3-day stretch stays 3 days in the pool.
      const dates =
        existing.length > 0
          ? [...new Set(existing.map((a) => a.date))].sort()
          : [
              card.date,
              card.endDate && card.endDate > card.date
                ? card.endDate
                : card.date,
            ];
      const length = differenceInCalendarDays(
        parseISO(dates[dates.length - 1]),
        parseISO(dates[0])
      );
      existing.forEach((a) => unassignWorkRequest(a.id));
      const nextEnd =
        length > 0
          ? format(addDays(parseISO(target.date), length), 'yyyy-MM-dd')
          : undefined;
      if (card.date !== target.date || card.endDate !== nextEnd) {
        updateWorkRequest(item.id, { date: target.date, endDate: nextEnd });
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
      // Move: keep the same crews, land the stretch's START on the new date —
      // a request spanning 3 days spans 3 days wherever it's dropped. A shared
      // card moves everywhere at once (same rule as unassigning).
      const dates = [...new Set(existing.map((a) => a.date))].sort();
      const length = differenceInCalendarDays(
        parseISO(dates[dates.length - 1]),
        parseISO(dates[0])
      );
      applySpan(
        item.id,
        target.date,
        format(addDays(parseISO(target.date), length), 'yyyy-MM-dd')
      );
    } else {
      // From the pool: its pencilled-in crew(s) if any, else the same
      // crew-target rules as the Schedule button. Its target span's length
      // carries over (a 3-day pool stretch schedules as 3 days).
      const targets = targetCrewsFor(card);
      if (targets.length === 0) {
        flash(
          allCrews.length === 0
            ? 'Create a crew before assigning work.'
            : 'Tap a crew to make it the assign target first.',
          'warning'
        );
        return;
      }
      const days = spanDaysFrom(card, target.date);
      targets.forEach((c) =>
        days.forEach((d) => assignWorkRequest(item.id, c.id, d))
      );
      const names = targets.map((c) => c.name).join(', ');
      flash(`Assigned "${card.title}" to ${names}`, 'success');
    }
    applyDayOrder(target.date, item.id, target.index);
  };

  return (
    <DragBoardProvider enabled={dragEnabled} allow={allowDrag} onDrop={handleDrop}>
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
                  daily={dailyCrews.some((dc) => dc.id === crew.id)}
                  calendar={'isCalendar' in crew && !!crew.isCalendar}
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
        <Animated.View
          style={[styles.calCol, { flex: calFlex, minWidth: calMinWidth }]}
        >
          {stripMode && backlogExpanded ? (
            <CollapsedCalendarStrip
              month={month}
              onExpand={() => toggleBacklogExpanded(false)}
            />
          ) : (
          <MonthCalendar
            month={month}
            onPrevMonth={() => setMonth((m) => subMonths(m, 1))}
            onNextMonth={() => setMonth((m) => addMonths(m, 1))}
            onSelectMonth={setMonth}
            activeCrews={activeCrews}
            visibleAssignments={visibleAssignments}
            workRequests={workRequests}
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
            canUnassign={canAssign}
            canAssign={canAssign}
            crewNameFor={crewHoverTagFor}
            jobNameFor={jobNameFor}
            // The main calendar's hover-＋: the Scheduler creates a work
            // request scheduled onto that day; the Field Super (read-only for
            // crews — they create work requests from the pool calendar) adds a
            // calendar TASK on that day instead.
            onCreateRequest={
              canAssign
                ? (date) => setCreateTarget({ date, assign: true })
                : showTasks
                  ? (date) => setTaskSheet({ date })
                  : undefined
            }
            createLabel={
              canAssign ? undefined : showTasks ? 'Add a task on this day' : undefined
            }
            calendarTasks={showTasks ? myCalendarTasks : undefined}
            onOpenTask={(id) => {
              const task = myCalendarTasks.find((t) => t.id === id);
              if (task) setTaskSheet({ date: task.date, taskId: id });
            }}
            flashCard={flashCard}
          />
          )}
        </Animated.View>

        {dayFocus != null && (
          <DaySidebar
            date={dayFocus}
            assignments={visibleAssignments.filter((a) => a.date === dayFocus)}
            workRequests={workRequests}
            jobNameFor={jobNameFor}
            colorForCrew={colorForCrew}
            crewNameFor={crewTagFor}
            onOpenCard={setViewingId}
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
              focusDate={backlogFocusDate}
              focusNonce={showCardNonce}
              flashCard={flashCard}
              onCreateRequest={(date) => setCreateTarget({ date, assign: false })}
              colorForCrew={colorForCrew}
              crewNameFor={crewHoverTagFor}
              plannedCrewIdsFor={plannedCrewIdsFor}
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
              plannedCrewIdsFor={plannedCrewIdsFor}
              colorForCrew={colorForCrew}
              crewNameFor={crewTagFor}
              onPlanCrews={canAssign ? handlePlanCrews : undefined}
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

      {/* A day cell's hover-＋: the creation popup with that day preset as
          the draft's target date. */}
      {createTarget != null && (
        <WorkRequestQuickView
          creating
          initialDate={createTarget.date}
          workRequestId={null}
          jobs={creationJobs}
          onClose={() => setCreateTarget(null)}
          onDelete={() => {}}
          onCreate={handleCreate}
        />
      )}

      {/* The Field Super's calendar task sheet — create on the hovered day,
          or edit the clicked task chip. */}
      {showTasks && (
        <CalendarTaskSheet
          visible={taskSheet != null}
          date={taskSheet?.date ?? ''}
          task={openTaskSheet}
          onClose={() => setTaskSheet(null)}
        />
      )}

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
            // Both roles that render this board (Scheduler + Field Super) get
            // full job-details editing and may create work requests; RLS
            // matches.
            editable
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

/**
 * A Field Super's crew calendar while their Work Requests calendar is
 * expanded: a slim strip holding the month and ONE arrow that brings the
 * full calendar back (collapsing the Work Requests calendar again).
 */
function CollapsedCalendarStrip({
  month,
  onExpand,
}: {
  month: Date;
  onExpand: () => void;
}) {
  return (
    <View style={styles.strip}>
      <Pressable
        onPress={onExpand}
        style={({ pressed }) => [styles.stripBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Show the full calendar"
      >
        <Feather name="chevron-right" size={18} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.stripLabelWrap}>
        <Text style={styles.stripLabel} numberOfLines={1}>
          {format(month, 'MMMM yyyy')}
        </Text>
      </View>
    </View>
  );
}

/** A crew toggle: hidden → visible → active (assign target) → hidden. */
function CrewChip({
  crew,
  color,
  visible,
  active,
  daily,
  calendar,
  onPress,
}: {
  crew: Crew;
  color: string;
  visible: boolean;
  active: boolean;
  /** True for a Daily Crew — drives the hover "Daily" tag. */
  daily?: boolean;
  /** True for a Scheduler's calendar (no members) — hover "Calendar" tag. */
  calendar?: boolean;
  onPress: () => void;
}) {
  // The "Daily" / "Calendar" tag only shows on hover to keep the chip row
  // compact.
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
      {(daily || calendar) && hovered && (
        <View style={[styles.dailyTag, { borderColor: withAlpha(color, 0.6) }]}>
          <Text style={[styles.dailyTagText, { color }]}>
            {daily ? 'Daily' : 'Calendar'}
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
    // The board is click-and-drag territory — stray mouse presses must not
    // sweep text selections across crew pills, day numbers, and chips. The
    // popups (quick view, Manage crews) portal outside this subtree, so their
    // text stays selectable/copyable.
    userSelect: 'none',
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
  // The Field Super's shrunken crew calendar (see CollapsedCalendarStrip).
  strip: {
    flex: 1,
    width: STRIP_W,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  stripBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The month name reads bottom-to-top down the strip. The text's layout box
  // stays 160 wide (transforms don't affect layout), centered in the strip
  // and clipped by it — so only the rotated glyphs show.
  stripLabelWrap: {
    flex: 1,
    width: STRIP_W,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stripLabel: {
    width: 160,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    transform: [{ rotate: '-90deg' }],
  },
}));
