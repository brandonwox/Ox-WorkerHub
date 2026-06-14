import { Feather } from '@expo/vector-icons';
import { endOfWeek, format, nextMonday, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { EditLogModal } from '@/components/EditLogModal';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toast } from '@/components/Toast';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { ReviewStatus, TimesheetLog } from '@/types';
import { formatHours, formatMoney, formatTime } from '@/utils/time';

const FILTERS = ['Pending', 'Approved', 'Synced', 'All'] as const;
type Filter = (typeof FILTERS)[number];

interface WorkerGroup {
  workerId: string;
  workerName: string;
  logs: TimesheetLog[];
  totalHours: number;
}

const STATUS_META: Record<ReviewStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Pending', bg: colors.warningDim, fg: colors.warning },
  approved: { label: 'Approved', bg: colors.primaryDim, fg: colors.primary },
  synced: { label: 'Synced', bg: colors.successDim, fg: colors.success },
};

export default function ReviewScreen() {
  const role = useCurrentRole();
  const logs = useAppStore((s) => s.logs);
  const jobcards = useAppStore((s) => s.jobcards);
  const workers = useAppStore((s) => s.workers);
  const setLogReviewStatus = useAppStore((s) => s.setLogReviewStatus);
  const sendApprovedToQbt = useAppStore((s) => s.sendApprovedToQbt);

  const [filter, setFilter] = useState<Filter>('Pending');
  const [editingLog, setEditingLog] = useState<TimesheetLog | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const nextPush = nextMonday(new Date());

  const projectNameFor = (log: TimesheetLog) =>
    log.jobcardId
      ? jobcards.find((j) => j.id === log.jobcardId)?.title ?? 'Jobcard'
      : log.customProjectName ?? 'Custom Project';

  // Current-week logs (the review window), with status tallies for the header.
  const weekLogs = useMemo(
    () => logs.filter((l) => l.date >= weekStart && l.date <= weekEnd),
    [logs, weekStart, weekEnd]
  );

  const counts = useMemo(
    () => ({
      pending: weekLogs.filter((l) => l.reviewStatus === 'pending').length,
      approved: weekLogs.filter((l) => l.reviewStatus === 'approved').length,
      synced: weekLogs.filter((l) => l.reviewStatus === 'synced').length,
    }),
    [weekLogs]
  );

  const groups = useMemo<WorkerGroup[]>(() => {
    const visible = weekLogs
      .filter((l) => filter === 'All' || l.reviewStatus === filter.toLowerCase())
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
  }, [weekLogs, workers, filter]);

  if (role !== 'operator') return <AccessDenied />;

  const sendToQbt = () => {
    if (counts.approved === 0) return;
    sendApprovedToQbt();
    setToast(`${counts.approved} approved timesheet(s) queued for QuickBooks Time`);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <Feather name="upload-cloud" size={18} color={colors.primary} />
          <Text style={styles.bannerText}>
            Approved hours sweep to QuickBooks Time automatically{' '}
            <Text style={styles.bannerStrong}>
              next on {format(nextPush, 'EEEE, MMM d')} at 7:30 AM
            </Text>
            . Review and approve below before then.
          </Text>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.filterWrap}>
            <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              counts.approved === 0 && styles.sendButtonDisabled,
              pressed && counts.approved > 0 && styles.pressed,
            ]}
            onPress={sendToQbt}
            disabled={counts.approved === 0}
          >
            <Feather name="send" size={15} color={colors.textPrimary} />
            <Text style={styles.sendText}>
              Send to QuickBooks{counts.approved > 0 ? ` (${counts.approved})` : ''}
            </Text>
          </Pressable>
        </View>

        <View style={styles.tallies}>
          <Tally label="Pending" value={counts.pending} color={colors.warning} />
          <Tally label="Approved" value={counts.approved} color={colors.primary} />
          <Tally label="Synced" value={counts.synced} color={colors.success} />
        </View>

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={28} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nothing {filter.toLowerCase()}</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'Pending'
                ? "You're all caught up on this week's review."
                : 'No timesheets match this filter for the current week.'}
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
                    onApprove={() => setLogReviewStatus(log.id, 'approved')}
                    onEdit={() => setEditingLog(log)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Toast message={toast} onDone={() => setToast(null)} />

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
  onApprove,
  onEdit,
}: {
  log: TimesheetLog;
  projectName: string;
  onApprove: () => void;
  onEdit: () => void;
}) {
  const meta = STATUS_META[log.reviewStatus];
  const locked = log.reviewStatus === 'synced';

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

      <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
        <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
      </View>

      <View style={styles.rowActions}>
        {log.reviewStatus === 'pending' && (
          <Pressable
            style={({ pressed }) => [styles.approveBtn, pressed && styles.pressed]}
            onPress={onApprove}
          >
            <Feather name="check" size={14} color={colors.success} />
            <Text style={styles.approveText}>Approve</Text>
          </Pressable>
        )}
        {!locked && (
          <Pressable
            onPress={onEdit}
            hitSlop={8}
            style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          >
            <Feather name="edit-2" size={15} color={colors.primary} />
          </Pressable>
        )}
      </View>
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
    maxWidth: 360,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceLight,
    opacity: 0.6,
  },
  sendText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.85,
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
  statusPill: {
    width: 86,
    alignItems: 'center',
    borderRadius: radii.pill,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 140,
    justifyContent: 'flex-end',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successDim,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  approveText: {
    color: colors.success,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  editBtn: {
    padding: spacing.xs + 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
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
