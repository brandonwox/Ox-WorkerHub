import {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * Pointer-driven drag & drop for the scheduler board (desktop web only).
 *
 * The provider wraps the whole board. Drop zones (day cells, the Work
 * Requests column, its expanded calendar's cells) register themselves with a
 * ref + metadata; draggable chips render through {@link DragSource}. On drag
 * start every zone and chip is measured once (measureInWindow), a ghost chip
 * follows the pointer, the hovered zone shows an insertion indicator, and the
 * drop resolves to a {@link DropTarget} handed to the provider's onDrop.
 * Invalid drops (no zone under the pointer) simply snap back.
 *
 * Mid-drag scrolling isn't supported (the measurement snapshot would go
 * stale) — a drag is a press-move-release with the wheel untouched, which is
 * how a mouse drag naturally works.
 */

/**
 * What is being dragged: a request chip being moved, or a request's stretch
 * handle being pulled to a new END day (multi-day span).
 */
export type DragItem = { kind: 'request' | 'resize'; id: string };

/** Where a drag can land. */
export type DropTarget =
  | {
      kind: 'day';
      /** Which surface the day belongs to (main calendar or day sidebar). */
      zone: 'calendar' | 'sidebar';
      date: string;
      /** Insertion position among the day's CURRENT items (0…n). */
      index: number;
    }
  | { kind: 'backlog' }
  | { kind: 'backlog-day'; date: string };

/** A zone's registration metadata. */
export interface ZoneMeta {
  type: 'day' | 'backlog' | 'backlog-day';
  surface?: 'calendar' | 'sidebar';
  date?: string;
  /** Higher wins when zones overlap (day cells sit inside the backlog panel). */
  priority: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MeasuredZone {
  zoneId: string;
  meta: ZoneMeta;
  rect: Rect;
}

interface MeasuredItem {
  key: string;
  centerY: number;
}

interface Ghost {
  title: string;
  color: string;
}

interface Snapshot {
  zones: MeasuredZone[];
  itemsByZone: Map<string, MeasuredItem[]>;
  rootX: number;
  rootY: number;
}

interface DragBoardContextValue {
  enabled: boolean;
  /** Key of the chip being dragged ("request:<id>"), or null. */
  draggingKey: string | null;
  /** The hovered drop position (zone + insertion index), or null. */
  hover: { zoneId: string; index: number } | null;
  registerZone: (zoneId: string, ref: RefObject<View | null>, meta: ZoneMeta) => () => void;
  registerItem: (zoneId: string, key: string, ref: RefObject<View | null>) => () => void;
  begin: (item: DragItem, ghost: Ghost, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  drop: (x: number, y: number) => void;
  cancel: () => void;
}

const DragBoardContext = createContext<DragBoardContextValue>({
  enabled: false,
  draggingKey: null,
  hover: null,
  registerZone: () => () => {},
  registerItem: () => () => {},
  begin: () => {},
  move: () => {},
  drop: () => {},
  cancel: () => {},
});

export function useDragBoard(): DragBoardContextValue {
  return useContext(DragBoardContext);
}

/** Measure a view in window coordinates (null when unmounted). */
function measureRect(ref: RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      // A detached node reports zeros/NaN — treat as unmeasurable.
      if (!Number.isFinite(x) || (w === 0 && h === 0)) resolve(null);
      else resolve({ x, y, w, h });
    });
  });
}

const keyOf = (item: DragItem) => `${item.kind}:${item.id}`;

/**
 * The responder system doesn't stop the browser's native text selection, so a
 * mouse drag would also sweep a selection across the whole board. Kill
 * selection for the duration of the drag (and drop whatever got selected
 * during the pre-threshold pixels).
 */
function suppressTextSelection(on: boolean) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.body.style.userSelect = on ? 'none' : '';
  document.body.style.webkitUserSelect = on ? 'none' : '';
  if (on) window.getSelection?.()?.removeAllRanges();
}

interface ProviderProps {
  /** Drag is offered only to schedulers on the web console. */
  enabled: boolean;
  /** Receives every completed (valid) drop. */
  onDrop: (item: DragItem, target: DropTarget) => void;
  children: ReactNode;
}

export function DragBoardProvider({ enabled, onDrop, children }: ProviderProps) {
  const rootRef = useRef<View>(null);
  const zonesRef = useRef(
    new Map<string, { ref: RefObject<View | null>; meta: ZoneMeta }>()
  );
  const itemsRef = useRef(new Map<string, Map<string, RefObject<View | null>>>());
  const snapshotRef = useRef<Snapshot | null>(null);
  const dragRef = useRef<DragItem | null>(null);
  const hoverRef = useRef<{ zoneId: string; index: number } | null>(null);

  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [hover, setHover] = useState<{ zoneId: string; index: number } | null>(
    null
  );
  const ghostPos = useRef(new Animated.ValueXY({ x: -1000, y: -1000 })).current;

  // Unmounting mid-drag would otherwise leave the page unselectable.
  useEffect(() => () => suppressTextSelection(false), []);

  const registerZone = useCallback(
    (zoneId: string, ref: RefObject<View | null>, meta: ZoneMeta) => {
      zonesRef.current.set(zoneId, { ref, meta });
      return () => {
        zonesRef.current.delete(zoneId);
      };
    },
    []
  );

  const registerItem = useCallback(
    (zoneId: string, key: string, ref: RefObject<View | null>) => {
      let zoneItems = itemsRef.current.get(zoneId);
      if (!zoneItems) {
        zoneItems = new Map();
        itemsRef.current.set(zoneId, zoneItems);
      }
      zoneItems.set(key, ref);
      return () => {
        itemsRef.current.get(zoneId)?.delete(key);
      };
    },
    []
  );

  const begin = useCallback(
    (item: DragItem, ghostSpec: Ghost, x: number, y: number) => {
      dragRef.current = item;
      hoverRef.current = null;
      suppressTextSelection(true);
      setGhost(ghostSpec);
      setDraggingKey(keyOf(item));
      setHover(null);
      // Snapshot every zone + chip position once, up front. Fire-and-forget:
      // hover resolution simply waits until the snapshot lands (~a frame).
      void (async () => {
        const root = await measureRect(rootRef);
        const zones: MeasuredZone[] = [];
        const itemsByZone = new Map<string, MeasuredItem[]>();
        await Promise.all(
          [...zonesRef.current.entries()].map(async ([zoneId, { ref, meta }]) => {
            const rect = await measureRect(ref);
            if (rect) zones.push({ zoneId, meta, rect });
          })
        );
        await Promise.all(
          [...itemsRef.current.entries()].map(async ([zoneId, zoneItems]) => {
            const measured: MeasuredItem[] = [];
            await Promise.all(
              [...zoneItems.entries()].map(async ([key, ref]) => {
                const rect = await measureRect(ref);
                if (rect) measured.push({ key, centerY: rect.y + rect.h / 2 });
              })
            );
            measured.sort((a, b) => a.centerY - b.centerY);
            itemsByZone.set(zoneId, measured);
          })
        );
        snapshotRef.current = {
          zones,
          itemsByZone,
          rootX: root?.x ?? 0,
          rootY: root?.y ?? 0,
        };
        ghostPos.setValue({
          x: x - (root?.x ?? 0) + 10,
          y: y - (root?.y ?? 0) + 10,
        });
      })();
    },
    [ghostPos]
  );

  /** The zone under the pointer (highest priority wins) + insertion index. */
  const resolve = useCallback(
    (x: number, y: number): { zone: MeasuredZone; index: number } | null => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return null;
      let best: MeasuredZone | null = null;
      for (const zone of snapshot.zones) {
        const { rect } = zone;
        if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) {
          continue;
        }
        if (!best || zone.meta.priority > best.meta.priority) best = zone;
      }
      if (!best) return null;
      const items = snapshot.itemsByZone.get(best.zoneId) ?? [];
      // Skip the dragged chip's own entry so hovering over yourself does not
      // shift the target slot.
      const dragKey = dragRef.current ? keyOf(dragRef.current) : null;
      let index = 0;
      for (const item of items) {
        if (item.key === dragKey) continue;
        if (item.centerY < y) index += 1;
      }
      return { zone: best, index };
    },
    []
  );

  const move = useCallback(
    (x: number, y: number) => {
      const snapshot = snapshotRef.current;
      if (snapshot) {
        ghostPos.setValue({ x: x - snapshot.rootX + 10, y: y - snapshot.rootY + 10 });
      }
      const hit = resolve(x, y);
      const next = hit ? { zoneId: hit.zone.zoneId, index: hit.index } : null;
      const prev = hoverRef.current;
      if (next?.zoneId !== prev?.zoneId || next?.index !== prev?.index) {
        hoverRef.current = next;
        setHover(next);
      }
    },
    [ghostPos, resolve]
  );

  const finish = useCallback(() => {
    suppressTextSelection(false);
    dragRef.current = null;
    hoverRef.current = null;
    snapshotRef.current = null;
    setGhost(null);
    setDraggingKey(null);
    setHover(null);
    ghostPos.setValue({ x: -1000, y: -1000 });
  }, [ghostPos]);

  const drop = useCallback(
    (x: number, y: number) => {
      const item = dragRef.current;
      const hit = resolve(x, y);
      finish();
      if (!item || !hit) return;
      const { meta } = hit.zone;
      let target: DropTarget | null = null;
      if (meta.type === 'day' && meta.date) {
        target = {
          kind: 'day',
          zone: meta.surface ?? 'calendar',
          date: meta.date,
          index: hit.index,
        };
      } else if (meta.type === 'backlog-day' && meta.date) {
        target = { kind: 'backlog-day', date: meta.date };
      } else if (meta.type === 'backlog') {
        target = { kind: 'backlog' };
      }
      if (target) onDrop(item, target);
    },
    [finish, onDrop, resolve]
  );

  const value = useMemo<DragBoardContextValue>(
    () => ({
      enabled,
      draggingKey,
      hover,
      registerZone,
      registerItem,
      begin,
      move,
      drop,
      cancel: finish,
    }),
    [enabled, draggingKey, hover, registerZone, registerItem, begin, move, drop, finish]
  );

  return (
    <DragBoardContext.Provider value={value}>
      <View ref={rootRef} style={styles.root} collapsable={false}>
        {children}
        {ghost && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ghost,
              {
                borderColor: ghost.color,
                transform: [
                  { translateX: ghostPos.x },
                  { translateY: ghostPos.y },
                ],
              },
            ]}
          >
            <View style={[styles.ghostDot, { backgroundColor: ghost.color }]} />
            <Text style={styles.ghostText} numberOfLines={1}>
              {ghost.title}
            </Text>
          </Animated.View>
        )}
      </View>
    </DragBoardContext.Provider>
  );
}

/** Register a drop zone. Pass null meta to skip (zone not active). */
export function useDropZone(
  zoneId: string,
  meta: ZoneMeta | null
): { ref: RefObject<View | null>; hovered: boolean; hoverIndex: number | null } {
  const { hover, registerZone } = useDragBoard();
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!meta) return;
    return registerZone(zoneId, ref, meta);
    // Meta is passed as a fresh object every render; re-register only on the
    // values that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneId, meta?.type, meta?.surface, meta?.date, meta?.priority, registerZone]);
  const hovered = hover?.zoneId === zoneId;
  return { ref, hovered, hoverIndex: hovered ? hover.index : null };
}

interface DragSourceProps {
  /** What dragging this chip moves. */
  item: DragItem;
  /** Ghost chip contents while dragging. */
  ghost: Ghost;
  /** Zone this chip currently sits in (for insertion-index measurement). */
  zoneId?: string;
  /** Plain click (no drag) — e.g. open the quick view. */
  onPress?: () => void;
  /** Web cursor while hovering the source (default 'grab'). */
  cursor?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** How far the pointer travels before a press becomes a drag. */
const DRAG_THRESHOLD = 5;

/**
 * A draggable chip. When the board's drag is disabled (field supers, native)
 * it renders a plain Pressable so taps keep working. While enabled it claims
 * the touch itself: release without movement is a click, movement beyond the
 * threshold starts the drag. Inner pressables (e.g. the unassign ×) still win
 * the responder negotiation because they sit deeper in the tree.
 */
export function DragSource({
  item,
  ghost,
  zoneId,
  onPress,
  cursor = 'grab',
  style,
  children,
}: DragSourceProps) {
  const board = useDragBoard();
  const ref = useRef<View>(null);
  const itemKey = keyOf(item);

  // Depend on the stable pieces (not the whole context value) so hover
  // updates mid-drag don't churn the registration.
  const { enabled, registerItem } = board;
  useEffect(() => {
    if (!enabled || !zoneId) return;
    return registerItem(zoneId, itemKey, ref);
  }, [enabled, registerItem, zoneId, itemKey]);

  // Mutable gesture state (no re-renders while tracking).
  const gesture = useRef({ startX: 0, startY: 0, dragging: false });

  const handlers = board.enabled
    ? {
        onStartShouldSetResponder: () => true,
        onResponderTerminationRequest: () => !gesture.current.dragging,
        onResponderGrant: (e: GestureResponderEvent) => {
          gesture.current = {
            startX: e.nativeEvent.pageX,
            startY: e.nativeEvent.pageY,
            dragging: false,
          };
        },
        onResponderMove: (e: GestureResponderEvent) => {
          const { pageX, pageY } = e.nativeEvent;
          const g = gesture.current;
          if (!g.dragging) {
            if (
              Math.abs(pageX - g.startX) < DRAG_THRESHOLD &&
              Math.abs(pageY - g.startY) < DRAG_THRESHOLD
            ) {
              return;
            }
            g.dragging = true;
            board.begin(item, ghost, pageX, pageY);
          }
          board.move(pageX, pageY);
        },
        onResponderRelease: (e: GestureResponderEvent) => {
          if (gesture.current.dragging) {
            board.drop(e.nativeEvent.pageX, e.nativeEvent.pageY);
          } else {
            onPress?.();
          }
          gesture.current.dragging = false;
        },
        onResponderTerminate: () => {
          if (gesture.current.dragging) board.cancel();
          gesture.current.dragging = false;
        },
      }
    : null;

  const dimmed = board.draggingKey === itemKey;

  if (!handlers) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [style, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      {...handlers}
      // @ts-expect-error — react-native-web honors `cursor` in styles.
      style={[style, { cursor }, dimmed && styles.dimmed]}
    >
      {children}
    </View>
  );
}

/** The insertion indicator zones render between chips at the hover index. */
export function DropLine({ color }: { color?: string }) {
  return (
    <View
      style={[styles.dropLine, { backgroundColor: color ?? colors.primary }]}
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    ghost: {
      position: 'absolute',
      top: 0,
      left: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 240,
      backgroundColor: colors.surfaceLight,
      borderWidth: 1,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      // Above every zone; the shadow keeps it readable over cells.
      zIndex: 1000,
      elevation: 8,
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
    },
    ghostDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    ghostText: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    dropLine: {
      height: 2,
      borderRadius: 1,
      marginVertical: 1,
      alignSelf: 'stretch',
    },
    dimmed: {
      opacity: 0.35,
    },
    pressed: {
      opacity: 0.7,
    },
  })
);
