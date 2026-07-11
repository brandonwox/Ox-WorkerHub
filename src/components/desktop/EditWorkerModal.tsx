import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { FormInput } from '@/components/FormInput';
import { colors, fonts, modalShadow, radii, spacing } from '@/theme';
import { Worker } from '@/types';

export interface WorkerChanges {
  name: string;
  email: string;
}

interface Props {
  /** The worker being edited, or null when the modal is closed. */
  worker: Worker | null;
  onClose: () => void;
  onSave: (id: string, changes: WorkerChanges) => void;
  onDelete: (id: string) => void;
}

export function EditWorkerModal({ worker, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the form whenever a different worker is opened.
  useEffect(() => {
    if (!worker) return;
    setName(worker.name);
    setEmail(worker.email);
    setError(null);
    setConfirmDelete(false);
  }, [worker]);

  const save = () => {
    if (!worker) return;
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    onSave(worker.id, { name: name.trim(), email: email.trim() });
    onClose();
  };

  const remove = () => {
    if (!worker) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(worker.id);
    onClose();
  };

  return (
    <Modal
      visible={worker != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit worker</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="jane@ox-glass.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
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
              {confirmDelete ? 'Tap again to remove this worker' : 'Remove worker'}
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
    maxWidth: 560,
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
  },
  col: {
    flex: 1,
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
