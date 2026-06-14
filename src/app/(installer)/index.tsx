import { Feather } from '@expo/vector-icons';
import { format, isToday } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddTimecardSheet } from '@/components/AddTimecardSheet';
import { ClockControls } from '@/components/ClockControls';
import { ClockEntrySheet, ClockEntryMode } from '@/components/ClockEntrySheet';
import { JobCard } from '@/components/JobCard';
import { Toast } from '@/components/Toast';
import { WeekRibbon } from '@/components/WeekRibbon';
import {
  assignedDatesForInstaller,
  jobcardsForInstallerOnDate,
  useAppStore,
} from '@/store/useAppStore';
import { colors, fonts, spacing } from '@/theme';
import { Jobcard, TimesheetLog } from '@/types';
import { formatHours } from '@/utils/time';

export default function CalendarScreen() {
  const router = useRouter();
  const allJobcards = useAppStore((s) => s.jobcards);
  const crews = useAppStore((s) => s.crews);
  const dailyCrews = useAppStore((s) => s.dailyCrews);
  const assignments = useAppStore((s) => s.assignments);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const clockIn = useAppStore((s) => s.clockIn);
  const updateShiftProject = useAppStore((s) => s.updateShiftProject);
  const activeShift = useAppStore((s) => s.activeShift);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectMode, setSelectMode] = useState(false);
  const [editShift, setEditShift] = useState(false);
  const [entryMode, setEntryMode] = useState<ClockEntryMode>(null);
  const [addTimecardOpen, setAddTimecardOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // The agenda is driven by crew assignments (Step 2 resolution): on any date, a
  // Daily Crew the installer is in that day overrides their Permanent Crew.
  const markedDates = useMemo(
    () =>
      assignedDatesForInstaller(
        { crews, dailyCrews, assignments },
        currentUserId
      ),
    [crews, dailyCrews, assignments, currentUserId]
  );

  const dayJobcards = useMemo(
    () =>
      jobcardsForInstallerOnDate(
        { crews, dailyCrews, assignments, jobcards: allJobcards },
        currentUserId,
        format(selectedDate, 'yyyy-MM-dd')
      ).sort((a, b) => a.priorityOrder - b.priorityOrder),
    [crews, dailyCrews, assignments, allJobcards, currentUserId, selectedDate]
  );

  const handleJobcardPress = (jobcard: Jobcard) => {
    if (editShift) {
      updateShiftProject({ jobcardId: jobcard.id });
      setEditShift(false);
    } else if (selectMode) {
      clockIn({ jobcardId: jobcard.id });
      setSelectMode(false);
    } else {
      router.push(`/job/${jobcard.id}`);
    }
  };

  const handleClockedOut = (log: TimesheetLog, projectName: string) => {
    setToast(`${formatHours(log.totalHours)} logged for ${projectName}`);
    // Hours are no longer pushed per clock-out — the Operator reviews them and
    // they're swept to QuickBooks Time every Monday morning.
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

      {selectMode || editShift ? (
        <Text style={[styles.dayLabel, styles.selectHint]}>
          {editShift ? 'Tap a job to switch project' : 'Tap a job to clock in'}
        </Text>
      ) : (
        <Text style={styles.dayLabel}>
          {dayLabel} · {dayJobcards.length}{' '}
          {dayJobcards.length === 1 ? 'jobcard' : 'jobcards'}
        </Text>
      )}

      <FlatList
        data={dayJobcards}
        keyExtractor={(jobcard) => jobcard.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <JobCard
            jobcard={item}
            selectable={selectMode || editShift}
            active={activeShift?.jobcardId === item.id}
            onPress={() => handleJobcardPress(item)}
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
        editShiftMode={editShift}
        onToggleSelectMode={() => setSelectMode((on) => !on)}
        onToggleEditShift={() => setEditShift((on) => !on)}
        onCustomPress={() => setEntryMode('custom')}
        onSearchPress={() => setEntryMode('search')}
        onAddTimecardPress={() => setAddTimecardOpen(true)}
        onClockedOut={handleClockedOut}
      />

      <ClockEntrySheet
        mode={entryMode}
        editing={editShift}
        onClose={() => {
          setEntryMode(null);
          setSelectMode(false);
          setEditShift(false);
        }}
      />

      <AddTimecardSheet
        visible={addTimecardOpen}
        onClose={() => setAddTimecardOpen(false)}
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
