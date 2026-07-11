import { Feather } from '@expo/vector-icons';
import { format, parse } from 'date-fns';
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
import { IssueCard } from '@/components/issues/IssueCard';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobcardPhotos } from '@/components/photos/useJobPhotos';
import { jobcardStatusColors } from '@/components/StatusPill';
import { useAppStore, uuid } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing } from '@/theme';
import {
  Job,
  JOB_SCOPES,
  JOBCARD_STATUSES,
  JobcardStatus,
  JobScope,
  READINESS_PRESETS,
} from '@/types';
import { buildCrewColorMap, crewColorFrom } from '@/utils/crewColors';
import { jobAllowsWindows } from '@/utils/jobScopes';
import { effectivePriority } from '@/utils/priorityRange';
import { formatJobWindow } from '@/utils/time';
import { useDismissOnOutsideClick } from '@/utils/useOutsideClick';

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));
const READINESS_OPTIONS = READINESS_PRESETS.map((r) => ({ value: r, label: r }));

/** Which field is being edited inline. Only one edits at a time. */
type EditField =
  | 'title'
  | 'job'
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
  /** Id of the jobcard to show, or null when the popup is closed. */
  jobcardId: string | null;
  /** Jobs in the viewer's scope — parent-job options and lookups. */
  jobs: Job[];
  onClose: () => void;
  onDelete: (id: string) => void;
}

/**
 * Google-Calendar-style quick view of a jobcard: a compact read-first popup
 * where every editable value highlights on hover and turns into its editor on
 * click. Edits save automatically as they're made (no Save/Cancel) — the only
 * guarded actions are delete (two-click confirm), status changes, and marking
 * readiness "Now" (both confirm inline before applying).
 */
export function JobcardQuickView({
  jobcardId,
  jobs,
  onClose,
  onDelete,
}: Props) {
  // Read the live card from the store so autosaved edits render back instantly.
  const jobcard = useAppStore((s) => s.jobcards.find((c) => c.id === jobcardId));
  const jobIssues = useAppStore((s) => s.jobIssues);
  const updateJobcard = useAppStore((s) => s.updateJobcard);
  const setJobcardStatus = useAppStore((s) => s.setJobcardStatus);
  const flash = useAppStore((s) => s.flash);
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const assignJobcard = useAppStore((s) => s.assignJobcard);
  const unassignJobcard = useAppStore((s) => s.unassignJobcard);

  const [editing, setEditing] = useState<EditField | null>(null);
  /** Text draft for whichever text field is being edited; committed on blur. */
  const [draft, setDraft] = useState('');
  /** In-progress priority edit (null = seed from the card when editing opens). */
  const [priorityDraft, setPriorityDraft] = useState<PriorityValue | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<JobcardStatus | null>(null);
  const [pendingReadinessNow, setPendingReadinessNow] = useState(false);
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
  // jobcard list's status pill). Null when the Scheduler hasn't placed it.
  const scheduledDate = useMemo(() => {
    const dates = assignments
      .filter((a) => a.jobcardId === jobcardId)
      .map((a) => a.date)
      .sort();
    if (dates.length === 0) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    return dates.find((d) => d >= today) ?? dates[dates.length - 1];
  }, [assignments, jobcardId]);

  const photos = useJobcardPhotos(jobcard?.id);
  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);

  // Reset every transient state when a different card is opened.
  useEffect(() => {
    setEditing(null);
    setDraft('');
    setPriorityDraft(null);
    setStatusMenuOpen(false);
    setPendingStatus(null);
    setPendingReadinessNow(false);
    setConfirmDelete(false);
    setCrewMenuOpen(false);
    setCrewSquareHovered(false);
  }, [jobcardId]);

  // An armed delete disarms itself after 4s if the second click never comes.
  useEffect(() => {
    if (!confirmDelete) return;
    const timer = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmDelete]);

  if (!jobcard) return null;

  const palette =
    jobcardStatusColors[jobcard.status] ?? jobcardStatusColors.Untouched;
  const parentJob = jobs.find((j) => j.id === jobcard.jobId);
  const activeJobs = jobs.filter((j) => j.status === 'Active');
  // Offer active jobs plus the card's own parent (which may be archived) so a
  // reparent never silently drops an archived-job parent.
  const jobOptions = (
    parentJob && !activeJobs.some((j) => j.id === parentJob.id)
      ? [parentJob, ...activeJobs]
      : activeJobs
  ).map((j) => ({ value: j.id, label: j.name }));
  const tasks = jobcard.tasks ?? [];
  const scopes = jobcard.scopes ?? [];
  // Installer-raised issues on this card, newest first — nested under the task
  // they were raised for, mirroring the installer's jobcard screen.
  const cardIssues = jobIssues
    .filter((issue) => issue.jobcardId === jobcard.id)
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
  // Flashing only exists when the jobcard covers windows AND the parent job's
  // scopes allow window work at all.
  const windowsAllowed = jobAllowsWindows(parentJob);
  const includesWindows = windowsAllowed && scopes.includes('Windows');
  const scopeOptions = windowsAllowed
    ? SCOPE_OPTIONS
    : SCOPE_OPTIONS.filter((o) => o.value !== 'Windows');
  const timeWindow = formatJobWindow(jobcard.startTime, jobcard.endTime);
  // Crew assignment drives the title square: permanent crews first so colors
  // match the scheduler calendar (same ordering as CalendarBoard).
  const cardAssignments = assignments.filter((a) => a.jobcardId === jobcard.id);
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

  // --- Autosave commits (each fires updateJobcard directly) -----------------

  const commitTitle = () => {
    const t = draft.trim();
    setEditing(null);
    if (!t) {
      flash('Title is required — change discarded.', 'warning');
      return;
    }
    if (t !== jobcard.title) updateJobcard(jobcard.id, { title: t });
  };

  const changeJob = (nextId: string) => {
    setEditing(null);
    const next = jobs.find((j) => j.id === nextId);
    if (!next || next.id === jobcard.jobId) return;
    // Moving to a job without the Windows scope drops the card's Windows scope
    // (and its flashing material) — those never show for such jobs.
    const dropWindows =
      !jobAllowsWindows(next) && scopes.includes('Windows');
    // The address follows the parent job, exactly like the create flow.
    updateJobcard(jobcard.id, {
      jobId: next.id,
      address: next.location ?? jobcard.address,
      ...(dropWindows
        ? {
            scopes: scopes.filter((s) => s !== 'Windows'),
            flashingMaterial: undefined,
          }
        : {}),
    });
  };

  const changeScopes = (vals: string[]) => {
    if (vals.length === 0) {
      flash('A jobcard needs at least one scope.', 'warning');
      return;
    }
    const next = vals as JobScope[];
    updateJobcard(jobcard.id, {
      scopes: next,
      // Flashing material only means anything with the Windows scope.
      ...(next.includes('Windows') ? {} : { flashingMaterial: undefined }),
    });
  };

  const commitTask = (index: number) => {
    const t = draft.trim();
    setEditing(null);
    if (!t) {
      if (tasks.length <= 1) {
        flash('A jobcard needs at least one task.', 'warning');
        return;
      }
      updateJobcard(jobcard.id, { tasks: tasks.filter((_, i) => i !== index) });
      return;
    }
    if (t !== tasks[index].text) {
      // Text edits keep the task's id (and check-off state) intact so
      // installer check-offs and per-task issues stay linked.
      updateJobcard(jobcard.id, {
        tasks: tasks.map((task, i) => (i === index ? { ...task, text: t } : task)),
      });
    }
  };

  const commitNewTask = () => {
    const t = draft.trim();
    setEditing(null);
    if (!t) return;
    updateJobcard(jobcard.id, {
      tasks: [...tasks, { id: uuid(), text: t, done: false }],
    });
  };

  const changeReadiness = (value: string) => {
    setEditing(null);
    const v = value.trim();
    if (!v || v === jobcard.readiness) return;
    // "Now" pings installers — keep the explicit double-check before applying.
    if (v === 'Now') {
      setPendingReadinessNow(true);
      return;
    }
    updateJobcard(jobcard.id, { readiness: v });
  };

  // Every complete change autosaves (quick-view style); the editor stays open
  // so both dates can be adjusted, and closes via its Done button.
  const changePriority = (value: PriorityValue) => {
    setPriorityDraft(value);
    if (!priorityValueComplete(value)) return;
    if (
      value.priority === jobcard.priority &&
      value.startDate === (jobcard.priorityStartDate ?? '') &&
      value.endDate === (jobcard.priorityEndDate ?? '')
    ) {
      return;
    }
    updateJobcard(jobcard.id, {
      priority: value.priority,
      priorityStartDate: value.startDate,
      priorityEndDate: value.endDate,
    });
  };

  // How the priority reads when not editing: "Now · Jul 11",
  // "This week · Jul 11 – Jul 18", or just the range for "Set dates".
  const cardPriority = effectivePriority(jobcard);
  const priorityDisplay = !jobcard.priority
    ? 'Set priority…'
    : cardPriority.range
      ? cardPriority.raw === 'Set dates' && !cardPriority.escalated
        ? cardPriority.range
        : `${cardPriority.label} · ${cardPriority.range}`
      : jobcard.priority;

  const commitFlashing = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== jobcard.flashingMaterial) {
      updateJobcard(jobcard.id, { flashingMaterial: v });
    }
  };

  const commitMaterials = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== jobcard.materials) updateJobcard(jobcard.id, { materials: v });
  };

  const changePickupRequired = (required: boolean) => {
    if (required === jobcard.pickupRequired) return;
    updateJobcard(jobcard.id, {
      pickupRequired: required,
      // "No" clears any stale location so it can't silently reappear.
      ...(required ? {} : { pickupLocation: undefined }),
    });
  };

  const commitPickupLocation = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== jobcard.pickupLocation) {
      updateJobcard(jobcard.id, { pickupLocation: v });
    }
  };

  const commitNotes = () => {
    setEditing(null);
    const v = draft.trim() || undefined;
    if (v !== jobcard.notes) updateJobcard(jobcard.id, { notes: v });
  };

  // --- Guarded actions -------------------------------------------------------

  const pickStatus = (status: JobcardStatus) => {
    setStatusMenuOpen(false);
    if (status === jobcard.status) return;
    setPendingStatus(status);
  };

  const confirmStatusChange = () => {
    if (pendingStatus) {
      setJobcardStatus(jobcard.id, pendingStatus);
      flash(`Status changed to "${pendingStatus}"`, 'success');
    }
    setPendingStatus(null);
  };

  const confirmReadinessNow = () => {
    updateJobcard(jobcard.id, { readiness: 'Now' });
    setPendingReadinessNow(false);
  };

  const remove = () => {
    // Two-click confirm — the first click arms the button, the second deletes.
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(jobcard.id);
    onClose();
  };

  const toggleCrewMenu = () => {
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
    cardAssignments.forEach((a) => unassignJobcard(a.id));
    dates.forEach((date) => assignJobcard(jobcard.id, crewId, date));
    flash(`Assigned to ${crewNameFor(crewId)}`, 'success');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          {/* Header action icons, Google-Calendar style. */}
          <View style={styles.headerActions}>
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
                  autoFocus
                />
              ) : (
                <Editable
                  onPress={() => startEdit('title', jobcard.title)}
                  style={styles.titleEditable}
                >
                  <Text style={styles.titleText}>{jobcard.title}</Text>
                </Editable>
              )}
            </View>

            {/* Parent job */}
            <Row icon="briefcase">
              {editing === 'job' ? (
                jobOptions.length > 0 ? (
                  <Combobox
                    value={jobcard.jobId ?? ''}
                    options={jobOptions}
                    onChange={changeJob}
                    placeholder="Search jobs…"
                    autoFocus
                    onDismiss={() => setEditing(null)}
                  />
                ) : (
                  <Text style={styles.mutedText}>No active jobs available.</Text>
                )
              ) : (
                <Editable onPress={() => setEditing('job')}>
                  <Text style={styles.valueText}>
                    {parentJob?.name ?? 'Unlinked job'}
                  </Text>
                </Editable>
              )}
            </Row>

            {/* Address + date + optional time window (read-only). */}
            <Row icon="map-pin">
              <Text style={styles.mutedText}>
                {jobcard.address || 'No address'}
              </Text>
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

            {/* Status — changeable, but always behind an inline confirm. */}
            <Row icon="activity" label="Status">
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
                      {jobcard.status}
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
                    {JOBCARD_STATUSES.map((status) => {
                      const active = jobcard.status === status;
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
                              { backgroundColor: jobcardStatusColors[status].fg },
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
              {pendingStatus && (
                <ConfirmBar
                  message={`Change status to “${pendingStatus}”?`}
                  confirmLabel="Change status"
                  onConfirm={confirmStatusChange}
                  onCancel={() => setPendingStatus(null)}
                />
              )}
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
                  {orphanIssues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      onPhotoPress={openPhoto}
                    />
                  ))}
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
                      value={jobcard.readiness ?? ''}
                      options={READINESS_OPTIONS}
                      onChange={changeReadiness}
                      placeholder="Now, Soon… or type + Enter"
                      allowCustom
                      autoFocus
                      onDismiss={() => setEditing(null)}
                    />
                  ) : (
                    <Editable onPress={() => setEditing('readiness')}>
                      <Text
                        style={
                          jobcard.readiness
                            ? styles.valueText
                            : styles.placeholderText
                        }
                      >
                        {jobcard.readiness || 'Set readiness…'}
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
                          priority: jobcard.priority ?? '',
                          startDate: jobcard.priorityStartDate ?? '',
                          endDate: jobcard.priorityEndDate ?? '',
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
                          jobcard.priority
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
                            : 'e.g. Clear Anodized Aluminum'
                        }
                        placeholderTextColor={colors.textTertiary}
                        autoFocus
                      />
                    ) : (
                      <Editable
                        onPress={() =>
                          startEdit('flashing', jobcard.flashingMaterial ?? '')
                        }
                      >
                        <Text
                          style={
                            jobcard.flashingMaterial
                              ? styles.valueText
                              : styles.placeholderText
                          }
                        >
                          {jobcard.flashingMaterial ??
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
                  onPress={() => startEdit('materials', jobcard.materials ?? '')}
                >
                  <Text
                    style={
                      jobcard.materials ? styles.valueText : styles.placeholderText
                    }
                  >
                    {jobcard.materials || 'Add materials…'}
                  </Text>
                </Editable>
              )}
            </Row>

            {/* Pickup Required — Yes/No pills; Yes reveals the location. */}
            <Row icon="truck" label="Pickup Required">
              <View style={styles.pickupRow}>
                {([true, false] as const).map((choice) => {
                  const active = jobcard.pickupRequired === choice;
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
              {jobcard.pickupRequired === true &&
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
                      startEdit('pickup-location', jobcard.pickupLocation ?? '')
                    }
                  >
                    <Text
                      style={
                        jobcard.pickupLocation
                          ? styles.valueText
                          : styles.placeholderText
                      }
                    >
                      {jobcard.pickupLocation || 'Add the pickup location…'}
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
                <Editable onPress={() => startEdit('notes', jobcard.notes ?? '')}>
                  <Text
                    style={
                      jobcard.notes ? styles.valueText : styles.placeholderText
                    }
                  >
                    {jobcard.notes || 'Add notes…'}
                  </Text>
                </Editable>
              )}
            </Row>

            {/* Installer-authored field notes (read-only here). */}
            {jobcard.fieldNotes ? (
              <Row icon="message-square" label="Field notes (installers)">
                <Text style={styles.valueText}>{jobcard.fieldNotes}</Text>
              </Row>
            ) : null}

            {/* Installer photos */}
            <Row
              icon="image"
              label={`Installer photos${photos.length > 0 ? ` (${photos.length})` : ''}`}
            >
              {photos.length === 0 ? (
                <Text style={styles.mutedText}>
                  No photos taken for this jobcard yet.
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

            {jobcard.createdAt ? (
              <Text style={styles.createdOn}>
                Created on {format(new Date(jobcard.createdAt), 'MMMM d, yyyy')}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
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
    maxWidth: 560,
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
    color: colors.textPrimary,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
    // Keep the crew tooltip/menu above the rows that follow.
    zIndex: 30,
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
    color: colors.textPrimary,
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
});
