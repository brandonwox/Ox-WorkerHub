import { Platform } from 'react-native';

/**
 * The box height for a multi-line TextInput that grows with its text, from
 * the height its `onContentSizeChange` event reported.
 *
 * Native reports the TEXT's own height, so the field's vertical padding and
 * borders go on top (`nativeChrome`). react-native-web reports the textarea's
 * scrollHeight, which already includes the padding — and, once an explicit
 * height has been applied, the whole inner box — so only the borders are
 * added there. Adding the padding again on web made each measurement grow the
 * box, which grew the next measurement (react-native-web re-measures on every
 * render), until React gave up with "Maximum update depth exceeded" and the
 * page went blank.
 */
export function autoGrowHeight(
  contentHeight: number,
  {
    min,
    nativeChrome,
    borderWidth = 1,
  }: {
    /** The field's resting height — never shrink below it. */
    min: number;
    /** Native only: vertical padding + borders (+ any slack) to add. */
    nativeChrome: number;
    /** The field's border width (web adds top + bottom). Default 1. */
    borderWidth?: number;
  }
): number {
  const chrome = Platform.OS === 'web' ? borderWidth * 2 : nativeChrome;
  return Math.max(min, contentHeight + chrome);
}
