import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Height of the software keyboard currently covering the window (0 when
 * closed). For lifting ABSOLUTELY-positioned bottom bars above the keyboard —
 * KeyboardAvoidingView's padding never moves `position: 'absolute'` children,
 * so inputs inside such bars end up hidden behind the keyboard.
 *
 * iOS-only by design: Android resizes the window itself (adjustResize), which
 * already lifts absolute-bottom bars, and web has no overlaying keyboard.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // willChangeFrame (not willShow/willHide) covers show, hide, AND the frame
    // moving while open (e.g. flipping to the emoji keyboard). The visible
    // height is how far the frame's top sits above the window bottom — on hide
    // the frame slides fully off-screen, so this lands back at 0.
    const change = Keyboard.addListener('keyboardWillChangeFrame', (e) => {
      const windowHeight = Dimensions.get('window').height;
      setHeight(Math.max(0, windowHeight - e.endCoordinates.screenY));
    });
    return () => change.remove();
  }, []);

  return height;
}
