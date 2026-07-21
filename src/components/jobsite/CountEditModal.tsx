import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { JobCount } from '@/utils/jobCounts';

interface Props {
  /** The count being edited, or null when the popup is closed. */
  count: JobCount | null;
  onClose: () => void;
  /** Commit the new done number for the count's field. */
  onSave: (doneField: JobCount['doneField'], done: number) => void;
}

/** Wheel row height (also the snap interval). */
const ITEM_HEIGHT = 42;
/** Rows visible at once — odd so one row sits centered. */
const VISIBLE_ROWS = 5;

/**
 * The "amount done" popup for a job count. On phones the number is picked on
 * a scroll wheel (like the iOS time selector) pre-set to the current done
 * number; web keeps a typed input (wheels are a touch idiom). Installers
 * update these from the work request; office roles from the job details page.
 */
export function CountEditModal({ count, onClose, onSave }: Props) {
  // Web-only typed input state.
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Native wheel selection.
  const [wheelValue, setWheelValue] = useState(0);
  const wheelRef = useRef<ScrollView>(null);

  // Fresh input each time a count is opened.
  useEffect(() => {
    setText('');
    setError(null);
    setWheelValue(count?.done ?? 0);
  }, [count?.doneField, count?.done]);

  if (!count) return null;

  const useWheel = Platform.OS !== 'web';

  const save = () => {
    if (useWheel) {
      onSave(count.doneField, wheelValue);
      onClose();
      return;
    }
    const trimmed = text.trim();
    // Nothing typed = keep the current number.
    if (!trimmed) {
      onClose();
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Enter a whole number.');
      return;
    }
    if (parsed > count.total) {
      setError(`That's more than the total (${count.total}).`);
      return;
    }
    onSave(count.doneField, parsed);
    onClose();
  };

  const onWheelEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    setWheelValue(Math.min(Math.max(index, 0), count.total));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{count.label}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={styles.hint}>How many are done?</Text>

          {useWheel ? (
            <View style={styles.wheelRow}>
              <View style={styles.wheelWrap}>
                {/* The fixed highlight band the selected row sits inside. */}
                <View pointerEvents="none" style={styles.wheelBand} />
                <ScrollView
                  ref={wheelRef}
                  style={styles.wheel}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_HEIGHT}
                  decelerationRate="fast"
                  // Land on the current done number when the wheel opens.
                  contentOffset={{ x: 0, y: count.done * ITEM_HEIGHT }}
                  onMomentumScrollEnd={onWheelEnd}
                  // A slow drag released without momentum never fires the
                  // momentum-end event — catch it here too.
                  onScrollEndDrag={onWheelEnd}
                  contentContainerStyle={{
                    paddingVertical: (ITEM_HEIGHT * (VISIBLE_ROWS - 1)) / 2,
                  }}
                >
                  {Array.from({ length: count.total + 1 }, (_, n) => (
                    <View key={n} style={styles.wheelItem}>
                      <Text
                        style={[
                          styles.wheelText,
                          n === wheelValue && styles.wheelTextActive,
                        ]}
                      >
                        {n}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <Text style={styles.total}>/ {count.total}</Text>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={String(count.done)}
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                autoFocus
                onSubmitEditing={save}
              />
              <Text style={styles.total}>/ {count.total}</Text>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            onPress={save}
          >
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 17,
    },
    hint: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    wheelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
    },
    wheelWrap: {
      width: 120,
      height: ITEM_HEIGHT * VISIBLE_ROWS,
    },
    wheel: {
      flex: 1,
    },
    wheelBand: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: (ITEM_HEIGHT * (VISIBLE_ROWS - 1)) / 2,
      height: ITEM_HEIGHT,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
    },
    wheelItem: {
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wheelText: {
      color: colors.textTertiary,
      fontFamily: fonts.medium,
      fontSize: 20,
    },
    wheelTextActive: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 24,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 18,
      outlineWidth: 0,
    },
    total: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 18,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.medium,
      fontSize: 13,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    pressed: {
      opacity: 0.85,
    },
    saveText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
  })
);
