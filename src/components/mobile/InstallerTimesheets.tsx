import { Feather } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditLogModal } from '@/components/EditLogModal';
import { TimesheetCard } from '@/components/TimesheetCard';
import { currentWorkerOf, useAppStore } from '@/store/useAppStore';
import {
  colors,
  fonts,
  modalShadow,
  radii,
  spacing,
  themed,
} from '@/theme';
import { TimesheetLog } from '@/types';
import { jobDisplayNameById } from '@/utils/jobName';
import { formatHours, formatMoney } from '@/utils/time';

/** The stat-card periods the tap cycle walks through (custom sits outside). */
type Period = 'today' | 'week' | 'month' | 'all' | 'custom';
const CYCLE: Period[] = ['today', 'week', 'month', 'all'];

const DAY = 'yyyy-MM-dd';

/** "Jul 7 – Jul 13, 2026" (years spelled out on both sides when they differ). */
function rangeLabel(from: string, to: string): string {
  const f = parseISO(from);
  const t = parseISO(to);
  if (from === to) return format(f, 'MMM d, yyyy');
  if (f.getFullYear() === t.getFullYear()) {
    return `${format(f, 'MMM d')} – ${format(t, 'MMM d, yyyy')}`;
  }
  return `${format(f, 'MMM d, yyyy')} – ${format(t, 'MMM d, yyyy')}`;
}

interface DaySection {
  date: string;
  label: string;
  logs: TimesheetLog[];
  earned: number;
}

interface WeekGroup {
  key: string;
  label: string;
  earned: number;
  days: DaySection[];
}

/**
 * The installer's own timesheet history. A bordered stat card cycles
 * Today → This week → This month → All time on tap (week/month offer a
 * grayed "to date" toggle; the date range line opens a custom range picker).
 * Below it, the activity log: one section per day this week (Today, then
 * weekday names), then one collapsed container per earlier week.
 * Rendered by the mobile Timesheets tab and the desktop /installer-timesheets
 * page.
 */
export function InstallerTimesheets() {
  const logs = useAppStore((s) => s.logs);
  const jobcards = useAppStore((s) => s.jobcards);
  const jobs = useAppStore((s) => s.jobs);
  const currentUserId = useAppStore((s) => currentWorkerOf(s)?.id ?? '');

  const [period, setPeriod] = useState<Period>('today');
  // Week/month sub-mode: false = the full period, true = "to date".
  const [toDate, setToDate] = useState(false);
  const [customRange, setCustomRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [editingLog, setEditingLog] = useState<TimesheetLog | null>(null);

  const myLogs = useMemo(
    () =>
      logs
        .filter((log) => log.workerId === currentUserId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        ),
    [logs, currentUserId]
  );

  const today = format(new Date(), DAY);

  // --- Stat card range -------------------------------------------------------
  const stat = useMemo(() => {
    const now = new Date();
    if (period === 'today') {
      return { from: today, to: today, title: 'Today' as const };
    }
    if (period === 'week') {
      const mon = startOfWeek(now, { weekStartsOn: 1 });
      const sun = endOfWeek(now, { weekStartsOn: 1 });
      return {
        from: format(mon, DAY),
        to: toDate ? today : format(sun, DAY),
        title: 'week' as const,
      };
    }
    if (period === 'month') {
      return {
        from: format(startOfMonth(now), DAY),
        to: toDate ? today : format(endOfMonth(now), DAY),
        title: 'month' as const,
      };
    }
    if (period === 'custom' && customRange) {
      return { from: customRange.from, to: customRange.to, title: 'Custom range' as const };
    }
    // All time: from the earliest log (they're sorted newest-first).
    const first = myLogs.length ? myLogs[myLogs.length - 1].date : today;
    return { from: first, to: today, title: 'All time' as const };
  }, [period, toDate, customRange, today, myLogs]);

  const statLogs = useMemo(
    () =>
      myLogs.filter((log) => log.date >= stat.from && log.date <= stat.to),
    [myLogs, stat.from, stat.to]
  );
  const statHours = statLogs.reduce((sum, log) => sum + log.totalHours, 0);
  const statEarned = statLogs.reduce((sum, log) => sum + log.earnedAmount, 0);

  const cyclePeriod = () => {
    setToDate(false);
    if (period === 'custom') {
      setPeriod('today');
      return;
    }
    setPeriod(CYCLE[(CYCLE.indexOf(period) + 1) % CYCLE.length]);
  };

  const openCustom = () => {
    setDraftFrom(stat.from);
    setDraftTo(stat.to);
    setCustomOpen(true);
  };

  const applyCustom = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftFrom)) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftTo)) return;
    const [from, to] =
      draftFrom <= draftTo ? [draftFrom, draftTo] : [draftTo, draftFrom];
    setCustomRange({ from, to });
    setPeriod('custom');
    setCustomOpen(false);
  };

  // --- Activity log grouping --------------------------------------------------
  const { currentWeekDays, pastWeeks } = useMemo(() => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), DAY);
    const dayMap = new Map<string, TimesheetLog[]>();
    for (const log of myLogs) {
      const list = dayMap.get(log.date);
      if (list) list.push(log);
      else dayMap.set(log.date, [log]);
    }

    const current: DaySection[] = [];
    const weeks = new Map<string, WeekGroup>();
    for (const [date, dayLogs] of dayMap) {
      const earned = dayLogs.reduce((sum, log) => sum + log.earnedAmount, 0);
      if (date >= weekStart) {
        current.push({
          date,
          label: date === today ? 'Today' : format(parseISO(date), 'EEEE'),
          logs: dayLogs,
          earned,
        });
      } else {
        const mon = startOfWeek(parseISO(date), { weekStartsOn: 1 });
        const key = format(mon, DAY);
        let group = weeks.get(key);
        if (!group) {
          const sun = endOfWeek(parseISO(date), { weekStartsOn: 1 });
          group = {
            key,
            label: rangeLabel(key, format(sun, DAY)),
            earned: 0,
            days: [],
          };
          weeks.set(key, group);
        }
        group.earned += earned;
        group.days.push({
          date,
          label: format(parseISO(date), 'M/d'),
          logs: dayLogs,
          earned,
        });
      }
    }
    return {
      currentWeekDays: current,
      pastWeeks: [...weeks.values()],
    };
  }, [myLogs, today]);

  const projectNameFor = (log: TimesheetLog) =>
    log.jobcardId
      ? jobcards.find((j) => j.id === log.jobcardId)?.title ?? 'Jobcard'
      : log.customProjectName ?? 'Custom Project';

  const jobNameFor = (log: TimesheetLog) => {
    if (!log.jobcardId) return undefined;
    const jobId = jobcards.find((j) => j.id === log.jobcardId)?.jobId;
    return jobId ? jobDisplayNameById(jobId, jobs) || undefined : undefined;
  };

  const toggleWeek = (key: string) =>
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderDay = (day: DaySection) => (
    <View key={day.date} style={styles.daySection}>
      <View style={styles.dayHeader}>
        <Text style={styles.dayLabel}>{day.label}</Text>
        <Text style={styles.dayEarned}>{formatMoney(day.earned)}</Text>
      </View>
      {day.logs.map((log) => (
        <TimesheetCard
          key={log.id}
          log={log}
          projectName={projectNameFor(log)}
          jobName={jobNameFor(log)}
          hideDate
          showEarned
          onEdit={() => setEditingLog(log)}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Stat card: tap anywhere to cycle the period; the range line opens
            the custom picker; the grayed half-title flips to "to date". */}
        <Pressable
          style={({ pressed }) => [styles.statCard, pressed && styles.pressed]}
          onPress={cyclePeriod}
        >
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={openCustom}
            hitSlop={6}
          >
            <Text style={styles.statRange}>
              {rangeLabel(stat.from, stat.to)}
            </Text>
          </Pressable>

          {stat.title === 'week' || stat.title === 'month' ? (
            <View style={styles.titleRow}>
              {toDate ? (
                <Pressable onPress={() => setToDate(false)} hitSlop={6}>
                  <Text style={[styles.statTitle, styles.titleInactive]}>
                    {stat.title === 'week' ? 'This week' : 'This month'}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.statTitle}>
                  {stat.title === 'week' ? 'This week' : 'This month'}
                </Text>
              )}
              <Text style={[styles.statTitle, styles.titleInactive]}> | </Text>
              {toDate ? (
                <Text style={styles.statTitle}>
                  {stat.title === 'week' ? 'Week to date' : 'Month to date'}
                </Text>
              ) : (
                <Pressable onPress={() => setToDate(true)} hitSlop={6}>
                  <Text style={[styles.statTitle, styles.titleInactive]}>
                    {stat.title === 'week' ? 'Week to date' : 'Month to date'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.statTitle}>{stat.title}</Text>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <Feather name="clock" size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.statValue}>{formatHours(statHours)}</Text>
                <Text style={styles.statLabel}>Hours worked</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.statIconWrap}>
                <Feather name="dollar-sign" size={16} color={colors.success} />
              </View>
              <View>
                <Text style={styles.statValue}>{formatMoney(statEarned)}</Text>
                <Text style={styles.statLabel}>Earned</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {myLogs.length === 0 && (
          <View style={styles.empty}>
            <Feather name="inbox" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No logs yet</Text>
            <Text style={styles.emptySubtitle}>
              Clock in from the Calendar tab to start tracking hours.
            </Text>
          </View>
        )}

        {currentWeekDays.map(renderDay)}

        {pastWeeks.map((week) => {
          const expanded = expandedWeeks.has(week.key);
          return (
            <View key={week.key} style={styles.weekGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.weekHeader,
                  pressed && styles.pressed,
                ]}
                onPress={() => toggleWeek(week.key)}
              >
                <Feather
                  name={expanded ? 'chevron-down' : 'chevron-right'}
                  size={15}
                  color={colors.textSecondary}
                />
                <Text style={styles.weekLabel}>{week.label}</Text>
                <Text style={styles.dayEarned}>{formatMoney(week.earned)}</Text>
              </Pressable>
              {expanded && (
                <View style={styles.weekBody}>{week.days.map(renderDay)}</View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Custom date range picker. */}
      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCustomOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Custom date range</Text>
            <DateField label="From" value={draftFrom} onChange={setDraftFrom} />
            <DateField label="To" value={draftTo} onChange={setDraftTo} />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => setCustomOpen(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.applyButton,
                  pressed && styles.pressed,
                ]}
                onPress={applyCustom}
              >
                <Text style={styles.applyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <EditLogModal
        log={editingLog}
        projectName={editingLog ? projectNameFor(editingLog) : ''}
        onClose={() => setEditingLog(null)}
      />
    </SafeAreaView>
  );
}

/**
 * One date field of the custom-range picker: the Android date dialog, an
 * inline iOS spinner (nested modals are unreliable on iOS), or a typed
 * YYYY-MM-DD input on web. Values travel as "yyyy-MM-dd" strings.
 */
function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const theme = useAppStore((s) => s.theme);
  const [iosOpen, setIosOpen] = useState(false);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseISO(value)
    : new Date();

  if (Platform.OS === 'web') {
    return (
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>{label}</Text>
        <TextInput
          style={styles.dateInput}
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
        />
      </View>
    );
  }

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parsed,
        mode: 'date',
        onChange: (event: DateTimePickerEvent, picked?: Date) => {
          if (event.type === 'set' && picked) onChange(format(picked, DAY));
        },
      });
      return;
    }
    setIosOpen((o) => !o);
  };

  return (
    <View style={styles.dateField}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.dateInput, pressed && { opacity: 0.8 }]}
        onPress={open}
      >
        <Text style={styles.dateValue}>
          {value ? format(parsed, 'MMM d, yyyy') : 'Pick a date'}
        </Text>
      </Pressable>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={parsed}
          mode="date"
          display="spinner"
          themeVariant={theme}
          onChange={(_event: DateTimePickerEvent, picked?: Date) => {
            if (picked) onChange(format(picked, DAY));
          }}
        />
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  statCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  statRange: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  titleInactive: {
    color: colors.textTertiary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  statValue: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  daySection: {
    gap: spacing.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dayLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  dayEarned: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  weekGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  weekLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  weekBody: {
    padding: spacing.md,
    gap: spacing.md,
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
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...modalShadow,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  dateField: {
    gap: spacing.xs + 2,
  },
  dateLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  dateInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  dateValue: {
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  cancelButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  applyButton: {
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 1,
  },
  applyText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
}));
