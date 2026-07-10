import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DisplayPhoto, useIssuePhotos } from '@/components/photos/useJobPhotos';
import { pickJobPhotos } from '@/lib/photoCapture';
import { useAppStore, useCurrentRole, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { JobIssue } from '@/types';

/** Thumbnails per row in an issue's gallery. */
const COLUMNS = 5;
const GAP = spacing.xs;

interface Props {
  issue: JobIssue;
  /**
   * Installer mode (the jobcard screen): the creator edits the description and
   * deletes; anyone adds photos. Off on the parent job page (read-only there).
   */
  editable?: boolean;
  /** Show the source jobcard's title as a link (used on the parent job page). */
  showJobcardLink?: boolean;
  /** Open the tapped photo in the parent screen's viewer. */
  onPhotoPress: (photo: DisplayPhoto, all: DisplayPhoto[]) => void;
}

/**
 * One field issue: who raised it and when, its description, its photo gallery,
 * and the actions the viewer's role allows (installer delete / photo capture,
 * Field Super resolve).
 */
export function IssueCard({
  issue,
  editable = false,
  showJobcardLink = false,
  onPhotoPress,
}: Props) {
  const router = useRouter();
  const me = useCurrentWorker();
  const role = useCurrentRole();
  const raisedBy = useAppStore(
    (s) => s.workers.find((w) => w.id === issue.workerId)?.name
  );
  const jobcard = useAppStore((s) =>
    s.jobcards.find((c) => c.id === issue.jobcardId)
  );
  const updateJobIssueDescription = useAppStore(
    (s) => s.updateJobIssueDescription
  );
  const setJobIssueResolved = useAppStore((s) => s.setJobIssueResolved);
  const deleteJobIssue = useAppStore((s) => s.deleteJobIssue);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const photos = useIssuePhotos(issue.id);

  const [description, setDescription] = useState(issue.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [picking, setPicking] = useState(false);

  const resolved = issue.status === 'resolved';
  const isCreator = me?.id === issue.workerId;
  const canResolve = role === 'field_super';

  const upload = async () => {
    if (picking) return;
    setPicking(true);
    try {
      const uris = await pickJobPhotos();
      if (uris.length) {
        await addJobPhotos({
          jobId: issue.jobId,
          jobcardId: issue.jobcardId,
          issueId: issue.id,
          localUris: uris,
        });
      }
    } finally {
      setPicking(false);
    }
  };

  return (
    <View style={[styles.card, resolved && styles.cardResolved]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          {showJobcardLink && jobcard && (
            <Pressable
              hitSlop={6}
              onPress={() =>
                router.push({ pathname: '/job/[id]', params: { id: jobcard.id } })
              }
            >
              <Text style={styles.jobcardLink} numberOfLines={1}>
                {jobcard.title}
              </Text>
            </Pressable>
          )}
          <Text style={styles.meta} numberOfLines={1}>
            {raisedBy ?? 'Unknown'} ·{' '}
            {format(parseISO(issue.createdAt), 'MMM d')}
          </Text>
        </View>

        {resolved ? (
          <Pressable
            style={styles.resolvedPill}
            disabled={!canResolve}
            onPress={() => setJobIssueResolved(issue.id, false)}
          >
            <Feather name="check" size={12} color={colors.success} />
            <Text style={styles.resolvedText}>Resolved</Text>
          </Pressable>
        ) : canResolve ? (
          <Pressable
            style={({ pressed }) => [
              styles.resolveButton,
              pressed && styles.pressed,
            ]}
            onPress={() => setJobIssueResolved(issue.id, true)}
          >
            <Text style={styles.resolveText}>Resolve</Text>
          </Pressable>
        ) : null}

        {editable && isCreator && (
          <Pressable
            style={[
              styles.deleteButton,
              confirmingDelete && styles.deleteConfirm,
            ]}
            hitSlop={6}
            onPress={() => {
              // Two-tap confirm — the first tap arms the button.
              if (!confirmingDelete) {
                setConfirmingDelete(true);
                return;
              }
              deleteJobIssue(issue.id);
            }}
          >
            <Feather name="trash-2" size={15} color={colors.danger} />
            {confirmingDelete && (
              <Text style={styles.deleteText}>Tap again</Text>
            )}
          </Pressable>
        )}
      </View>

      {editable && isCreator ? (
        <TextInput
          style={styles.descriptionInput}
          value={description}
          onChangeText={setDescription}
          onBlur={() => updateJobIssueDescription(issue.id, description)}
          placeholder="Describe the issue…"
          placeholderTextColor={colors.textTertiary}
          multiline
        />
      ) : (
        <Text
          style={[
            styles.description,
            !issue.description && styles.descriptionEmpty,
          ]}
        >
          {issue.description || 'No description yet.'}
        </Text>
      )}

      {editable && (
        <View style={styles.photoButtonsRow}>
          {Platform.OS !== 'web' && (
            <Pressable
              style={({ pressed }) => [
                styles.photoButton,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                router.push({
                  pathname: '/camera/[jobId]',
                  params: {
                    jobId: issue.jobId,
                    ...(issue.jobcardId ? { jobcardId: issue.jobcardId } : {}),
                    issueId: issue.id,
                  },
                })
              }
            >
              <Feather name="camera" size={14} color={colors.primary} />
              <Text style={styles.photoButtonText}>Take Photos</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.photoButton,
              pressed && styles.pressed,
            ]}
            disabled={picking}
            onPress={upload}
          >
            <Feather name="upload" size={14} color={colors.primary} />
            <Text style={styles.photoButtonText}>
              {picking ? 'Opening…' : 'Upload Images'}
            </Text>
          </Pressable>
        </View>
      )}

      {photos.length > 0 && (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              style={styles.cell}
              onPress={() => onPhotoPress(photo, photos)}
            >
              <Image
                source={{ uri: photo.url }}
                style={styles.thumb}
                contentFit="cover"
                transition={100}
              />
              {photo.pending && (
                <View style={styles.pendingBadge}>
                  <Feather
                    name={
                      photo.pending === 'failed' ? 'alert-circle' : 'upload-cloud'
                    }
                    size={10}
                    color={
                      photo.pending === 'failed'
                        ? colors.warning
                        : colors.textPrimary
                    }
                  />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardResolved: {
    opacity: 0.65,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  jobcardLink: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  meta: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  resolveButton: {
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  resolveText: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  resolvedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  resolvedText: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  deleteConfirm: {
    backgroundColor: colors.dangerDim,
    paddingHorizontal: spacing.sm,
  },
  deleteText: {
    color: colors.danger,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  descriptionInput: {
    minHeight: 56,
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
  description: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  descriptionEmpty: {
    color: colors.textTertiary,
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  photoButtonText: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    margin: -GAP / 2,
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    padding: GAP / 2,
  },
  thumb: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  pendingBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: 3,
  },
});
