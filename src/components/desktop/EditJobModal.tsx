import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { MultiCombobox } from '@/components/desktop/Combobox';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job, JOB_SCOPES, JobScope, JobStatus, Worker } from '@/types';

export interface JobChanges {
  name: string;
  /** The job's PO number (cleared when blanked — legacy jobs may lack one). */
  po?: string;
  qbtJobcodeId?: string;
  status: JobStatus;
  fieldSuperIds: string[];
  scopes?: JobScope[];
}

const SCOPE_OPTIONS = JOB_SCOPES.map((s) => ({ value: s, label: s }));

interface Props {
  /** The job being edited, or null when the modal is closed. */
  job: Job | null;
  /** Roster of field supers the Operator can assign to this job. */
  fieldSupers: Worker[];
  /**
   * How many sub-jobs hang off this job — deleting it deletes them (and their
   * work requests) too, so the delete confirmation calls it out.
   */
  subJobCount?: number;
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
  subJobCount = 0,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [name, setName] = useState('');
  const [po, setPo] = useState('');
  const [qbtJobcodeId, setQbtJobcodeId] = useState('');
  const [status, setStatus] = useState<JobStatus>('Active');
  const [scopes, setScopes] = useState<JobScope[]>([]);
  const [fieldSuperIds, setFieldSuperIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Deleting is a two-step confirm: arming reveals a type-the-job-name field,
  // and the final button stays disabled until the typed name matches.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteName, setDeleteName] = useState('');

  // Re-seed the form whenever a different job is opened.
  useEffect(() => {
    if (!job) return;
    setName(job.name);
    setPo(job.po ?? '');
    setQbtJobcodeId(job.qbtJobcodeId ?? '');
    setStatus(job.status);
    setScopes(job.scopes ?? []);
    setFieldSuperIds(job.fieldSuperIds ?? []);
    setError(null);
    setConfirmDelete(false);
    setDeleteName('');
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
      po: po.trim() || undefined,
      qbtJobcodeId: qbtJobcodeId.trim() || undefined,
      status,
      scopes: scopes.length > 0 ? scopes : undefined,
      fieldSuperIds,
    });
    onClose();
  };

  const deleteNameMatches =
    job != null &&
    deleteName.trim().toLowerCase() === job.name.trim().toLowerCase();

  const remove = () => {
    if (!job) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!deleteNameMatches) return;
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

          {/* Name + PO share the line, matching the creation form. */}
          <View style={styles.row}>
            <View style={styles.colWide}>
              <FormInput
                label="Job name"
                value={name}
                onChangeText={setName}
                placeholder="Snyderville Commercial Complex"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="PO"
                value={po}
                onChangeText={setPo}
                placeholder="e.g. 4501"
                autoCapitalize="none"
              />
            </View>
          </View>
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
            <Text style={styles.fieldLabel}>Scopes</Text>
            <MultiCombobox
              values={scopes}
              options={SCOPE_OPTIONS}
              onChange={(vals) => setScopes(vals as JobScope[])}
              placeholder="Windows, Mirrors, Storefront…"
            />
            <Text style={styles.fieldHint}>
              The trades this job covers. Without the Windows scope, the
              flashing material never shows for this job or its work requests.
            </Text>
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
              Assigned field supers see this job and its work requests. You can pick
              more than one.
            </Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!confirmDelete ? (
            <Pressable
              style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
              onPress={remove}
            >
              <Feather name="trash-2" size={15} color={colors.danger} />
              <Text style={styles.deleteText}>Delete job</Text>
            </Pressable>
          ) : (
            <View style={styles.deleteConfirmBox}>
              <Text style={styles.deleteWarning}>
                This permanently deletes &ldquo;{job?.name}&rdquo; and every one
                of its work requests
                {subJobCount > 0
                  ? ` — including its ${
                      subJobCount === 1
                        ? 'sub-job'
                        : `${subJobCount} sub-jobs`
                    } and their work requests`
                  : ''}
                . A deleted job cannot be restored.
              </Text>
              <FormInput
                label="Type the job name to confirm"
                value={deleteName}
                onChangeText={setDeleteName}
                placeholder={job?.name ?? ''}
                autoCapitalize="none"
              />
              <View style={styles.deleteConfirmActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteCancel,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    setConfirmDelete(false);
                    setDeleteName('');
                  }}
                >
                  <Text style={styles.deleteCancelText}>Keep job</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.deleteButton,
                    styles.deleteConfirmButton,
                    !deleteNameMatches && styles.deleteDisabled,
                    pressed && deleteNameMatches && styles.pressed,
                  ]}
                  disabled={!deleteNameMatches}
                  onPress={remove}
                >
                  <Feather name="trash-2" size={15} color={colors.textOnAccent} />
                  <Text style={[styles.deleteText, styles.deleteTextConfirm]}>
                    Permanently delete job
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

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

const styles = themed(() => StyleSheet.create({
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
  colWide: {
    flex: 2,
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
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  deleteTextConfirm: {
    color: colors.textOnAccent,
  },
  deleteConfirmBox: {
    gap: spacing.md,
    backgroundColor: colors.dangerDim,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  deleteWarning: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deleteCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  deleteDisabled: {
    opacity: 0.45,
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
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
}));
