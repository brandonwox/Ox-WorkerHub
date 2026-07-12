import { Feather } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  CameraZoomControl,
  cameraPropsForFactor,
  ULTRA_WIDE_LENS,
} from '@/components/CameraZoomControl';
import { compressJobPhoto } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
// Camera chrome sits over the viewfinder — pinned to the dark palette so it
// stays dark-styled in light mode too.
import { darkColors as colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * In-app camera for job photos. Stays open across shots so an installer can
 * document a whole site in one go: every capture saves instantly (into the
 * upload queue), the latest shot shows as a thumbnail bottom-left with a note
 * input beside it, and X closes the camera. `jobcardId` / `issueId` (optional)
 * link every photo taken in this session to that jobcard / issue.
 */
export default function JobCameraScreen() {
  const { jobId, jobcardId, issueId } = useLocalSearchParams<{
    jobId: string;
    jobcardId?: string;
    issueId?: string;
  }>();
  const router = useRouter();
  const job = useAppStore((s) => s.jobs.find((j) => j.id === jobId));
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const setJobPhotoNote = useAppStore((s) => s.setJobPhotoNote);
  const deleteJobPhoto = useAppStore((s) => s.deleteJobPhoto);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  // Nominal zoom factor (1 = no zoom). Whether 0.5x exists comes from the
  // available-lenses callback (iOS only — Android never reports an ultra-wide).
  const [zoomFactor, setZoomFactor] = useState(1);
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Every shot taken this session (oldest first); the last one is the
  // thumbnail. Deleting the latest falls back to the one before it.
  const [shots, setShots] = useState<{ id: string; uri: string }[]>([]);
  const [note, setNote] = useState('');
  // Tapping the thumbnail expands the latest shot into a popup with delete
  // (two-tap confirm) and the note input.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const lastShot = shots.length > 0 ? shots[shots.length - 1] : null;

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
        jobcardId: jobcardId || undefined,
        issueId: issueId || undefined,
        localUris: [compressed],
      });
      if (photoId) {
        // addJobPhotos MOVES the file into app storage, so `compressed` is a
        // dead uri now — the thumbnail must render the stashed copy instead.
        const stored = useAppStore.getState();
        const uri =
          stored.pendingPhotos.find((p) => p.id === photoId)?.localUri ??
          stored.jobPhotos.find((p) => p.id === photoId)?.url ??
          compressed;
        setShots((prev) => [...prev, { id: photoId, uri }]);
        setNote('');
      }
    } catch (e) {
      console.error('Capture failed:', e);
    } finally {
      setCapturing(false);
    }
  };

  const commitNote = () => {
    if (lastShot) setJobPhotoNote(lastShot.id, note);
  };

  // Leaving the camera (X / Done) unmounts the note input before its onBlur
  // can fire — commit whatever was typed so the note isn't silently dropped.
  const leave = () => {
    commitNote();
    router.back();
  };

  const closePreview = () => {
    commitNote();
    setConfirmingDelete(false);
    setPreviewOpen(false);
  };

  const deleteLastShot = () => {
    if (!lastShot) return;
    // Two-tap confirm — the first tap arms the button, the second deletes.
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteJobPhoto(lastShot.id);
    const remaining = shots.slice(0, -1);
    setShots(remaining);
    // The note input now belongs to the new latest shot — load its saved note.
    const previous = remaining.length ? remaining[remaining.length - 1] : null;
    const stored = useAppStore.getState();
    setNote(
      previous
        ? (stored.pendingPhotos.find((p) => p.id === previous.id)?.note ??
            stored.jobPhotos.find((p) => p.id === previous.id)?.note ??
            '')
        : ''
    );
    setConfirmingDelete(false);
    setPreviewOpen(false);
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
        {/* Top bar: close, job name, flip. */}
        <View style={styles.topBar}>
          <Pressable style={styles.roundButton} onPress={leave} hitSlop={8}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.jobName} numberOfLines={1}>
            {job?.name ?? 'Job photos'}
          </Text>
          <Pressable
            style={styles.roundButton}
            onPress={() =>
              setFacing((f) => (f === 'back' ? 'front' : 'back'))
            }
            hitSlop={8}
          >
            <Feather name="refresh-ccw" size={19} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.bottomArea}>
          {/* Latest shot + its note input, side by side (bottom-left). Tapping
              the thumbnail expands it into the preview popup. */}
          {lastShot && (
            <View style={styles.lastShotRow}>
              <Pressable onPress={() => setPreviewOpen(true)} hitSlop={4}>
                <Image
                  source={{ uri: lastShot.uri }}
                  style={styles.lastShotThumb}
                  contentFit="cover"
                />
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

          {/* Shutter, with Done on its right to leave the camera. */}
          <View style={styles.shutterRow}>
            <View style={styles.shutterSide} />
            <Pressable
              style={[styles.shutter, capturing && styles.shutterBusy]}
              onPress={capture}
              disabled={capturing}
            >
              <View style={styles.shutterInner} />
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

      {/* Expanded view of the latest shot: delete (confirmed) + note. */}
      <Modal
        visible={previewOpen && lastShot != null}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewBackdrop}>
          <KeyboardAvoidingView
            style={styles.previewFlex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {lastShot && (
              <Image
                source={{ uri: lastShot.uri }}
                style={styles.previewImage}
                contentFit="contain"
              />
            )}

            <View style={styles.previewTopBar}>
              <Text style={styles.previewCounter}>
                Photo {shots.length} of {shots.length}
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
              <Pressable
                style={[
                  styles.deleteButton,
                  confirmingDelete && styles.deleteConfirm,
                ]}
                onPress={deleteLastShot}
              >
                <Feather name="trash-2" size={15} color={colors.danger} />
                <Text style={styles.deleteText}>
                  {confirmingDelete ? 'Tap again to delete' : 'Delete photo'}
                </Text>
              </Pressable>
              {/* The keyboard's mic button gives speech-to-text dictation. */}
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                onBlur={commitNote}
                onSubmitEditing={commitNote}
                placeholder="Note — tap the mic on your keyboard to dictate…"
                placeholderTextColor={colors.textTertiary}
                returnKeyType="done"
                multiline
              />
            </View>
          </KeyboardAvoidingView>
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
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
    paddingHorizontal: spacing.lg,
  },
  roundButton: {
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: spacing.sm + 2,
  },
  jobName: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowRadius: 4,
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
  previewImage: {
    ...StyleSheet.absoluteFillObject,
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
