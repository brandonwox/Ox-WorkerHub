import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';

export interface ComboOption {
  value: string;
  label: string;
}

function matches(option: ComboOption, query: string): boolean {
  return option.label.toLowerCase().includes(query.trim().toLowerCase());
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  /** Allow committing a free-text value (Enter / "Use …") that matches no option. */
  allowCustom?: boolean;
  /** Focus the input (and open the menu) on mount — for click-to-edit fields. */
  autoFocus?: boolean;
  /**
   * Fires when the input loses focus (after the menu's press-delay), i.e. the
   * user clicked elsewhere. Click-to-edit callers use it to leave edit mode.
   */
  onDismiss?: () => void;
}

/**
 * Single-select searchable input. The dropdown renders in normal flow (pushing
 * content down) so it is never clipped inside a scrolling modal. With
 * `allowCustom`, pressing Enter on unmatched text commits it as a custom value.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowCustom,
  autoFocus,
  onDismiss,
}: ComboboxProps) {
  const [open, setOpen] = useState(!!autoFocus);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  // Closed: show the option label, or the raw value for a custom entry.
  const closedText = selected?.label ?? value;

  const filtered = useMemo(
    () => (query.trim() ? options.filter((o) => matches(o, query)) : options),
    [options, query]
  );
  const exact = options.some(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase()
  );
  const customAvailable = !!allowCustom && !!query.trim() && !exact;

  const choose = (opt: ComboOption) => {
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const commitCustom = () => {
    if (customAvailable) {
      onChange(query.trim());
      setQuery('');
      setOpen(false);
    }
  };

  return (
    <View>
      <Pressable
        style={styles.inputRow}
        onPress={() => setOpen(true)}
      >
        <TextInput
          style={styles.input}
          value={open ? query : closedText}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          // Delay so a press on an option lands before the menu unmounts.
          onBlur={() =>
            setTimeout(() => {
              setOpen(false);
              onDismiss?.();
            }, 120)
          }
          onSubmitEditing={commitCustom}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoFocus={autoFocus}
        />
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={styles.menu}>
          {filtered.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => choose(opt)}
            >
              <Text
                style={[
                  styles.itemText,
                  opt.value === value && styles.itemTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {opt.value === value && (
                <Feather name="check" size={14} color={colors.primary} />
              )}
            </Pressable>
          ))}
          {customAvailable && (
            <Pressable
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={commitCustom}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={styles.customText}>Use “{query.trim()}”</Text>
            </Pressable>
          )}
          {filtered.length === 0 && !customAvailable && (
            <Text style={styles.empty}>No matches</Text>
          )}
        </View>
      )}
    </View>
  );
}

interface MultiProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: ComboOption[];
  placeholder?: string;
}

/** Multi-select searchable input: selected items become removable chips. */
export function MultiCombobox({
  values,
  onChange,
  options,
  placeholder,
}: MultiProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOptions = options.filter((o) => values.includes(o.value));
  const available = useMemo(
    () =>
      options.filter(
        (o) => !values.includes(o.value) && (!query.trim() || matches(o, query))
      ),
    [options, values, query]
  );

  const add = (opt: ComboOption) => {
    onChange([...values, opt.value]);
    setQuery('');
  };
  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <View>
      <Pressable style={styles.tokenWrap} onPress={() => setOpen(true)}>
        {selectedOptions.map((opt) => (
          <View key={opt.value} style={styles.token}>
            <Text style={styles.tokenText}>{opt.label}</Text>
            <Pressable onPress={() => remove(opt.value)} hitSlop={6}>
              <Feather name="x" size={13} color={colors.primary} />
            </Pressable>
          </View>
        ))}
        <TextInput
          style={styles.tokenInput}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          placeholder={selectedOptions.length === 0 ? placeholder : ''}
          placeholderTextColor={colors.textTertiary}
        />
      </Pressable>

      {open && available.length > 0 && (
        <View style={styles.menu}>
          {available.map((opt) => (
            <Pressable
              key={opt.value}
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              onPress={() => add(opt)}
            >
              <Text style={styles.itemText}>{opt.label}</Text>
              <Feather name="plus" size={14} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    outlineWidth: 0,
  },
  tokenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  token: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 4,
  },
  tokenText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  tokenInput: {
    flexGrow: 1,
    minWidth: 120,
    paddingVertical: spacing.xs,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    outlineWidth: 0,
  },
  menu: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  customText: {
    flex: 1,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
}));
