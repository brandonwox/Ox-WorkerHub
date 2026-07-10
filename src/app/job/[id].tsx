import { Feather } from '@expo/vector-icons';
import { format, parse } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import {
  DisplayPhoto,
  useJobcardPhotos,
} from '@/components/photos/useJobPhotos';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { JobcardStatus } from '@/types';
import { formatJobWindow } from '@/utils/time';

const STATUSES: JobcardStatus[] = ['Upcoming', 'In Progress', 'Finished'];

const statusColors: Record<JobcardStatus, { bg: string; fg: string }> = {
  Upcoming: { bg: colors.primaryDim, fg: colors.primary },
  'In Progress': { bg: colors.warningDim, fg: colors.warning },
  Finished: { bg: colors.successDim, fg: colors.success },
};

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const job = useAppStore((s) => s.jobcards.find((j) => j.id === id));
  // Parent job — carries the Window Flashing Material reference photo.
  const parentJob = useAppStore((s) =>
    s.jobs.find((parent) => parent.id === job?.jobId)
  );
  const setJobcardStatus = useAppStore((s) => s.setJobcardStatus);
  const updateJobcardNotes = useAppStore((s) => s.updateJobcardNotes);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const photos = useJobcardPhotos(job?.id);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [notes, setNotes] = useState(job?.fieldNotes ?? '');
  const [picking, setPicking] = useState(false);
  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);
  const statusWrapRef = useRef<View>(null);

  if (!job) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Jobcard not found.</Text>
      </View>
    );
  }

  const palette = statusColors[job.status];
  const timeWindow = formatJobWindow(job.startTime, job.endTime);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closePressed,
          ]}
          hitSlop={12}
          onPress={() => router.back()}
        >
          <Feather name="x" size={28} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.header}>
          {parentJob && (
            <Pressable
              hitSlop={8}
              onPress={() =>
                router.push({
                  pathname: '/job-site/[id]',
                  params: { id: parentJob.id },
                })
              }
            >
              <Text style={styles.parentJobLink}>{parentJob.name}</Text>
            </Pressable>
          )}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{job.title}</Text>
            <View ref={statusWrapRef} style={styles.statusWrap}>
              <Pressable
                style={[styles.statusPill, { backgroundColor: palette.bg }]}
                onPress={() => setStatusMenuOpen((open) => !open)}
              >
                <Text style={[styles.statusPillText, { color: palette.fg }]}>
                  {job.status}
                </Text>
                <Feather
                  name={statusMenuOpen ? 'chevron-up' : 'chevron-down'}
                  size={13}
                  color={palette.fg}
                />
              </Pressable>
              <DropdownPortal
                anchorRef={statusWrapRef}
                open={statusMenuOpen}
                onClose={() => setStatusMenuOpen(false)}
                align="right"
                minWidth={150}
              >
                <View style={styles.statusMenu}>
                  {STATUSES.map((status) => {
                    const active = job.status === status;
                    return (
                      <Pressable
                        key={status}
                        style={({ pressed }) => [
                          styles.statusMenuItem,
                          pressed && styles.statusMenuItemPressed,
                        ]}
                        onPress={() => {
                          setJobcardStatus(job.id, status);
                          setStatusMenuOpen(false);
                        }}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: statusColors[status].fg },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusMenuText,
                            active && styles.statusMenuTextActive,
                          ]}
                        >
                          {status}
                        </Text>
                        {active && (
                          <Feather
                            name="check"
                            size={14}
                            color={colors.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </DropdownPortal>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <InfoRow icon="map-pin" label="Address" value={job.address} />
          <InfoRow
            icon="calendar"
            label="Date"
            value={format(
              parse(job.date, 'yyyy-MM-dd', new Date()),
              'EEEE, MMMM d, yyyy'
            )}
          />
          {timeWindow ? (
            <InfoRow icon="clock" label="Time Window" value={timeWindow} />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.flashingRow}>
            <View style={styles.flashingInfo}>
              <InfoRow
                icon="layers"
                label="Window Opening Flashing Material (site-wide)"
                value={job.flashingMaterial ?? 'Not specified'}
              />
            </View>
            {/* The Field Super's reference photo of the material (tap to expand). */}
            <FlashingPhotoField job={parentJob} />
          </View>
          {job.materials ? (
            <InfoRow icon="package" label="Materials Needed" value={job.materials} />
          ) : null}
          {job.scopeOfWork ? (
            <InfoRow icon="clipboard" label="Scope of Work" value={job.scopeOfWork} />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Feather name="edit-3" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Field Notes</Text>
              <Text style={styles.notesCaption}>
                Shared with every crew on this jobcard.
              </Text>
            </View>
          </View>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            onBlur={() => updateJobcardNotes(job.id, notes)}
            placeholder="Add notes from the field…"
            placeholderTextColor={colors.textTertiary}
            multiline
          />
        </View>

        {/* Photos taken here land on the PARENT job's photo wall, each linked
            back to this jobcard. Hidden for legacy cards with no parent job. */}
        {job.jobId && (
          <View style={styles.section}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Feather name="image" size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Photos</Text>
              </View>
            </View>
            <View style={styles.photoButtonsRow}>
              {Platform.OS !== 'web' && (
                <Pressable
                  style={({ pressed }) => [
                    styles.cameraButton,
                    pressed && styles.cameraPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: '/camera/[jobId]',
                      params: { jobId: job.jobId!, jobcardId: job.id },
                    })
                  }
                >
                  <Feather name="camera" size={18} color={colors.textPrimary} />
                  <Text style={styles.cameraText}>Take Photos</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.uploadButton,
                  pressed && styles.uploadPressed,
                ]}
                disabled={picking}
                onPress={async () => {
                  if (picking) return;
                  setPicking(true);
                  try {
                    const uris = await pickJobPhotos();
                    if (uris.length) {
                      await addJobPhotos({
                        jobId: job.jobId!,
                        jobcardId: job.id,
                        localUris: uris,
                      });
                    }
                  } finally {
                    setPicking(false);
                  }
                }}
              >
                <Feather name="upload" size={18} color={colors.primary} />
                <Text style={styles.uploadText}>
                  {picking ? 'Opening…' : 'Upload Images'}
                </Text>
              </Pressable>
            </View>
            {photos.length > 0 && (
              <JobPhotoGrid
                photos={photos}
                onPhotoPress={(photo, sorted) =>
                  setViewer({
                    photos: sorted,
                    index: sorted.findIndex((p) => p.id === photo.id),
                  })
                }
              />
            )}
          </View>
        )}
      </ScrollView>

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={16} color={colors.textSecondary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  closeButton: {
    alignSelf: 'flex-start',
    marginBottom: -spacing.sm,
  },
  closePressed: {
    opacity: 0.6,
  },
  header: {
    gap: 2,
    zIndex: 10,
  },
  parentJobLink: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 22,
  },
  statusWrap: {
    position: 'relative',
    zIndex: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 3,
  },
  statusPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  statusMenu: {
    minWidth: 150,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35)',
  },
  statusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  statusMenuItemPressed: {
    backgroundColor: colors.border,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.pill,
  },
  statusMenuText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  statusMenuTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  section: {
    gap: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  flashingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flashingInfo: {
    flex: 1,
  },
  infoIcon: {
    width: 20,
    alignItems: 'center',
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  notesCaption: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 84,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
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
  cameraPressed: {
    opacity: 0.85,
  },
  cameraText: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
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
  uploadPressed: {
    backgroundColor: colors.primaryDim,
  },
  uploadText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
});
