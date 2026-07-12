import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { colors, fonts, radii, spacing, themed } from '@/theme';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  minWidth?: number;
}

/** Compact dropdown used in desktop tables and forms. */
export function InlineSelect<T extends string>({
  value,
  options,
  onChange,
  minWidth = 150,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<View>(null);
  const current = options.find((o) => o.value === value);

  return (
    <View ref={wrapRef} style={[styles.wrap, { minWidth }]}>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={styles.triggerText}>{current?.label ?? value}</Text>
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
        minWidth={minWidth}
      >
        <View style={styles.menu}>
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                ]}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.itemText, active && styles.itemTextActive]}>
                  {opt.label}
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
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    position: 'relative',
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
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  triggerText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
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
    fontSize: 13,
  },
  itemTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
}));
