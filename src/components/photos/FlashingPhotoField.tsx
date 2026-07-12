import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ZoomableImage } from '@/components/photos/ZoomableImage';
import { captureSingleJobPhoto, pickSingleJobPhoto } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, darkColors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';

interface Props {
  /** The job whose flashing photo to show/manage. Undefined renders nothing. */
  job: Job | undefined;
  /**
   * Whether this viewer may take/upload/replace the photo (Field Supers).
   * Read-only surfaces (installer jobcard view) just show the thumbnail.
   */
  editable?: boolean;
}

/**
 * The Window Flashing Material reference photo, shown beside the flashing
 * material text input/value. One image per JOB: a Field Super takes (native)
 * or uploads it once and it appears on every jobcard of that job. Tapping the
 * thumbnail opens it full-screen.
 */
export function FlashingPhotoField({ job, editable = false }: Props) {
  const setJobFlashingPhoto = useAppStore((s) => s.setJobFlashingPhoto);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  if (!job) return null;
  const url = job.flashingPhotoUrl;
  if (!url && !editable) return null;

  const save = async (getUri: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await getUri();
      if (uri) await setJobFlashingPhoto(job.id, uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {url ? (
        <Pressable onPress={() => setViewerOpen(true)} hitSlop={4}>
          <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
        </Pressable>
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Feather name="image" size={18} color={colors.textTertiary} />
        </View>
      )}

      {editable && (
        <View style={styles.buttons}>
          {Platform.OS !== 'web' && (
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              onPress={() => save(captureSingleJobPhoto)}
              disabled={busy}
            >
              <Feather name="camera" size={13} color={colors.primary} />
              <Text style={styles.buttonText}>{url ? 'Retake' : 'Take'}</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => save(pickSingleJobPhoto)}
            disabled={busy}
          >
            <Feather name="upload" size={13} color={colors.primary} />
            <Text style={styles.buttonText}>
              {busy ? 'Saving…' : url ? 'Replace' : 'Upload'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Full-screen viewer. */}
      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        {/* RN Modals don't inherit the app root's gesture root — mount our own
            so pinch-to-zoom works inside the viewer. */}
        <GestureHandlerRootView style={styles.viewerBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setViewerOpen(false)}
          />
          {url && (
            <ZoomableImage uri={url} width={winWidth} height={winHeight} />
          )}
          <View style={styles.viewerTopBar}>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              Window Flashing Material
            </Text>
            <Pressable
              style={styles.viewerClose}
              onPress={() => setViewerOpen(false)}
              hitSlop={10}
            >
              <Feather name="x" size={22} color={darkColors.textPrimary} />
            </Pressable>
          </View>
          {job.flashingMaterial ? (
            <View style={styles.viewerBottomBar}>
              <Text style={styles.viewerCaption}>{job.flashingMaterial}</Text>
            </View>
          ) : null}
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttons: {
    gap: spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  pressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerTopBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? spacing.lg : spacing.xxl + spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  // Viewer chrome sits on the black backdrop — pinned to the dark palette so
  // it stays light-on-dark in light mode too.
  viewerTitle: {
    flexShrink: 1,
    color: darkColors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  viewerClose: {
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: spacing.sm,
  },
  viewerBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'web' ? spacing.lg : spacing.xl + spacing.md,
  },
  viewerCaption: {
    color: darkColors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
}));
