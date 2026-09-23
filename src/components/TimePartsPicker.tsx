import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { colors, fonts, radii, spacing, themed } from '@/theme';

interface Props {
  label: string;
  /** "h:mm a" text (e.g. "7:30 AM"), or '' while incomplete. */
  value: string;
  /**
   * Receives the full "h:mm a" text once hour, minute, and AM/PM are all
   * picked — and '' whenever the selection is incomplete.
   */
  onChange: (text: string) => void;
}

type Meridiem = 'AM' | 'PM';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
/** Five-minute steps — a reminder rarely needs finer than that. */
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const MERIDIEMS: Meridiem[] = ['AM', 'PM'];

// Compact trigger widths: enough for the placeholder ("Hour" / "Min" /
// "AM/PM") or the widest value, plus the chevron.
const HOUR_WIDTH = 84;
const MINUTE_WIDTH = 78;
const MERIDIEM_WIDTH = 92;

/** Split "7:30 AM" into its parts; null when the text isn't that shape. */
function parseParts(
  text: string
): { hour: string; minute: string; meridiem: Meridiem } | null {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(text.trim());
  if (!m) return null;
  const hour = String(Number(m[1]));
  if (Number(hour) < 1 || Number(hour) > 12) return null;
  return { hour, minute: m[2], meridiem: m[3].toUpperCase() as Meridiem };
}

/**
 * A time-of-day picker as three separate selects — hour, minute, AM/PM —
 * instead of a typed time (works the same on web and phone). Each select
 * opens a scrollable list centered on its input, picker-wheel style. Emits
 * the "h:mm a" text the rest of the app already speaks (parseTimeInput).
 */
export function TimePartsPicker({ label, value, onChange }: Props) {
  const initial = parseParts(value);
  const [hour, setHour] = useState(initial?.hour ?? '');
  const [minute, setMinute] = useState(initial?.minute ?? '');
  const [meridiem, setMeridiem] = useState<Meridiem | ''>(initial?.meridiem ?? '');

  // A full time arriving from outside (opening an existing task) re-seeds the
  // parts; an empty value leaves a half-made selection alone.
  useEffect(() => {
    const parts = parseParts(value);
    if (!parts) return;
    setHour(parts.hour);
    setMinute(parts.minute);
    setMeridiem(parts.meridiem);
  }, [value]);

  const emit = (h: string, m: string, ap: Meridiem | '') => {
    onChange(h && m && ap ? `${h}:${m} ${ap}` : '');
  };

  // A stored minute off the 5-minute grid (older data) still shows as itself.
  const minuteOptions =
    minute && !MINUTES.includes(minute) ? [...MINUTES, minute].sort() : MINUTES;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {/* Each select is just wide enough for its widest value + the
          chevron — the row hugs its content instead of stretching. */}
      <View style={styles.row}>
        <WheelSelect
          value={hour}
          options={HOURS}
          onChange={(h) => {
            setHour(h);
            emit(h, minute, meridiem);
          }}
          width={HOUR_WIDTH}
          placeholder="Hour"
        />
        <Text style={styles.colon}>:</Text>
        <WheelSelect
          value={minute}
          options={minuteOptions}
          onChange={(m) => {
            setMinute(m);
            emit(hour, m, meridiem);
          }}
          width={MINUTE_WIDTH}
          placeholder="Min"
        />
        <WheelSelect
          value={meridiem}
          options={MERIDIEMS}
          onChange={(ap) => {
            setMeridiem(ap as Meridiem);
            emit(hour, minute, ap as Meridiem);
          }}
          width={MERIDIEM_WIDTH}
          placeholder="AM/PM"
        />
      </View>
    </View>
  );
}

// The open list: fixed-height rows so the selected one can be scrolled to
// the middle, at most VISIBLE rows tall (then it scrolls), vertically
// centered on the trigger. 12 fits every hour and every 5-minute step
// without scrolling; only an off-grid legacy minute adds a 13th row.
const ITEM_H = 34;
const VISIBLE = 12;
const MENU_PAD = spacing.xs;

/** One compact select whose list opens centered on it and scrolls. */
function WheelSelect({
  value,
  options,
  onChange,
  width,
  placeholder,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  width: number;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<View>(null);
  const listRef = useRef<ScrollView>(null);
  const rows = Math.min(options.length, VISIBLE);
  const menuHeight = rows * ITEM_H + MENU_PAD * 2;

  // On open, put the current value in the middle of the visible rows (or
  // start at the top when nothing is picked yet).
  const scrollToValue = () => {
    const index = options.indexOf(value);
    if (index < 0) return;
    const y = Math.max(0, index * ITEM_H - Math.floor(rows / 2) * ITEM_H);
    listRef.current?.scrollTo({ y, animated: false });
  };

  return (
    <View ref={wrapRef} style={{ width }}>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${placeholder}: ${value || 'not set'}`}
      >
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>
          {value || placeholder}
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
        placement="center"
        menuHeight={menuHeight}
        minWidth={width}
      >
        <View style={[styles.menu, { height: menuHeight }]}>
          <ScrollView
            ref={listRef}
            onLayout={scrollToValue}
            showsVerticalScrollIndicator={options.length > VISIBLE}
            // A wheel inside a modal: the page behind must not scroll.
            nestedScrollEnabled
          >
            {options.map((opt) => {
              const active = opt === value;
              return (
                <Pressable
                  key={opt}
                  style={({ pressed, hovered }: PressState) => [
                    styles.item,
                    active && styles.itemActive,
                    (hovered || pressed) && styles.itemHover,
                  ]}
                  onPress={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>
                    {opt}
                  </Text>
                  {active && <Feather name="check" size={13} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </DropdownPortal>
    </View>
  );
}

/** RN's Pressable state on web also carries `hovered` (react-native-web). */
type PressState = { pressed: boolean; hovered?: boolean };

const styles = themed(() =>
  StyleSheet.create({
    field: {
      gap: spacing.xs + 2,
    },
    label: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    // Hugs its three selects (no stretching across the sheet).
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.sm,
    },
    colon: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 16,
    },
    // Mirrors InlineSelect's trigger so the three read like its siblings.
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
    triggerPlaceholder: {
      color: colors.textTertiary,
    },
    menu: {
      backgroundColor: colors.surfaceLight,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: MENU_PAD,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)' }
        : {}),
    },
    item: {
      height: ITEM_H,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    itemHover: {
      backgroundColor: colors.border,
    },
    itemActive: {
      backgroundColor: colors.primaryDim,
    },
    itemText: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    itemTextActive: {
      color: colors.textPrimary,
    },
  })
);
