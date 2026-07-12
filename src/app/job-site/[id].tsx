import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { CollapsibleIssueList } from '@/components/issues/CollapsibleIssueList';
import { IssueCard } from '@/components/issues/IssueCard';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobPhotos } from '@/components/photos/useJobPhotos';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * A parent Job's page: a cover photo, jobsite info, issues, and the photo
 * wall. Installers open it from the Jobs tab. Capture/upload live as icon
 * buttons floating at the bottom (no live camera on web — upload only there).
 */
export default function JobSiteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Newest photo doubles as the page's cover image.
  const coverPhoto = photos[0];

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(Platform.OS === 'web' ? '/installer-pics' : '/pics');
  };

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
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Keyboard insets (iOS): otherwise the open keyboard covers the bottom
          of the page and it can't be scrolled fully into view. */}
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            hitSlop={12}
            onPress={close}
          >
            <Feather name="x" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Cover: the job's newest photo (tap to view); a quiet placeholder
            until the job has photos. */}
        {coverPhoto ? (
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={() =>
              setViewer({
                photos,
                index: 0,
              })
            }
          >
            <Image
              source={{ uri: coverPhoto.url }}
              style={styles.cover}
              contentFit="cover"
              transition={120}
            />
          </Pressable>
        ) : (
          <View style={[styles.cover, styles.coverEmpty]}>
            <Feather name="image" size={28} color={colors.textTertiary} />
          </View>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>{job.name}</Text>
          {job.status === 'Finished' && (
            <View style={styles.archivedPill}>
              <Text style={styles.archivedText}>Finished</Text>
            </View>
          )}
        </View>

        <View style={styles.infoBlock}>
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
                ? fieldSupers.join(', ')
                : 'No Field Super assigned'}
            </Text>
          </View>
        </View>

        {/* Field issues raised on this job's cards, with a link back to each
            card. Field Supers resolve them from here. Long lists collapse
            behind a "View all" toggle. */}
        {issues.length > 0 && (
          <View style={styles.issuesSection}>
            <Text style={styles.issuesHeader}>Issues</Text>
            <CollapsibleIssueList
              issues={issues}
              renderIssue={(issue) => (
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
              )}
            />
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

      {/* Floating capture bar: icon-only camera (native) + upload, centered. */}
      <View
        style={[styles.actionBar, { bottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        {Platform.OS !== 'web' && (
          <Pressable
            style={({ pressed }) => [
              styles.cameraFab,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.push({
                pathname: '/camera/[jobId]',
                params: { jobId: job.id },
              })
            }
            accessibilityLabel="Take photos"
          >
            <Feather name="camera" size={24} color={colors.textOnAccent} />
          </Pressable>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.uploadFab,
            (pressed || picking) && styles.pressed,
          ]}
          onPress={uploadFromLibrary}
          disabled={picking}
          accessibilityLabel="Upload photos"
        >
          <Feather name="upload" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
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
    // Clears the floating capture bar so the last grid rows stay reachable.
    paddingBottom: spacing.xxl * 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: '100%',
    height: 190,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceLight,
  },
  coverEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
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
  infoBlock: {
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
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  cameraFab: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
  },
  uploadFab: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.18)',
  },
  pressed: {
    opacity: 0.85,
  },
}));
