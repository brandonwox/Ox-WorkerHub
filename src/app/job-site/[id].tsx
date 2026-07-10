import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IssueCard } from '@/components/issues/IssueCard';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobPhotos } from '@/components/photos/useJobPhotos';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/**
 * A parent Job's page: jobsite info and its photo wall. Installers open it from
 * the Pics tab; the camera button captures new photos straight onto the job.
 * On web (no live camera) the capture button is replaced by file upload only.
 */
export default function JobSiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const job = useAppStore((s) => s.jobs.find((j) => j.id === id));
  const workers = useAppStore((s) => s.workers);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const photos = useJobPhotos(job?.id);
  // This job's issues from every jobcard: open ones first, then newest first.
  const issues = useMemo(
    () =>
      jobIssues
        .filter((issue) => issue.jobId === job?.id)
        .sort((a, b) =>
          a.status !== b.status
            ? a.status === 'open'
              ? -1
              : 1
            : b.createdAt.localeCompare(a.createdAt)
        ),
    [jobIssues, job?.id]
  );

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

  if (!job) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Job not found.</Text>
      </View>
    );
  }

  const uploadFromLibrary = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const uris = await pickJobPhotos();
      if (uris.length) await addJobPhotos({ jobId: job.id, localUris: uris });
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{job.name}</Text>
          {job.status === 'Archived' && (
            <View style={styles.archivedPill}>
              <Text style={styles.archivedText}>Archived</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={15} color={colors.textSecondary} />
            <Text style={styles.infoValue}>
              {job.location || 'No location set'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="user" size={15} color={colors.textSecondary} />
            <Text style={styles.infoValue}>
              {fieldSupers.length
                ? `Field Super: ${fieldSupers.join(', ')}`
                : 'No Field Super assigned'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {Platform.OS !== 'web' && (
            <Pressable
              style={({ pressed }) => [
                styles.cameraButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/camera/[jobId]',
                  params: { jobId: job.id },
                })
              }
            >
              <Feather name="camera" size={18} color={colors.textPrimary} />
              <Text style={styles.cameraButtonText}>Take Photos</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.uploadButton,
              pressed && styles.pressed,
            ]}
            onPress={uploadFromLibrary}
            disabled={picking}
          >
            <Feather name="upload" size={17} color={colors.primary} />
            <Text style={styles.uploadButtonText}>
              {picking ? 'Opening…' : 'Upload'}
            </Text>
          </Pressable>
        </View>

        {/* Field issues raised on this job's cards, with a link back to each
            card. Field Supers resolve them from here. */}
        {issues.length > 0 && (
          <View style={styles.issuesSection}>
            <Text style={styles.issuesHeader}>Issues</Text>
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                showJobcardLink
                onPhotoPress={(photo, all) =>
                  setViewer({
                    photos: all,
                    index: all.findIndex((p) => p.id === photo.id),
                  })
                }
              />
            ))}
          </View>
        )}

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

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  archivedPill: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  archivedText: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoValue: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  issuesSection: {
    gap: spacing.md,
  },
  issuesHeader: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cameraButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.md + 2,
  },
  cameraButtonText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.md + 2,
  },
  uploadButtonText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
});
