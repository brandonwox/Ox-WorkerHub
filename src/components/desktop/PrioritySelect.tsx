import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DayPickerField } from '@/components/desktop/DayPicker';
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
  /**
   * Open the choices dropdown immediately on mount — for click-to-edit hosts
   * where the click that revealed this selector already meant "pick one"
   * (skips the redundant second click on the trigger).
   */
  autoOpen?: boolean;
}

/**
 * The range-based priority selector: a single dropdown (Now / This week /
 * Next week / Set dates) that splits into start + end date fields once a
 * choice is made. Presets pre-fill their window ("This week" targets the
 * upcoming Friday, also from a weekend); "Set dates" leaves both blank for
 * manual picking. The two dates cross-clamp so the end can never precede the
 * start — whichever side creates the paradox pulls the other along.
 */
export function PrioritySelect({ value, onChange, autoOpen }: Props) {
  const [open, setOpen] = useState(!!autoOpen);
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
          <DayPickerField
            label="Start"
            value={value.startDate}
            onChange={setStart}
          />
          {/* Right-aligned: the End field sits at the form's right edge, so a
              left-aligned picker (252px wide) ran off the screen. */}
          <DayPickerField
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
}));
