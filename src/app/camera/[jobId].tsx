import { Feather } from '@expo/vector-icons';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { compressJobPhoto } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/**
 * In-app camera for job photos. Stays open across shots so an installer can
 * document a whole site in one go: every capture saves instantly (into the
 * upload queue), the latest shot shows as a thumbnail bottom-left with a note
 * input beside it, and X closes the camera. `jobcardId` (optional) links every
 * photo taken in this session to that jobcard.
 */
export default function JobCameraScreen() {
  const { jobId, jobcardId } = useLocalSearchParams<{
    jobId: string;
    jobcardId?: string;
  }>();
  const router = useRouter();
  const job = useAppStore((s) => s.jobs.find((j) => j.id === jobId));
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const setJobPhotoNote = useAppStore((s) => s.setJobPhotoNote);

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const [shotCount, setShotCount] = useState(0);
  const [lastShot, setLastShot] = useState<{ id: string; uri: string } | null>(
    null
  );
  const [note, setNote] = useState('');

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
      const shot = await cameraRef.current.takePictureAsync();
      if (!shot?.uri) return;
      const compressed = await compressJobPhoto(shot.uri, shot.width);
      // Committing the running note to the PREVIOUS shot happens on blur/typing
      // end; a new capture starts a fresh note for the new latest photo.
      const [photoId] = await addJobPhotos({
        jobId,
        jobcardId: jobcardId || undefined,
        localUris: [compressed],
      });
      if (photoId) {
        setLastShot({ id: photoId, uri: compressed });
        setNote('');
        setShotCount((n) => n + 1);
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

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {/* Top bar: close, job name, flip. */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.roundButton}
            onPress={() => router.back()}
            hitSlop={8}
          >
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
          {/* Latest shot + its note input, side by side (bottom-left). */}
          {lastShot && (
            <View style={styles.lastShotRow}>
              <View>
                <Image
                  source={{ uri: lastShot.uri }}
                  style={styles.lastShotThumb}
                  contentFit="cover"
                />
                <View style={styles.shotCountBadge}>
                  <Text style={styles.shotCountText}>{shotCount}</Text>
                </View>
              </View>
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

          {/* Shutter. */}
          <View style={styles.shutterRow}>
            <Pressable
              style={[styles.shutter, capturing && styles.shutterBusy]}
              onPress={capture}
              disabled={capturing}
            >
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
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
});
