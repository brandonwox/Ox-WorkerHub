import { Feather } from '@expo/vector-icons';
import { addMonths, format, isSameMonth } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import {
  useDragBoard,
  useDropZone,
} from '@/components/desktop/scheduler/DragBoard';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { withAlpha } from '@/utils/crewColors';
import { useDismissOnOutsideClick } from '@/utils/useOutsideClick';

/** Months listed either side of the anchor month. */
const REACH = 3;
/** How long the list stays up after the pointer leaves it mid-drag. */
const DRAG_CLOSE_DELAY_MS = 350;

/** RN's Pressable state on web also carries `hovered` (react-native-web). */
type PressState = { pressed: boolean; hovered?: boolean };

interface Props {
  month: Date;
  onSelectMonth: (month: Date) => void;
  /** Unique per calendar — keys this label's drag hover zones. */
  zoneKey: string;
  /** The label's text style (each calendar styles its month label). */
  textStyle?: StyleProp<TextStyle>;
  /** Where the list unfolds relative to the label (default 'left'). */
  align?: 'left' | 'center';
}

/**
 * A calendar's month label that doubles as a month picker. Idle, clicking it
 * unfolds the few closest months. MID-DRAG it's a hover target: dragging a
 * work request over the label unfolds the same list, and dragging over a
 * month in it shows that month — so a request can be carried into the next
 * or previous month without letting go. Dropping on the list lands nowhere
 * (the drag snaps back); the drop goes on a day of the newly shown month.
 */
export function MonthDragNav({
  month,
  onSelectMonth,
  zoneKey,
  textStyle,
  align = 'left',
}: Props) {
  const board = useDragBoard();
  const { requestSnapshot } = board;
  const dragging = board.draggingKey != null;
  const entryPrefix = `nav:${zoneKey}:m:`;
  const { ref: labelRef, hovered: labelHovered } = useDropZone(
    `nav:${zoneKey}:label`,
    { type: 'nav', priority: 3 }
  );
  const rowHovered = board.hover?.zoneId.startsWith(entryPrefix) ?? false;

  // Drag-opened (hover) and click-opened (idle) are tracked apart so a drag
  // that ends never leaves a stale list behind.
  const [dragOpen, setDragOpen] = useState(false);
  const [clickOpen, setClickOpen] = useState(false);
  const dragOpenRef = useRef(false);
  // The month the list was built around — frozen while open, so steering to
  // a month (which changes `month`) doesn't shift the rows under the pointer
  // and cascade through the list.
  const [anchor, setAnchor] = useState<Date>(month);
  const open = dragging ? dragOpen : clickOpen;

  useEffect(() => {
    if (!dragging) {
      dragOpenRef.current = false;
      setDragOpen(false);
      return;
    }
    if (labelHovered || rowHovered) {
      if (!dragOpenRef.current) {
        dragOpenRef.current = true;
        setAnchor(month);
        setDragOpen(true);
      }
      return;
    }
    // A beat of grace so the pointer can cross from the label into the list
    // (and so a steered month change doesn't blink the list away).
    const timer = setTimeout(() => {
      dragOpenRef.current = false;
      setDragOpen(false);
    }, DRAG_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [dragging, labelHovered, rowHovered, month]);

  // The rows mount mid-drag: measure them right away so hovering one works
  // before the board's next interval re-snapshot.
  useEffect(() => {
    if (dragOpen) requestSnapshot();
  }, [dragOpen, requestSnapshot]);

  const wrapRef = useRef<View>(null);
  useDismissOnOutsideClick(clickOpen, [wrapRef], () => setClickOpen(false));

  const months = Array.from({ length: REACH * 2 + 1 }, (_, i) =>
    addMonths(anchor, i - REACH)
  );

  return (
    <View ref={wrapRef} collapsable={false} style={styles.wrap}>
      <View ref={labelRef} collapsable={false}>
        <Pressable
          onPress={() => {
            if (dragging) return;
            setAnchor(month);
            setClickOpen((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityLabel="Pick a month"
          style={({ pressed, hovered }: PressState) => [
            styles.label,
            (hovered || pressed) && styles.labelHover,
            dragging && labelHovered && styles.labelDragHover,
          ]}
        >
          <Text style={textStyle}>{format(month, 'MMMM yyyy')}</Text>
          <Feather name="chevron-down" size={14} color={colors.textTertiary} />
        </Pressable>
      </View>

      {open && (
        <View style={[styles.list, align === 'center' && styles.listCenter]}>
          {dragging && (
            <Text style={styles.listHint}>Drag over a month to show it</Text>
          )}
          {months.map((m) => (
            <MonthRow
              key={format(m, 'yyyy-MM')}
              zoneId={`${entryPrefix}${format(m, 'yyyy-MM')}`}
              month={m}
              current={isSameMonth(m, month)}
              dragging={dragging}
              onHover={() => onSelectMonth(m)}
              onPress={() => {
                onSelectMonth(m);
                setClickOpen(false);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** One month in the list: a hover zone mid-drag, a plain button when idle. */
function MonthRow({
  zoneId,
  month,
  current,
  dragging,
  onHover,
  onPress,
}: {
  zoneId: string;
  month: Date;
  current: boolean;
  dragging: boolean;
  onHover: () => void;
  onPress: () => void;
}) {
  const { ref, hovered } = useDropZone(zoneId, { type: 'nav', priority: 3 });
  // Steer the calendar as the drag passes over this row.
  useEffect(() => {
    if (hovered && dragging) onHover();
    // onHover is an inline closure; re-running on its identity would re-fire
    // the steer every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, dragging]);
  return (
    <Pressable
      ref={ref}
      collapsable={false}
      onPress={dragging ? undefined : onPress}
      style={({ pressed, hovered: h }: PressState) => [
        styles.row,
        (hovered || h || pressed) && styles.rowHover,
      ]}
    >
      <Text style={[styles.rowText, current && styles.rowTextCurrent]}>
        {format(month, 'MMMM yyyy')}
      </Text>
      {current && <Feather name="check" size={13} color={colors.primary} />}
    </Pressable>
  );
}

const LIST_WIDTH = 190;

const styles = themed(() =>
  StyleSheet.create({
    wrap: {
      alignSelf: 'flex-start',
      zIndex: 30,
    },
    label: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginLeft: -spacing.xs,
      paddingHorizontal: spacing.xs,
      paddingVertical: 1,
      borderRadius: radii.sm,
    },
    labelHover: {
      backgroundColor: colors.surfaceLight,
    },
    labelDragHover: {
      backgroundColor: withAlpha(colors.primary, 0.16),
    },
    list: {
      position: 'absolute',
      top: '100%',
      left: -spacing.xs,
      marginTop: 2,
      width: LIST_WIDTH,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.xs,
      ...modalShadow,
      zIndex: 40,
    },
    listCenter: {
      left: '50%',
      marginLeft: -LIST_WIDTH / 2,
    },
    listHint: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 11,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowHover: {
      backgroundColor: withAlpha(colors.primary, 0.14),
    },
    rowText: {
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    rowTextCurrent: {
      fontFamily: fonts.bold,
    },
  })
);
