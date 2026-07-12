import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TimeField } from '@/components/TimeField';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { formatTime, parseTimeInput } from '@/utils/time';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Adjusts the start time of the shift that's currently in progress. */
export function ShiftStartModal({ visible, onClose }: Props) {
  const activeShift = useAppStore((s) => s.activeShift);
  const updateShiftStart = useAppStore((s) => s.updateShiftStart);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && activeShift) {
      setText(formatTime(activeShift.startTime));
      setError(null);
    }
  }, [visible, activeShift]);

  const save = () => {
    if (!activeShift) return;
    const dateStr = format(new Date(activeShift.startTime), 'yyyy-MM-dd');
    const start = parseTimeInput(text, dateStr);
    if (!start) {
      setError('Enter a time like "7:30 AM" or "15:45".');
      return;
    }
    if (start.getTime() > Date.now()) {
      setError('Start time can’t be in the future.');
      return;
    }
    updateShiftStart(start.toISOString());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.centerWrapper}
      >
        <View style={styles.modal}>
          <Text style={styles.title}>Adjust start time</Text>
          <Text style={styles.subtitle}>
            When did this clock-in actually begin?
          </Text>

          <TimeField
            label="Start time"
            value={text}
            onChangeText={setText}
            placeholder="7:00 AM"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    pointerEvents: 'box-none',
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 4,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: -spacing.md,
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
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg - 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  saveText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
}));
