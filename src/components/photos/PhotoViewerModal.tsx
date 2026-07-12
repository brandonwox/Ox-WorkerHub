import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { ZoomableImage } from '@/components/photos/ZoomableImage';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
// The viewer draws over a black backdrop — pinned to the dark palette so its
// chrome stays light-on-dark in light mode too.
import { darkColors as colors, fonts, radii, spacing, themed } from '@/theme';

interface Props {
  /**
   * The photos being browsed, in display order. A snapshot taken when the
   * viewer opened — the viewer itself drops entries deleted since.
   */
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
  const uploadedPhotos = useAppStore((s) => s.jobPhotos);
  const pendingPhotos = useAppStore((s) => s.pendingPhotos);
  const setJobPhotoNote = useAppStore((s) => s.setJobPhotoNote);
  const deleteJobPhoto = useAppStore((s) => s.deleteJobPhoto);
  const router = useRouter();

  const [index, setIndex] = useState(initialIndex ?? 0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Metadata bars; a single tap on the photo toggles them.
  const [detailsVisible, setDetailsVisible] = useState(true);
  // True while the current photo is pinch-zoomed in — locks the pager so a
  // drag pans the photo instead of swiping to the neighbour.
  const [photoZoomed, setPhotoZoomed] = useState(false);
  const listRef = useRef<FlatList<DisplayPhoto>>(null);
  // How far a swipe-down-to-dismiss has dragged the viewer (mobile only).
  const dismissTy = useSharedValue(0);

  // The photos prop was captured when the viewer opened; drop anything deleted
  // since (from in here or by a background refresh) so the pager never shows a
  // photo that no longer exists.
  const livePhotos = useMemo(() => {
    const alive = new Set<string>();
    for (const p of uploadedPhotos) alive.add(p.id);
    for (const p of pendingPhotos) alive.add(p.id);
    return photos.filter((p) => alive.has(p.id));
  }, [photos, uploadedPhotos, pendingPhotos]);

  // Re-sync when the viewer (re)opens on a different photo — the render-phase
  // "adjust state when props change" pattern (no effect, no extra frame).
  const [lastInitialIndex, setLastInitialIndex] = useState(initialIndex);
  if (initialIndex !== lastInitialIndex) {
    setLastInitialIndex(initialIndex);
    if (initialIndex != null) {
      setIndex(initialIndex);
      setConfirmingDelete(false);
      setDetailsVisible(true);
      setPhotoZoomed(false);
      dismissTy.value = 0;
    }
  }

  // When the photo being viewed disappears, land on the nearest remaining
  // neighbour; close once nothing is left.
  useEffect(() => {
    if (initialIndex == null) return;
    if (livePhotos.length === 0) {
      onClose();
      return;
    }
    if (index > livePhotos.length - 1) {
      const next = livePhotos.length - 1;
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: false });
    }
  }, [initialIndex, livePhotos.length, index, onClose]);

  const photo = livePhotos[index] as DisplayPhoto | undefined;
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
    setConfirmingDelete(false);
    // livePhotos shrinks immediately; the effect above moves off the photo
    // (or closes the viewer when it was the last one).
    deleteJobPhoto(photo.id);
  };

  // Swipe down anywhere to dismiss — mobile only, and only while not zoomed
  // (a vertical drag on a zoomed photo pans it instead). Horizontal movement
  // fails the gesture so the pager keeps its swipe.
  const dismissGesture = Gesture.Pan()
    .enabled(Platform.OS !== 'web' && !photoZoomed)
    .maxPointers(1)
    .activeOffsetY(24)
    .failOffsetY(-24)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      dismissTy.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > height * 0.22 || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        dismissTy.value = withTiming(0, { duration: 160 });
      }
    });

  const dismissContentStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: dismissTy.value }] }),
    []
  );
  const dismissBackdropStyle = useAnimatedStyle(
    () => ({ opacity: 1 - Math.min(1, dismissTy.value / (height * 0.9)) }),
    [height]
  );

  if (initialIndex == null || livePhotos.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* RN Modals don't inherit the app root's gesture root — mount our own
          so pinch-to-zoom works inside the viewer. */}
      <GestureHandlerRootView style={styles.flex}>
        {/* Separate backdrop so a swipe-down drag can fade it out while the
            content translates with the finger. */}
        <Animated.View
          style={[styles.backdrop, dismissBackdropStyle]}
          pointerEvents="none"
        />
        <GestureDetector gesture={dismissGesture}>
          <Animated.View style={[styles.flex, dismissContentStyle]}>
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <FlatList
                ref={listRef}
                data={livePhotos}
                keyExtractor={(p) => p.id}
                horizontal
                pagingEnabled
                scrollEnabled={!photoZoomed}
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={Math.min(
                  initialIndex,
                  livePhotos.length - 1
                )}
                getItemLayout={(_, i) => ({
                  length: width,
                  offset: width * i,
                  index: i,
                })}
                onMomentumScrollEnd={(e) => {
                  const next = Math.round(
                    e.nativeEvent.contentOffset.x / width
                  );
                  if (next !== index) {
                    setIndex(next);
                    setConfirmingDelete(false);
                  }
                }}
                renderItem={({ item }) => (
                  // Explicit height: on web, list cells have no intrinsic height,
                  // so the image's percentage height collapses to 0 (black screen).
                  <View style={[styles.page, { width, height }]}>
                    <ZoomableImage
                      uri={item.url}
                      width={width}
                      height={height}
                      onZoomChange={setPhotoZoomed}
                      onSingleTap={() => setDetailsVisible((v) => !v)}
                    />
                  </View>
                )}
              />

              {/* Top bar: position + close. */}
              {detailsVisible && (
                <View style={styles.topBar}>
                  <Text style={styles.counter}>
                    {Math.min(index + 1, livePhotos.length)} /{' '}
                    {livePhotos.length}
                  </Text>
                  <Pressable
                    onPress={onClose}
                    hitSlop={10}
                    style={styles.closeButton}
                  >
                    <Feather name="x" size={22} color={colors.textPrimary} />
                  </Pressable>
                </View>
              )}

              {/* Bottom bar: metadata + note + actions. */}
              {detailsVisible && photo && (
                <View style={styles.bottomBar}>
                  <View style={styles.metaRow}>
                    <View style={styles.metaMain}>
                      <Text style={styles.metaName}>
                        {photographer?.name ?? 'Unknown'}
                      </Text>
                      <Text style={styles.metaTime}>
                        {format(
                          parseISO(photo.takenAt),
                          'MMM d, yyyy · h:mm a'
                        )}
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
                        <Feather
                          name="trash-2"
                          size={14}
                          color={colors.danger}
                        />
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
                      <Feather
                        name="clipboard"
                        size={12}
                        color={colors.primary}
                      />
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
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * The photographer's editable caption; commits on blur/submit — and on unmount
 * (closing the viewer or swiping to the next photo re-keys this input before
 * onBlur can fire, which used to silently drop the draft).
 */
function NoteInput({
  note,
  onCommit,
}: {
  note: string | undefined;
  onCommit: (text: string) => void;
}) {
  const [text, setText] = useState(note ?? '');
  const latest = useRef({ text, note, onCommit });
  latest.current = { text, note, onCommit };
  useEffect(
    () => () => {
      const { text: draft, note: saved, onCommit: commit } = latest.current;
      if (draft !== (saved ?? '')) commit(draft);
    },
    []
  );
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

const styles = themed(() => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  page: {
    alignItems: 'center',
    justifyContent: 'center',
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
}));
