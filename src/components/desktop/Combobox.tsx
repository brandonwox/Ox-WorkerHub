import { Feather } from '@expo/vector-icons';
import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * How long a menu stays mounted after its input blurs — long enough for a
 * press that is already in flight inside it to land (see useMenuPress).
 */
const BLUR_CLOSE_DELAY_MS = 120;

/**
 * Keeps a dropdown menu alive while an option inside it is being pressed.
 *
 * On web the input blurs the moment the mouse goes DOWN on an option (the
 * option takes focus), but react-native-web fires the option's onPress on the
 * browser's click, i.e. on mouse-UP. Closing on a timer after the blur raced
 * that click: a press held longer than the timer unmounted the option before
 * the click landed, so nothing was picked and the menu just closed — every
 * time, for anyone who clicks deliberately. Here onPressIn (mouse-down, which
 * runs BEFORE the blur) flags the press, the blur skips its close while the
 * flag is up, and onPressOut schedules the close instead — only when the
 * input really lost focus, so a touch scroll over the menu doesn't close it.
 * A completed press cancels that close itself (choose/add call cancelClose).
 */
function useMenuPress(
  inputRef: RefObject<TextInput | null>,
  close: () => void
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressing = useRef(false);

  const cancelClose = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      timer.current = null;
      close();
    }, BLUR_CLOSE_DELAY_MS);
  };
  /** The input blurred — close unless a press in the menu is in flight. */
  const onInputBlur = () => {
    if (!pressing.current) scheduleClose();
  };
  /** Spread onto every pressable inside the menu. */
  const menuPressProps = {
    onPressIn: () => {
      pressing.current = true;
      cancelClose();
    },
    onPressOut: () => {
      pressing.current = false;
      // The press is over; if it never lands (the pointer slid off the
      // option) the blurred input would otherwise leave the menu stranded.
      if (!inputRef.current?.isFocused()) scheduleClose();
    },
  };
  // A pending close must not fire into an unmounted component.
  useEffect(() => cancelClose, []);

  return { cancelClose, onInputBlur, menuPressProps };
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
  const inputRef = useRef<TextInput>(null);
  const { cancelClose, onInputBlur, menuPressProps } = useMenuPress(
    inputRef,
    () => {
      setOpen(false);
      onDismiss?.();
    }
  );

  const selected = options.find((o) => o.value === value);
  // Closed: show the option label, or the raw value for a custom entry.
  const closedText = selected?.label ?? value;

  const filtered = useMemo(
    () => (query.trim() ? options.filter((o) => matches(o, query)) : options),
    [options, query]
  );
  // The option whose label is exactly what was typed (ignoring case).
  const exactOption = options.find(
    (o) => o.label.toLowerCase() === query.trim().toLowerCase()
  );
  const customAvailable = !!allowCustom && !!query.trim() && !exactOption;

  const choose = (opt: ComboOption) => {
    cancelClose();
    onChange(opt.value);
    setQuery('');
    setOpen(false);
  };

  const commitCustom = () => {
    if (!customAvailable) return;
    cancelClose();
    onChange(query.trim());
    setQuery('');
    setOpen(false);
  };

  // Enter: typed text that IS an option picks it ("yes" ⏎ → Yes) — before,
  // an exact match disabled the custom commit and Enter did nothing at all.
  const submit = () => {
    if (exactOption) choose(exactOption);
    else commitCustom();
  };

  return (
    <View>
      <Pressable
        style={styles.inputRow}
        onPress={() => {
          setOpen(true);
          // A click on the frame or chevron took focus off the input (which
          // would close the menu) — hand it straight back.
          inputRef.current?.focus();
        }}
      >
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={open ? query : closedText}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
          }}
          onFocus={() => {
            cancelClose();
            // Opening afresh starts from the full list; a refocus mid-edit
            // (the frame click above) keeps what was typed.
            if (!open) setQuery('');
            setOpen(true);
          }}
          onBlur={onInputBlur}
          onSubmitEditing={submit}
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
              {...menuPressProps}
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
              {...menuPressProps}
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
  const { cancelClose, onInputBlur, menuPressProps } = useMenuPress(
    inputRef,
    () => {
      setOpen(false);
      setAdding(false);
      onDismiss?.();
    }
  );

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
    cancelClose();
    onChange([...values, opt.value]);
    setQuery('');
    // A collapsing picker folds back to chips after each pick.
    if (collapseOnSelect) {
      setAdding(false);
      setOpen(false);
    } else {
      // Keep the menu open for the next pick — the press blurred the input,
      // so refocus it.
      inputRef.current?.focus();
    }
  };
  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  const pickFooter = () => {
    cancelClose();
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
              cancelClose();
              setOpen(true);
            }}
            onBlur={onInputBlur}
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
              {...menuPressProps}
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
              {...menuPressProps}
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
