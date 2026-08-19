import { Feather } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { PRIORITY_CHOICES, PriorityChoice } from '@/types';
import { datesForPriorityChoice } from '@/utils/priorityRange';

/** The selector's value: a label plus its start→end window ('' = unset). */
export interface PriorityValue {
  priority: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_PRIORITY: PriorityValue = {
  priority: '',
  startDate: '',
  endDate: '',
};

/** Whether the value is complete enough to create/save a work request. */
export function priorityValueComplete(value: PriorityValue): boolean {
  return !!value.priority && !!value.startDate && !!value.endDate;
}

interface Props {
  value: PriorityValue;
  onChange: (value: PriorityValue) => void;
}

/**
 * The range-based priority selector: a single dropdown (Now / This week /
 * Next week / Set dates) that splits into start + end date fields once a
 * choice is made. Presets pre-fill their window ("This week" targets the
 * upcoming Friday, also from a weekend); "Set dates" leaves both blank for
 * manual picking. The two dates cross-clamp so the end can never precede the
 * start — whichever side creates the paradox pulls the other along.
 */
export function PrioritySelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<View>(null);

  const pick = (choice: PriorityChoice) => {
    setOpen(false);
    onChange({ priority: choice, ...datesForPriorityChoice(choice) });
  };

  const setStart = (date: string) => {
    onChange({
      ...value,
      startDate: date,
      // Start pushed past the end drags the end forward with it.
      endDate: value.endDate && value.endDate < date ? date : value.endDate,
    });
  };
  const setEnd = (date: string) => {
    onChange({
      ...value,
      endDate: date,
      // End pulled before the start drags the start back to match.
      startDate:
        value.startDate && date < value.startDate ? date : value.startDate,
    });
  };

  return (
    <View style={styles.wrap}>
      <View ref={wrapRef}>
        <Pressable
          style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
          onPress={() => setOpen((o) => !o)}
        >
          <Text
            style={[
              styles.triggerText,
              !value.priority && styles.triggerPlaceholder,
            ]}
          >
            {value.priority || 'Choose a priority…'}
          </Text>
          <Feather
            name={open ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={colors.textSecondary}
          />
        </Pressable>
        <DropdownPortal
          anchorRef={wrapRef}
          open={open}
          onClose={() => setOpen(false)}
        >
          <View style={styles.menu}>
            {PRIORITY_CHOICES.map((choice) => {
              const active = value.priority === choice;
              return (
                <Pressable
                  key={choice}
                  style={({ pressed }) => [
                    styles.item,
                    pressed && styles.itemPressed,
                  ]}
                  onPress={() => pick(choice)}
                >
                  <Text
                    style={[styles.itemText, active && styles.itemTextActive]}
                  >
                    {choice}
                  </Text>
                  {active && (
                    <Feather name="check" size={14} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </DropdownPortal>
      </View>

      {value.priority !== '' && (
        <View style={styles.datesRow}>
          <DateField
            label="Start"
            value={value.startDate}
            onChange={setStart}
          />
          {/* Right-aligned: the End field sits at the form's right edge, so a
              left-aligned picker (252px wide) ran off the screen. */}
          <DateField
            label="End"
            value={value.endDate}
            onChange={setEnd}
            align="right"
          />
        </View>
      )}
    </View>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A date input that opens a small month-calendar popover to pick the day. */
function DateField({
  label,
  value,
  onChange,
  align = 'left',
}: {
  label: string;
  /** yyyy-MM-dd, or '' when unset. */
  value: string;
  onChange: (date: string) => void;
  /** Which field edge the picker hugs — 'right' keeps it on-screen for the End field. */
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    value ? parseISO(value) : new Date()
  );
  const wrapRef = useRef<View>(null);

  const monthStart = startOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) });
  const leadingBlanks = getDay(monthStart);

  const openPicker = () => {
    setMonth(value ? parseISO(value) : new Date());
    setOpen(true);
  };

  return (
    <View ref={wrapRef} style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={openPicker}
      >
        <Feather name="calendar" size={13} color={colors.textSecondary} />
        <Text
          style={[styles.triggerText, !value && styles.triggerPlaceholder]}
        >
          {value ? format(parseISO(value), 'EEE, MMM d') : 'Pick a date'}
        </Text>
      </Pressable>
      <DropdownPortal
        anchorRef={wrapRef}
        open={open}
        onClose={() => setOpen(false)}
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
              <Feather
                name="chevron-left"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
            <Text style={styles.pickerMonth}>{format(month, 'MMMM yyyy')}</Text>
            <Pressable
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
              onPress={() => setMonth((m) => addMonths(m, 1))}
              hitSlop={6}
            >
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textSecondary}
              />
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
              return (
                <Pressable
                  key={ymd}
                  style={({ pressed }) => [
                    styles.pickerCell,
                    selected && styles.pickerCellSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    onChange(ymd);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerDay,
                      isToday(day) && styles.pickerDayToday,
                      selected && styles.pickerDaySelected,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </DropdownPortal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    gap: spacing.sm,
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
  menu: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  itemPressed: {
    backgroundColor: colors.border,
  },
  itemText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  itemTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  datesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dateField: {
    flex: 1,
    gap: 3,
  },
  dateLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
}));
