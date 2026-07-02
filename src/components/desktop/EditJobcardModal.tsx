import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Combobox, MultiCombobox } from '@/components/desktop/Combobox';
import { FormInput } from '@/components/FormInput';
import { colors, fonts, radii, spacing } from '@/theme';
import {
  Job,
  Jobcard,
  JobScope,
  JOB_SCOPES,
  PRIORITY_PRESETS,
  READINESS_PRESETS,
} from '@/types';

/** Fields the PM may edit on an existing jobcard. */
export interface JobcardChanges {
  jobId: string;
  address: string;
  title: string;
  scopes: JobScope[];
  tasks: string[];
  readiness: string;
  priority: string;
  materials?: string;
  /** Per-card Window Opening Flashing Material (Windows scope only). */
  flashingMaterial?: string;
  notes?: string;
}

interface Props {
  /** The jobcard being edited, or null when the modal is closed. */
  jobcard: Jobcard | null;
  /** Active Jobs the card can be parented to. */
  jobs: Job[];
  onClose: () => void;
  onSave: (id: string, changes: JobcardChanges) => void;
}

const MIN_TASK_LEN = 15;

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));
const READINESS_OPTIONS = READINESS_PRESETS.map((r) => ({ value: r, label: r }));
const PRIORITY_OPTIONS = PRIORITY_PRESETS.map((p) => ({ value: p, label: p }));

export function EditJobcardModal({ jobcard, jobs, onClose, onSave }: Props) {
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  const [tasks, setTasks] = useState<string[]>(['']);
  const [readiness, setReadiness] = useState('');
  const [readyConfirmed, setReadyConfirmed] = useState(false);
  const [priority, setPriority] = useState('');
  const [flashing, setFlashing] = useState('');
  const [materials, setMaterials] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever a different jobcard is opened.
  useEffect(() => {
    if (!jobcard) return;
    setJobId(jobcard.jobId ?? '');
    setTitle(jobcard.title);
    setScopes(jobcard.scopes ?? []);
    setTasks(jobcard.tasks && jobcard.tasks.length > 0 ? jobcard.tasks : ['']);
    setReadiness(jobcard.readiness ?? '');
    // A card already marked "Now" was confirmed when created — keep it confirmed
    // so the PM isn't forced to re-check it on every edit.
    setReadyConfirmed(jobcard.readiness === 'Now');
    setPriority(jobcard.priority ?? '');
    setFlashing(jobcard.flashingMaterial ?? '');
    setMaterials(jobcard.materials ?? '');
    setNotes(jobcard.notes ?? '');
    setError(null);
  }, [jobcard]);

  const jobOptions = useMemo(
    () => jobs.map((j) => ({ value: j.id, label: j.name })),
    [jobs]
  );
  const selectedJob = jobs.find((j) => j.id === jobId);
  const includesWindows = scopes.includes('Windows');

  const setTaskAt = (index: number, value: string) =>
    setTasks((prev) => prev.map((t, i) => (i === index ? value : t)));
  const addTask = () => setTasks((prev) => [...prev, '']);
  const removeTask = (index: number) =>
    setTasks((prev) => prev.filter((_, i) => i !== index));

  const onReadinessChange = (value: string) => {
    setReadiness(value);
    if (value !== 'Now') setReadyConfirmed(false);
  };

  const save = () => {
    if (!jobcard) return;
    if (!selectedJob) {
      setError('Pick a parent job for this jobcard.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (scopes.length === 0) {
      setError('Select at least one scope.');
      return;
    }
    const cleanTasks = tasks.map((t) => t.trim()).filter((t) => t.length > 0);
    if (cleanTasks.length === 0) {
      setError('Add at least one task.');
      return;
    }
    if (cleanTasks.some((t) => t.length < MIN_TASK_LEN)) {
      setError(`Each task must be at least ${MIN_TASK_LEN} characters.`);
      return;
    }
    if (!readiness.trim()) {
      setError('Choose when this jobcard is ready for installers.');
      return;
    }
    if (readiness === 'Now' && !readyConfirmed) {
      setError('Confirm the job and tasks are ready before marking it "Now".');
      return;
    }
    if (!priority.trim()) {
      setError('Choose a priority.');
      return;
    }

    onSave(jobcard.id, {
      jobId: selectedJob.id,
      address: selectedJob.location ?? jobcard.address,
      title: title.trim(),
      scopes,
      tasks: cleanTasks,
      readiness: readiness.trim(),
      priority: priority.trim(),
      materials: materials.trim() || undefined,
      flashingMaterial: includesWindows
        ? flashing.trim() || undefined
        : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      visible={jobcard != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit jobcard</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Parent job — searchable */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Parent job</Text>
              {jobs.length === 0 ? (
                <Text style={styles.noJobs}>No active jobs available.</Text>
              ) : (
                <Combobox
                  value={jobId}
                  options={jobOptions}
                  onChange={setJobId}
                  placeholder="Search jobs…"
                />
              )}
            </View>

            {/* Title */}
            <FormInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="Install windows"
              autoCapitalize="sentences"
            />

            {/* Scope — searchable multi-select */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Scope (select one or more)</Text>
              <MultiCombobox
                values={scopes}
                options={SCOPE_OPTIONS}
                onChange={(vals) => setScopes(vals as JobScope[])}
                placeholder="Search scopes…"
              />
            </View>

            {/* Tasks (at least one ≥ 15 chars) */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>
                Tasks (each at least {MIN_TASK_LEN} characters)
              </Text>
              {tasks.map((task, index) => (
                <View key={index} style={styles.taskRow}>
                  <TextInput
                    style={styles.taskInput}
                    value={task}
                    onChangeText={(t) => setTaskAt(index, t)}
                    placeholder="Describe a task for the installers…"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                  />
                  {tasks.length > 1 && (
                    <Pressable
                      style={styles.taskRemove}
                      onPress={() => removeTask(index)}
                      hitSlop={6}
                    >
                      <Feather name="x" size={16} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable style={styles.addTask} onPress={addTask}>
                <Feather name="plus" size={15} color={colors.primary} />
                <Text style={styles.addTaskText}>Add task</Text>
              </Pressable>
            </View>

            {/* Readiness + priority share a row on the wide desktop layout */}
            <View style={styles.row}>
              {/* Ready for installers — searchable, custom allowed via Enter */}
              <View style={[styles.field, styles.col]}>
                <Text style={styles.fieldLabel}>Ready for installers</Text>
                <Combobox
                  value={readiness}
                  options={READINESS_OPTIONS}
                  onChange={onReadinessChange}
                  placeholder="Now, Soon, Over 2 Weeks… or type your own + Enter"
                  allowCustom
                />
              </View>

              {/* Priority — searchable, custom allowed via Enter */}
              <View style={[styles.field, styles.col]}>
                <Text style={styles.fieldLabel}>Priority</Text>
                <Combobox
                  value={priority}
                  options={PRIORITY_OPTIONS}
                  onChange={setPriority}
                  placeholder="Now, Tomorrow, This Week… or type your own + Enter"
                  allowCustom
                />
              </View>
            </View>

            {readiness === 'Now' && (
              <Pressable
                style={[styles.confirm, readyConfirmed && styles.confirmOn]}
                onPress={() => setReadyConfirmed((v) => !v)}
              >
                <Feather
                  name={readyConfirmed ? 'check-square' : 'square'}
                  size={18}
                  color={readyConfirmed ? colors.success : colors.warning}
                />
                <Text style={styles.confirmText}>
                  I&apos;ve double-checked the job and tasks are ready for
                  installers to arrive now.
                </Text>
              </Pressable>
            )}

            {/* Window Opening Flashing Material (Windows scope only) */}
            {includesWindows && (
              <FormInput
                label="Window Opening Flashing Material"
                value={flashing}
                onChangeText={setFlashing}
                placeholder={
                  selectedJob?.flashingMaterial
                    ? `Defaults to ${selectedJob.flashingMaterial}`
                    : 'e.g. Clear Anodized Aluminum'
                }
              />
            )}

            {/* Materials needed (optional) */}
            <FormInput
              label="Materials needed (optional)"
              value={materials}
              onChangeText={setMaterials}
              placeholder="Gaskets, setting blocks, structural silicone…"
              multiline
              style={styles.multiline}
            />

            {/* Notes */}
            <FormInput
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else the crew or scheduler should know…"
              multiline
              style={styles.multiline}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={save}>
              <Text style={styles.submitText}>Save changes</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: colors.overlay,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
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
    fontSize: 20,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    gap: spacing.lg,
    paddingBottom: spacing.xs,
  },
  field: {
    gap: spacing.xs + 2,
  },
  // Two-column row for paired fields on the wide desktop layout.
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  col: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  noJobs: {
    color: colors.warning,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  taskRemove: {
    padding: spacing.sm,
  },
  addTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  addTaskText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    backgroundColor: colors.warningDim,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  confirmOn: {
    backgroundColor: colors.successDim,
    borderColor: colors.success,
  },
  confirmText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  multiline: {
    minHeight: 64,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
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
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
