import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditLogModal } from '@/components/EditLogModal';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TimesheetCard } from '@/components/TimesheetCard';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatHours } from '@/utils/time';

const FILTERS = ['All', 'Unsent', 'Sent', 'Failed'] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_STATUS: Record<Exclude<Filter, 'All'>, TimesheetLog['sendStatus']> = {
  Unsent: 'unsent',
  Sent: 'sent',
  Failed: 'failed',
};

/**
 * The Operator's timesheet review on the phone: every worker's logs grouped by
 * worker, filterable by QBT send status, with the same edit sheet as the
 * desktop console (edits reset a log to 'unsent' for the Monday sweep).
 */
export function OperatorTimesheetsMobile() {
  const logs = useAppStore((s) => s.logs);
  const workRequests = useAppStore((s) => s.workRequests);
  const workers = useAppStore((s) => s.workers);
  const [filter, setFilter] = useState<Filter>('All');
  const [editingLog, setEditingLog] = useState<TimesheetLog | null>(null);

  const sections = useMemo(() => {
    const wanted =
      filter === 'All' ? null : FILTER_STATUS[filter as Exclude<Filter, 'All'>];
    const filtered = logs.filter(
      (log) => wanted === null || log.sendStatus === wanted
    );
    return workers
      .map((worker) => {
        const data = filtered
          .filter((log) => log.workerId === worker.id)
          .sort(
            (a, b) =>
              new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
        return {
          title: worker.name,
          totalHours: data.reduce((sum, log) => sum + log.totalHours, 0),
          data,
        };
      })
      .filter((section) => section.data.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [logs, workers, filter]);

  const projectNameFor = (log: TimesheetLog) =>
    log.workRequestId
      ? workRequests.find((j) => j.id === log.workRequestId)?.title ?? 'Work Request'
      : log.customProjectName ?? 'Custom Project';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Timesheets</Text>

      <View style={styles.headerSection}>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(log) => log.id}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionHours}>
              {formatHours(section.totalHours)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <TimesheetCard
              log={item}
              projectName={projectNameFor(item)}
              onEdit={() => setEditingLog(item)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>
              Nothing {filter === 'All' ? 'logged' : filter.toLowerCase()}
            </Text>
            <Text style={styles.emptySubtitle}>
              Logs appear here as installers clock time.
            </Text>
          </View>
        }
      />

      <EditLogModal
        log={editingLog}
        projectName={editingLog ? projectNameFor(editingLog) : ''}
        onClose={() => setEditingLog(null)}
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
  headerSection: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  sectionHours: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  cardWrap: {
    marginBottom: spacing.md,
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
