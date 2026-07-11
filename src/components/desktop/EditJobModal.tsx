import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { colors, fonts, modalShadow, radii, spacing } from '@/theme';
import { Job, JobStatus, Worker } from '@/types';

export interface JobChanges {
  name: string;
  qbtJobcodeId?: string;
  status: JobStatus;
  fieldSuperIds: string[];
}

interface Props {
  /** The job being edited, or null when the modal is closed. */
  job: Job | null;
  /** Roster of field supers the Operator can assign to this job. */
  fieldSupers: Worker[];
  onClose: () => void;
  onSave: (id: string, changes: JobChanges) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Finished', label: 'Finished' },
];

export function EditJobModal({
  job,
  fieldSupers,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState('');
  const [qbtJobcodeId, setQbtJobcodeId] = useState('');
  const [status, setStatus] = useState<JobStatus>('Active');
  const [fieldSuperIds, setFieldSuperIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the form whenever a different job is opened.
  useEffect(() => {
    if (!job) return;
    setName(job.name);
    setQbtJobcodeId(job.qbtJobcodeId ?? '');
    setStatus(job.status);
    setFieldSuperIds(job.fieldSuperIds ?? []);
    setError(null);
    setConfirmDelete(false);
  }, [job]);

  const save = () => {
    if (!job) return;
    if (!name.trim()) {
      setError('Job name is required.');
      return;
    }
    // Address and flashing material are managed by the Field Super.
    onSave(job.id, {
      name: name.trim(),
      qbtJobcodeId: qbtJobcodeId.trim() || undefined,
      status,
      fieldSuperIds,
    });
    onClose();
  };

  const remove = () => {
    if (!job) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(job.id);
    onClose();
  };

  return (
    <Modal
      visible={job != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit job</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <FormInput
            label="Job name"
            value={name}
            onChangeText={setName}
            placeholder="Snyderville Commercial Complex"
            autoCapitalize="words"
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="QuickBooks Time jobcode ID"
                value={qbtJobcodeId}
                onChangeText={setQbtJobcodeId}
                placeholder="e.g. 90112 — maps hours to QBT"
                autoCapitalize="none"
              />
            </View>
            <View style={[styles.field, styles.col]}>
              <Text style={styles.fieldLabel}>Status</Text>
              <InlineSelect
                value={status}
                options={STATUS_OPTIONS}
                onChange={setStatus}
                minWidth={200}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Field supers</Text>
            <FieldSuperPicker
              fieldSupers={fieldSupers}
              selected={fieldSuperIds}
              onToggle={(id) =>
                setFieldSuperIds((ids) =>
                  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
                )
              }
            />
            <Text style={styles.fieldHint}>
              Assigned field supers see this job and its jobcards. You can pick
              more than one.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              confirmDelete && styles.deleteButtonConfirm,
              pressed && styles.pressed,
            ]}
            onPress={remove}
          >
            <Feather
              name="trash-2"
              size={15}
              color={confirmDelete ? colors.textPrimary : colors.danger}
            />
            <Text
              style={[
                styles.deleteText,
                confirmDelete && styles.deleteTextConfirm,
              ]}
            >
              {confirmDelete
                ? 'Tap again to delete this job and its jobcards'
                : 'Delete job'}
            </Text>
          </Pressable>

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
  },
  card: {
    width: '100%',
    maxWidth: 680,
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
  // Two-column row for paired fields on the wide desktop layout.
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    zIndex: 10,
  },
  col: {
    flex: 1,
  },
  field: {
    gap: spacing.xs + 2,
    zIndex: 10,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  fieldHint: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonConfirm: {
    backgroundColor: colors.danger,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  deleteTextConfirm: {
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.85,
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
