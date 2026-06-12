import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { JobStatus } from '@/types';
import { formatTimeWindow } from '@/utils/time';

const STATUSES: JobStatus[] = ['Upcoming', 'In Progress', 'Finished'];

const statusColors: Record<JobStatus, { bg: string; fg: string }> = {
  Upcoming: { bg: colors.primaryDim, fg: colors.primary },
  'In Progress': { bg: colors.warningDim, fg: colors.warning },
  Finished: { bg: colors.successDim, fg: colors.success },
};

export default function JobDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useAppStore((s) => s.jobs.find((j) => j.id === id));
  const setJobStatus = useAppStore((s) => s.setJobStatus);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  if (!job) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.notFound}>Job not found.</Text>
      </View>
    );
  }

  const palette = statusColors[job.status];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{job.title}</Text>
        <View style={styles.statusWrap}>
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
          {statusMenuOpen && (
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
                      setJobStatus(job.id, status);
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
          )}
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
          value={format(new Date(job.startTime), 'EEEE, MMMM d, yyyy')}
        />
        <InfoRow
          icon="clock"
          label="Time Window"
          value={formatTimeWindow(job.startTime, job.endTime)}
        />
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

      <Pressable
        style={({ pressed }) => [styles.uploadButton, pressed && styles.uploadPressed]}
      >
        <Feather name="camera" size={18} color={colors.primary} />
        <Text style={styles.uploadText}>Upload Images</Text>
      </Pressable>
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
    position: 'absolute',
    top: 34,
    right: 0,
    minWidth: 150,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    zIndex: 20,
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
});
