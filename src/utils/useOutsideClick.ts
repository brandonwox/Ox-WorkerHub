import { RefObject, useEffect } from 'react';
import { View } from 'react-native';

/**
 * Close an open menu/editor when a press lands outside every given wrapper.
 * Web-only (listens on `document`, the same pattern DropdownPortal uses); a
 * no-op on native, where such surfaces should use DropdownPortal's modal
 * fallback instead. Uses `mousedown` so the dismissal beats the click.
 */
export function useDismissOnOutsideClick(
  active: boolean,
  refs: RefObject<View | null>[],
  onDismiss: () => void
): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      // Dropdown menus render in body-level portals (DropdownPortal), so a
      // click inside one is NOT inside the wrapper's subtree — treat portal
      // content as "inside" or the dismissal would fire mid-selection.
      if ((target as Element).closest?.('[data-dropdown-portal]')) return;
      const inside = refs.some((ref) => {
        const node = ref.current as unknown as HTMLElement | null;
        return node?.contains?.(target);
      });
      if (!inside) onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
    // refs is a fresh array each render; its entries are stable ref objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onDismiss]);
}
