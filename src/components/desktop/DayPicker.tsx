import { Feather } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { RefObject, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { colors, fonts, radii, spacing, themed } from '@/theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The month the calendar opens on: the value, else the floor, else today. */
function seedMonth(value: string, minDate?: string): Date {
  for (const ymd of [value, minDate]) {
    if (ymd) {
      const d = parseISO(ymd);
      if (isValid(d)) return d;
    }
  }
  return new Date();
}

interface PopoverProps {
  /** Ref to the trigger wrapper the calendar hangs under. */
  anchorRef: RefObject<View | null>;
  open: boolean;
  /** An outside click — the caller flips `open` off. */
  onClose: () => void;
  /** yyyy-MM-dd, or '' when unset — highlighted, and the month shown first. */
  value: string;
  /** Fires with the picked day (yyyy-MM-dd); the caller closes the popover. */
  onPick: (ymd: string) => void;
  /** Days before this (yyyy-MM-dd) are greyed out and can't be picked. */
  minDate?: string;
  /**
   * Which trigger edge the calendar hugs — 'right' keeps it on-screen when
   * the trigger sits at a form's right edge.
   */
  align?: 'left' | 'right';
  /** An extra action under the grid (e.g. "Single day" clearing an end day). */
  footer?: { label: string; onPress: () => void };
}

/**
 * A month calendar floating under its trigger (DropdownPortal) to pick one
 * day. Controlled: the caller owns `open` and turns it off from onPick /
 * onClose. Shared by the priority window's Start/End fields and the work
 * request quick view's date row.
 */
export function DayPickerPopover({
  anchorRef,
  open,
  onClose,
  value,
  onPick,
  minDate,
  align = 'left',
  footer,
}: PopoverProps) {
  const [month, setMonth] = useState(() => seedMonth(value, minDate));
  // Re-seed the month each time the calendar opens (state adjusted during
  // render — React's way to derive state from a prop change, no effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMonth(seedMonth(value, minDate));
  }

  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart);

  return (
    <DropdownPortal
      anchorRef={anchorRef}
      open={open}
      onClose={onClose}
      minWidth={252}
      align={align}
    >
      <View style={styles.picker}>
        <View style={styles.pickerHeader}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={() => setMonth((m) => subMonths(m, 1))}
            hitSlop={6}
          >
            <Feather name="chevron-left" size={16} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.pickerMonth}>{format(month, 'MMMM yyyy')}</Text>
          <Pressable
            style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
            onPress={() => setMonth((m) => addMonths(m, 1))}
            hitSlop={6}
          >
            <Feather name="chevron-right" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.pickerGrid}>
          {WEEKDAYS.map((d, i) => (
            <Text key={`${d}-${i}`} style={styles.pickerWeekday}>
              {d}
            </Text>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <View key={`blank-${i}`} style={styles.pickerCell} />
          ))}
          {days.map((day) => {
            const ymd = format(day, 'yyyy-MM-dd');
            const selected = ymd === value;
            const disabled = minDate != null && ymd < minDate;
            return (
              <Pressable
                key={ymd}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.pickerCell,
                  selected && styles.pickerCellSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => onPick(ymd)}
              >
                <Text
                  style={[
                    styles.pickerDay,
                    isToday(day) && styles.pickerDayToday,
                    selected && styles.pickerDaySelected,
                    disabled && styles.pickerDayDisabled,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {footer && (
          <Pressable
            style={({ pressed }) => [styles.footer, pressed && styles.pressed]}
            onPress={footer.onPress}
          >
            <Text style={styles.footerText}>{footer.label}</Text>
          </Pressable>
        )}
      </View>
    </DropdownPortal>
  );
}

interface FieldProps {
  label: string;
  /** yyyy-MM-dd, or '' when unset. */
  value: string;
  onChange: (date: string) => void;
  /** Which field edge the picker hugs — 'right' keeps it on-screen for an End field. */
  align?: 'left' | 'right';
}

/** A labelled date input whose trigger opens a {@link DayPickerPopover}. */
export function DayPickerField({ label, value, onChange, align }: FieldProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<View>(null);

  return (
    <View ref={wrapRef} style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
      >
        <Feather name="calendar" size={13} color={colors.textSecondary} />
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>
          {value ? format(parseISO(value), 'EEE, MMM d') : 'Pick a date'}
        </Text>
      </Pressable>
      <DayPickerPopover
        anchorRef={wrapRef}
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onPick={(ymd) => {
          onChange(ymd);
          setOpen(false);
        }}
        align={align}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  field: {
    flex: 1,
    gap: 3,
  },
  fieldLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  pressed: {
    opacity: 0.85,
  },
  triggerText: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  triggerPlaceholder: {
    color: colors.textTertiary,
  },
  picker: {
    width: 252,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  navBtn: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerMonth: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pickerWeekday: {
    width: '14.2857%',
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    paddingVertical: 2,
  },
  pickerCell: {
    width: '14.2857%',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  pickerCellSelected: {
    backgroundColor: colors.primary,
  },
  pickerDay: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  pickerDayToday: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
  },
  pickerDaySelected: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
  },
  pickerDayDisabled: {
    color: colors.textTertiary,
    opacity: 0.45,
  },
  footer: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  footerText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
}));
