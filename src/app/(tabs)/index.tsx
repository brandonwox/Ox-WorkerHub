import { Feather } from '@expo/vector-icons';
import { format, isSameDay, isToday } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClockControls } from '@/components/ClockControls';
import { ClockEntrySheet, ClockEntryMode } from '@/components/ClockEntrySheet';
import { JobCard } from '@/components/JobCard';
import { Toast } from '@/components/Toast';
import { WeekRibbon } from '@/components/WeekRibbon';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, spacing } from '@/theme';
import { Job, TimesheetLog } from '@/types';
import { formatHours } from '@/utils/time';

export default function CalendarScreen() {
  const router = useRouter();
  const jobs = useAppStore((s) => s.jobs);
  const clockIn = useAppStore((s) => s.clockIn);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectMode, setSelectMode] = useState(false);
  const [entryMode, setEntryMode] = useState<ClockEntryMode>(null);
  const [toast, setToast] = useState<string | null>(null);

  const markedDates = useMemo(
    () => new Set(jobs.map((j) => format(new Date(j.startTime), 'yyyy-MM-dd'))),
    [jobs]
  );

  const dayJobs = useMemo(
    () =>
      jobs
        .filter((j) => isSameDay(new Date(j.startTime), selectedDate))
        .sort((a, b) => a.priorityOrder - b.priorityOrder),
    [jobs, selectedDate]
  );

  const handleJobPress = (job: Job) => {
    if (selectMode) {
      clockIn({ jobId: job.id });
      setSelectMode(false);
    } else {
      router.push(`/job/${job.id}`);
    }
  };

  const handleClockedOut = (log: TimesheetLog, projectName: string) => {
    setToast(`${formatHours(log.totalHours)} logged for ${projectName}`);
  };

  const clearToast = useCallback(() => setToast(null), []);

  const dayLabel = isToday(selectedDate)
    ? 'Today'
    : format(selectedDate, 'EEEE, MMM d');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <WeekRibbon
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        markedDates={markedDates}
      />

      {selectMode ? (
        <Text style={[styles.dayLabel, styles.selectHint]}>
          Tap a job to clock in
        </Text>
      ) : (
        <Text style={styles.dayLabel}>
          {dayLabel} · {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
        </Text>
      )}

      <FlatList
        data={dayJobs}
        keyExtractor={(job) => job.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            selectable={selectMode}
            onPress={() => handleJobPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="coffee" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No jobs scheduled</Text>
            <Text style={styles.emptySubtitle}>
              Nothing on the board for this day.
            </Text>
          </View>
        }
      />

      <Toast message={toast} onDone={clearToast} />

      <ClockControls
        selectMode={selectMode}
        onToggleSelectMode={() => setSelectMode((on) => !on)}
        onCustomPress={() => setEntryMode('custom')}
        onSearchPress={() => setEntryMode('search')}
        onClockedOut={handleClockedOut}
      />

      <ClockEntrySheet
        mode={entryMode}
        onClose={() => {
          setEntryMode(null);
          setSelectMode(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dayLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selectHint: {
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 96,
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
  },
});
