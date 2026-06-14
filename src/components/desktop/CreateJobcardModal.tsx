import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { colors, fonts, radii, spacing } from '@/theme';
import { Job, JobcardPriority } from '@/types';

/** Payload the PM screen hands to `addJobcard` (flashing is inherited by the store). */
export interface NewJobcardInput {
  jobId: string;
  title: string;
  address: string;
  date: string;
  priority: JobcardPriority;
  materials?: string;
  scopeOfWork?: string;
}

interface Props {
  visible: boolean;
  /** Active Jobs the card can be parented to. */
  jobs: Job[];
  onClose: () => void;
  onSubmit: (input: NewJobcardInput) => void;
}

const PRIORITY_OPTIONS: { value: JobcardPriority; label: string }[] = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function CreateJobcardModal({ visible, jobs, onClose, onSubmit }: Props) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [jobId, setJobId] = useState(jobs[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<JobcardPriority>('Medium');
  const [materials, setMaterials] = useState('');
  const [scope, setScope] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = jobs.find((j) => j.id === jobId);

  const reset = () => {
    setJobId(jobs[0]?.id ?? '');
    setTitle('');
    setPriority('Medium');
    setMaterials('');
    setScope('');
    setDate(today);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!selectedJob) {
      setError('Pick a parent job for this jobcard.');
      return;
    }
    if (!DATE_RE.test(date.trim())) {
      setError('Scheduled date must be in YYYY-MM-DD format.');
      return;
    }
    onSubmit({
      jobId: selectedJob.id,
      title: title.trim() || `${selectedJob.name} — Jobcard`,
      address: selectedJob.location,
      date: date.trim(),
      priority,
      materials: materials.trim() || undefined,
      scopeOfWork: scope.trim() || undefined,
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

          <View style={[styles.field, styles.zTop]}>
            <Text style={styles.fieldLabel}>Parent job</Text>
            {jobs.length === 0 ? (
              <Text style={styles.noJobs}>
                No active jobs available. The Operator must create one first.
              </Text>
            ) : (
              <InlineSelect
                value={jobId}
                options={jobs.map((j) => ({ value: j.id, label: j.name }))}
                onChange={setJobId}
                minWidth={200}
              />
            )}
          </View>

          {/* Flashing is auto-inherited from the parent Job — read-only here. */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Flashing material</Text>
            <View style={styles.readonlyRow}>
              <Feather
                name={selectedJob?.flashingMaterial ? 'link' : 'minus-circle'}
                size={15}
                color={
                  selectedJob?.flashingMaterial
                    ? colors.primary
                    : colors.textTertiary
                }
              />
              <Text
                style={[
                  styles.readonlyText,
                  !selectedJob?.flashingMaterial && styles.readonlyMuted,
                ]}
                numberOfLines={1}
              >
                {selectedJob?.flashingMaterial
                  ? `${selectedJob.flashingMaterial}  ·  inherited from ${selectedJob.name}`
                  : selectedJob
                    ? 'None set on this job'
                    : '—'}
              </Text>
            </View>
          </View>

          <FormInput
            label="Title (optional)"
            value={title}
            onChangeText={setTitle}
            placeholder={
              selectedJob ? `${selectedJob.name} — Jobcard` : 'Jobcard title'
            }
            autoCapitalize="words"
          />

          <View style={[styles.field, styles.zMid]}>
            <Text style={styles.fieldLabel}>Priority</Text>
            <InlineSelect
              value={priority}
              options={PRIORITY_OPTIONS}
              onChange={setPriority}
              minWidth={200}
            />
          </View>

          <FormInput
            label="Materials needed (optional)"
            value={materials}
            onChangeText={setMaterials}
            placeholder="Gaskets, setting blocks, structural silicone…"
            multiline
            style={styles.multiline}
          />
          <FormInput
            label="Scope of work / work required (optional)"
            value={scope}
            onChangeText={setScope}
            placeholder="What this card covers on site…"
            multiline
            style={styles.multiline}
          />
          <FormInput
            label="Scheduled date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
    maxWidth: 480,
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
  field: {
    gap: spacing.xs + 2,
  },
  // Keep parent-job and priority dropdown menus above the fields beneath them.
  zTop: {
    zIndex: 30,
  },
  zMid: {
    zIndex: 20,
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
  readonlyRow: {
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
  readonlyText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  readonlyMuted: {
    color: colors.textTertiary,
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
    marginTop: spacing.xs,
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
