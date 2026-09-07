import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format, isValid, parseISO } from 'date-fns';
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

interface Props {
  label: string;
  /** yyyy-MM-dd, or '' when not set. */
  value: string;
  /** Receives the picked day as yyyy-MM-dd. */
  onChange: (ymd: string) => void;
  placeholder?: string;
}

/** The picker's starting position: the current value, else today. */
function seedDate(value: string): Date {
  if (value) {
    const parsed = parseISO(value);
    if (isValid(parsed)) return parsed;
  }
  return new Date();
}

/**
 * A date form field that opens the platform's standard date picker — the
 * Android calendar dialog, or the iOS spinner in a bottom sheet. Values are
 * plain yyyy-MM-dd strings (the same shape the priority windows store).
 * (DateField.web.tsx keeps a typed input on web, where there is no native
 * picker.)
 */
export function DateField({ label, value, onChange, placeholder }: Props) {
  const [iosDraft, setIosDraft] = useState<Date | null>(null);
  const theme = useAppStore((s) => s.theme);

  const commit = (picked: Date) => onChange(format(picked, 'yyyy-MM-dd'));
  const display = value ? format(seedDate(value), 'EEE, MMM d, yyyy') : '';

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: seedDate(value),
        mode: 'date',
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
        accessibilityLabel={`${label}: ${display || 'not set'}`}
      >
        <Text style={display ? styles.valueText : styles.placeholderText}>
          {display || placeholder || 'Pick a date'}
        </Text>
      </Pressable>

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
                  mode="date"
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
