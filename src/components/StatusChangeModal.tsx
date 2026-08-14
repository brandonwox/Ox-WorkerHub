import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { STATUSES_REQUIRING_REASON, WorkRequestStatus } from '@/types';

/** The preset completion notes offered when a request is marked Finished. */
const FINISHED_ALL_DONE = 'Everything done, nothing left.';
const FINISHED_BUT_SHEETROCK = 'Everything but sheetrock';

/** Does picking `status` require the extra note popup before it commits? */
export function statusNeedsNote(status: WorkRequestStatus): boolean {
  return STATUSES_REQUIRING_REASON.includes(status) || status === 'Finished';
}

interface Props {
  /** The status being applied, or null when the popup is closed. */
  status: WorkRequestStatus | null;
  /** Shown in the reason title so the worker knows which card they're explaining. */
  workRequestTitle: string;
  /**
   * Whether the work request covers the Windows scope — only then is the
   * "Everything but sheetrock" Finished option offered.
   */
  windowsScope: boolean;
  /** Commits the status with its note (the reason, or the Finished selection). */
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/**
 * The popup a status change routes through when it needs a note:
 *  - 'Untouched' / 'False Start': a required "why" text field. The reason is
 *    saved on the card for the field super + scheduler dashboards to review.
 *  - 'Finished': pick "Everything done, nothing left." / (Windows scope only)
 *    "Everything but sheetrock" / or type custom text.
 * Shared by the desktop quick view, the mobile work request page, and the
 * undefined-status catch-up popup.
 */
export function StatusChangeModal({
  status,
  workRequestTitle,
  windowsScope,
  onConfirm,
  onCancel,
}: Props) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState<string | null>(null);
  // Reset the draft every time the popup opens for a new status pick.
  useEffect(() => {
    setText('');
    setChoice(null);
  }, [status]);

  if (!status) return null;
  const finished = status === 'Finished';
  // Typing custom text overrides a preset selection.
  const note = finished ? (text.trim() || choice || '') : text.trim();
  const canConfirm = note.length > 0;

  const presetOptions = [
    FINISHED_ALL_DONE,
    ...(windowsScope ? [FINISHED_BUT_SHEETROCK] : []),
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.card}>
          {finished ? (
            <>
              <Text style={styles.title}>How finished is it?</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {workRequestTitle}
              </Text>
              {presetOptions.map((option) => {
                const active = choice === option && !text.trim();
                return (
                  <Pressable
                    key={option}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      setChoice(option);
                      setText('');
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Or type what's left…"
                placeholderTextColor={colors.textTertiary}
                multiline
                inputAccessoryViewID={KEYBOARD_DONE_ID}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>
                Why was this Work Request{' '}
                {status === 'Untouched' ? 'untouched' : 'a false start'}?
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {workRequestTitle}
              </Text>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Type the reason…"
                placeholderTextColor={colors.textTertiary}
                multiline
                autoFocus
                inputAccessoryViewID={KEYBOARD_DONE_ID}
              />
            </>
          )}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                !canConfirm && styles.confirmBtnDisabled,
                pressed && styles.pressed,
              ]}
              onPress={() => canConfirm && onConfirm(note)}
            >
              <Text style={styles.confirmText}>
                {finished ? 'Mark Finished' : 'Save reason'}
              </Text>
            </Pressable>
          </View>
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
      padding: spacing.xl,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: colors.surface,
      ...modalShadow,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 17,
    },
    subtitle: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
      marginBottom: spacing.xs,
    },
    option: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryDim,
    },
    optionText: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    optionTextActive: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
      minHeight: 72,
      textAlignVertical: 'top',
      padding: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    cancelBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.pill,
    },
    cancelText: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    confirmBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    confirmBtnDisabled: {
      opacity: 0.45,
    },
    confirmText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.7,
    },
  })
);
