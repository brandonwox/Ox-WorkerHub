import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppStore } from '@/store/useAppStore';
// Used over the camera and the photo viewer (both black chrome) — pinned to
// the dark palette so it reads the same in either app theme.
import { darkColors as colors, fonts, radii, spacing, themed } from '@/theme';
import {
  collectTagSuggestions,
  hasTag,
  MAX_TAG_LENGTH,
  normalizeTag,
  toggleTag,
} from '@/utils/photoTags';

/**
 * Company-wide tag suggestions: every tag on any photo (uploaded or queued),
 * the current job's tags first. Recomputed as photos change.
 */
export function usePhotoTagSuggestions(jobId?: string): string[] {
  const jobPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  return useMemo(
    () => collectTagSuggestions([...jobPhotos, ...pendingPhotos], jobId),
    [jobPhotos, pendingPhotos, jobId]
  );
}

interface Props {
  visible: boolean;
  title: string;
  hint?: string;
  /** The tags currently on the target (a photo, or the camera session default). */
  tags: string[];
  /** Company-wide suggestions (see {@link usePhotoTagSuggestions}). */
  suggestions: string[];
  /** Fires on every toggle/add with the full next list. */
  onChange: (tags: string[]) => void;
  onClose: () => void;
}

/**
 * The tag picker: the target's current tags and every suggestion as toggle
 * chips (selected ones lead), plus a "New tag" input — typing a name and
 * hitting Done adds AND selects it (matching an existing tag, ignoring case,
 * just selects that one). Several tags may be on at once.
 */
export function PhotoTagsMenu({
  visible,
  title,
  hint,
  tags,
  suggestions,
  onChange,
  onClose,
}: Props) {
  const [draft, setDraft] = useState('');

  // Selected first (in their own order), then the unselected suggestions.
  const options = useMemo(() => {
    const rest = suggestions.filter((s) => !hasTag(tags, s));
    return [...tags, ...rest];
  }, [tags, suggestions]);

  const addDraft = () => {
    const tag = normalizeTag(draft);
    setDraft('');
    if (!tag || hasTag(tags, tag)) return;
    onChange([...tags, tag]);
  };

  const close = () => {
    setDraft('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
            <Pressable onPress={close} hitSlop={8} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.inputRow}>
            <Feather name="hash" size={14} color={colors.textTertiary} />
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addDraft}
              blurOnSubmit={false}
              returnKeyType="done"
              placeholder="New tag…"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={MAX_TAG_LENGTH}
            />
            {draft.trim().length > 0 && (
              <Pressable onPress={addDraft} hitSlop={8} style={styles.addButton}>
                <Feather name="plus" size={14} color={colors.textOnAccent} />
                <Text style={styles.addButtonText}>Add</Text>
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            {options.length === 0 ? (
              <Text style={styles.empty}>
                No tags yet — type one above to create the first.
              </Text>
            ) : (
              options.map((tag) => {
                const on = hasTag(tags, tag);
                return (
                  <Pressable
                    key={tag.toLowerCase()}
                    style={({ pressed }) => [
                      styles.chip,
                      on && styles.chipOn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => onChange(toggleTag(tags, tag))}
                  >
                    {on && <Feather name="check" size={12} color={colors.textOnAccent} />}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      maxHeight: '80%',
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
    hint: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    doneButton: {
      paddingVertical: 2,
    },
    doneText: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 15,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.regular,
      fontSize: 14,
      paddingVertical: spacing.sm + 2,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.primary,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 3,
    },
    addButtonText: {
      color: colors.textOnAccent,
      fontFamily: fonts.bold,
      fontSize: 12,
    },
    scroll: {
      flexGrow: 0,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    chipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    chipTextOn: {
      color: colors.textOnAccent,
    },
    pressed: {
      opacity: 0.8,
    },
    empty: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
  })
);
