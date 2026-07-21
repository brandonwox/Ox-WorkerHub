import { Feather } from '@expo/vector-icons';
import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isReadyNow } from '@/components/desktop/scheduler/Backlog';
import { StatusPill } from '@/components/StatusPill';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { Job, WorkRequest } from '@/types';
import {
  workRequestJobIds,
  workRequestJobsLabel,
} from '@/utils/workRequestJobs';
import { effectivePriority } from '@/utils/priorityRange';

interface Props {
  /** Which role's overview to render (the host page already gated access). */
  mode: 'scheduler' | 'field_super';
  /** The jobs in the viewer's scope (every job for schedulers). */
  jobs: Job[];
  /** Open a work request (desktop: quick-view sidebar; mobile: the work request page). */
  onOpenWorkRequest: (id: string) => void;
  /** Scheduler only: jump to where work requests are handled. */
  onOpenWorkRequests?: () => void;
}

/**
 * The Overview dashboard — the "what needs attention" landing page.
 * Schedulers see work requests at "Now" priority, the work-request pool size, and
 * cards freshly marked Finished; Field Supers see their work requests with open
 * issues and this week's false starts. "This week" is the current Mon–Sun
 * window keyed off each card's scheduled day (there is no marked-at
 * timestamp — same proxy as the false-starts counter on the Work Requests page).
 */
export function OverviewContent({
  mode,
  jobs,
  onOpenWorkRequest,
  onOpenWorkRequests,
}: Props) {
  const allWorkRequests = useAppStore((s) => s.workRequests);
  const assignments = useAppStore((s) => s.assignments);
  const jobIssues = useAppStore((s) => s.jobIssues);

  const jobIds = useMemo(() => new Set(jobs.map((j) => j.id)), [jobs]);
  // In scope: cards linked to any of the viewer's jobs, plus standalone cards
  // (no parent job at all).
  const workRequests = useMemo(
    () =>
      allWorkRequests.filter((c) => {
        const linked = workRequestJobIds(c);
        return linked.length === 0 || linked.some((id) => jobIds.has(id));
      }),
    [allWorkRequests, jobIds]
  );

  const jobNameFor = (card: WorkRequest) =>
    workRequestJobsLabel(card, jobs) || 'No parent job';

  // Whether a card's scheduled day (assignment dates, else its target date)
  // falls inside the current Mon–Sun week.
  const scheduledThisWeek = useMemo(() => {
    const now = new Date();
    const weekStart = format(
      startOfWeek(now, { weekStartsOn: 1 }),
      'yyyy-MM-dd'
    );
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
    return (card: WorkRequest) => {
      const dates = assignments
        .filter((a) => a.workRequestId === card.id)
        .map((a) => a.date);
      return dates.length > 0 ? dates.some(inWeek) : inWeek(card.date);
    };
  }, [assignments]);

  // --- Scheduler slices -----------------------------------------------------
  const nowCards = useMemo(
    () =>
      mode !== 'scheduler'
        ? []
        : workRequests
            .filter(
              (c) =>
                c.status !== 'Finished' && effectivePriority(c).label === 'Now'
            )
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [mode, workRequests]
  );

  // Work requests = work requests with no assignment row anywhere (same definition
  // as the calendar board); only the ready ones sit in the main pool.
  const backlogCounts = useMemo(
    () =>
      mode !== 'scheduler'
        ? { ready: 0, notReady: 0 }
        : workRequests.reduce(
            (acc, c) => {
              if (assignments.some((a) => a.workRequestId === c.id)) return acc;
              if (c.status === 'Finished') return acc;
              if (isReadyNow(c)) acc.ready += 1;
              else acc.notReady += 1;
              return acc;
            },
            { ready: 0, notReady: 0 }
          ),
    [mode, workRequests, assignments]
  );

  const finishedThisWeek = useMemo(
    () =>
      mode !== 'scheduler'
        ? []
        : workRequests
            .filter((c) => c.status === 'Finished' && scheduledThisWeek(c))
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [mode, workRequests, scheduledThisWeek]
  );

  // --- Field Super slices -----------------------------------------------------
  // Work Requests with open issues, newest issue first.
  const issueCards = useMemo(() => {
    if (mode !== 'field_super') return [];
    const byCard = new Map<string, { count: number; latest: string; latestAt: string }>();
    for (const issue of jobIssues) {
      if (issue.status !== 'open' || !issue.workRequestId) continue;
      if (!jobIds.has(issue.jobId)) continue;
      const cur = byCard.get(issue.workRequestId);
      if (!cur) {
        byCard.set(issue.workRequestId, {
          count: 1,
          latest: issue.description,
          latestAt: issue.createdAt,
        });
      } else {
        cur.count += 1;
        if (issue.createdAt > cur.latestAt) {
          cur.latest = issue.description;
          cur.latestAt = issue.createdAt;
        }
      }
    }
    const entries: {
      card: WorkRequest;
      count: number;
      latest: string;
      latestAt: string;
    }[] = [];
    for (const [cardId, info] of byCard) {
      const card = workRequests.find((c) => c.id === cardId);
      if (card) entries.push({ card, ...info });
    }
    return entries.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  }, [mode, jobIssues, jobIds, workRequests]);

  const falseStartCards = useMemo(
    () =>
      mode !== 'field_super'
        ? []
        : workRequests
            .filter((c) => c.status === 'False Start' && scheduledThisWeek(c))
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [mode, workRequests, scheduledThisWeek]
  );

  // Untouched / False Start reports with their typed reasons — the review
  // feed both dashboards promise when the status popup requires a "why".
  const statusReviewCards = useMemo(
    () =>
      workRequests
        .filter(
          (c) =>
            (c.status === 'Untouched' || c.status === 'False Start') &&
            !!c.statusNote
        )
        .sort((a, b) =>
          (b.statusChangedAt ?? '').localeCompare(a.statusChangedAt ?? '')
        ),
    [workRequests]
  );

  const stats =
    mode === 'scheduler'
      ? [
          {
            key: 'now',
            value: nowCards.length,
            label: '"Now" priority work requests',
            hot: nowCards.length > 0,
          },
          {
            key: 'requests',
            value: backlogCounts.ready,
            label: 'Work requests ready',
            hot: false,
            onPress: onOpenWorkRequests,
          },
          {
            key: 'finished',
            value: finishedThisWeek.length,
            label: 'Finished this week',
            hot: false,
          },
        ]
      : [
          {
            key: 'issues',
            value: issueCards.length,
            label: 'Work Requests with open issues',
            hot: issueCards.length > 0,
          },
          {
            key: 'false-starts',
            value: falseStartCards.length,
            label: 'False starts this week',
            hot: falseStartCards.length > 0,
          },
        ];

  const cardRow = (card: WorkRequest, extra?: string) => (
    <Pressable
      key={card.id}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onOpenWorkRequest(card.id)}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {jobNameFor(card)}
          {extra ? ` · ${extra}` : ''}
        </Text>
      </View>
      <StatusPill status={card.status} />
      <Feather name="chevron-right" size={16} color={colors.textTertiary} />
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Stat tiles — the at-a-glance numbers. */}
      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <Pressable
            key={stat.key}
            style={({ pressed }) => [
              styles.statCard,
              pressed && stat.onPress != null && styles.pressed,
            ]}
            disabled={stat.onPress == null}
            onPress={stat.onPress}
          >
            <Text style={[styles.statValue, stat.hot && styles.statValueHot]}>
              {stat.value}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'scheduler' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>“Now” priority work requests</Text>
            {nowCards.length === 0 ? (
              <Text style={styles.emptyText}>
                No work requests at “Now” priority — you’re caught up.
              </Text>
            ) : (
              nowCards.map((card) =>
                cardRow(
                  card,
                  effectivePriority(card).escalated
                    ? 'escalated to Now'
                    : undefined
                )
              )
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Work requests</Text>
            <Text style={styles.sectionNote}>
              {backlogCounts.ready} ready to schedule
              {backlogCounts.notReady > 0
                ? ` · ${backlogCounts.notReady} not ready yet`
                : ''}
              {onOpenWorkRequests ? ' — tap the tile above to open them.' : ''}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Finished this week</Text>
            {finishedThisWeek.length === 0 ? (
              <Text style={styles.emptyText}>
                Nothing marked Finished this week yet.
              </Text>
            ) : (
              finishedThisWeek.map((card) => cardRow(card))
            )}
          </View>
        </>
      )}

      {mode === 'field_super' && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Work Requests with open issues</Text>
            {issueCards.length === 0 ? (
              <Text style={styles.emptyText}>
                No open issues on your work requests.
              </Text>
            ) : (
              issueCards.map(({ card, count, latest, latestAt }) => (
                <Pressable
                  key={card.id}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() => onOpenWorkRequest(card.id)}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {card.title}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {jobNameFor(card)} ·{' '}
                      {format(parseISO(latestAt), 'MMM d')}
                    </Text>
                    {!!latest && (
                      <Text style={styles.rowIssue} numberOfLines={2}>
                        {latest}
                      </Text>
                    )}
                  </View>
                  <View style={styles.issueBadge}>
                    <Text style={styles.issueBadgeText}>
                      {count} {count === 1 ? 'issue' : 'issues'}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={colors.textTertiary}
                  />
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionHeader}>False starts this week</Text>
            {falseStartCards.length === 0 ? (
              <Text style={styles.emptyText}>No false starts this week.</Text>
            ) : (
              falseStartCards.map((card) => cardRow(card))
            )}
          </View>
        </>
      )}

      {/* Why installers reported Untouched / False Start — both dashboards
          review these typed reasons. */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Untouched & false start reasons</Text>
        {statusReviewCards.length === 0 ? (
          <Text style={styles.emptyText}>
            No untouched or false-start reports to review.
          </Text>
        ) : (
          statusReviewCards.map((card) => (
            <Pressable
              key={card.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenWorkRequest(card.id)}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {card.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {jobNameFor(card)}
                  {card.statusChangedAt
                    ? ` · ${format(parseISO(card.statusChangedAt), 'MMM d')}`
                    : ''}
                </Text>
                <Text style={styles.rowIssue} numberOfLines={2}>
                  “{card.statusNote}”
                </Text>
              </View>
              <StatusPill status={card.status} />
              <Feather
                name="chevron-right"
                size={16}
                color={colors.textTertiary}
              />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    content: {
      padding: spacing.xl,
      gap: spacing.xl,
    },
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    statCard: {
      flexGrow: 1,
      flexBasis: 140,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    statValue: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 28,
    },
    statValueHot: {
      color: colors.danger,
    },
    statLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.medium,
      fontSize: 12,
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
    sectionNote: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    emptyText: {
      color: colors.textTertiary,
      fontFamily: fonts.regular,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 14,
    },
    rowMeta: {
      color: colors.textTertiary,
      fontFamily: fonts.medium,
      fontSize: 11,
    },
    rowIssue: {
      color: colors.textSecondary,
      fontFamily: fonts.regular,
      fontSize: 12,
    },
    issueBadge: {
      backgroundColor: colors.dangerDim,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 3,
    },
    issueBadgeText: {
      color: colors.danger,
      fontFamily: fonts.semiBold,
      fontSize: 11,
    },
    pressed: {
      opacity: 0.85,
    },
  })
);
