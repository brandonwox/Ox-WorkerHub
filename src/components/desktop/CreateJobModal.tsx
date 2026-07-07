import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { FieldSuperPicker } from '@/components/desktop/FieldSuperPicker';
import { colors, fonts, radii, spacing } from '@/theme';
import { Worker } from '@/types';

export interface NewJobInput {
  name: string;
  location: string;
  qbtJobcodeId?: string;
  fieldSuperIds: string[];
}

interface Props {
  visible: boolean;
  /** Roster of field supers the Operator can assign to this job. */
  fieldSupers: Worker[];
  onClose: () => void;
  onSubmit: (job: NewJobInput) => void;
}

export function CreateJobModal({
  visible,
  fieldSupers,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState('');
  const [qbtJobcodeId, setQbtJobcodeId] = useState('');
  const [fieldSuperIds, setFieldSuperIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setQbtJobcodeId('');
    setFieldSuperIds([]);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Job name is required.');
      return;
    }
    // Address is set by the Field Super, not the Operator.
    onSubmit({
      name: name.trim(),
      location: '',
      qbtJobcodeId: qbtJobcodeId.trim() || undefined,
      fieldSuperIds,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Create job</Text>
            <Pressable onPress={close} hitSlop={8}>
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
          <FormInput
            label="QuickBooks Time jobcode ID"
            value={qbtJobcodeId}
            onChangeText={setQbtJobcodeId}
            placeholder="e.g. 90112 — maps hours to QBT"
            autoCapitalize="none"
          />

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

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitText}>Create job</Text>
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
    maxWidth: 620,
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
