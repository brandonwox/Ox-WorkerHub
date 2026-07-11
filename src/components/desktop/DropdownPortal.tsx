import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

/**
 * `react-dom` only exists on web (Expo web). Resolved lazily and guarded on
 * `document` so it is never executed inside a native bundle.
 */
const createPortal:
  | ((node: ReactNode, container: Element) => ReactNode)
  | null =
  typeof document !== 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('react-dom').createPortal
    : null;

type Align = 'left' | 'right' | 'stretch';

interface Props {
  /** Ref to the trigger wrapper the menu anchors to. */
  anchorRef: RefObject<View | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Horizontal alignment relative to the trigger. Default `stretch`. */
  align?: Align;
  /** Minimum menu width; defaults to the trigger's measured width. */
  minWidth?: number;
  /** Vertical gap between the trigger and the menu. Default 4. */
  offset?: number;
}

interface Rect {
  bottom: number;
  left: number;
  right: number;
  width: number;
}

/**
 * Renders a dropdown menu in a body-level portal anchored to its trigger, so it
 * always floats above every other element regardless of ancestor stacking
 * contexts or `overflow` clipping — the reason in-flow `position: absolute`
 * menus get covered by neighbouring rows/sections.
 *
 * Web-only behaviour (the desktop console runs on web). On native it falls back
 * to an inline absolutely-positioned menu, so callers can share one code path.
 */
export function DropdownPortal({
  anchorRef,
  open,
  onClose,
  children,
  align = 'stretch',
  minWidth,
  offset = 4,
}: Props) {
  const menuRef = useRef<View>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  // Native anchor position, measured in window coordinates each time the menu
  // opens (the native fallback renders inside a Modal, which spans the window).
  const [nativeRect, setNativeRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!open || createPortal) return;
    anchorRef.current?.measureInWindow((x, y, width, height) =>
      setNativeRect({ x, y, width, height })
    );
    return () => setNativeRect(null);
  }, [open, anchorRef]);

  // Keep the menu glued to the trigger while open (scroll / resize reflow).
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const anchor = anchorRef.current as unknown as HTMLElement | null;
    if (!anchor?.getBoundingClientRect) return;

    const measure = () => {
      const r = anchor.getBoundingClientRect();
      setRect({ bottom: r.bottom, left: r.left, right: r.right, width: r.width });
    };
    measure();

    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, anchorRef]);

  // Close on a press that lands outside both the trigger and the menu. Using
  // `mousedown` (before the menu item's click) is why the menu node must be
  // treated as "inside" — otherwise it would self-close before a press lands.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const anchor = anchorRef.current as unknown as HTMLElement | null;
      const menu = menuRef.current as unknown as HTMLElement | null;
      if (anchor?.contains?.(target)) return;
      if (menu?.contains?.(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, anchorRef, onClose]);

  if (!open) return null;

  // Native fallback: a transparent Modal whose full-screen backdrop dismisses
  // the menu on any outside tap — the same behaviour the web path gets from
  // its document-level mousedown listener.
  if (!createPortal) {
    if (!nativeRect) return null;
    const menuStyle: ViewStyle = {
      position: 'absolute',
      top: nativeRect.y + nativeRect.height + offset,
      minWidth: minWidth ?? nativeRect.width,
      ...(align === 'stretch'
        ? { left: nativeRect.x, width: nativeRect.width }
        : align === 'right'
          ? { right: windowWidth - (nativeRect.x + nativeRect.width) }
          : { left: nativeRect.x }),
    };
    return (
      <Modal visible transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View ref={menuRef} style={menuStyle}>
          {children}
        </View>
      </Modal>
    );
  }

  if (!rect) return null;

  // `position: 'fixed'` is honoured by react-native-web at runtime but absent
  // from the RN `ViewStyle` type, so the object is cast through `unknown`.
  const style = {
    position: 'fixed',
    top: rect.bottom + offset,
    minWidth: minWidth ?? rect.width,
    // Above react-native-web's <Modal> layer (fixed at 9999), so dropdowns
    // inside modals (Add worker, Edit job, …) open on top instead of behind.
    zIndex: 10000,
    ...(align === 'stretch'
      ? { left: rect.left, width: rect.width }
      : align === 'right'
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
  } as unknown as ViewStyle;

  return createPortal(
    <View ref={menuRef} style={style}>
      {children}
    </View>,
    document.body
  );
}
