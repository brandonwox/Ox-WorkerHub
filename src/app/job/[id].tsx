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

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { pickJobPhotos } from '@/lib/photoCapture';
import { priorityMeta } from '@/lib/priority';
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
  const setJobcardStatus = useAppStore((s) => s.setJobcardStatus);
  const updateJobcardNotes = useAppStore((s) => s.updateJobcardNotes);
  const addJobPhotos = useAppStore((s) => s.addJobPhotos);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [notes, setNotes] = useState(job?.fieldNotes ?? '');
  const [picking, setPicking] = useState(false);
  const statusWrapRef = useRef<View>(null);

  if (!job) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Jobcard not found.</Text>
      </View>
    );
  }

  const palette = statusColors[job.status];
  const pr = priorityMeta(job.priority);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
                      <Feather name="check" size={14} color={colors.primary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </DropdownPortal>
        </View>
      </View>

      <View style={styles.card}>
        <InfoRow
          icon="map-pin"
          label="Address"
          value={job.address}
        />
        <InfoRow
          icon="calendar"
          label="Date"
          value={format(
            parse(job.date, 'yyyy-MM-dd', new Date()),
            'EEEE, MMMM d, yyyy'
          )}
        />
        <InfoRow
          icon="clock"
          label="Time Window"
          value={formatJobWindow(job.startTime, job.endTime) ?? 'Not set'}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Feather name="flag" size={16} color={colors.textSecondary} />
          </View>
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Priority</Text>
            <View style={[styles.priorityBadge, { backgroundColor: pr.bg }]}>
              <Text style={[styles.priorityBadgeText, { color: pr.fg }]}>
                {job.priority}
              </Text>
            </View>
          </View>
        </View>
        <InfoRow
          icon="layers"
          label="Window Opening Flashing Material (site-wide)"
          value={job.flashingMaterial ?? 'Not specified'}
        />
        {job.materials ? (
          <InfoRow icon="package" label="Materials Needed" value={job.materials} />
        ) : null}
        {job.scopeOfWork ? (
          <InfoRow icon="clipboard" label="Scope of Work" value={job.scopeOfWork} />
        ) : null}
      </View>

      <View style={styles.card}>
        <InfoRow
          icon="briefcase"
          label="General Contractor"
          value={job.details.generalContractor}
        />
        <InfoRow
          icon="user"
          label="Manager"
          value={job.details.managerName}
        />
        <InfoRow
          icon="phone"
          label="Manager Phone"
          value={job.details.managerPhone}
        />
      </View>

      <View style={styles.card}>
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
        <View style={styles.photoActions}>
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
          <Pressable
            style={({ pressed }) => [pressed && styles.uploadPressed]}
            onPress={() =>
              router.push({
                pathname: '/job-site/[id]',
                params: { id: job.jobId! },
              })
            }
          >
            <Text style={styles.viewPhotosText}>View job photos</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
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
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    zIndex: 10,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    marginTop: 2,
  },
  priorityBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  notesCaption: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 84,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  photoActions: {
    gap: spacing.md,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.lg,
  },
  cameraPressed: {
    opacity: 0.85,
  },
  cameraText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: spacing.lg,
  },
  uploadPressed: {
    backgroundColor: colors.primaryDim,
  },
  uploadText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  viewPhotosText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
