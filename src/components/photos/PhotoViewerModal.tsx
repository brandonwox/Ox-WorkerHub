import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

interface Props {
  /** The photos being browsed, in display order. */
  photos: DisplayPhoto[];
  /** Index to open on, or null when the viewer is closed. */
  initialIndex: number | null;
  onClose: () => void;
}

/**
 * Full-screen photo browser: swipe between a job's photos; each shows who took
 * it, when, and its note. The photographer can edit their note; they (and Field
 * Supers / the Operator) can delete.
 */
export function PhotoViewerModal({ photos, initialIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const me = useCurrentWorker();
  const workers = useAppStore((s) => s.workers);
  const jobcards = useAppStore((s) => s.jobcards);
  const setJobPhotoNote = useAppStore((s) => s.setJobPhotoNote);
  const deleteJobPhoto = useAppStore((s) => s.deleteJobPhoto);
  const router = useRouter();

  const [index, setIndex] = useState(initialIndex ?? 0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const listRef = useRef<FlatList<DisplayPhoto>>(null);

  // Re-sync when the viewer (re)opens on a different photo — the render-phase
  // "adjust state when props change" pattern (no effect, no extra frame).
  const [lastInitialIndex, setLastInitialIndex] = useState(initialIndex);
  if (initialIndex !== lastInitialIndex) {
    setLastInitialIndex(initialIndex);
    if (initialIndex != null) {
      setIndex(initialIndex);
      setConfirmingDelete(false);
    }
  }

  const photo = photos[index] as DisplayPhoto | undefined;
  const photographer = useMemo(
    () => workers.find((w) => w.id === photo?.workerId),
    [workers, photo]
  );
  const jobcard = useMemo(
    () =>
      photo?.jobcardId
        ? jobcards.find((c) => c.id === photo.jobcardId)
        : undefined,
    [jobcards, photo]
  );

  const isOwn = !!me && !!photo && photo.workerId === me.id;
  const canDelete =
    isOwn || me?.role === 'field_super' || me?.role === 'operator';

  const handleDelete = () => {
    if (!photo) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteJobPhoto(photo.id);
    setConfirmingDelete(false);
    // Stay open on the neighbouring photo; close when it was the last one.
    if (photos.length <= 1) onClose();
    else if (index >= photos.length - 1) setIndex(photos.length - 2);
  };

  if (initialIndex == null) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={photos}
            keyExtractor={(p) => p.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(initialIndex, photos.length - 1)}
            getItemLayout={(_, i) => ({
              length: width,
              offset: width * i,
              index: i,
            })}
            onMomentumScrollEnd={(e) => {
              const next = Math.round(e.nativeEvent.contentOffset.x / width);
              if (next !== index) {
                setIndex(next);
                setConfirmingDelete(false);
              }
            }}
            renderItem={({ item }) => (
              // Explicit height: on web, list cells have no intrinsic height,
              // so the image's percentage height collapses to 0 (black screen).
              <View style={[styles.page, { width, height }]}>
                <Image
                  source={{ uri: item.url }}
                  style={styles.image}
                  contentFit="contain"
                />
              </View>
            )}
          />

          {/* Top bar: position + close. */}
          <View style={styles.topBar}>
            <Text style={styles.counter}>
              {Math.min(index + 1, photos.length)} / {photos.length}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
              <Feather name="x" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Bottom bar: metadata + note + actions. */}
          {photo && (
            <View style={styles.bottomBar}>
              <View style={styles.metaRow}>
                <View style={styles.metaMain}>
                  <Text style={styles.metaName}>
                    {photographer?.name ?? 'Unknown'}
                  </Text>
                  <Text style={styles.metaTime}>
                    {format(parseISO(photo.takenAt), 'MMM d, yyyy · h:mm a')}
                    {photo.pending
                      ? photo.pending === 'failed'
                        ? ' · upload waiting for signal'
                        : ' · uploading…'
                      : ''}
                  </Text>
                </View>
                {canDelete && (
                  <Pressable
                    style={[
                      styles.deleteButton,
                      confirmingDelete && styles.deleteConfirm,
                    ]}
                    onPress={handleDelete}
                  >
                    <Feather name="trash-2" size={14} color={colors.danger} />
                    <Text style={styles.deleteText}>
                      {confirmingDelete ? 'Tap again to delete' : 'Delete'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {jobcard && (
                <Pressable
                  style={styles.jobcardChip}
                  onPress={() => {
                    onClose();
                    router.push(`/job/${jobcard.id}`);
                  }}
                >
                  <Feather name="clipboard" size={12} color={colors.primary} />
                  <Text style={styles.jobcardChipText} numberOfLines={1}>
                    {jobcard.title}
                  </Text>
                </Pressable>
              )}

              {isOwn ? (
                <NoteInput
                  key={photo.id}
                  note={photo.note}
                  onCommit={(text) => setJobPhotoNote(photo.id, text)}
                />
              ) : photo.note ? (
                <Text style={styles.noteText}>{photo.note}</Text>
              ) : null}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** The photographer's editable caption; commits on blur/submit. */
function NoteInput({
  note,
  onCommit,
}: {
  note: string | undefined;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(note ?? '');
  return (
    <TextInput
      style={styles.noteInput}
      value={text}
      onChangeText={setText}
      onBlur={() => onCommit(text)}
      onSubmitEditing={() => onCommit(text)}
      placeholder="Add a note to this photo…"
      placeholderTextColor={colors.textTertiary}
      returnKeyType="done"
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? spacing.lg : spacing.xxl + spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  closeButton: {
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'web' ? spacing.lg : spacing.xl + spacing.md,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaMain: {
    flex: 1,
    gap: 1,
  },
  metaName: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  metaTime: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  deleteConfirm: {
    backgroundColor: colors.dangerDim,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  jobcardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  jobcardChipText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  noteText: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
