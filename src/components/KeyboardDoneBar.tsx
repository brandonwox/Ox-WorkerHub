import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, fonts, spacing, themed } from '@/theme';

/** Pass as `inputAccessoryViewID` on TextInputs that should get the bar. */
export const KEYBOARD_DONE_ID = 'keyboard-done-bar';

/**
 * iOS-only "Done" bar above the keyboard — multiline inputs otherwise offer
 * no way to dismiss it. Mounted once at the app root; TextInputs opt in via
 * inputAccessoryViewID={KEYBOARD_DONE_ID} (the prop is iOS-only, so Android
 * and web — which have their own dismiss affordances — are untouched).
 */
export function KeyboardDoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ID}>
      <View style={styles.bar}>
        <Pressable
          hitSlop={8}
          style={({ pressed }) => [pressed && styles.pressed]}
          onPress={() => Keyboard.dismiss()}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      backgroundColor: colors.surfaceLight,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    pressed: {
      opacity: 0.6,
    },
    doneText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 15,
    },
  })
);
