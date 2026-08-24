import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';

export interface ComboOption {
  value: string;
  label: string;
  /**
   * Extra search terms beyond the label — typing any of them also matches
   * this option (e.g. a job's name when the label shows its PO).
   */
  keywords?: string[];
}

function matches(option: ComboOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    option.label.toLowerCase().includes(q) ||
    (option.keywords ?? []).some((k) => k.toLowerCase().includes(q))
  );
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
  /**
   * Once something is selected, replace the always-typeable input with the
   * chips alone plus a small "+ add" affordance (shown only while more
   * options remain) — for pickers where an open text field after selection
   * reads as misleading (the job picker).
   */
  collapseOnSelect?: boolean;
  /** Label for the collapsed state's add affordance (with collapseOnSelect). */
  addLabel?: string;
  /**
   * An extra action pinned at the bottom of the dropdown, visually separated
   * from the options and styled as a (quiet) destructive choice — the job
   * picker's "No parent job". Pressing it closes the menu.
   */
  footer?: { label: string; onPress: () => void };
  /** Focus the input (and open the menu) on mount — for click-to-edit fields. */
  autoFocus?: boolean;
  /**
   * Fires when the user clicks away from the input AND the menu (after the
   * menu's press-delay). Click-to-edit callers use it to leave edit mode —
   * picking an option keeps the menu open (the input refocuses) so several
   * can be added in a row.
   */
  onDismiss?: () => void;
}

/** Multi-select searchable input: selected items become removable chips. */
export function MultiCombobox({
  values,
  onChange,
  options,
  placeholder,
  collapseOnSelect,
  addLabel = 'Add',
  footer,
  autoFocus,
  onDismiss,
}: MultiProps) {
  const [open, setOpen] = useState(!!autoFocus);
  const [query, setQuery] = useState('');
  // collapseOnSelect: whether the "+ add" affordance re-opened the input.
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // The blur-close is delayed so a press on an option lands first; refocusing
  // (picking an option, clicking back in) cancels the pending close.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedOptions = options.filter((o) => values.includes(o.value));
  const available = useMemo(
    () =>
      options.filter(
        (o) => !values.includes(o.value) && (!query.trim() || matches(o, query))
      ),
    [options, values, query]
  );
  const anyAvailable = options.some((o) => !values.includes(o.value));
  const collapsed = !!collapseOnSelect && values.length > 0 && !adding;

  const add = (opt: ComboOption) => {
    onChange([...values, opt.value]);
    setQuery('');
    // A collapsing picker folds back to chips after each pick.
    if (collapseOnSelect) {
      setAdding(false);
      setOpen(false);
    } else {
      // Keep the menu open for the next pick — the press blurred the input,
      // so refocus (which also cancels the pending blur-close/dismiss).
      inputRef.current?.focus();
    }
  };
  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  const pickFooter = () => {
    setQuery('');
    setAdding(false);
    setOpen(false);
    footer?.onPress();
  };

  return (
    <View>
      <Pressable
        style={[styles.tokenWrap, collapsed && styles.tokenWrapCollapsed]}
        onPress={() => {
          if (collapsed) return;
          setOpen(true);
        }}
      >
        {selectedOptions.map((opt) => (
          <View key={opt.value} style={styles.token}>
            <Text style={styles.tokenText}>{opt.label}</Text>
            <Pressable onPress={() => remove(opt.value)} hitSlop={6}>
              <Feather name="x" size={13} color={colors.primary} />
            </Pressable>
          </View>
        ))}
        {collapsed ? (
          anyAvailable && (
            <Pressable
              style={({ pressed }) => [
                styles.addMore,
                pressed && styles.itemPressed,
              ]}
              onPress={() => {
                setAdding(true);
                setOpen(true);
              }}
              hitSlop={4}
            >
              <Feather name="plus" size={13} color={colors.textSecondary} />
              <Text style={styles.addMoreText}>{addLabel}</Text>
            </Pressable>
          )
        ) : (
          <TextInput
            ref={inputRef}
            style={styles.tokenInput}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setOpen(true);
            }}
            onFocus={() => {
              if (blurTimer.current) {
                clearTimeout(blurTimer.current);
                blurTimer.current = null;
              }
              setOpen(true);
            }}
            // Delay so a press on an option lands before the menu unmounts.
            onBlur={() => {
              blurTimer.current = setTimeout(() => {
                blurTimer.current = null;
                setOpen(false);
                setAdding(false);
                onDismiss?.();
              }, 120);
            }}
            placeholder={selectedOptions.length === 0 ? placeholder : ''}
            placeholderTextColor={colors.textTertiary}
            autoFocus={autoFocus || adding}
          />
        )}
      </Pressable>

      {open && (available.length > 0 || footer) && (
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
          {footer && (
            <Pressable
              style={({ pressed }) => [
                styles.footerItem,
                available.length > 0 && styles.footerItemSeparated,
                pressed && styles.itemPressed,
              ]}
              onPress={pickFooter}
            >
              <Text style={styles.footerText}>{footer.label}</Text>
            </Pressable>
          )}
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
  // Collapsed (collapseOnSelect, something picked): just the chips, no input —
  // so no input-field frame around them either.
  tokenWrapCollapsed: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
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
  addMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  addMoreText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  footerItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
  },
  footerItemSeparated: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  footerText: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
}));
