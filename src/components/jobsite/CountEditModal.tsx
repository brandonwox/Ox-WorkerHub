import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JobCount } from '@/utils/jobCounts';

interface Props {
  /** The count being edited, or null when the popup is closed. */
  count: JobCount | null;
  onClose: () => void;
  /** Commit the new done number for the count's field. */
  onSave: (doneField: JobCount['doneField'], done: number) => void;
}

/**
 * The "amount done" popup for a job count: the current done number sits
 * pre-filled as grayed placeholder text, the total on the right. Installers
 * update these from the work request; office roles from the job details page.
 */
export function CountEditModal({ count, onClose, onSave }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fresh input each time a count is opened.
  useEffect(() => {
    setText('');
    setError(null);
  }, [count?.doneField]);

  if (!count) return null;

  const save = () => {
    const trimmed = text.trim();
    // Nothing typed = keep the current number.
    if (!trimmed) {
      onClose();
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a whole number.');
      return;
    }
    if (parsed > count.total) {
      setError(`That's more than the total (${count.total}).`);
      return;
    }
    onSave(count.doneField, parsed);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{count.label}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.hint}>How many are done?</Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={String(count.done)}
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              autoFocus
              onSubmitEditing={save}
            />
            <Text style={styles.total}>/ {count.total}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            onPress={save}
          >
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
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
      maxWidth: 360,
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 17,
    },
    hint: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 18,
      outlineWidth: 0,
    },
    total: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 18,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
    saveText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
  })
);
