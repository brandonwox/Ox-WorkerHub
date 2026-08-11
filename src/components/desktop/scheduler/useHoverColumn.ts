import { RefObject, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';

/**
 * Which of the 7 weekday columns the mouse is over, tracked by pointer
 * POSITION over the grid container — NOT by element hover. Chips, their
 * grips, and the multi-day bar overlay (a sibling of the columns, not a
 * child) would otherwise steal or drop an element-based hover, making the
 * column resize track work requests instead of the pointer.
 *
 * Attach `ref` to a plain View (collapsable={false}) wrapping the weekday
 * header + week rows. `minWidth` must equal the hovered column's minWidth
 * style and `pad` the grid's horizontal padding — the boundary math mirrors
 * the flex layout (equal sevenths, except the hovered column which never
 * shrinks below minWidth).
 *
 * Web-only by nature (mouse hover); returns null forever on native.
 */
export function useHoverColumn(
  minWidth: number,
  pad: number
): { ref: RefObject<View | null>; hoveredCol: number | null } {
  const ref = useRef<View>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // On react-native-web a View ref IS the backing DOM element.
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof node.getBoundingClientRect !== 'function') return;

    const move = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const inner = rect.width - pad * 2;
      if (inner <= 0) return;
      const relX = e.clientX - rect.left - pad;
      const base = inner / 7;
      const cur = hoveredRef.current;
      let col: number;
      if (cur == null || base >= minWidth) {
        // Equal columns (nothing hovered yet, or the board is wide enough
        // that the min width never bites).
        col = Math.floor(relX / base);
      } else {
        // One column is expanded — walk the actual boundary layout so the
        // hovered column stays stable while the pointer sits inside it.
        const other = (inner - minWidth) / 6;
        let x = 0;
        col = 6;
        for (let i = 0; i < 7; i++) {
          const w = i === cur ? minWidth : other;
          if (relX < x + w) {
            col = i;
            break;
          }
          x += w;
        }
      }
      col = Math.max(0, Math.min(6, col));
      if (col !== hoveredRef.current) {
        hoveredRef.current = col;
        setHoveredCol(col);
      }
    };
    const leave = () => {
      hoveredRef.current = null;
      setHoveredCol(null);
    };
    node.addEventListener('mousemove', move);
    node.addEventListener('mouseleave', leave);
    return () => {
      node.removeEventListener('mousemove', move);
      node.removeEventListener('mouseleave', leave);
    };
  }, [minWidth, pad]);

  return { ref, hoveredCol };
}
