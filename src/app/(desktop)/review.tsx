import { Feather } from '@expo/vector-icons';
import { endOfWeek, format, nextMonday, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { EditLogModal } from '@/components/EditLogModal';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { TimesheetLog, TimesheetSendStatus } from '@/types';
import { formatHours, formatMoney, formatTime } from '@/utils/time';

const FILTERS = ['All', 'Unsent', 'Sent', 'Failed'] as const;
type Filter = (typeof FILTERS)[number];

interface WorkerGroup {
  workerId: string;
  workerName: string;
  logs: TimesheetLog[];
  totalHours: number;
}

/** Badge per delivery result. 'unsent' shows no badge (nothing has happened yet). */
const SEND_META: Record<
  Exclude<TimesheetSendStatus, 'unsent'>,
  { label: string; icon: keyof typeof Feather.glyphMap; color: string }
> = {
  sent: { label: 'Sent to QBT', icon: 'check-circle', color: colors.success },
  failed: {
    label: 'Failed to send to QBT',
    icon: 'alert-triangle',
    color: colors.danger,
  },
};

export default function ReviewScreen() {
  const role = useCurrentRole();
  const logs = useAppStore((s) => s.logs);
  const jobcards = useAppStore((s) => s.jobcards);
  const workers = useAppStore((s) => s.workers);

  const [filter, setFilter] = useState<Filter>('All');
  const [editingLog, setEditingLog] = useState<TimesheetLog | null>(null);

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const nextPush = nextMonday(new Date());

  const projectNameFor = (log: TimesheetLog) =>
    log.jobcardId
      ? jobcards.find((j) => j.id === log.jobcardId)?.title ?? 'Jobcard'
      : log.customProjectName ?? 'Custom Project';

  // Show this week's hours, plus anything not yet delivered (unsent/failed) from
  // earlier so delivery problems stay visible until they clear.
  const visibleLogs = useMemo(
    () =>
      logs.filter(
        (l) =>
          (l.date >= weekStart && l.date <= weekEnd) || l.sendStatus !== 'sent'
      ),
    [logs, weekStart, weekEnd]
  );

  const counts = useMemo(
    () => ({
      unsent: visibleLogs.filter((l) => l.sendStatus === 'unsent').length,
      sent: visibleLogs.filter((l) => l.sendStatus === 'sent').length,
      failed: visibleLogs.filter((l) => l.sendStatus === 'failed').length,
    }),
    [visibleLogs]
  );

  const groups = useMemo<WorkerGroup[]>(() => {
    const visible = visibleLogs
      .filter((l) => filter === 'All' || l.sendStatus === filter.toLowerCase())
      .sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
    const byWorker = new Map<string, TimesheetLog[]>();
    for (const log of visible) {
      const list = byWorker.get(log.workerId) ?? [];
      list.push(log);
      byWorker.set(log.workerId, list);
    }
    return Array.from(byWorker.entries())
      .map(([workerId, list]) => ({
        workerId,
        workerName: workers.find((w) => w.id === workerId)?.name ?? 'Unknown',
        logs: list,
        totalHours: list.reduce((sum, l) => sum + l.totalHours, 0),
      }))
      .sort((a, b) => a.workerName.localeCompare(b.workerName));
  }, [visibleLogs, workers, filter]);

  if (role !== 'operator') return <AccessDenied />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Feather name="upload-cloud" size={18} color={colors.primary} />
          <Text style={styles.bannerText}>
            Hours sync to QuickBooks Time automatically{' '}
            <Text style={styles.bannerStrong}>
              next on {format(nextPush, 'EEEE, MMM d')} at 7:30 AM
            </Text>
            . Your payroll manager reviews and approves them in QuickBooks Time —
            there&apos;s nothing to approve here.
          </Text>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filterWrap}>
            <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
          </View>
        </View>

        <View style={styles.tallies}>
          <Tally label="Unsent" value={counts.unsent} color={colors.textSecondary} />
          <Tally label="Sent" value={counts.sent} color={colors.success} />
          <Tally label="Failed" value={counts.failed} color={colors.danger} />
        </View>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={28} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nothing {filter.toLowerCase()}</Text>
            <Text style={styles.emptySubtitle}>
              No timesheets match this filter.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.workerId} style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{group.workerName}</Text>
                <Text style={styles.groupHours}>
                  {formatHours(group.totalHours)}
                </Text>
              </View>
              <View style={styles.groupLogs}>
                {group.logs.map((log) => (
                  <ReviewRow
                    key={log.id}
                    log={log}
                    projectName={projectNameFor(log)}
                    onEdit={() => setEditingLog(log)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <EditLogModal
        log={editingLog}
        projectName={editingLog ? projectNameFor(editingLog) : ''}
        onClose={() => setEditingLog(null)}
      />
    </View>
  );
}

function Tally({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.tally}>
      <Text style={[styles.tallyValue, { color }]}>{value}</Text>
      <Text style={styles.tallyLabel}>{label}</Text>
    </View>
  );
}

function ReviewRow({
  log,
  projectName,
  onEdit,
}: {
  log: TimesheetLog;
  projectName: string;
  onEdit: () => void;
}) {
  const meta = log.sendStatus === 'unsent' ? null : SEND_META[log.sendStatus];

  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowProject} numberOfLines={1}>
          {projectName}
        </Text>
        <Text style={styles.rowTime}>
          {format(new Date(log.startTime), 'EEE, MMM d')} ·{' '}
          {formatTime(log.startTime)} – {formatTime(log.endTime)}
        </Text>
      </View>

      <Text style={styles.rowHours}>{formatHours(log.totalHours)}</Text>
      <Text style={styles.rowEarned}>{formatMoney(log.earnedAmount)}</Text>

      <View style={styles.statusArea}>
        {meta && (
          <>
            <Feather name={meta.icon} size={14} color={meta.color} />
            <Text style={[styles.statusText, { color: meta.color }]} numberOfLines={1}>
              {meta.label}
            </Text>
          </>
        )}
      </View>

      <Pressable
        onPress={onEdit}
        hitSlop={8}
        style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
      >
        <Feather name="edit-2" size={15} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: 960,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryDim,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  bannerText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bannerStrong: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  filterWrap: {
    flex: 1,
    maxWidth: 420,
  },
  tallies: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tally: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  tallyValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
  },
  tallyLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  groupName: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  groupHours: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  groupLogs: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowProject: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  rowTime: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  rowHours: {
    width: 64,
    textAlign: 'right',
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  rowEarned: {
    width: 80,
    textAlign: 'right',
    color: colors.success,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  statusArea: {
    width: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  editBtn: {
    padding: spacing.xs + 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  pressed: {
    opacity: 0.85,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    textTransform: 'capitalize',
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
