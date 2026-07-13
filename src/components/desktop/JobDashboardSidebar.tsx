import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CollapsibleIssueList } from '@/components/issues/CollapsibleIssueList';
import { IssueCard } from '@/components/issues/IssueCard';
import { JobDocumentsSection } from '@/components/jobsite/JobDocumentsSection';
import { JobcardQuickView } from '@/components/desktop/JobcardQuickView';
import { FlashingPhotoField } from '@/components/photos/FlashingPhotoField';
import { JobPhotoGrid } from '@/components/photos/JobPhotoGrid';
import { PhotoViewerModal } from '@/components/photos/PhotoViewerModal';
import { DisplayPhoto, useJobPhotos } from '@/components/photos/useJobPhotos';
import { StatusPill } from '@/components/StatusPill';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { jobAllowsWindows } from '@/utils/jobScopes';

interface Props {
  /** The job to dashboard, or null when the sidebar is closed. */
  job: Job | null;
  onClose: () => void;
  /**
   * Whether the viewer may edit the jobsite address / flashing material inline
   * (Field Supers and the Operator; RLS matches).
   */
  editable?: boolean;
  /** Jobs passed through to the jobcard quick view (the viewer's scope). */
  quickViewJobs: Job[];
}

/**
 * The desktop job dashboard: a large right-hand sidebar mirroring the mobile
 * job details page. Shows the jobsite address (copy / open in maps), the
 * Window Flashing Material (text + reference photo), and the job's jobcards,
 * issues, documents, and pictures. Clicking a jobcard opens its quick view.
 */
export function JobDashboardSidebar({
  job,
  onClose,
  editable = false,
  quickViewJobs,
}: Props) {
  const jobcards = useAppStore((s) => s.jobcards);
  const jobIssues = useAppStore((s) => s.jobIssues);
  const updateJob = useAppStore((s) => s.updateJob);
  const deleteJobcard = useAppStore((s) => s.deleteJobcard);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const flash = useAppStore((s) => s.flash);
  const photos = useJobPhotos(job?.id);

  const [viewingCardId, setViewingCardId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    photos: DisplayPhoto[];
    index: number;
  } | null>(null);
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [picking, setPicking] = useState(false);

  const jobJobcards = useMemo(
    () =>
      jobcards
        .filter((card) => card.jobId === job?.id)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [jobcards, job?.id]
  );

  const issues = useMemo(
    () =>
      jobIssues
        .filter((issue) => issue.jobId === job?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobIssues, job?.id]
  );
  const openIssues = issues.filter((issue) => issue.status === 'open');
  const resolvedIssues = issues.filter((issue) => issue.status === 'resolved');

  if (!job) return null;

  const copyAddress = async () => {
    if (!job.location) return;
    await Clipboard.setStringAsync(job.location);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const openInMaps = () => {
    if (!job.location) return;
    const q = encodeURIComponent(job.location);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  const uploadPhotos = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const uris = await pickJobPhotos();
      if (uris.length) await addJobPhotos({ jobId: job.id, localUris: uris });
    } finally {
      setPicking(false);
    }
  };

  const openPhoto = (photo: DisplayPhoto, all: DisplayPhoto[]) =>
    setViewer({ photos: all, index: all.findIndex((p) => p.id === photo.id) });

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={styles.title} numberOfLines={2}>
            {job.name}
          </Text>
          {job.status === 'Finished' && (
            <View style={styles.archivedPill}>
              <Text style={styles.archivedText}>Finished</Text>
            </View>
          )}
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Jobsite address: inline-editable for Field Supers/Operator, with
            copy + open-in-maps at hand. */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Jobsite address</Text>
          <View style={styles.addressRow}>
            {editable ? (
              <AddressInput
                key={job.id}
                value={job.location ?? ''}
                onCommit={(location) => updateJob(job.id, { location })}
              />
            ) : (
              <Text style={styles.addressText}>
                {job.location || 'No location set'}
              </Text>
            )}
            <Pressable
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
              onPress={copyAddress}
              disabled={!job.location}
              accessibilityLabel="Copy address"
            >
              <Feather
                name={copied ? 'check' : 'copy'}
                size={15}
                color={job.location ? colors.primary : colors.textTertiary}
              />
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
              onPress={openInMaps}
              disabled={!job.location}
              accessibilityLabel="Open in Google Maps"
            >
              <Feather
                name="map"
                size={15}
                color={job.location ? colors.primary : colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>

        {/* Hidden entirely for jobs whose scopes exclude window work. */}
        {jobAllowsWindows(job) && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>
              Window Opening Flashing Material
            </Text>
            <View style={styles.flashRow}>
              {editable ? (
                <FlashingInput
                  key={job.id}
                  value={job.flashingMaterial ?? ''}
                  onCommit={(flashingMaterial) =>
                    updateJob(job.id, { flashingMaterial })
                  }
                />
              ) : (
                <Text style={styles.addressText}>
                  {job.flashingMaterial || 'Not set'}
                </Text>
              )}
              <FlashingPhotoField job={job} editable={editable} />
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>
            Jobcards ({jobJobcards.length})
          </Text>
          {jobJobcards.length === 0 ? (
            <Text style={styles.emptyText}>No jobcards yet.</Text>
          ) : (
            jobJobcards.map((card) => {
              const tasks = card.tasks ?? [];
              const done = tasks.filter((t) => t.done).length;
              return (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [
                    styles.jobcardRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setViewingCardId(card.id)}
                >
                  <View style={styles.jobcardText}>
                    <Text style={styles.jobcardTitle} numberOfLines={1}>
                      {card.title}
                    </Text>
                    {tasks.length > 0 && (
                      <Text style={styles.jobcardMeta}>
                        {done}/{tasks.length} tasks
                      </Text>
                    )}
                  </View>
                  <StatusPill status={card.status} />
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={colors.textTertiary}
                  />
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Issues ({openIssues.length})</Text>
          {openIssues.length === 0 && resolvedIssues.length === 0 && (
            <Text style={styles.emptyText}>No issues.</Text>
          )}
          {openIssues.length > 0 && (
            <CollapsibleIssueList
              issues={openIssues}
              renderIssue={(issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  showJobcardLink
                  onPhotoPress={openPhoto}
                />
              )}
            />
          )}
          {resolvedIssues.length > 0 && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.resolvedToggle,
                  pressed && styles.pressed,
                ]}
                onPress={() => setResolvedOpen((o) => !o)}
              >
                <Feather
                  name={resolvedOpen ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={colors.textSecondary}
                />
                <Text style={styles.resolvedToggleText}>
                  Resolved ({resolvedIssues.length})
                </Text>
              </Pressable>
              {resolvedOpen &&
                resolvedIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    showJobcardLink
                    onPhotoPress={openPhoto}
                  />
                ))}
            </>
          )}
        </View>

        <JobDocumentsSection jobId={job.id} />

        <View style={styles.section}>
          <View style={styles.picturesHeader}>
            <Text style={styles.sectionHeader}>Pictures</Text>
            <Pressable
              style={({ pressed }) => [
                styles.uploadButton,
                pressed && styles.pressed,
              ]}
              onPress={uploadPhotos}
              disabled={picking}
            >
              <Feather name="upload" size={13} color={colors.primary} />
              <Text style={styles.uploadText}>
                {picking ? 'Opening…' : 'Upload'}
              </Text>
            </Pressable>
          </View>
          <JobPhotoGrid photos={photos} onPhotoPress={openPhoto} />
        </View>
      </ScrollView>

      <JobcardQuickView
        jobcardId={viewingCardId}
        jobs={quickViewJobs}
        onClose={() => setViewingCardId(null)}
        onDelete={(id) => {
          const title = jobJobcards.find((c) => c.id === id)?.title;
          deleteJobcard(id);
          setViewingCardId(null);
          flash(title ? `Jobcard "${title}" deleted` : 'Jobcard deleted', 'success');
        }}
      />

      <PhotoViewerModal
        photos={viewer?.photos ?? []}
        initialIndex={viewer?.index ?? null}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

/** Inline editable jobsite address; commits on blur. */
function AddressInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => onCommit(text.trim());
  return (
    <TextInput
      style={styles.addressInput}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="123 Main St, Park City, UT"
      placeholderTextColor={colors.textTertiary}
    />
  );
}

/** Inline editable flashing material; commits on blur (empty clears). */
function FlashingInput({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string | undefined) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    const trimmed = text.trim();
    onCommit(trimmed || undefined);
  };
  return (
    <TextInput
      style={styles.addressInput}
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onEndEditing={commit}
      placeholder="not set"
      placeholderTextColor={colors.textTertiary}
    />
  );
}

const styles = themed(() =>
  StyleSheet.create({
    panel: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 520,
      maxWidth: '82%',
      backgroundColor: colors.surface,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
      ...modalShadow,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    headerMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    title: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 20,
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
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: spacing.xl,
      paddingBottom: spacing.xl,
    },
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    addressText: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
    addressInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
      outlineWidth: 0,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceLight,
    },
    flashRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    jobcardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    jobcardText: {
      flex: 1,
      gap: 2,
    },
    jobcardTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    jobcardMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.medium,
      fontSize: 11,
    },
    resolvedToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceLight,
      paddingVertical: spacing.sm + 2,
    },
    resolvedToggleText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 13,
    },
    picturesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 1,
    },
    uploadText: {
      color: colors.primary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    pressed: {
      opacity: 0.85,
    },
  })
);
