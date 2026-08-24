import { Feather } from '@expo/vector-icons';
import {
  CameraType,
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  CameraZoomControl,
  cameraPropsForFactor,
  ULTRA_WIDE_LENS,
} from '@/components/CameraZoomControl';
import { KEYBOARD_DONE_ID } from '@/components/KeyboardDoneBar';
import { VideoPage } from '@/components/photos/VideoPage';
import { ZoomableImage } from '@/components/photos/ZoomableImage';
import { compressJobPhoto } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
// Camera chrome sits over the viewfinder — pinned to the dark palette so it
// stays dark-styled in light mode too.
import { darkColors as colors, fonts, radii, spacing, themed } from '@/theme';
import { JobPhotoType, photoTypesForScopes } from '@/types';
import { jobDisplayName } from '@/utils/jobName';

/** Recording cap — keeps worst-case uploads inside the bucket's size limit. */
const MAX_VIDEO_SECONDS = 120;

// The expanded view's note input grows with its content, one line at a time,
// from a 2-line floor to a 6-line ceiling (it scrolls internally past that).
const NOTE_LINE_HEIGHT = 20;
const NOTE_PAD_V = spacing.sm + 2;
const NOTE_MIN_HEIGHT = NOTE_LINE_HEIGHT * 2 + NOTE_PAD_V * 2;
const NOTE_MAX_HEIGHT = NOTE_LINE_HEIGHT * 6 + NOTE_PAD_V * 2;

/**
 * In-app camera for job photos. Stays open across shots so an installer can
 * document a whole site in one go: every capture saves instantly (into the
 * upload queue), the latest shot shows as a thumbnail bottom-left with a note
 * input beside it, and X closes the camera. `workRequestId` / `issueId` / `taskId`
 * (optional) link every photo taken in this session to that work request / issue /
 * work request task.
 */
export default function JobCameraScreen() {
  const { jobId, workRequestId, issueId, taskId } = useLocalSearchParams<{
    jobId: string;
    workRequestId?: string;
    issueId?: string;
    taskId?: string;
  }>();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const jobs = useAppStore((s) => s.jobs);
  const job = jobs.find((j) => j.id === jobId);
  const workRequests = useAppStore((s) => s.workRequests);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const setJobPhotoNote = useAppStore((s) => s.setJobPhotoNote);
  const deleteJobPhoto = useAppStore((s) => s.deleteJobPhoto);
  const setJobPhotoSgd = useAppStore((s) => s.setJobPhotoSgd);
  const setJobPhotoType = useAppStore((s) => s.setJobPhotoType);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  // Photo vs video capture ('picture' matches CameraView's mode prop).
  const [mode, setMode] = useState<'picture' | 'video'>('picture');
  const [recording, setRecording] = useState(false);
  // Nominal zoom factor (1 = no zoom). Whether 0.5x exists comes from the
  // available-lenses callback (iOS only — Android never reports an ultra-wide).
  const [zoomFactor, setZoomFactor] = useState(1);
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Every shot taken this session (oldest first); the last one is the
  // thumbnail. Deleting the latest falls back to the one before it.
  const [shots, setShots] = useState<
    { id: string; uri: string; isVideo?: boolean; photoType?: JobPhotoType }[]
  >([]);
  const [note, setNote] = useState('');
  // Tapping the thumbnail expands the session's shots into a swipeable pager
  // with delete (two-tap confirm), the type chips, and the note input. The
  // index is which shot is being viewed; null = closed.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  // The note draft for the shot currently shown in the pager (the bottom-left
  // quick input's `note` keeps belonging to the LAST shot).
  const [previewNote, setPreviewNote] = useState('');
  const [previewNoteHeight, setPreviewNoteHeight] = useState(0);
  // True while the previewed photo is pinch-zoomed — locks the pager so a drag
  // pans the photo instead of swiping to a neighbour.
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const previewListRef = useRef<FlatList<(typeof shots)[number]>>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Auto-type for the session: when set (via the button under the flip
  // control), every new capture is tagged with this type.
  const [defaultType, setDefaultType] = useState<JobPhotoType | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  // "Were any SGD videos taken?" popup shown on leaving a Windows-scope work
  // request's camera when this session recorded videos.
  const [sgdPopupOpen, setSgdPopupOpen] = useState(false);
  const [sgdChecked, setSgdChecked] = useState<Set<string>>(new Set());

  const lastShot = shots.length > 0 ? shots[shots.length - 1] : null;
  const sessionVideos = shots.filter((s) => s.isVideo);
  const workRequest = workRequests.find((c) => c.id === workRequestId);
  // The task this session's photos attach to (opened from a task's camera
  // button) — its text is shown in the top bar so the taker knows the target.
  const task = taskId
    ? workRequest?.tasks?.find((t) => t.id === taskId)
    : undefined;
  // The SGD question only applies to videos taken FOR a Windows-scope work request.
  const windowsWorkRequest = !!workRequest?.scopes?.includes('Windows');
  // Type choices follow the work request's scopes (falling back to the job's).
  const typeOptions = photoTypesForScopes(workRequest?.scopes ?? job?.scopes);

  // The camera is native-only; the job page offers file upload on web instead.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.permissionText}>
          The camera isn&apos;t available on web — use Upload on the job page.
        </Text>
        <Pressable style={styles.permissionButton} onPress={() => router.back()}>
          <Text style={styles.permissionButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Feather name="camera-off" size={32} color={colors.textTertiary} />
        <Text style={styles.permissionText}>
          WorkerHub needs camera access to take job photos.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.permissionCancel}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const capture = async () => {
    if (capturing || !cameraRef.current || !jobId) return;
    setCapturing(true);
    try {
      // Commit the running note to the PREVIOUS shot now — waiting for the
      // input's blur loses the note when the shutter is tapped with the
      // keyboard still up (blur never fires before the note is cleared).
      commitNote();
      const shot = await cameraRef.current.takePictureAsync();
      if (!shot?.uri) return;
      const compressed = await compressJobPhoto(shot.uri, shot.width);
      const [photoId] = await addJobPhotos({
        jobId,
        workRequestId: workRequestId || undefined,
        issueId: issueId || undefined,
        taskId: taskId || undefined,
        items: [{ uri: compressed }],
      });
      if (photoId) {
        // addJobPhotos MOVES the file into app storage, so `compressed` is a
        // dead uri now — the thumbnail must render the stashed copy instead.
        const stored = useAppStore.getState();
        const uri =
          stored.pendingPhotos.find((p) => p.id === photoId)?.localUri ??
          stored.jobPhotos.find((p) => p.id === photoId)?.url ??
          compressed;
        if (defaultType) setJobPhotoType(photoId, defaultType);
        setShots((prev) => [
          ...prev,
          { id: photoId, uri, photoType: defaultType ?? undefined },
        ]);
        setNote('');
      }
    } catch (e) {
      console.error('Capture failed:', e);
    } finally {
      setCapturing(false);
    }
  };

  // Video mode: first shutter tap starts recording, second stops it (the
  // recordAsync promise resolves on stop / at the duration cap).
  const record = async () => {
    if (!cameraRef.current || !jobId) return;
    if (recording) {
      cameraRef.current.stopRecording();
      return;
    }
    setRecording(true);
    try {
      commitNote();
      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_VIDEO_SECONDS,
      });
      if (!video?.uri) return;
      const [photoId] = await addJobPhotos({
        jobId,
        workRequestId: workRequestId || undefined,
        issueId: issueId || undefined,
        taskId: taskId || undefined,
        items: [{ uri: video.uri, isVideo: true }],
      });
      if (photoId) {
        const stored = useAppStore.getState();
        const uri =
          stored.pendingPhotos.find((p) => p.id === photoId)?.localUri ??
          stored.jobPhotos.find((p) => p.id === photoId)?.url ??
          video.uri;
        if (defaultType) setJobPhotoType(photoId, defaultType);
        setShots((prev) => [
          ...prev,
          {
            id: photoId,
            uri,
            isVideo: true,
            photoType: defaultType ?? undefined,
          },
        ]);
        setNote('');
      }
    } catch (e) {
      console.error('Recording failed:', e);
    } finally {
      setRecording(false);
    }
  };

  // Switching to video needs the microphone; without it the recording is muted.
  const switchMode = (next: 'picture' | 'video') => {
    if (recording || capturing) return;
    if (next === 'video' && !micPermission?.granted) {
      void requestMicPermission();
    }
    setMode(next);
  };

  const commitNote = () => {
    if (lastShot) setJobPhotoNote(lastShot.id, note);
  };

  // Leaving the camera (X / Done) unmounts the note input before its onBlur
  // can fire — commit whatever was typed so the note isn't silently dropped.
  // On a Windows-scope work request with videos taken, the SGD question must
  // be answered first.
  const leave = () => {
    if (recording) cameraRef.current?.stopRecording();
    commitNote();
    if (windowsWorkRequest && sessionVideos.length > 0) {
      setSgdPopupOpen(true);
      return;
    }
    router.back();
  };

  const toggleSgdChecked = (id: string) =>
    setSgdChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Commit the SGD answers and leave. Tags every checked video (none checked
  // = "No SGD videos taken" — nothing to tag).
  const confirmSgdPopup = () => {
    for (const video of sessionVideos) {
      if (sgdChecked.has(video.id)) setJobPhotoSgd(video.id, true);
    }
    setSgdPopupOpen(false);
    router.back();
  };

  /** A shot's saved note from the store (pending queue first, then uploaded). */
  const storedNote = (id: string) => {
    const stored = useAppStore.getState();
    return (
      stored.pendingPhotos.find((p) => p.id === id)?.note ??
      stored.jobPhotos.find((p) => p.id === id)?.note ??
      ''
    );
  };

  // Opens the pager on the latest shot. Its draft is the quick input's `note`
  // (possibly uncommitted), not the store copy.
  const openPreview = () => {
    if (shots.length === 0) return;
    setPreviewNote(note);
    setPreviewNoteHeight(0);
    setPreviewZoomed(false);
    setConfirmingDelete(false);
    setPreviewIndex(shots.length - 1);
  };

  // Commit the pager's note draft to the shot at `index`; when that shot is
  // the latest one, the quick input's state must follow so a later commitNote
  // can't overwrite this edit with a stale draft.
  const commitPreviewNote = (index: number, text: string) => {
    const shot = shots[index];
    if (!shot) return;
    setJobPhotoNote(shot.id, text);
    if (index === shots.length - 1) setNote(text);
  };

  const onPreviewPageChange = (next: number) => {
    if (previewIndex == null || next === previewIndex) return;
    commitPreviewNote(previewIndex, previewNote);
    const shot = shots[next];
    // The latest shot's draft lives in `note`; others read the store.
    setPreviewNote(next === shots.length - 1 ? note : storedNote(shot.id));
    setPreviewNoteHeight(0);
    setPreviewZoomed(false);
    setConfirmingDelete(false);
    setPreviewIndex(next);
  };

  const closePreview = () => {
    if (previewIndex != null) commitPreviewNote(previewIndex, previewNote);
    setConfirmingDelete(false);
    setPreviewIndex(null);
  };

  // Deletes the shot currently shown in the pager (two-tap confirm), then
  // lands on the nearest remaining neighbour — or closes when none are left.
  const deletePreviewShot = () => {
    if (previewIndex == null) return;
    const shot = shots[previewIndex];
    if (!shot) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteJobPhoto(shot.id);
    const remaining = shots.filter((_, i) => i !== previewIndex);
    setShots(remaining);
    setConfirmingDelete(false);
    if (remaining.length === 0) {
      setNote('');
      setPreviewIndex(null);
      return;
    }
    const wasLast = previewIndex === shots.length - 1;
    const nextIndex = Math.min(previewIndex, remaining.length - 1);
    // The quick input belongs to whichever shot is now latest — reload its
    // saved note when the old latest was the one deleted.
    let lastDraft = note;
    if (wasLast) {
      lastDraft = storedNote(remaining[remaining.length - 1].id);
      setNote(lastDraft);
    }
    setPreviewNote(
      nextIndex === remaining.length - 1
        ? lastDraft
        : storedNote(remaining[nextIndex].id)
    );
    setPreviewNoteHeight(0);
    setPreviewIndex(nextIndex);
    previewListRef.current?.scrollToIndex({ index: nextIndex, animated: false });
  };

  // Set/clear the type on the shot at `index` (store + the local session list
  // the chips render from).
  const setShotType = (index: number, type: JobPhotoType | undefined) => {
    const shot = shots[index];
    if (!shot) return;
    setJobPhotoType(shot.id, type);
    setShots((prev) =>
      prev.map((s, i) => (i === index ? { ...s, photoType: type } : s))
    );
  };

  // Zoom only applies to the back camera; the front lens stays at 1x.
  const zoomProps =
    facing === 'back'
      ? cameraPropsForFactor(zoomFactor, hasUltraWide)
      : { zoom: 0, selectedLens: undefined };

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode={mode}
        // 1080p at the 2-minute cap stays inside the bucket's 200 MiB limit.
        videoQuality="1080p"
        mute={mode === 'video' && !micPermission?.granted}
        zoom={zoomProps.zoom}
        selectedLens={zoomProps.selectedLens}
        onAvailableLensesChanged={({ lenses }) =>
          setHasUltraWide(lenses.includes(ULTRA_WIDE_LENS))
        }
      />

      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {/* Top bar: close, job (+ task) name, flip with the session auto-type
            button beneath it. */}
        <View style={styles.topBar}>
          <Pressable style={styles.roundButton} onPress={leave} hitSlop={8}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.jobName} numberOfLines={1}>
              {job ? jobDisplayName(job, jobs) : 'Job photos'}
            </Text>
            {task && (
              <Text style={styles.taskName} numberOfLines={1}>
                Task: {task.text}
              </Text>
            )}
          </View>
          <View style={styles.topRightColumn}>
            <Pressable
              style={styles.roundButton}
              onPress={() =>
                setFacing((f) => (f === 'back' ? 'front' : 'back'))
              }
              hitSlop={8}
            >
              <Feather
                name="refresh-ccw"
                size={19}
                color={colors.textPrimary}
              />
            </Pressable>
            {typeOptions.length > 0 && (
              <Pressable
                style={[
                  styles.typeButton,
                  defaultType != null && styles.typeButtonActive,
                ]}
                onPress={() => setTypeMenuOpen(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={
                  defaultType
                    ? `Auto photo type: ${defaultType}`
                    : 'Set auto photo type'
                }
              >
                <Feather
                  name="tag"
                  size={16}
                  color={
                    defaultType ? colors.textOnAccent : colors.textPrimary
                  }
                />
                {defaultType != null && (
                  <Text style={styles.typeButtonText}>{defaultType}</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.bottomArea}>
          {/* Latest shot + its note input, side by side (bottom-left). Tapping
              the thumbnail expands it into the preview popup. */}
          {lastShot && (
            <View style={styles.lastShotRow}>
              <Pressable onPress={openPreview} hitSlop={4}>
                {lastShot.isVideo ? (
                  <View style={[styles.lastShotThumb, styles.videoThumb]}>
                    <Feather
                      name="play-circle"
                      size={20}
                      color={colors.textPrimary}
                    />
                  </View>
                ) : (
                  <Image
                    source={{ uri: lastShot.uri }}
                    style={styles.lastShotThumb}
                    contentFit="cover"
                  />
                )}
                <View style={styles.shotCountBadge}>
                  <Text style={styles.shotCountText}>{shots.length}</Text>
                </View>
              </Pressable>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                onBlur={commitNote}
                onSubmitEditing={commitNote}
                placeholder="Note for this photo…"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
              />
            </View>
          )}

          {/* Zoom presets + drag-to-scrub (back camera only). */}
          {facing === 'back' && (
            <CameraZoomControl
              factor={zoomFactor}
              minFactor={hasUltraWide ? 0.5 : 1}
              onChange={setZoomFactor}
            />
          )}

          {/* Photo / Video mode toggle. */}
          <View style={styles.modeRow}>
            {(['picture', 'video'] as const).map((m) => (
              <Pressable key={m} onPress={() => switchMode(m)} hitSlop={6}>
                <Text
                  style={[
                    styles.modeLabel,
                    mode === m && styles.modeLabelActive,
                  ]}
                >
                  {m === 'picture' ? 'PHOTO' : 'VIDEO'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Shutter, with Done on its right to leave the camera. In video
              mode the inner circle is red; while recording it becomes a
              square (tap again to stop). */}
          <View style={styles.shutterRow}>
            <View style={styles.shutterSide}>
              {recording && (
                <View style={styles.recordingPill}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>REC</Text>
                </View>
              )}
            </View>
            <Pressable
              style={[styles.shutter, capturing && styles.shutterBusy]}
              onPress={mode === 'video' ? record : capture}
              disabled={capturing}
            >
              <View
                style={[
                  styles.shutterInner,
                  mode === 'video' && styles.shutterInnerVideo,
                  recording && styles.shutterInnerRecording,
                ]}
              />
            </Pressable>
            <View style={[styles.shutterSide, styles.shutterSideRight]}>
              <Pressable
                style={({ pressed }) => [
                  styles.doneButton,
                  pressed && styles.donePressed,
                ]}
                onPress={leave}
              >
                <Feather name="check" size={16} color={colors.textPrimary} />
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Expanded view of the session's shots: swipe between them; each has
          delete (confirmed), the type chips, and its note. */}
      <Modal
        visible={previewIndex != null && shots.length > 0}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        {/* RN Modals don't inherit the app root's gesture root — mount our own
            so pinch-to-zoom works inside the pager. */}
        <GestureHandlerRootView style={styles.previewFlex}>
          <View style={styles.previewBackdrop}>
            <FlatList
              ref={previewListRef}
              style={StyleSheet.absoluteFill}
              data={shots}
              keyExtractor={(s) => s.id}
              horizontal
              pagingEnabled
              scrollEnabled={!previewZoomed}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={Math.min(
                previewIndex ?? 0,
                shots.length - 1
              )}
              getItemLayout={(_, i) => ({
                length: windowWidth,
                offset: windowWidth * i,
                index: i,
              })}
              onMomentumScrollEnd={(e) =>
                onPreviewPageChange(
                  Math.round(e.nativeEvent.contentOffset.x / windowWidth)
                )
              }
              renderItem={({ item }) =>
                item.isVideo ? (
                  <VideoPage
                    uri={item.uri}
                    width={windowWidth}
                    height={windowHeight}
                  />
                ) : (
                  <View style={{ width: windowWidth, height: windowHeight }}>
                    <ZoomableImage
                      uri={item.uri}
                      width={windowWidth}
                      height={windowHeight}
                      onZoomChange={setPreviewZoomed}
                    />
                  </View>
                )
              }
            />

            <KeyboardAvoidingView
              style={styles.previewFlex}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              pointerEvents="box-none"
            >
              <View style={styles.previewTopBar}>
                <Text style={styles.previewCounter}>
                  {previewIndex != null && shots[previewIndex]?.isVideo
                    ? 'Video'
                    : 'Photo'}{' '}
                  {(previewIndex ?? 0) + 1} of {shots.length}
                </Text>
                <Pressable
                  style={styles.roundButton}
                  onPress={closePreview}
                  hitSlop={10}
                >
                  <Feather name="x" size={22} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.previewBottomBar}>
                {/* What the shot shows — tap to tag, tap again to clear. */}
                {typeOptions.length > 0 && previewIndex != null && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.typeChipRow}>
                      {typeOptions.map((t) => {
                        const selected =
                          shots[previewIndex]?.photoType === t;
                        return (
                          <Pressable
                            key={t}
                            style={[
                              styles.typeChip,
                              selected && styles.typeChipSelected,
                            ]}
                            onPress={() =>
                              setShotType(
                                previewIndex,
                                selected ? undefined : t
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.typeChipText,
                                selected && styles.typeChipTextSelected,
                              ]}
                            >
                              {t}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
                <Pressable
                  style={[
                    styles.deleteButton,
                    confirmingDelete && styles.deleteConfirm,
                  ]}
                  onPress={deletePreviewShot}
                >
                  <Feather name="trash-2" size={15} color={colors.danger} />
                  <Text style={styles.deleteText}>
                    {confirmingDelete ? 'Tap again to delete' : 'Delete photo'}
                  </Text>
                </Pressable>
                {/* The keyboard's mic button gives speech-to-text dictation.
                    Grows with its content up to 6 lines; the checkmark key
                    drops the keyboard instead of line-breaking. */}
                <TextInput
                  style={[
                    styles.noteInput,
                    styles.previewNoteInput,
                    {
                      height: Math.min(
                        NOTE_MAX_HEIGHT,
                        Math.max(
                          NOTE_MIN_HEIGHT,
                          previewNoteHeight + NOTE_PAD_V * 2
                        )
                      ),
                    },
                  ]}
                  value={previewNote}
                  onChangeText={setPreviewNote}
                  onBlur={() =>
                    previewIndex != null &&
                    commitPreviewNote(previewIndex, previewNote)
                  }
                  onSubmitEditing={() =>
                    previewIndex != null &&
                    commitPreviewNote(previewIndex, previewNote)
                  }
                  onContentSizeChange={(e) =>
                    setPreviewNoteHeight(e.nativeEvent.contentSize.height)
                  }
                  placeholder="Note — tap the mic on your keyboard to dictate…"
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  multiline
                  inputAccessoryViewID={KEYBOARD_DONE_ID}
                />
              </View>
            </KeyboardAvoidingView>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* Session auto-type menu (the tag button under the flip control). */}
      <Modal
        visible={typeMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypeMenuOpen(false)}
      >
        <View style={styles.typeMenuBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setTypeMenuOpen(false)}
          />
          <View style={styles.typeMenuCard}>
            <Text style={styles.typeMenuTitle}>Auto photo type</Text>
            <Text style={styles.typeMenuHint}>
              New shots are tagged with this type automatically.
            </Text>
            {[null, ...typeOptions].map((t) => {
              const selected = defaultType === t;
              return (
                <Pressable
                  key={t ?? 'none'}
                  style={[
                    styles.typeMenuOption,
                    selected && styles.typeMenuOptionSelected,
                  ]}
                  onPress={() => {
                    setDefaultType(t);
                    setTypeMenuOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.typeMenuOptionText,
                      selected && styles.typeMenuOptionTextSelected,
                    ]}
                  >
                    {t ?? 'No auto type'}
                  </Text>
                  {selected && (
                    <Feather name="check" size={16} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* "Were any SGD videos taken?" — shown on leaving a Windows-scope work
          request's camera when videos were recorded. Checked videos get the
          SGD tag; the button reads "No SGD videos taken" until one is
          checked. */}
      <Modal
        visible={sgdPopupOpen}
        transparent
        animationType="fade"
        onRequestClose={confirmSgdPopup}
      >
        <View style={styles.sgdBackdrop}>
          <View style={styles.sgdCard}>
            <Text style={styles.sgdTitle}>Were any SGD videos taken?</Text>
            <Text style={styles.sgdHint}>
              Tap each video that shows SGD work.
            </Text>
            <ScrollView style={styles.sgdScroll}>
              <View style={styles.sgdGrid}>
                {sessionVideos.map((video, i) => {
                  const checked = sgdChecked.has(video.id);
                  return (
                    <Pressable
                      key={video.id}
                      style={[
                        styles.sgdCell,
                        checked && styles.sgdCellChecked,
                      ]}
                      onPress={() => toggleSgdChecked(video.id)}
                    >
                      <Feather
                        name="play-circle"
                        size={22}
                        color={colors.textPrimary}
                      />
                      <Text style={styles.sgdCellText}>Video {i + 1}</Text>
                      {checked && (
                        <View style={styles.sgdCheckBadge}>
                          <Feather
                            name="check"
                            size={12}
                            color={colors.textOnAccent}
                          />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              style={({ pressed }) => [
                styles.sgdButton,
                sgdChecked.size > 0 && styles.sgdButtonConfirm,
                pressed && styles.donePressed,
              ]}
              onPress={confirmSgdPopup}
            >
              <Text style={styles.sgdButtonText}>
                {sgdChecked.size > 0 ? 'Confirm' : 'No SGD videos taken'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    // Flex-start, not center: the right column (flip + auto-type) grows
    // downward without pushing the title around.
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  roundButton: {
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: spacing.sm + 2,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    // Centers a one-line title against the round buttons beside it.
    paddingTop: spacing.md,
  },
  jobName: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 4,
  },
  taskName: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 4,
  },
  topRightColumn: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: spacing.sm + 2,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
  },
  typeButtonText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  bottomArea: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  lastShotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lastShotThumb: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
  },
  shotCountBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  shotCountText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  noteInput: {
    flex: 1,
    backgroundColor: colors.overlay,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shutterSide: {
    flex: 1,
  },
  shutterSideRight: {
    alignItems: 'flex-end',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  donePressed: {
    opacity: 0.85,
  },
  doneText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewFlex: {
    flex: 1,
  },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  previewCounter: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  previewBottomBar: {
    marginTop: 'auto',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
    gap: spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  deleteConfirm: {
    backgroundColor: colors.dangerDim,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  previewNoteInput: {
    // The bar's height is driven by the input's explicit (grown) height, so
    // no flexing here — see NOTE_MIN/MAX_HEIGHT.
    flex: 0,
    lineHeight: NOTE_LINE_HEIGHT,
    paddingVertical: NOTE_PAD_V,
    textAlignVertical: 'top',
  },
  typeChipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.overlay,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  typeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  typeChipTextSelected: {
    color: colors.textOnAccent,
  },
  typeMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'flex-end',
    paddingTop: 110,
    paddingRight: spacing.lg,
  },
  typeMenuCard: {
    minWidth: 200,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 2,
  },
  typeMenuTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  typeMenuHint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  typeMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  typeMenuOptionSelected: {
    backgroundColor: colors.primaryDim,
  },
  typeMenuOptionText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  typeMenuOptionTextSelected: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: radii.pill,
    borderWidth: 4,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.textPrimary,
  },
  shutterInnerVideo: {
    backgroundColor: colors.danger,
  },
  shutterInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.danger,
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  modeLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 4,
  },
  modeLabelActive: {
    color: colors.warning,
  },
  recordingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
  },
  recordingText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
  },
  sgdBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sgdCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sgdTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  sgdHint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  sgdScroll: {
    flexShrink: 1,
  },
  sgdGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sgdCell: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  sgdCellChecked: {
    borderColor: colors.primary,
  },
  sgdCellText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  sgdCheckBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sgdButton: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  sgdButtonConfirm: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sgdButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  permissionText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  permissionButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  permissionCancel: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
}));
