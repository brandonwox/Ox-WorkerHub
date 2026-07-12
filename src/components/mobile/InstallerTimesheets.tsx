import { Feather } from '@expo/vector-icons';
import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditLogModal } from '@/components/EditLogModal';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TimesheetCard } from '@/components/TimesheetCard';
import { currentWorkerOf, useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { TimesheetLog } from '@/types';
import { formatHours, formatMoney } from '@/utils/time';

const TIMEFRAMES = ['Today', 'This Week', 'Last 30 Days'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

function timeframeRange(timeframe: Timeframe): { from: string; to: string } {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (timeframe === 'Today') {
    return { from: today, to: today };
  }
  if (timeframe === 'This Week') {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return {
      from: format(monday, 'yyyy-MM-dd'),
      to: format(addDays(monday, 4), 'yyyy-MM-dd'), // Mon–Fri
    };
  }
  return { from: format(subDays(new Date(), 29), 'yyyy-MM-dd'), to: today };
}

/**
 * The installer's own timesheet history (timeframe filter + summary + logs).
 * Rendered by the mobile Timesheets tab and by the desktop /installer-timesheets
 * page.
 */
export function InstallerTimesheets() {
  const logs = useAppStore((s) => s.logs);
  const jobcards = useAppStore((s) => s.jobcards);
  const currentUserId = useAppStore((s) => currentWorkerOf(s)?.id ?? '');
  const [timeframe, setTimeframe] = useState<Timeframe>('This Week');
  const [editingLog, setEditingLog] = useState<TimesheetLog | null>(null);

  const filteredLogs = useMemo(() => {
    const { from, to } = timeframeRange(timeframe);
    return logs
      .filter(
        (log) =>
          log.workerId === currentUserId && log.date >= from && log.date <= to
      )
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
  }, [logs, timeframe, currentUserId]);

  const totalHours = filteredLogs.reduce((sum, log) => sum + log.totalHours, 0);
  const totalEarned = filteredLogs.reduce(
    (sum, log) => sum + log.earnedAmount,
    0
  );

  const projectNameFor = (log: TimesheetLog) =>
    log.jobcardId
      ? jobcards.find((j) => j.id === log.jobcardId)?.title ?? 'Jobcard'
      : log.customProjectName ?? 'Custom Project';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Timesheets</Text>

      <View style={styles.headerSection}>
        <SegmentedControl
          options={TIMEFRAMES}
          value={timeframe}
          onChange={setTimeframe}
        />

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrap}>
              <Feather name="clock" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.summaryValue}>{formatHours(totalHours)}</Text>
              <Text style={styles.summaryLabel}>Hours worked</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <View style={styles.summaryIconWrap}>
              <Feather name="dollar-sign" size={16} color={colors.success} />
            </View>
            <View>
              <Text style={styles.summaryValue}>{formatMoney(totalEarned)}</Text>
              <Text style={styles.summaryLabel}>Estimated earned</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredLogs}
        keyExtractor={(log) => log.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TimesheetCard
            log={item}
            projectName={projectNameFor(item)}
            onEdit={() => setEditingLog(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.emptySubtitle}>
              Clock in from the Calendar tab to start tracking hours.
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
    gap: spacing.md,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
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
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
}));
