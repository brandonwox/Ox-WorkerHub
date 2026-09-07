import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { NewWorkRequestInput } from '@/components/desktop/WorkRequestQuickView';
import { FormInput } from '@/components/FormInput';
import { WorkRequestOfficeFields } from '@/components/mobile/WorkRequestOfficeFields';
import { jobsForFieldSuper, useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job, WorkRequest } from '@/types';
import { activeJobs } from '@/utils/jobArchive';
import { jobDisplayName } from '@/utils/jobName';
import { jobAllowsWindows } from '@/utils/jobScopes';
import { newWorkRequestPayload } from '@/utils/workRequestCreate';

interface Props {
  visible: boolean;
  /** Pre-link this job (creation launched from its page). */
  initialJobId?: string;
  onClose: () => void;
}

/** Blank draft backing the sheet — the same shape as a stored card. */
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

/**
 * Phone-layout work request creation — the mobile counterpart of the web
 * quick view's create mode. Pick the parent job (assigned jobs first, every
 * active job available — helping out needs no assignment) or mark the request
 * standalone and type its address; the office fields below are the shared
 * WorkRequestOfficeFields editor working on a local draft. Validation and
 * the resulting addWorkRequest payload are the web's, so a card created here
 * is indistinguishable from one created on the console.
 */
export function CreateWorkRequestSheet({ visible, initialJobId, onClose }: Props) {
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);
  const addWorkRequest = useAppStore((s) => s.addWorkRequest);
  const flash = useAppStore((s) => s.flash);

  const [draft, setDraft] = useState<WorkRequest>(emptyDraft);
  const [noJob, setNoJob] = useState(false);
  const [pickingJob, setPickingJob] = useState(false);
  const [jobQuery, setJobQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Assigned jobs lead the picker; every other active job follows.
  const jobs = useMemo(() => activeJobs(allJobs), [allJobs]);
  const myJobIds = useMemo(
    () => new Set(me ? jobsForFieldSuper(jobs, me.id).map((j) => j.id) : []),
    [jobs, me]
  );
  const pickerJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    const label = (j: Job) => jobDisplayName(j, jobs);
    return jobs
      .filter(
        (j) =>
          !q ||
          label(j).toLowerCase().includes(q) ||
          (j.po ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const am = myJobIds.has(a.id) ? 0 : 1;
        const bm = myJobIds.has(b.id) ? 0 : 1;
        return am !== bm ? am - bm : label(a).localeCompare(label(b));
      });
  }, [jobs, jobQuery, myJobIds]);

  const parentJob = draft.jobId
    ? jobs.find((j) => j.id === draft.jobId)
    : undefined;

  // Fresh draft every time the sheet opens (pre-linking the launching job).
  useEffect(() => {
    if (!visible) return;
    const seed = emptyDraft();
    const initial = initialJobId ? jobs.find((j) => j.id === initialJobId) : undefined;
    if (initial) {
      seed.jobId = initial.id;
      seed.address = initial.location ?? '';
    }
    setDraft(seed);
    setNoJob(false);
    setPickingJob(!initial);
    setJobQuery('');
    setError(null);
    // `jobs` is deliberately not a dep — a background refresh must not wipe an
    // in-progress draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialJobId]);

  const applyChange = (patch: Partial<WorkRequest>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setError(null);
  };

  const pickJob = (job: Job) => {
    const scopes = draft.scopes ?? [];
    // A job without the Windows scope drops the draft's Windows scope (and
    // its flashing material) — those never show for such jobs.
    const dropWindows = !jobAllowsWindows(job) && scopes.includes('Windows');
    applyChange({
      jobId: job.id,
      jobIds: undefined,
      address: job.location ?? '',
      ...(dropWindows
        ? {
            scopes: scopes.filter((s) => s !== 'Windows'),
            flashingMaterial: undefined,
          }
        : {}),
    });
    setNoJob(false);
    setPickingJob(false);
  };

  const toggleNoJob = () => {
    const on = !noJob;
    setNoJob(on);
    if (on) {
      applyChange({ jobId: undefined, jobIds: undefined, address: '' });
      setPickingJob(false);
    } else {
      setPickingJob(true);
    }
  };

  const submit = () => {
    const scopes = draft.scopes ?? [];
    const tasks = draft.tasks ?? [];
    if (!noJob && !parentJob) {
      setError('Pick a parent job — or mark this request as having no parent job.');
      return;
    }
    if (noJob && !draft.address.trim()) {
      setError('Type the jobsite address for this work request.');
      return;
    }
    if (parentJob && !parentJob.location.trim()) {
      setError('This job has no jobsite address yet — set it on the Jobs tab first.');
      return;
    }
    const includesWindows = jobAllowsWindows(parentJob) && scopes.includes('Windows');
    if (
      parentJob &&
      includesWindows &&
      !parentJob.flashingMaterial?.trim() &&
      !draft.flashingMaterial?.trim()
    ) {
      setError(
        'This job has no Window Opening Flashing Material yet — type one in the flashing field, or set it on the Jobs tab.'
      );
      return;
    }
    if (!draft.title.trim()) {
      setError('Add a title.');
      return;
    }
    if (scopes.length === 0) {
      setError('Select at least one scope.');
      return;
    }
    const cleanTasks = tasks.map((t) => t.text.trim()).filter((t) => t.length > 0);
    if (cleanTasks.length === 0) {
      setError('Add at least one task.');
      return;
    }
    if (!draft.readiness?.trim()) {
      setError('Choose whether this work request is ready for installers.');
      return;
    }
    if (!draft.priority) {
      setError('Choose a priority.');
      return;
    }
    if (!draft.priorityStartDate || !draft.priorityEndDate) {
      setError('Set the priority start and end dates.');
      return;
    }
    if (draft.pickupRequired == null) {
      setError('Answer whether a pickup is required.');
      return;
    }
    if (draft.pickupRequired && !draft.pickupLocation?.trim()) {
      setError('Specify where the pickup is.');
      return;
    }
    if (scopes.includes('Delivery') && draft.deliveryCountTotal == null) {
      setError('Set the delivery count for the Delivery scope.');
      return;
    }
    const input: NewWorkRequestInput = {
      jobId: parentJob?.id,
      jobIds: undefined,
      address: noJob ? draft.address.trim() : undefined,
      title: draft.title.trim(),
      startTime: draft.startTime,
      scopes,
      tasks: cleanTasks,
      readiness: draft.readiness.trim(),
      priority: draft.priority,
      priorityStartDate: draft.priorityStartDate,
      priorityEndDate: draft.priorityEndDate,
      materials: draft.materials?.trim() || undefined,
      // An untouched flashing field falls back to the parent job's material.
      flashingMaterial: includesWindows
        ? (draft.flashingMaterial ?? parentJob?.flashingMaterial)?.trim() || undefined
        : undefined,
      deliveryCountTotal: scopes.includes('Delivery') ? draft.deliveryCountTotal : undefined,
      windowsCasements: includesWindows ? draft.windowsCasements : undefined,
      pickupRequired: draft.pickupRequired,
      pickupLocation: draft.pickupRequired ? draft.pickupLocation?.trim() : undefined,
      notes: draft.notes?.trim() || undefined,
    };
    const created = addWorkRequest(newWorkRequestPayload(input, jobs));
    flash(`Work request "${created.title}" created`, 'success');
    onClose();
  };

  const jobLabel = parentJob
    ? `${jobDisplayName(parentJob, jobs)}${parentJob.po ? ` · ${parentJob.po}` : ''}`
    : noJob
      ? 'No parent job'
      : 'Pick a job…';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>New Work Request</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Job link — fixed once the card exists, so it's picked first. */}
            <View style={styles.field}>
              <Text style={styles.label}>Job</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.jobField,
                  pickingJob && styles.jobFieldOpen,
                  pressed && styles.pressed,
                ]}
                onPress={() => setPickingJob((on) => !on)}
              >
                <Text
                  style={parentJob || noJob ? styles.jobFieldText : styles.jobFieldPlaceholder}
                  numberOfLines={1}
                >
                  {jobLabel}
                </Text>
                <Feather
                  name={pickingJob ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
              {pickingJob && (
                <View style={styles.picker}>
                  <View style={styles.searchRow}>
                    <Feather name="search" size={14} color={colors.textTertiary} />
                    <TextInput
                      style={styles.searchInput}
                      value={jobQuery}
                      onChangeText={setJobQuery}
                      placeholder="Search jobs by name or PO…"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
                    onPress={toggleNoJob}
                  >
                    <Feather
                      name={noJob ? 'check-square' : 'square'}
                      size={16}
                      color={noJob ? colors.primary : colors.textSecondary}
                    />
                    <Text style={styles.pickerRowText}>No parent job (standalone)</Text>
                  </Pressable>
                  {pickerJobs.length === 0 ? (
                    <Text style={styles.hint}>No jobs match.</Text>
                  ) : (
                    pickerJobs.slice(0, 40).map((job) => {
                      const active = job.id === draft.jobId;
                      return (
                        <Pressable
                          key={job.id}
                          style={({ pressed }) => [
                            styles.pickerRow,
                            active && styles.pickerRowOn,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => pickJob(job)}
                        >
                          <View style={styles.pickerRowBody}>
                            <Text style={styles.pickerJobName} numberOfLines={1}>
                              {jobDisplayName(job, jobs)}
                            </Text>
                            <Text style={styles.pickerJobMeta} numberOfLines={1}>
                              {[job.po, myJobIds.has(job.id) ? 'Assigned to you' : '']
                                .filter(Boolean)
                                .join(' · ') || ' '}
                            </Text>
                          </View>
                          {active && (
                            <Feather name="check" size={16} color={colors.primary} />
                          )}
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}
              {noJob && (
                <FormInput
                  label="Jobsite address"
                  value={draft.address}
                  onChangeText={(text) => applyChange({ address: text })}
                  placeholder="123 Main St, Park City, UT"
                />
              )}
              {parentJob && !pickingJob && (
                <Text style={styles.hint}>
                  {parentJob.location || 'This job has no jobsite address yet.'}
                </Text>
              )}
            </View>

            <WorkRequestOfficeFields
              card={draft}
              parentJob={parentJob}
              creating
              onChange={applyChange}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
              onPress={submit}
            >
              <Text style={styles.submitText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '94%',
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 18,
    },
    body: {
      gap: spacing.lg,
    },
    pressed: {
      opacity: 0.7,
    },
    field: {
      gap: spacing.xs + 2,
    },
    label: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    hint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
    },
    jobField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md + 2,
    },
    jobFieldOpen: {
      borderColor: colors.primary,
    },
    jobFieldText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 15,
    },
    jobFieldPlaceholder: {
      flex: 1,
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    picker: {
      gap: spacing.xs,
      backgroundColor: colors.surfaceLight,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
      paddingVertical: spacing.sm + 2,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
    },
    pickerRowOn: {
      backgroundColor: colors.primaryDim,
    },
    pickerRowText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    pickerRowBody: {
      flex: 1,
      gap: 1,
    },
    pickerJobName: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    pickerJobMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    submitButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    submitText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
  })
);
