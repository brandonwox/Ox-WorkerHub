import { Feather } from '@expo/vector-icons';
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';

import { MonthCalendar } from '@/components/MonthCalendar';
import { colors, fonts, radii, spacing } from '@/theme';

const WEEK_RANGE = 8; // weeks rendered before and after the current week

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** yyyy-MM-dd strings of days that have at least one job */
  markedDates: Set<string>;
}

export function WeekRibbon({ selectedDate, onSelectDate, markedDates }: Props) {
  const [width, setWidth] = useState(0);
  const [monthOpen, setMonthOpen] = useState(false);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const listRef = useRef<FlatList<Date>>(null);

  const weeks = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: WEEK_RANGE * 2 + 1 }, (_, i) =>
      addWeeks(base, i - WEEK_RANGE)
    );
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<Date>[] }) => {
      if (viewableItems[0]?.item) setVisibleWeekStart(viewableItems[0].item);
    }
  ).current;

  const monthLabel = format(visibleWeekStart, 'MMMM yyyy');

  const scrollToDate = (date: Date) => {
    const target = startOfWeek(date, { weekStartsOn: 1 });
    const index = weeks.findIndex((w) => isSameDay(w, target));
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: false });
      setVisibleWeekStart(target);
    }
  };

  const renderWeek = ({ item }: { item: Date }) => {
    const days = eachDayOfInterval({
      start: item,
      end: endOfWeek(item, { weekStartsOn: 1 }),
    });
    return (
      <View style={[styles.weekRow, { width }]}>
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          const marked = markedDates.has(format(day, 'yyyy-MM-dd'));
          return (
            <Pressable
              key={day.toISOString()}
              style={[styles.dayChip, selected && styles.dayChipSelected]}
              onPress={() => onSelectDate(day)}
            >
              <Text
                style={[
                  styles.dayName,
                  selected && styles.dayTextSelected,
                ]}
              >
                {format(day, 'EEE')}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  isToday(day) && !selected && styles.dayNumberToday,
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
    );
  };

  return (
    <View>
      <Pressable
        style={styles.monthToggle}
        onPress={() => setMonthOpen((open) => !open)}
      >
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Feather
          name={monthOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.primary}
        />
      </Pressable>

      {monthOpen ? (
        <MonthCalendar
          selectedDate={selectedDate}
          markedDates={markedDates}
          onSelectDate={(date) => {
            onSelectDate(date);
            setMonthOpen(false);
            scrollToDate(date);
          }}
        />
      ) : (
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={styles.listContainer}
        >
          {width > 0 && (
            <FlatList
              ref={listRef}
              data={weeks}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={WEEK_RANGE}
              getItemLayout={(_, index) => ({
                length: width,
                offset: width * index,
                index,
              })}
              keyExtractor={(item) => item.toISOString()}
              renderItem={renderWeek}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  monthLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  listContainer: {
    height: 84,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    gap: 2,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
  },
  dayName: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  dayNumber: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 16,
  },
  dayNumberToday: {
    color: colors.primary,
  },
  dayTextSelected: {
    color: colors.textPrimary,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: 'transparent',
  },
});
