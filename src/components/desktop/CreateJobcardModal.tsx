import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { colors, fonts, modalShadow, radii, spacing } from '@/theme';
import {
  Job,
  JobScope,
  JOB_SCOPES,
  PRIORITY_PRESETS,
  READINESS_PRESETS,
} from '@/types';
import { useTypewriter } from '@/utils/useTypewriter';

/** Payload the Field Super screen hands to `addJobcard`. */
export interface NewJobcardInput {
  jobId: string;
  title: string;
  scopes: JobScope[];
  tasks: string[];
  readiness: string;
  priority: string;
  materials?: string;
  /** Per-card Window Opening Flashing Material (defaults to the parent Job's). */
  flashingMaterial?: string;
  notes?: string;
}

interface Props {
  visible: boolean;
  /** Active Jobs the card can be parented to. */
  jobs: Job[];
  onClose: () => void;
  onSubmit: (input: NewJobcardInput) => void;
}

/** Title placeholder cycles through these via a typewriter animation. */
const TITLE_PHRASES = [
  'Install windows',
  'Finish the north face',
  'Fix the sashes',
  'Set mirrors on floor 3',
];

const MIN_TASK_LEN = 15;

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));
const READINESS_OPTIONS = READINESS_PRESETS.map((r) => ({ value: r, label: r }));
const PRIORITY_OPTIONS = PRIORITY_PRESETS.map((p) => ({ value: p, label: p }));

export function CreateJobcardModal({ visible, jobs, onClose, onSubmit }: Props) {
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  const [tasks, setTasks] = useState<string[]>(['']);
  // The first task mirrors the title until the Field Super edits it directly —
  // they're usually the same thing, so we save the Field Super re-typing it.
  const [taskLinked, setTaskLinked] = useState(true);
  const [readiness, setReadiness] = useState('');
  const [readyConfirmed, setReadyConfirmed] = useState(false);
  const [priority, setPriority] = useState('');
  // Window Opening Flashing Material: tracks the parent Job until the Field Super edits it.
  const [flashing, setFlashing] = useState('');
  const [flashingTouched, setFlashingTouched] = useState(false);
  const [materials, setMaterials] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const titlePlaceholder = useTypewriter(TITLE_PHRASES);

  const jobOptions = useMemo(
    () => jobs.map((j) => ({ value: j.id, label: j.name })),
    [jobs]
  );
  const selectedJob = jobs.find((j) => j.id === jobId);
  const includesWindows = scopes.includes('Windows');
  const flashingValue = flashingTouched
    ? flashing
    : (selectedJob?.flashingMaterial ?? '');

  const reset = () => {
    setJobId('');
    setTitle('');
    setScopes([]);
    setTasks(['']);
    setTaskLinked(true);
    setReadiness('');
    setReadyConfirmed(false);
    setPriority('');
    setFlashing('');
    setFlashingTouched(false);
    setMaterials('');
    setNotes('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const setTaskAt = (index: number, value: string) => {
    // A direct edit of the first task unlinks it from the title.
    if (index === 0) setTaskLinked(false);
    setTasks((prev) => prev.map((t, i) => (i === index ? value : t)));
  };
  const addTask = () => setTasks((prev) => [...prev, '']);
  const removeTask = (index: number) =>
    setTasks((prev) => prev.filter((_, i) => i !== index));

  // While linked, typing the title also fills the first task.
  const onTitleChange = (value: string) => {
    setTitle(value);
    if (taskLinked) {
      setTasks((prev) => {
        const next = [...prev];
        next[0] = value;
        return next;
      });
    }
  };

  // When readiness changes away from "Now", the confirmation no longer applies.
  const onReadinessChange = (value: string) => {
    setReadiness(value);
    if (value !== 'Now') setReadyConfirmed(false);
  };

  const submit = () => {
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

    onSubmit({
      jobId: selectedJob.id,
      title: title.trim(),
      scopes,
      tasks: cleanTasks,
      readiness: readiness.trim(),
      priority: priority.trim(),
      materials: materials.trim() || undefined,
      flashingMaterial: includesWindows
        ? flashingValue.trim() || undefined
        : undefined,
      notes: notes.trim() || undefined,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Create jobcard</Text>
            <Pressable onPress={close} hitSlop={8}>
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
                <Text style={styles.noJobs}>
                  No active jobs available. The Operator must create one first.
                </Text>
              ) : (
                <Combobox
                  value={jobId}
                  options={jobOptions}
                  onChange={setJobId}
                  placeholder="Search jobs…"
                />
              )}
            </View>

            {/* Title (required, animated placeholder) — directly under the job */}
            <FormInput
              label="Title"
              value={title}
              onChangeText={onTitleChange}
              placeholder={titlePlaceholder || 'Install windows'}
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

            {/* Window Opening Flashing Material (Windows scope only). The photo
                beside it belongs to the parent JOB — installers see it on every
                jobcard of that job. */}
            {includesWindows && (
              <View style={styles.flashingRow}>
                <View style={styles.flashingInput}>
                  <FormInput
                    label="Window Opening Flashing Material"
                    value={flashingValue}
                    onChangeText={(t) => {
                      setFlashingTouched(true);
                      setFlashing(t);
                    }}
                    placeholder={
                      selectedJob?.flashingMaterial
                        ? `Defaults to ${selectedJob.flashingMaterial}`
                        : 'e.g. Clear Anodized Aluminum'
                    }
                  />
                </View>
                <FlashingPhotoField job={selectedJob} editable />
              </View>
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
            <Pressable style={styles.cancelButton} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>Create jobcard</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Flashing text input + the parent job's reference photo side by side.
  flashingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  flashingInput: {
    flex: 1,
  },
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
    maxWidth: 760,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    ...modalShadow,
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
