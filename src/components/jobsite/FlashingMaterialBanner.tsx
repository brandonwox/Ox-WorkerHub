import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { jobAllowsWindows } from '@/utils/jobScopes';

/**
 * Job details warning: a windows-covering job with no Window Opening Flashing
 * Material set blocks work request creation, so office roles that can fix it
 * (Field Supers, the Operator, Schedulers) see a plain warning row under the
 * job header — same quiet style as the layout-plan banners — plus a + button
 * that opens a popup to set the material (and its reference photo) right
 * there. Non-window jobs never show it (flashing material doesn't exist for
 * them), and the whole banner disappears once a material is set.
 */
export function FlashingMaterialBanner({ job }: { job: Job }) {
  const role = useCurrentRole();
  const updateJob = useAppStore((s) => s.updateJob);
  const [popupOpen, setPopupOpen] = useState(false);
  const [text, setText] = useState('');

  if (
    !['field_super', 'operator', 'scheduler'].includes(role ?? '') ||
    !jobAllowsWindows(job) ||
    job.flashingMaterial?.trim()
  ) {
    return null;
  }

  const canSave = text.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    updateJob(job.id, { flashingMaterial: text.trim() });
    setPopupOpen(false);
  };

  return (
    <View style={styles.row}>
      <Feather name="alert-triangle" size={16} color={colors.warning} />
      <Text style={styles.warningText}>
        No Window Opening Flashing Material set — Installers need this
        information.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
        onPress={() => {
          setText('');
          setPopupOpen(true);
        }}
        hitSlop={6}
      >
        <Feather name="plus" size={15} color={colors.textOnAccent} />
      </Pressable>

      {popupOpen && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPopupOpen(false)}
        >
          <View style={styles.overlay}>
            <Pressable
              style={styles.backdrop}
              onPress={() => setPopupOpen(false)}
            />
            <View style={styles.card}>
              <Text style={styles.title}>Window Opening Flashing Material</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {job.name}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder="e.g. regular rainbuster"
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                  inputAccessoryViewID={KEYBOARD_DONE_ID}
                />
                {/* The reference photo/document installers see next to the
                    material on every work request of this job. */}
                <FlashingPhotoField job={job} editable />
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setPopupOpen(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={!canSave}
                  style={({ pressed }) => [
                    styles.confirmBtn,
                    !canSave && styles.confirmBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={save}
                >
                  <Text style={styles.confirmText}>Save material</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // Bare text, no background/border — matches LayoutPlanBanner.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm + 2,
      alignSelf: 'center',
      maxWidth: '94%',
    },
    warningText: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    addBtn: {
      width: 24,
      height: 24,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
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
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
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
  })
);
