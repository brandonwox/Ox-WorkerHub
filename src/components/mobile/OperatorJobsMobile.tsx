import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job } from '@/types';

/**
 * The Operator's jobs on the phone: a read-only monitor of every jobsite —
 * status, QBT mapping, field supers, jobcard counts. Creating and editing jobs
 * stays on the desktop console.
 */
export function OperatorJobsMobile() {
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const workers = useAppStore((s) => s.workers);

  const sorted = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        // Active sites first, then alphabetical.
        if (a.status !== b.status) return a.status === 'Active' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [jobs]
  );

  const cardCountFor = (job: Job) =>
    jobcards.filter((c) => c.jobId === job.id).length;

  const superNamesFor = (job: Job) =>
    (job.fieldSuperIds ?? [])
      .map((id) => workers.find((w) => w.id === id)?.name)
      .filter(Boolean)
      .join(', ');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Jobs</Text>
      <Text style={styles.hint}>
        {sorted.length} {sorted.length === 1 ? 'jobsite' : 'jobsites'} · create
        and edit from the desktop console
      </Text>

      <FlatList
        data={sorted}
        keyExtractor={(job) => job.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const cardCount = cardCountFor(item);
          const supers = superNamesFor(item);
          const archived = item.status === 'Finished';
          return (
            <View style={[styles.card, archived && styles.cardArchived]}>
              <View style={styles.topRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.name}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    archived ? styles.statusPillOff : styles.statusPillOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: archived ? colors.textSecondary : colors.success },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              {item.location ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {item.location}
                </Text>
              ) : null}

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Feather
                    name="link"
                    size={12}
                    color={item.qbtJobcodeId ? colors.success : colors.warning}
                  />
                  <Text
                    style={[
                      styles.metaText,
                      { color: item.qbtJobcodeId ? colors.success : colors.warning },
                    ]}
                  >
                    {item.qbtJobcodeId ? 'QBT linked' : 'No QBT'}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather name="clipboard" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {cardCount} {cardCount === 1 ? 'jobcard' : 'jobcards'}
                  </Text>
                </View>
              </View>

              {supers ? (
                <View style={styles.metaItem}>
                  <Feather name="user-check" size={12} color={colors.textSecondary} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {supers}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="briefcase" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No jobs yet</Text>
            <Text style={styles.emptySubtitle}>
              Create the first job from the desktop console.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardArchived: {
    opacity: 0.6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  statusPill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statusPillOn: {
    backgroundColor: colors.successDim,
  },
  statusPillOff: {
    backgroundColor: colors.surfaceLight,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
  sub: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
}));
