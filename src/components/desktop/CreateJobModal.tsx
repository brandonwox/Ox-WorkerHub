import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { colors, fonts, radii, spacing } from '@/theme';
import { JobStatus } from '@/types';

export interface NewJobInput {
  name: string;
  location: string;
  qbtJobcodeId?: string;
  flashingMaterial?: string;
  status: JobStatus;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (job: NewJobInput) => void;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'Active', label: 'Active' },
  { value: 'Archived', label: 'Archived' },
];

export function CreateJobModal({ visible, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [qbtJobcodeId, setQbtJobcodeId] = useState('');
  const [flashingMaterial, setFlashingMaterial] = useState('');
  const [status, setStatus] = useState<JobStatus>('Active');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setLocation('');
    setQbtJobcodeId('');
    setFlashingMaterial('');
    setStatus('Active');
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
    if (!location.trim()) {
      setError('Job location is required.');
      return;
    }
    onSubmit({
      name: name.trim(),
      location: location.trim(),
      qbtJobcodeId: qbtJobcodeId.trim() || undefined,
      flashingMaterial: flashingMaterial.trim() || undefined,
      status,
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
            label="Location / address"
            value={location}
            onChangeText={setLocation}
            placeholder="123 Main St, Park City, UT"
          />
          <FormInput
            label="QuickBooks Time jobcode ID"
            value={qbtJobcodeId}
            onChangeText={setQbtJobcodeId}
            placeholder="e.g. 90112 — maps hours to QBT"
            autoCapitalize="none"
          />
          <FormInput
            label="Flashing material (site-wide)"
            value={flashingMaterial}
            onChangeText={setFlashingMaterial}
            placeholder="e.g. Clear Anodized Aluminum — optional"
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Status</Text>
            <InlineSelect
              value={status}
              options={STATUS_OPTIONS}
              onChange={setStatus}
              minWidth={200}
            />
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
    maxWidth: 460,
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
    zIndex: 10,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
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
