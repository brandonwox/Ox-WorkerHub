import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

interface Props {
  uri: string;
  /** Rendered size of the viewport the image fills (usually the window). */
  width: number;
  height: number;
  /**
   * Fires when the image crosses between zoomed-in and 1:1, so a paging parent
   * (the photo browser) can lock/unlock its horizontal swipe.
   */
  onZoomChange?: (zoomed: boolean) => void;
}

/**
 * A full-viewport photo with pinch-to-zoom, drag-to-pan while zoomed, and
 * double-tap to toggle zoom. Must render under a GestureHandlerRootView —
 * RN Modals don't inherit the app root's, so modals mount their own.
 */
export function ZoomableImage({ uri, width, height, onZoomChange }: Props) {
  // Pan is only enabled while zoomed, so a plain horizontal swipe still falls
  // through to the parent list and pages between photos.
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const setZoomedState = (z: boolean) => {
    setZoomed(z);
    onZoomChange?.(z);
  };

  // Translation is bounded by how much larger than the viewport the scaled
  // image is, so its edges never pan past the screen edges.
  const clampTx = (v: number, s: number) => {
    'worklet';
    const max = (width * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, v));
  };
  const clampTy = (v: number, s: number) => {
    'worklet';
    const max = (height * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, v));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
      tx.value = clampTx(tx.value, scale.value);
      ty.value = clampTy(ty.value, scale.value);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
      runOnJS(setZoomedState)(scale.value > 1.01);
    });

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .maxPointers(2)
    .onUpdate((e) => {
      tx.value = clampTx(savedTx.value + e.translationX, scale.value);
      ty.value = clampTy(savedTy.value + e.translationY, scale.value);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const to = scale.value > 1.01 ? 1 : DOUBLE_TAP_SCALE;
      scale.value = withTiming(to, { duration: 180 });
      savedScale.value = to;
      tx.value = withTiming(0, { duration: 180 });
      ty.value = withTiming(0, { duration: 180 });
      savedTx.value = 0;
      savedTy.value = 0;
      runOnJS(setZoomedState)(to > 1);
    });

  const composed = Gesture.Race(
    doubleTap,
    Gesture.Simultaneous(pinch, pan)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image source={{ uri }} style={styles.image} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
