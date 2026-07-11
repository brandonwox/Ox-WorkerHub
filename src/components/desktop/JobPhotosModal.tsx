import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobPhotos } from '@/components/photos/useJobPhotos';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing } from '@/theme';
import { Job } from '@/types';

interface Props {
  /** The job whose photos to show, or null when closed. */
  job: Job | null;
  onClose: () => void;
}

/**
 * Desktop popup with a job's photo wall. There is no live camera on web, but
 * photos can be added from the computer; delete rules match the mobile viewer
 * (own photos, or any photo for Field Supers / the Operator).
 */
export function JobPhotosModal({ job, onClose }: Props) {
  const workers = useAppStore((s) => s.workers);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const photos = useJobPhotos(job?.id);

  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);
  const [picking, setPicking] = useState(false);

  const fieldSupers = useMemo(
    () =>
      (job?.fieldSuperIds ?? [])
        .map((fsId) => workers.find((w) => w.id === fsId)?.name)
        .filter((name): name is string => !!name),
    [job, workers]
  );

  const uploadFromComputer = async () => {
    if (!job || picking) return;
    setPicking(true);
    try {
      const uris = await pickJobPhotos();
      if (uris.length) await addJobPhotos({ jobId: job.id, localUris: uris });
    } finally {
      setPicking(false);
    }
  };

  return (
    <Modal
      visible={!!job}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerMain}>
              <Text style={styles.title} numberOfLines={1}>
                {job?.name ?? ''}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {job?.location || 'No location set'}
                {fieldSupers.length
                  ? ` · Field Super: ${fieldSupers.join(', ')}`
                  : ''}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.uploadButton,
                pressed && styles.uploadPressed,
              ]}
              onPress={uploadFromComputer}
              disabled={picking}
            >
              <Feather name="upload" size={14} color={colors.primary} />
              <Text style={styles.uploadText}>
                {picking ? 'Opening…' : 'Upload photos'}
              </Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            <JobPhotoGrid
              photos={photos}
              onPhotoPress={(photo, sorted) =>
                setViewer({
                  photos: sorted,
                  index: sorted.findIndex((p) => p.id === photo.id),
                })
              }
            />
          </ScrollView>
        </View>
      </View>

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 860,
    maxHeight: '90%',
    backgroundColor: colors.surface,
    ...modalShadow,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerMain: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  uploadPressed: {
    backgroundColor: colors.primaryDim,
  },
  uploadText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xs,
  },
});
