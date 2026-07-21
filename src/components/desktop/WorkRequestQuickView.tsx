import { Feather } from '@expo/vector-icons';
import { format, parse } from 'date-fns';
import { Image } from 'expo-image';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { Combobox, MultiCombobox } from '@/components/desktop/Combobox';
import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import {
  PrioritySelect,
  PriorityValue,
  priorityValueComplete,
} from '@/components/desktop/PrioritySelect';
import { CollapsibleIssueList } from '@/components/issues/CollapsibleIssueList';
import { IssueCard } from '@/components/issues/IssueCard';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useWorkRequestPhotos } from '@/components/photos/useJobPhotos';
import {
  StatusChangeModal,
  statusNeedsNote,
} from '@/components/StatusChangeModal';
import { workRequestStatusColors } from '@/components/StatusPill';
import { useAppStore, useCurrentRole, uuid } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import {
  Job,
  JOB_SCOPES,
  SELECTABLE_WORK_REQUEST_STATUSES,
  WorkRequest,
  WorkRequestStatus,
  JobScope,
  READINESS_PRESETS,
} from '@/types';
import { buildCrewColorMap, crewColorFrom } from '@/utils/crewColors';
import { formatCount, jobCounts } from '@/utils/jobCounts';
import { jobDisplayName } from '@/utils/jobName';
import { jobAllowsWindows } from '@/utils/jobScopes';
import {
  workRequestJobIds,
  workRequestJobsLabel,
} from '@/utils/workRequestJobs';
import { effectivePriority } from '@/utils/priorityRange';
import { formatJobWindow } from '@/utils/time';
import { useDismissOnOutsideClick } from '@/utils/useOutsideClick';

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));
const READINESS_OPTIONS = READINESS_PRESETS.map((r) => ({ value: r, label: r }));

/**
 * Payload handed to `addWorkRequest` when the quick view creates a card.
 * (Moved here from the retired CreateWorkRequestModal.)
 */
export interface NewWorkRequestInput {
  /** Primary linked job. Unset on a standalone (no-parent-job) request. */
  jobId?: string;
  /** Every linked job (parent first) — set only when more than one. */
  jobIds?: string[];
  /** Hand-typed jobsite address — standalone requests only (no job to inherit from). */
  address?: string;
  title: string;
  scopes: JobScope[];
  tasks: string[];
  readiness: string;
  priority: string;
  /** Priority window (yyyy-MM-dd), from the range-based selector. */
  priorityStartDate: string;
  priorityEndDate: string;
  materials?: string;
  /** Per-card Window Opening Flashing Material (defaults to the parent Job's). */
  flashingMaterial?: string;
  notes?: string;
  /** Required Yes/No answer; true also requires {@link pickupLocation}. */
  pickupRequired: boolean;
  pickupLocation?: string;
}

/** Blank draft backing create mode — the same shape as a stored card. */
const emptyDraft = (): WorkRequest => ({
  id: '',
  title: '',
  address: '',
  date: '',
  status: 'Undefined',
  priorityOrder: 0,
  priority: '',
  scopes: [],
  tasks: [],
  details: { generalContractor: '', managerName: '', managerPhone: '' },
});

/** Which field is being edited inline. Only one edits at a time. */
type EditField =
  | 'title'
  | 'address'
  | 'scopes'
  | 'readiness'
  | 'priority'
  | 'flashing'
  | 'materials'
  | 'pickup-location'
  | 'notes'
  | 'new-task'
  | `task-${number}`;

/** RN's Pressable state on web also carries `hovered` (react-native-web). */
type PressState = { pressed: boolean; hovered?: boolean };

interface Props {
  /** Id of the work request to show, or null when the popup is closed. */
  workRequestId: string | null;
  /**
   * Author a new work request instead of showing a stored one: the exact same
   * layout, backed by a local draft, plus Cancel / Create Work Request buttons at
   * the bottom. Takes precedence over `workRequestId`.
   */
  creating?: boolean;
  /**
   * Pre-link this job on the create draft (the job details pages' "+ Work
   * Request" button) — the picker still allows adding family members.
   */
  initialJobId?: string;
  /** Jobs in the viewer's scope — parent-job options and lookups. */
  jobs: Job[];
  /**
   * 'popup' (default): centered floating card. 'sidebar': a right-hand panel
   * the same size as the job dashboard sidebar (the work requests pages).
   */
  variant?: 'popup' | 'sidebar';
  /**
   * Popup variant only: center the card in the space LEFT of the job dashboard
   * sidebar instead of the whole screen (creation opened from that sidebar).
   */
  popupShifted?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  /** Receives the validated draft when `creating`; required in that mode. */
  onCreate?: (input: NewWorkRequestInput) => void;
  /**
   * When provided, the parent job name above the title becomes a link that
   * hands the job id up — the host opens its job details over this view.
   */
  onOpenJob?: (jobId: string) => void;
}

/**
 * Google-Calendar-style quick view of a work request: a compact read-first popup
 * where every editable value highlights on hover and turns into its editor on
 * click. Edits save automatically as they're made (no Save/Cancel) — the only
 * guarded actions are delete (two-click confirm), status changes, and marking
 * readiness "Now" (both confirm inline before applying).
 *
 * With `creating` the identical layout authors a new card instead: edits land
 * on a local draft, and Cancel / Create Work Request buttons sit at the bottom
 * (creation is blocked until the required fields are filled).
 */
export function WorkRequestQuickView({
  workRequestId,
  creating = false,
  initialJobId,
  jobs,
  variant = 'popup',
  popupShifted = false,
  onClose,
  onDelete,
  onCreate,
  onOpenJob,
}: Props) {
  // Read the live card from the store so autosaved edits render back instantly.
  const storeWorkRequest = useAppStore((s) =>
    s.workRequests.find((c) => c.id === workRequestId)
  );
  const jobIssues = useAppStore((s) => s.jobIssues);
  const updateWorkRequest = useAppStore((s) => s.updateWorkRequest);
  const setWorkRequestStatus = useAppStore((s) => s.setWorkRequestStatus);
  const flash = useAppStore((s) => s.flash);
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const assignWorkRequest = useAppStore((s) => s.assignWorkRequest);
  const unassignWorkRequest = useAppStore((s) => s.unassignWorkRequest);
  const role = useCurrentRole();

  // Create mode edits this local draft; view mode edits the stored card.
  const [draftCard, setDraftCard] = useState<WorkRequest>(emptyDraft);
  const workRequest = creating ? draftCard : storeWorkRequest;
  const [createError, setCreateError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditField | null>(null);
  /** Text draft for whichever text field is being edited; committed on blur. */
  const [draft, setDraft] = useState('');
  /** In-progress priority edit (null = seed from the card when editing opens). */
  const [priorityDraft, setPriorityDraft] = useState<PriorityValue | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WorkRequestStatus | null>(null);
  // Status picks that need a typed note (Untouched / False Start / Finished)
  // route through the StatusChangeModal instead of the inline ConfirmBar.
  const [pendingNoteStatus, setPendingNoteStatus] =
    useState<WorkRequestStatus | null>(null);
  const [pendingReadinessNow, setPendingReadinessNow] = useState(false);
  // Create mode: "No parent job" — a standalone request with a typed address.
  const [noJob, setNoJob] = useState(false);
  // Create mode: the missing-flashing-material warning stays hidden until the
  // Create button is actually clicked (then clears itself once satisfied).
  const [flashingWarned, setFlashingWarned] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [crewMenuOpen, setCrewMenuOpen] = useState(false);
  const [crewSquareHovered, setCrewSquareHovered] = useState(false);

  // Close the inline menus when a click lands anywhere outside them.
  const statusWrapRef = useRef<View>(null);
  const crewWrapRef = useRef<View>(null);
  useDismissOnOutsideClick(statusMenuOpen, [statusWrapRef], () =>
    setStatusMenuOpen(false)
  );
  useDismissOnOutsideClick(crewMenuOpen, [crewWrapRef], () =>
    setCrewMenuOpen(false)
  );
  // The priority editor closes the same way — every complete change already
  // autosaved, so clicking elsewhere just puts the field back in read mode.
  // (Its dropdown + date pickers render in portals, which the hook treats as
  // "inside".)
  const priorityWrapRef = useRef<View>(null);
  useDismissOnOutsideClick(editing === 'priority', [priorityWrapRef], () => {
    setEditing(null);
    setPriorityDraft(null);
  });

  // The calendar day this card is scheduled for: its next upcoming assignment
  // date, or the most recent one when they're all in the past (mirrors the
  // work request list's status pill). Null when the Scheduler hasn't placed it.
  const scheduledDate = useMemo(() => {
    const dates = assignments
      .filter((a) => a.workRequestId === workRequestId)
      .map((a) => a.date)
      .sort();
    if (dates.length === 0) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    return dates.find((d) => d >= today) ?? dates[dates.length - 1];
  }, [assignments, workRequestId]);

  const photos = useWorkRequestPhotos(creating ? undefined : workRequest?.id);
  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);

  // Reset every transient state (and the create draft) when a different card
  // is opened or create mode is entered/left.
  useEffect(() => {
    const seed = emptyDraft();
    // Creation launched from a job details page pre-links that job (the
    // picker still allows adding the rest of its family).
    if (creating && initialJobId) {
      const initialJob = jobs.find((j) => j.id === initialJobId);
      if (initialJob) {
        seed.jobId = initialJob.id;
        seed.address = initialJob.location ?? '';
      }
    }
    setDraftCard(seed);
    setCreateError(null);
    setEditing(null);
    setDraft('');
    setPriorityDraft(null);
    setStatusMenuOpen(false);
    setPendingStatus(null);
    setPendingReadinessNow(false);
    setNoJob(false);
    setFlashingWarned(false);
    setConfirmDelete(false);
    setCrewMenuOpen(false);
    setCrewSquareHovered(false);
    // `jobs` is deliberately not a dep — a background refresh must not wipe an
    // in-progress draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workRequestId, creating, initialJobId]);

  // An armed delete disarms itself after 4s if the second click never comes.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  if (!workRequest) return null;

  /** Route an edit to the create draft or the stored card (autosave). */
  const applyChange = (patch: Partial<WorkRequest>) => {
    if (creating) setDraftCard((prev) => ({ ...prev, ...patch }));
    else updateWorkRequest(workRequest.id, patch);
  };

  const palette =
    workRequestStatusColors[workRequest.status] ?? workRequestStatusColors.Undefined;
  // The PRIMARY linked job (the parent when it's linked, else the first
  // linked sub-job) — drives address, scopes, counts, and flashing defaults.
  const parentJob = jobs.find((j) => j.id === workRequest.jobId);
  const activeJobs = jobs.filter((j) => j.status === 'Active');
  // Job options for the create draft (links are fixed once a card exists).
  // A card links either one job or several jobs of ONE family (sibling
  // sub-jobs ± their parent) — once something is selected, the picker offers
  // only the rest of that family. Options are labeled by PO (the office's
  // handle for a job); typing a job name still finds it via keywords.
  const selectedJobIds = workRequestJobIds(workRequest);
  const selectedJobs = selectedJobIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is Job => j != null);
  const familyAnchorId = selectedJobs[0]
    ? (selectedJobs[0].parentJobId ?? selectedJobs[0].id)
    : null;
  const pickableJobs =
    familyAnchorId == null
      ? activeJobs
      : activeJobs.filter(
          (j) => j.id === familyAnchorId || j.parentJobId === familyAnchorId
        );
  const jobOptions = pickableJobs.map((j) => ({
    value: j.id,
    label: j.po ? `PO ${j.po}` : jobDisplayName(j, jobs),
    keywords: [jobDisplayName(j, jobs)],
  }));
  // A card can't be created until the parent job has a jobsite address — and
  // flashing material, when the job covers windows. Typing a flashing material
  // into THIS work request satisfies the flashing requirement too; its warning
  // only shows after a blocked Create click (see submitCreate).
  const missingAddress =
    creating && parentJob != null && !parentJob.location.trim();
  const missingFlashing =
    creating &&
    parentJob != null &&
    jobAllowsWindows(parentJob) &&
    !parentJob.flashingMaterial?.trim() &&
    !workRequest?.flashingMaterial?.trim();
  const tasks = workRequest.tasks ?? [];
  const scopes = workRequest.scopes ?? [];
  // Installer-raised issues on this card, newest first — nested under the task
  // they were raised for, mirroring the installer's work request screen.
  const cardIssues = jobIssues
    .filter((issue) => issue.workRequestId === workRequest.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Issues whose task is gone (or that predate per-task issues) — shown in a
  // fallback section instead of silently disappearing.
  const orphanIssues = cardIssues.filter(
    (issue) => !issue.taskId || !tasks.some((t) => t.id === issue.taskId)
  );
  const openPhoto = (photo: DisplayPhoto, all: DisplayPhoto[]) =>
    setViewer({
      photos: all,
      index: all.findIndex((p) => p.id === photo.id),
    });
  // Flashing only exists when the work request covers windows AND the parent job's
  // scopes allow window work at all.
  const windowsAllowed = jobAllowsWindows(parentJob);
  const includesWindows = windowsAllowed && scopes.includes('Windows');
  const scopeOptions = windowsAllowed
    ? SCOPE_OPTIONS
    : SCOPE_OPTIONS.filter((o) => o.value !== 'Windows');
  const timeWindow = formatJobWindow(workRequest.startTime, workRequest.endTime);
  // The parent JOB's scope counts, shown on every one of its work requests.
  const cardCounts = jobCounts(parentJob);
  // Crew assignment drives the title square: permanent crews first so colors
  // match the scheduler calendar (same ordering as CalendarBoard).
  const cardAssignments = assignments.filter((a) => a.workRequestId === workRequest.id);
  const allCrews = [...crews, ...dailyCrews];
  const crewColorMap = buildCrewColorMap(allCrews.map((c) => c.id));
  const assignedCrewIds = [...new Set(cardAssignments.map((a) => a.crewId))];
  const crewNameFor = (id: string) =>
    allCrews.find((c) => c.id === id)?.name ?? 'Unknown crew';
  const crewSquareColor =
    assignedCrewIds.length > 0
      ? crewColorFrom(crewColorMap, assignedCrewIds[0])
      : undefined;
  const crewTooltip =
    assignedCrewIds.length > 0
      ? assignedCrewIds.map(crewNameFor).join(', ')
      : 'No crew assigned';

  const startEdit = (field: EditField, initial: string) => {
    setEditing(field);
    setDraft(initial);
  };

  // --- Autosave commits (each fires updateWorkRequest directly) -----------------

  const commitTitle = () => {
    const t = draft.trim();
    setEditing(null);
    if (!t) {
      // An untitled draft is fine until Create is pressed.
      if (!creating) flash('Title is required — change discarded.', 'warning');
      return;
    }
    if (t === workRequest.title) return;
    // On creation, typing the title auto-authors the first task from it (and
    // keeps following title retypes until the task is edited or others exist).
    const autoFirstTask = creating
      ? tasks.length === 0
        ? [{ id: uuid(), text: t, done: false }]
        : tasks.length === 1 && tasks[0].text === workRequest.title
          ? [{ ...tasks[0], text: t }]
          : null
      : null;
    applyChange({
      title: t,
      ...(autoFirstTask ? { tasks: autoFirstTask } : {}),
    });
  };

  // Create mode only — the linked jobs are fixed once a card exists.
  const changeJobs = (nextIds: string[]) => {
    const linked = nextIds
      .map((id) => jobs.find((j) => j.id === id))
      .filter((j): j is Job => j != null);
    // The parent (when itself linked) leads the list, so the primary jobId —
    // and the DB row's FK — always points at the top-level job if one is in.
    const ordered = [
      ...linked.filter((j) => !j.parentJobId),
      ...linked.filter((j) => j.parentJobId),
    ];
    const primary = ordered[0];
    // A primary job without the Windows scope drops the draft's Windows scope
    // (and its flashing material) — those never show for such jobs.
    const dropWindows =
      primary != null &&
      !jobAllowsWindows(primary) &&
      scopes.includes('Windows');
    // The address follows the primary job.
    applyChange({
      jobId: primary?.id,
      jobIds: ordered.length > 1 ? ordered.map((j) => j.id) : undefined,
      address: primary ? (primary.location ?? '') : workRequest.address,
      ...(dropWindows
        ? {
            scopes: scopes.filter((s) => s !== 'Windows'),
            flashingMaterial: undefined,
          }
        : {}),
    });
  };

  // "No parent job": clears any picked jobs and opens the address for typing.
  const toggleNoJob = () => {
    const on = !noJob;
    setNoJob(on);
    if (on) applyChange({ jobId: undefined, jobIds: undefined, address: '' });
  };

  const commitAddress = () => {
    setEditing(null);
    const v = draft.trim();
    if (v !== workRequest.address) applyChange({ address: v });
  };

  const changeScopes = (vals: string[]) => {
    if (vals.length === 0) {
      flash('A work request needs at least one scope.', 'warning');
      return;
    }
    const next = vals as JobScope[];
    applyChange({
      scopes: next,
      // Flashing material only means anything with the Windows scope.
      ...(next.includes('Windows') ? {} : { flashingMaterial: undefined }),
    });
  };

  const commitTask = (index: number) => {
    const t = draft.trim();
    setEditing(null);
    if (!t) {
      if (!creating && tasks.length <= 1) {
        flash('A work request needs at least one task.', 'warning');
        return;
      }
      applyChange({ tasks: tasks.filter((_, i) => i !== index) });
      return;
    }
    if (t !== tasks[index].text) {
      // Text edits keep the task's id (and check-off state) intact so
      // installer check-offs and per-task issues stay linked.
      applyChange({
        tasks: tasks.map((task, i) => (i === index ? { ...task, text: t } : task)),
      });
    }
  };

  const commitNewTask = () => {
    const t = draft.trim();
    setEditing(null);
    if (!t) return;
    applyChange({
      tasks: [...tasks, { id: uuid(), text: t, done: false }],
    });
  };

  const changeReadiness = (value: string) => {
    setEditing(null);
    const v = value.trim();
    if (!v || v === workRequest.readiness) return;
    // "Yes" drops the request into the schedulers' pool — keep the explicit
    // double-check before applying.
    if (v === 'Yes') {
      setPendingReadinessNow(true);
      return;
    }
    applyChange({ readiness: v });
  };

  // Every complete change autosaves (quick-view style); the editor stays open
  // so both dates can be adjusted, and closes via its Done button.
  const changePriority = (value: PriorityValue) => {
    setPriorityDraft(value);
    if (!priorityValueComplete(value)) return;
    if (
      value.priority === workRequest.priority &&
      value.startDate === (workRequest.priorityStartDate ?? '') &&
      value.endDate === (workRequest.priorityEndDate ?? '')
    ) {
      return;
    }
    applyChange({
      priority: value.priority,
      priorityStartDate: value.startDate,
      priorityEndDate: value.endDate,
    });
  };

  // How the priority reads when not editing: "Now · Jul 11",
  // "This week · Jul 11 – Jul 18", or just the range for "Set dates".
  const cardPriority = effectivePriority(workRequest);
  const priorityDisplay = !workRequest.priority
    ? 'Set priority…'
    : cardPriority.range
      ? cardPriority.raw === 'Set dates' && !cardPriority.escalated
        ? cardPriority.range
        : `${cardPriority.label} · ${cardPriority.range}`
      : workRequest.priority;

  const commitFlashing = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== workRequest.flashingMaterial) {
      applyChange({ flashingMaterial: v });
    }
  };

  const commitMaterials = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== workRequest.materials) applyChange({ materials: v });
  };

  const changePickupRequired = (required: boolean) => {
    if (required === workRequest.pickupRequired) return;
    applyChange({
      pickupRequired: required,
      // "No" clears any stale location so it can't silently reappear.
      ...(required ? {} : { pickupLocation: undefined }),
    });
  };

  const commitPickupLocation = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== workRequest.pickupLocation) {
      applyChange({ pickupLocation: v });
    }
  };

  const commitNotes = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== workRequest.notes) applyChange({ notes: v });
  };

  // --- Guarded actions -------------------------------------------------------

  const pickStatus = (status: WorkRequestStatus) => {
    setStatusMenuOpen(false);
    if (status === workRequest.status) return;
    // Untouched / False Start need a typed reason, Finished a completion
    // note — those commit from the popup instead of the inline confirm.
    if (statusNeedsNote(status)) {
      setPendingNoteStatus(status);
      return;
    }
    setPendingStatus(status);
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      setWorkRequestStatus(workRequest.id, pendingStatus);
      flash(`Status changed to "${pendingStatus}"`, 'success');
    }
    setPendingStatus(null);
  };

  const confirmReadinessNow = () => {
    applyChange({ readiness: 'Yes' });
    setPendingReadinessNow(false);
  };

  const remove = () => {
    // Two-click confirm — the first click arms the button, the second deletes.
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(workRequest.id);
    onClose();
  };

  const toggleCrewMenu = () => {
    if (creating) return;
    // Field Supers may see the assigned crew (hover) but never change it —
    // moving work between crews is the Scheduler's call.
    if (role === 'field_super') return;
    if (cardAssignments.length === 0) {
      flash(
        'Not on the calendar yet — schedule this card to assign a crew.',
        'warning'
      );
      return;
    }
    setCrewMenuOpen((open) => !open);
  };

  /** Swap which crew the card is assigned to; every scheduled date is kept. */
  const changeCrew = (crewId: string) => {
    setCrewMenuOpen(false);
    if (assignedCrewIds.length === 1 && assignedCrewIds[0] === crewId) return;
    const dates = [...new Set(cardAssignments.map((a) => a.date))];
    cardAssignments.forEach((a) => unassignWorkRequest(a.id));
    dates.forEach((date) => assignWorkRequest(workRequest.id, crewId, date));
    flash(`Assigned to ${crewNameFor(crewId)}`, 'success');
  };

  /** Validate the create draft; hand it up only when every requirement holds. */
  const submitCreate = () => {
    if (!onCreate) return;
    if (!noJob && !parentJob) {
      setCreateError(
        'Pick a parent job — or mark this request as having no parent job.'
      );
      return;
    }
    if (noJob && !workRequest.address.trim()) {
      setCreateError('Type the jobsite address for this work request.');
      return;
    }
    if (missingAddress) {
      setCreateError(
        'This job has no jobsite address yet — set it on the Jobs tab first.'
      );
      return;
    }
    if (missingFlashing) {
      // No createError — the dedicated warning above the buttons explains it
      // (and clears itself once a flashing material is typed either place).
      setFlashingWarned(true);
      setCreateError(null);
      return;
    }
    if (!workRequest.title.trim()) {
      setCreateError('Add a title.');
      return;
    }
    if (scopes.length === 0) {
      setCreateError('Select at least one scope.');
      return;
    }
    const cleanTasks = tasks
      .map((t) => t.text.trim())
      .filter((t) => t.length > 0);
    if (cleanTasks.length === 0) {
      setCreateError('Add at least one task.');
      return;
    }
    // Readiness "Now" was already double-confirmed via the inline ConfirmBar.
    if (!workRequest.readiness?.trim()) {
      setCreateError('Choose when this work request is ready for installers.');
      return;
    }
    if (!workRequest.priority) {
      setCreateError('Choose a priority.');
      return;
    }
    if (
      !priorityValueComplete({
        priority: workRequest.priority,
        startDate: workRequest.priorityStartDate ?? '',
        endDate: workRequest.priorityEndDate ?? '',
      })
    ) {
      setCreateError('Set the priority start and end dates.');
      return;
    }
    if (workRequest.pickupRequired == null) {
      setCreateError('Answer whether a pickup is required.');
      return;
    }
    if (workRequest.pickupRequired && !workRequest.pickupLocation?.trim()) {
      setCreateError('Specify where the pickup is.');
      return;
    }
    onCreate({
      jobId: parentJob?.id,
      jobIds: workRequest.jobIds,
      address: noJob ? workRequest.address.trim() : undefined,
      title: workRequest.title.trim(),
      scopes,
      tasks: cleanTasks,
      readiness: workRequest.readiness.trim(),
      priority: workRequest.priority,
      priorityStartDate: workRequest.priorityStartDate ?? '',
      priorityEndDate: workRequest.priorityEndDate ?? '',
      materials: workRequest.materials?.trim() || undefined,
      // An untouched flashing field falls back to the parent job's material,
      // exactly what the read view displays as the default.
      flashingMaterial: includesWindows
        ? (workRequest.flashingMaterial ?? parentJob?.flashingMaterial)?.trim() ||
          undefined
        : undefined,
      pickupRequired: workRequest.pickupRequired,
      pickupLocation: workRequest.pickupRequired
        ? workRequest.pickupLocation?.trim()
        : undefined,
      notes: workRequest.notes?.trim() || undefined,
    });
    onClose();
  };

  // The same panel renders either centered in a popup Modal (calendar and job
  // dashboard) or as a fixed right-hand sidebar (the work requests pages).
  const panel = (
    <View style={variant === 'sidebar' ? styles.sidebarPanel : styles.card}>
      {/* Header action icons, Google-Calendar style. A draft has nothing to
          delete — create mode shows only the X. */}
      <View style={styles.headerActions}>
        {!creating && (
          <Pressable
            onPress={remove}
            style={({ pressed, hovered }: PressState) => [
              styles.iconButton,
              confirmDelete && styles.deleteArmed,
              (hovered || pressed) && !confirmDelete && styles.iconButtonHover,
            ]}
          >
            <Feather
              name="trash-2"
              size={16}
              color={confirmDelete ? colors.textPrimary : colors.textSecondary}
            />
            {confirmDelete && (
              <Text style={styles.deleteArmedText}>Click again to delete</Text>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={onClose}
          style={({ pressed, hovered }: PressState) => [
            styles.iconButton,
            (hovered || pressed) && styles.iconButtonHover,
          ]}
        >
          <Feather name="x" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        // Any click in the body disarms a pending delete (returning false
        // leaves the click itself untouched).
        onStartShouldSetResponderCapture={() => {
          if (confirmDelete) setConfirmDelete(false);
          return false;
        }}
      >
        {/* Parent job — always shown directly above the work request name (like
            the mobile installer view). Fixed once the card exists; only the
            create draft still picks it. */}
        <View style={styles.header}>
          {creating ? (
            <View style={styles.parentJobPicker}>
              {!noJob &&
                (jobOptions.length > 0 || selectedJobIds.length > 0 ? (
                  <MultiCombobox
                    values={selectedJobIds}
                    options={jobOptions}
                    onChange={changeJobs}
                    placeholder="Search jobs by PO or name…"
                  />
                ) : (
                  <Text style={styles.mutedText}>
                    No active jobs available — create one first, or make this a
                    standalone work request below.
                  </Text>
                ))}
              {/* Standalone: a request that hangs off no job (rarely needed).
                  The address is typed by hand since there's no job to
                  inherit it from. */}
              <Pressable
                style={({ pressed }) => [
                  styles.noJobToggle,
                  pressed && styles.pressed,
                ]}
                onPress={toggleNoJob}
              >
                <Feather
                  name={noJob ? 'check-square' : 'square'}
                  size={16}
                  color={noJob ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[styles.noJobText, noJob && styles.noJobTextOn]}
                >
                  No parent job — standalone work request
                </Text>
              </Pressable>
              {missingAddress && (
                <View style={styles.prereqWarning}>
                  <Feather
                    name="alert-triangle"
                    size={14}
                    color={colors.warning}
                  />
                  <Text style={styles.prereqText}>
                    Work Requests can&apos;t be created for this job until its
                    jobsite address is set — do that on the Jobs tab.
                  </Text>
                </View>
              )}
            </View>
          ) : parentJob && onOpenJob ? (
            <Pressable
              style={({ pressed, hovered }: PressState) => [
                styles.parentJobLinkWrap,
                (hovered || pressed) && styles.pressedLink,
              ]}
              hitSlop={4}
              onPress={() => onOpenJob(parentJob.id)}
            >
              <Text style={styles.parentJobText}>
                {workRequestJobsLabel(workRequest, jobs)}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.parentJobText}>
              {parentJob
                ? workRequestJobsLabel(workRequest, jobs)
                : 'No parent job'}
            </Text>
          )}

          {/* Title, led by the crew square (the GCal event square): colored
              by the assigned crew, gray + slash when unassigned. Hover shows
              the crew name(s); click swaps the assigned crew. */}
          <View style={styles.titleRow}>
            <View ref={crewWrapRef} style={styles.crewSquareWrap}>
              <Pressable
                onPress={toggleCrewMenu}
                onHoverIn={() => setCrewSquareHovered(true)}
                onHoverOut={() => setCrewSquareHovered(false)}
                style={[
                  styles.titleDot,
                  crewSquareColor
                    ? { backgroundColor: crewSquareColor }
                    : styles.titleDotEmpty,
                ]}
              >
                {!crewSquareColor && <View style={styles.titleDotSlash} />}
              </Pressable>
              {/* Hover pill ABOVE the square (the click menu still opens
                  below). Portaled so the modal's ScrollView can't clip it. */}
              <DropdownPortal
                anchorRef={crewWrapRef}
                open={crewSquareHovered && !crewMenuOpen}
                onClose={() => setCrewSquareHovered(false)}
                align="left"
                placement="above"
                minWidth={160}
              >
                <View style={styles.crewTooltip}>
                  <Text style={styles.crewTooltipText}>{crewTooltip}</Text>
                </View>
              </DropdownPortal>
              {crewMenuOpen && (
                <View style={styles.crewMenu}>
                  {allCrews.map((crew) => {
                    const active = assignedCrewIds.includes(crew.id);
                    return (
                      <Pressable
                        key={crew.id}
                        style={({ pressed, hovered }: PressState) => [
                          styles.menuItem,
                          (hovered || pressed) && styles.menuItemHover,
                        ]}
                        onPress={() => changeCrew(crew.id)}
                      >
                        <View
                          style={[
                            styles.menuDot,
                            {
                              backgroundColor: crewColorFrom(
                                crewColorMap,
                                crew.id
                              ),
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.menuText,
                            active && styles.menuTextActive,
                          ]}
                        >
                          {crew.name}
                        </Text>
                        {active && (
                          <Feather
                            name="check"
                            size={14}
                            color={colors.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
            {editing === 'title' ? (
              <TextInput
                style={styles.titleInput}
                value={draft}
                onChangeText={setDraft}
                onBlur={commitTitle}
                placeholder="Install windows"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Editable
                onPress={() => startEdit('title', workRequest.title)}
                style={styles.titleEditable}
              >
                <Text
                  style={[
                    styles.titleText,
                    !workRequest.title && styles.titlePlaceholder,
                  ]}
                >
                  {workRequest.title || 'Add a title…'}
                </Text>
              </Editable>
            )}
          </View>
        </View>

        {/* Address + date + optional time window. The address is read-only
            (it follows the linked job) — except on a standalone create draft,
            where it must be typed by hand. */}
        <Row icon="map-pin">
          {creating && noJob ? (
            editing === 'address' ? (
              <TextInput
                style={styles.textEditor}
                value={draft}
                onChangeText={setDraft}
                onBlur={commitAddress}
                placeholder="Type the jobsite address…"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Editable
                onPress={() => startEdit('address', workRequest.address)}
              >
                <Text
                  style={
                    workRequest.address
                      ? styles.valueText
                      : styles.placeholderText
                  }
                >
                  {workRequest.address || 'Add the jobsite address…'}
                </Text>
              </Editable>
            )
          ) : (
            <Text style={styles.mutedText}>
              {workRequest.address || 'No address'}
            </Text>
          )}
        </Row>
        <Row icon="calendar">
          <Text style={styles.mutedText}>
            {scheduledDate
              ? format(
                  parse(scheduledDate, 'yyyy-MM-dd', new Date()),
                  'EEEE, MMMM d'
                )
              : 'Not Scheduled'}
          </Text>
        </Row>
        {timeWindow ? (
          <Row icon="clock">
            <Text style={styles.mutedText}>{timeWindow}</Text>
          </Row>
        ) : null}

        {/* Parent job's scope counts, "done/total" (installers update the
            done numbers from their work request view). */}
        {cardCounts.length > 0 && (
          <Row icon="hash">
            <Text style={styles.mutedText}>
              {cardCounts
                .map((c) => `${c.label} ${formatCount(c)}`)
                .join('  ·  ')}
            </Text>
          </Row>
        )}

        {/* Status — changeable, but always guarded (inline confirm, or the
            note popup for Untouched / False Start / Finished). A draft is
            always "Undefined", so create mode shows a static pill. */}
        <Row icon="activity" label="Status">
          {creating ? (
            <View style={styles.statusStatic}>
              <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
                <Text style={[styles.statusPillText, { color: palette.fg }]}>
                  {workRequest.status}
                </Text>
              </View>
            </View>
          ) : (
            <View ref={statusWrapRef}>
              <Editable
                onPress={() => {
                  setStatusMenuOpen((open) => !open);
                  setPendingStatus(null);
                }}
                style={styles.statusEditable}
              >
                <View style={[styles.statusPill, { backgroundColor: palette.bg }]}>
                  <Text style={[styles.statusPillText, { color: palette.fg }]}>
                    {workRequest.status}
                  </Text>
                  <Feather
                    name={statusMenuOpen ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={palette.fg}
                  />
                </View>
              </Editable>
              {statusMenuOpen && (
                <View style={styles.menu}>
                  {SELECTABLE_WORK_REQUEST_STATUSES.map((status) => {
                    const active = workRequest.status === status;
                    return (
                      <Pressable
                        key={status}
                        style={({ pressed, hovered }: PressState) => [
                          styles.menuItem,
                          (hovered || pressed) && styles.menuItemHover,
                        ]}
                        onPress={() => pickStatus(status)}
                      >
                        <View
                          style={[
                            styles.menuDot,
                            { backgroundColor: workRequestStatusColors[status].fg },
                          ]}
                        />
                        <Text
                          style={[
                            styles.menuText,
                            active && styles.menuTextActive,
                          ]}
                        >
                          {status}
                        </Text>
                        {active && (
                          <Feather name="check" size={14} color={colors.primary} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}
          {pendingStatus && (
            <ConfirmBar
              message={`Change status to “${pendingStatus}”?`}
              confirmLabel="Change status"
              onConfirm={confirmStatusChange}
              onCancel={() => setPendingStatus(null)}
            />
          )}
          {!creating && workRequest.statusNote ? (
            <Text style={styles.statusNoteText}>{workRequest.statusNote}</Text>
          ) : null}
          <StatusChangeModal
            status={pendingNoteStatus}
            workRequestTitle={workRequest.title}
            windowsScope={includesWindows}
            onConfirm={(note) => {
              if (pendingNoteStatus) {
                setWorkRequestStatus(workRequest.id, pendingNoteStatus, note);
                flash(`Status changed to "${pendingNoteStatus}"`, 'success');
              }
              setPendingNoteStatus(null);
            }}
            onCancel={() => setPendingNoteStatus(null)}
          />
        </Row>

        {/* Scope chips */}
        <Row icon="tag" label="Scope">
          {editing === 'scopes' ? (
            <View style={styles.scopeEdit}>
              <MultiCombobox
                values={scopes}
                options={scopeOptions}
                onChange={changeScopes}
                placeholder="Search scopes…"
              />
              <Pressable onPress={() => setEditing(null)} hitSlop={6}>
                <Text style={styles.doneLink}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <Editable onPress={() => setEditing('scopes')}>
              <View style={styles.chipWrap}>
                {scopes.length === 0 ? (
                  <Text style={styles.placeholderText}>Add scopes…</Text>
                ) : (
                  scopes.map((scope) => (
                    <View key={scope} style={styles.chip}>
                      <Text style={styles.chipText}>{scope}</Text>
                    </View>
                  ))
                )}
              </View>
            </Editable>
          )}
        </Row>

        {/* Tasks */}
        <Row icon="check-square" label="Tasks">
          <View style={styles.taskStack}>
            {tasks.map((task, index) => {
              const taskIssues = cardIssues.filter(
                (issue) => issue.taskId === task.id
              );
              // Photos taken FOR this task — shown inside the task (they
              // also appear in the Photos section below).
              const taskPhotos = photos.filter((p) => p.taskId === task.id);
              return (
                <View key={task.id} style={styles.taskBlock}>
                  {editing === `task-${index}` ? (
                    <TextInput
                      style={styles.textEditor}
                      value={draft}
                      onChangeText={setDraft}
                      onBlur={() => commitTask(index)}
                      autoFocus
                      multiline
                    />
                  ) : (
                    <Editable
                      onPress={() => startEdit(`task-${index}`, task.text)}
                    >
                      <Text
                        style={[
                          styles.valueText,
                          task.done && styles.taskDoneText,
                        ]}
                      >
                        {task.done ? '✓  ' : '•  '}
                        {task.text}
                      </Text>
                    </Editable>
                  )}
                  {taskPhotos.length > 0 && (
                    <View style={styles.taskPhotosRow}>
                      {taskPhotos.map((photo) => (
                        <Pressable
                          key={photo.id}
                          onPress={() => openPhoto(photo, taskPhotos)}
                        >
                          {photo.isVideo ? (
                            <View
                              style={[
                                styles.taskPhotoThumb,
                                styles.taskVideoThumb,
                              ]}
                            >
                              <Feather
                                name="play-circle"
                                size={16}
                                color={colors.textPrimary}
                              />
                            </View>
                          ) : (
                            <Image
                              source={{ uri: photo.url }}
                              style={styles.taskPhotoThumb}
                              contentFit="cover"
                              transition={100}
                            />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {taskIssues.length > 0 && (
                    <View style={styles.taskIssues}>
                      {taskIssues.map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          onPhotoPress={openPhoto}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
            {editing === 'new-task' ? (
              <TextInput
                style={styles.textEditor}
                value={draft}
                onChangeText={setDraft}
                onBlur={commitNewTask}
                placeholder="Describe a task for the installers…"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                multiline
              />
            ) : (
              <Pressable
                style={styles.addTask}
                onPress={() => startEdit('new-task', '')}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={styles.addTaskText}>Add task</Text>
              </Pressable>
            )}
          </View>
        </Row>

        {/* Issues that no longer belong to a task (task deleted, or raised
            before per-task issues) — kept visible instead of vanishing. */}
        {orphanIssues.length > 0 && (
          <Row icon="alert-triangle" label="Issues">
            <View style={styles.issueStack}>
              <CollapsibleIssueList
                issues={orphanIssues}
                renderIssue={(issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onPhotoPress={openPhoto}
                  />
                )}
              />
            </View>
          </Row>
        )}

        {/* Readiness + priority side by side. */}
        <Row icon="flag">
          <View style={styles.pairRow}>
            <View style={styles.pairCol}>
              <Text style={styles.rowLabel}>Ready for installers</Text>
              {editing === 'readiness' ? (
                <Combobox
                  value={workRequest.readiness ?? ''}
                  options={READINESS_OPTIONS}
                  onChange={changeReadiness}
                  placeholder="Yes, No, Soon… or type + Enter"
                  allowCustom
                  autoFocus
                  onDismiss={() => setEditing(null)}
                />
              ) : (
                <Editable onPress={() => setEditing('readiness')}>
                  <Text
                    style={
                      workRequest.readiness
                        ? styles.valueText
                        : styles.placeholderText
                    }
                  >
                    {workRequest.readiness || 'Set readiness…'}
                  </Text>
                </Editable>
              )}
            </View>
            <View ref={priorityWrapRef} style={styles.pairCol}>
              <Text style={styles.rowLabel}>Priority</Text>
              {editing === 'priority' ? (
                <PrioritySelect
                  value={
                    priorityDraft ?? {
                      priority: workRequest.priority ?? '',
                      startDate: workRequest.priorityStartDate ?? '',
                      endDate: workRequest.priorityEndDate ?? '',
                    }
                  }
                  onChange={changePriority}
                />
              ) : (
                <Editable
                  onPress={() => {
                    setPriorityDraft(null);
                    setEditing('priority');
                  }}
                >
                  <Text
                    style={[
                      workRequest.priority
                        ? styles.valueText
                        : styles.placeholderText,
                      cardPriority.label === 'Now' && styles.priorityNow,
                    ]}
                  >
                    {priorityDisplay}
                  </Text>
                </Editable>
              )}
            </View>
          </View>
          {pendingReadinessNow && (
            <ConfirmBar
              message="You confirm the job and tasks are ready?"
              confirmLabel="It's ready"
              onConfirm={confirmReadinessNow}
              onCancel={() => setPendingReadinessNow(false)}
            />
          )}
        </Row>

        {/* Window Opening Flashing Material (Windows scope only). */}
        {includesWindows && (
          <Row icon="layers" label="Window Opening Flashing Material">
            <View style={styles.flashingRow}>
              <View style={styles.flashingValue}>
                {editing === 'flashing' ? (
                  <TextInput
                    style={styles.textEditor}
                    value={draft}
                    onChangeText={setDraft}
                    onBlur={commitFlashing}
                    placeholder={
                      parentJob?.flashingMaterial
                        ? `Defaults to ${parentJob.flashingMaterial}`
                        : 'e.g. regular rainbuster'
                    }
                    placeholderTextColor={colors.textTertiary}
                    autoFocus
                  />
                ) : (
                  <Editable
                    onPress={() =>
                      startEdit('flashing', workRequest.flashingMaterial ?? '')
                    }
                  >
                    <Text
                      style={
                        workRequest.flashingMaterial
                          ? styles.valueText
                          : styles.placeholderText
                      }
                    >
                      {workRequest.flashingMaterial ??
                        parentJob?.flashingMaterial ??
                        'Not specified'}
                    </Text>
                  </Editable>
                )}
              </View>
              <FlashingPhotoField job={parentJob} editable />
            </View>
          </Row>
        )}

        {/* Materials needed */}
        <Row icon="package" label="Materials needed">
          {editing === 'materials' ? (
            <TextInput
              style={[styles.textEditor, styles.multiline]}
              value={draft}
              onChangeText={setDraft}
              onBlur={commitMaterials}
              placeholder="Gaskets, setting blocks, structural silicone…"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              multiline
            />
          ) : (
            <Editable
              onPress={() => startEdit('materials', workRequest.materials ?? '')}
            >
              <Text
                style={
                  workRequest.materials ? styles.valueText : styles.placeholderText
                }
              >
                {workRequest.materials || 'Add materials…'}
              </Text>
            </Editable>
          )}
        </Row>

        {/* Pickup Required — Yes/No pills; Yes reveals the location. */}
        <Row icon="truck" label="Pickup Required">
          <View style={styles.pickupRow}>
            {([true, false] as const).map((choice) => {
              const active = workRequest.pickupRequired === choice;
              return (
                <Pressable
                  key={String(choice)}
                  style={[styles.pickupChoice, active && styles.pickupChoiceOn]}
                  onPress={() => changePickupRequired(choice)}
                >
                  <Text
                    style={[
                      styles.pickupChoiceText,
                      active && styles.pickupChoiceTextOn,
                    ]}
                  >
                    {choice ? 'Yes' : 'No'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {workRequest.pickupRequired === true &&
            (editing === 'pickup-location' ? (
              <TextInput
                style={styles.textEditor}
                value={draft}
                onChangeText={setDraft}
                onBlur={commitPickupLocation}
                placeholder="Where does the crew pick up?"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
            ) : (
              <Editable
                onPress={() =>
                  startEdit('pickup-location', workRequest.pickupLocation ?? '')
                }
              >
                <Text
                  style={
                    workRequest.pickupLocation
                      ? styles.valueText
                      : styles.placeholderText
                  }
                >
                  {workRequest.pickupLocation || 'Add the pickup location…'}
                </Text>
              </Editable>
            ))}
        </Row>

        {/* Notes */}
        <Row icon="edit-3" label="Notes">
          {editing === 'notes' ? (
            <TextInput
              style={[styles.textEditor, styles.multiline]}
              value={draft}
              onChangeText={setDraft}
              onBlur={commitNotes}
              placeholder="Anything else the crew or scheduler should know…"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              multiline
            />
          ) : (
            <Editable onPress={() => startEdit('notes', workRequest.notes ?? '')}>
              <Text
                style={
                  workRequest.notes ? styles.valueText : styles.placeholderText
                }
              >
                {workRequest.notes || 'Add notes…'}
              </Text>
            </Editable>
          )}
        </Row>

        {/* Installer-authored field notes (read-only here). */}
        {workRequest.fieldNotes ? (
          <Row icon="message-square" label="Field notes (installers)">
            <Text style={styles.valueText}>{workRequest.fieldNotes}</Text>
          </Row>
        ) : null}

        {/* Photos — from every role with access to the card, not just
            installers. */}
        <Row
          icon="image"
          label={`Photos${photos.length > 0 ? ` (${photos.length})` : ''}`}
        >
          {photos.length === 0 ? (
            <Text style={styles.mutedText}>
              No photos for this work request yet.
            </Text>
          ) : (
            <JobPhotoGrid
              photos={photos}
              onPhotoPress={(photo, sorted) =>
                setViewer({
                  photos: sorted,
                  index: sorted.findIndex((p) => p.id === photo.id),
                })
              }
            />
          )}
        </Row>

        {workRequest.createdAt ? (
          <Text style={styles.createdOn}>
            Created on {format(new Date(workRequest.createdAt), 'MMMM d, yyyy')}
          </Text>
        ) : null}
      </ScrollView>

      {/* Create mode: the ONLY difference from viewing a card — Cancel /
          Create Work Request at the bottom (plus the validation error). */}
      {creating && (
        <View style={styles.createFooter}>
          {/* Missing-flashing warning: appears only after a blocked Create
              click, and disappears on its own once a flashing material is
              typed on this request (or set on the job). */}
          {flashingWarned && missingFlashing && (
            <View style={styles.prereqWarning}>
              <Feather name="alert-triangle" size={14} color={colors.warning} />
              <Text style={styles.prereqText}>
                This job&apos;s Window Opening Flashing Material isn&apos;t set.
                Type one into this work request&apos;s Window Opening Flashing
                Material field (add the Windows scope to see it) — or set it in
                the parent job&apos;s details, where it applies to every future
                work request.
              </Text>
            </View>
          )}
          {createError ? (
            <Text style={styles.createError}>{createError}</Text>
          ) : null}
          <View style={styles.createActions}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.pressed,
              ]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                pressed && styles.pressed,
              ]}
              onPress={submitCreate}
            >
              <Text style={styles.submitText}>Create Work Request</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const photoViewer = (
    <PhotoViewerModal
      photos={viewer?.photos ?? []}
      initialIndex={viewer?.index ?? null}
      onClose={() => setViewer(null)}
    />
  );

  if (variant === 'sidebar') {
    return (
      <>
        {panel}
        {photoViewer}
      </>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, popupShifted && styles.overlayShifted]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        {panel}
      </View>
      {photoViewer}
    </Modal>
  );
}

/**
 * Wraps an editable value: the background highlights on hover so it's obvious
 * a click switches it into edit mode.
 */
function Editable({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: PressState) => [
        styles.editable,
        style,
        (hovered || pressed) && styles.editableHover,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** GCal-style row: a slim icon column, then label + content. */
function Row({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  label?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={17} color={colors.textSecondary} />
      </View>
      <View style={styles.rowBody}>
        {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
        {children}
      </View>
    </View>
  );
}

/** Inline confirm strip for guarded changes (status, readiness "Now"). */
function ConfirmBar({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={styles.confirmBar}>
      <Text style={styles.confirmBarText}>{message}</Text>
      <View style={styles.confirmBarActions}>
        <Pressable
          style={({ pressed }) => [styles.confirmNo, pressed && styles.pressed]}
          onPress={onCancel}
        >
          <Text style={styles.confirmNoText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.confirmYes, pressed && styles.pressed]}
          onPress={onConfirm}
        >
          <Text style={styles.confirmYesText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  // Shifted left of the job dashboard sidebar (640) so creating a work
  // request from a job's page shows both side by side.
  overlayShifted: {
    paddingRight: 640 + spacing.xl,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    ...modalShadow,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  // The work requests pages open the same panel as a right-hand sidebar, sized
  // like the job dashboard sidebar.
  sidebarPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 640,
    maxWidth: '88%',
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    ...modalShadow,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 32,
    minWidth: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  iconButtonHover: {
    backgroundColor: colors.surfaceLight,
  },
  deleteArmed: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
  },
  deleteArmedText: {
    color: colors.textOnAccent,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Parent job + title as one block (parent directly above the name, like
  // the mobile installer view).
  header: {
    gap: 2,
    // Keep the crew tooltip/menu above the rows that follow.
    zIndex: 30,
  },
  parentJobText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 12,
    // Line up with the title text: crew-square margin + square + row gap +
    // the title Editable's own inset.
    paddingLeft: 5 + 14 + spacing.md + spacing.sm,
  },
  parentJobLinkWrap: {
    alignSelf: 'flex-start',
  },
  pressedLink: {
    opacity: 0.7,
  },
  parentJobPicker: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  noJobToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  noJobText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  noJobTextOn: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  prereqWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningDim,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  prereqText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  crewSquareWrap: {
    marginLeft: 5,
  },
  titleDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleDotEmpty: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.textTertiary,
  },
  titleDotSlash: {
    width: 18,
    height: 1.5,
    backgroundColor: colors.textTertiary,
    transform: [{ rotate: '-45deg' }],
  },
  crewTooltip: {
    width: 160,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  crewTooltipText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  crewMenu: {
    position: 'absolute',
    top: 20,
    left: -4,
    width: 200,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
  },
  titleEditable: {
    flex: 1,
  },
  titleText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 20,
  },
  titlePlaceholder: {
    color: colors.textTertiary,
  },
  titleInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    outlineWidth: 0,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  rowIcon: {
    width: 26,
    alignItems: 'center',
    paddingTop: 4,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rowLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: spacing.sm,
  },
  // Hover highlight that hints "click to edit" (requirement #1).
  editable: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  editableHover: {
    backgroundColor: colors.surfaceLight,
  },
  valueText: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  mutedText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: spacing.sm,
    paddingVertical: 3,
  },
  placeholderText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  statusEditable: {
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  // Matches the Editable's inset so the static create-mode pill sits where
  // the interactive one does.
  statusStatic: {
    alignSelf: 'flex-start',
    padding: 3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  statusNoteText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  menu: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    alignSelf: 'stretch',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  menuItemHover: {
    backgroundColor: colors.border,
  },
  menuDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  menuText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  menuTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.warningDim,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmBarText: {
    flex: 1,
    minWidth: 180,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  confirmBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmYes: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  confirmYesText: {
    color: colors.textOnAccent,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  confirmNo: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  confirmNoText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  scopeEdit: {
    gap: spacing.xs,
  },
  doneLink: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  chipText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  taskStack: {
    gap: 2,
  },
  taskBlock: {
    gap: spacing.xs,
  },
  taskIssues: {
    marginLeft: spacing.lg,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  taskPhotosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginLeft: spacing.lg,
  },
  taskPhotoThumb: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  taskVideoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueStack: {
    gap: spacing.sm,
  },
  taskDoneText: {
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  textEditor: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  multiline: {
    minHeight: 56,
  },
  addTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  addTaskText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  pairRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  priorityNow: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
  },
  createdOn: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingTop: spacing.sm,
  },
  pairCol: {
    flex: 1,
    gap: spacing.xs,
  },
  pickupRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  pickupChoice: {
    minWidth: 56,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  pickupChoiceOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  pickupChoiceText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  pickupChoiceTextOn: {
    color: colors.primary,
  },
  flashingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flashingValue: {
    flex: 1,
  },
  // Create-mode footer: validation error + Cancel / Create Work Request.
  createFooter: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createError: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  createActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  submitButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  submitText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
}));
