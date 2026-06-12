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

import { FormInput } from '@/components/FormInput';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatLogDate, formatTime, parseTimeInput } from '@/utils/time';

interface Props {
  log: TimesheetLog | null;
  onClose: () => void;
}

export function EditLogModal({ log, onClose }: Props) {
  const updateLog = useAppStore((s) => s.updateLog);
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (log) {
      setStartText(formatTime(log.startTime));
      setEndText(formatTime(log.endTime));
      setNotes(log.notes ?? '');
      setError(null);
    }
  }, [log]);

  const save = () => {
    if (!log) return;
    const start = parseTimeInput(startText, log.date);
    const end = parseTimeInput(endText, log.date);
    if (!start || !end) {
      setError('Enter times like "7:30 AM" or "15:45".');
      return;
    }
    if (end.getTime() <= start.getTime()) {
      setError('End time must be after start time.');
      return;
    }
    updateLog(log.id, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal
      visible={log !== null}
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
          <Text style={styles.title}>Edit Log</Text>
          {log ? (
            <Text style={styles.subtitle}>{formatLogDate(log.date)}</Text>
          ) : null}

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <FormInput
                label="Start time"
                value={startText}
                onChangeText={setStartText}
                placeholder="7:00 AM"
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.timeField}>
              <FormInput
                label="End time"
                value={endText}
                onChangeText={setEndText}
                placeholder="3:30 PM"
                autoCapitalize="characters"
              />
            </View>
          </View>

          <FormInput
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes…"
            multiline
            numberOfLines={3}
            style={styles.notesInput}
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

const styles = StyleSheet.create({
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
  timeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timeField: {
    flex: 1,
  },
  notesInput: {
    minHeight: 72,
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
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
});
