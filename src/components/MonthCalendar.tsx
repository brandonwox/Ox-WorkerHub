import { Feather } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  markedDates: Set<string>;
}

export function MonthCalendar({ selectedDate, onSelectDate, markedDates }: Props) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));

  const gridDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
  });

  const weeks: Date[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.navButton}
          onPress={() => setViewMonth((m) => addMonths(m, -1))}
        >
          <Feather name="chevron-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerLabel}>{format(viewMonth, 'MMMM yyyy')}</Text>
        <Pressable
          style={styles.navButton}
          onPress={() => setViewMonth((m) => addMonths(m, 1))}
        >
          <Feather name="chevron-right" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      {weeks.map((week, i) => (
        <View key={i} style={styles.weekRow}>
          {week.map((day) => {
            const selected = isSameDay(day, selectedDate);
            const inMonth = isSameMonth(day, viewMonth);
            const marked = markedDates.has(format(day, 'yyyy-MM-dd'));
            return (
              <Pressable
                key={day.toISOString()}
                style={[styles.dayCell, selected && styles.dayCellSelected]}
                onPress={() => onSelectDate(day)}
              >
                <Text
                  style={[
                    styles.dayText,
                    !inMonth && styles.dayTextMuted,
                    isToday(day) && !selected && styles.dayTextToday,
                    selected && styles.dayTextSelected,
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                <View
                  style={[
                    styles.dot,
                    marked && {
                      backgroundColor: selected
                        ? colors.textPrimary
                        : colors.primary,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  navButton: {
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    paddingVertical: spacing.xs,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radii.sm,
    gap: 1,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  dayTextMuted: {
    color: colors.textTertiary,
  },
  dayTextToday: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  dayTextSelected: {
    fontFamily: fonts.bold,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
});
