import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { parseTimeInput } from '@/utils/time';

interface Props {
  label: string;
  /** Display text, e.g. "7:30 AM". Empty = not set yet. */
  value: string;
  /** Receives the picked time formatted as "h:mm a" text. */
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/** The picker's starting position: the current value, else the time right now. */
function seedDate(value: string): Date {
  const today = format(new Date(), 'yyyy-MM-dd');
  return parseTimeInput(value, today) ?? new Date();
}

/**
 * A time form field that opens the platform's standard time picker — the
 * Android clock dialog, or the iOS spinner in a bottom sheet — instead of
 * asking the worker to type the time. (TimeField.web.tsx keeps the typed
 * input on web, where there is no native picker.)
 */
export function TimeField({ label, value, onChangeText, placeholder }: Props) {
  // iOS only — the spinner edits this draft until "Done" commits it.
  const [iosDraft, setIosDraft] = useState<Date | null>(null);
  // The spinner must match the app theme: a hardcoded variant renders
  // invisible (white-on-white / black-on-black) digits in the other theme.
  const theme = useAppStore((s) => s.theme);

  const commit = (picked: Date) => onChangeText(format(picked, 'h:mm a'));

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: seedDate(value),
        mode: 'time',
        onChange: (event: DateTimePickerEvent, picked?: Date) => {
          if (event.type === 'set' && picked) commit(picked);
        },
      });
      return;
    }
    setIosDraft(seedDate(value));
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.input, pressed && styles.inputPressed]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not set'}`}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder || 'Pick a time'}
        </Text>
      </Pressable>

      {/* iOS: the standard spinner in a bottom sheet with Cancel / Done. */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosDraft !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setIosDraft(null)}
        >
          <Pressable style={styles.backdrop} onPress={() => setIosDraft(null)} />
          <View style={styles.sheetWrapper} pointerEvents="box-none">
            <View style={styles.sheet}>
              <View style={styles.sheetActions}>
                <Pressable onPress={() => setIosDraft(null)} hitSlop={8}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable
                  onPress={() => {
                    if (iosDraft) commit(iosDraft);
                    setIosDraft(null);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.doneText}>Done</Text>
                </Pressable>
              </View>
              {iosDraft !== null && (
                <DateTimePicker
                  value={iosDraft}
                  mode="time"
                  display="spinner"
                  themeVariant={theme}
                  onChange={(_event: DateTimePickerEvent, picked?: Date) => {
                    if (picked) setIosDraft(picked);
                  }}
                />
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  field: {
    gap: spacing.xs + 2,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  // Mirrors FormInput's input box so the field reads the same in forms.
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  inputPressed: {
    borderColor: colors.textTertiary,
  },
  valueText: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  placeholderText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg + 4,
    borderTopRightRadius: radii.lg + 4,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  doneText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
}));
