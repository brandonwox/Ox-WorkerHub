import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { InlineSelect } from '@/components/desktop/InlineSelect';
import { colors, fonts, radii, spacing, themed } from '@/theme';

export type ScheduleFilter = 'all' | 'scheduled' | 'unscheduled';

const SCHEDULE_OPTIONS: { value: ScheduleFilter; label: string }[] = [
  { value: 'all', label: 'All cards' },
  { value: 'scheduled', label: 'On calendar' },
  { value: 'unscheduled', label: 'Not on calendar' },
];

interface Props {
  search: string;
  onSearch: (value: string) => void;
  /** Distinct priorities present across the jobcards. */
  priorities: string[];
  selectedPriorities: string[];
  onTogglePriority: (priority: string) => void;
  schedule: ScheduleFilter;
  onSchedule: (value: ScheduleFilter) => void;
  groupByJob: boolean;
  onToggleGroup: () => void;
}

/** Single-row filter/sort toolbar for the Field Super Jobcards view (desktop). */
export function JobcardFilters({
  search,
  onSearch,
  priorities,
  selectedPriorities,
  onTogglePriority,
  schedule,
  onSchedule,
  groupByJob,
  onToggleGroup,
}: Props) {
  return (
    <View style={styles.row}>
      {/* Search by jobcard title or parent job title */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={onSearch}
          placeholder="Search jobcards or jobs…"
          placeholderTextColor={colors.textTertiary}
        />
        {search.length > 0 && (
          <Pressable onPress={() => onSearch('')} hitSlop={6}>
            <Feather name="x" size={15} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Priority filter (multi-select dropdown) */}
      <PriorityDropdown
        priorities={priorities}
        selected={selectedPriorities}
        onToggle={onTogglePriority}
      />

      {/* Schedule filter */}
      <InlineSelect
        value={schedule}
        options={SCHEDULE_OPTIONS}
        onChange={onSchedule}
        minWidth={150}
      />

      {/* Group by job toggle */}
      <Pressable
        style={[styles.toggle, groupByJob && styles.toggleOn]}
        onPress={onToggleGroup}
      >
        <Feather
          name="layers"
          size={15}
          color={groupByJob ? colors.primary : colors.textSecondary}
        />
        <Text style={[styles.toggleText, groupByJob && styles.toggleTextOn]}>
          Group by job
        </Text>
      </Pressable>
    </View>
  );
}

function PriorityDropdown({
  priorities,
  selected,
  onToggle,
}: {
  priorities: string[];
  selected: string[];
  onToggle: (priority: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<View>(null);
  const count = selected.length;

  return (
    <View ref={wrapRef} style={styles.ddWrap}>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={styles.triggerText}>
          {count > 0 ? `Priority · ${count}` : 'Priority'}
        </Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={colors.textSecondary}
        />
      </Pressable>
      <DropdownPortal
        anchorRef={wrapRef}
        open={open}
        onClose={() => setOpen(false)}
        align="left"
        minWidth={180}
      >
        <View style={styles.menu}>
          {priorities.map((p) => {
            const active = selected.includes(p);
            return (
              <Pressable
                key={p}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.itemPressed,
                ]}
                onPress={() => onToggle(p)}
              >
                <Feather
                  name={active ? 'check-square' : 'square'}
                  size={15}
                  color={active ? colors.primary : colors.textTertiary}
                />
                <Text style={[styles.itemText, active && styles.itemTextActive]}>
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </DropdownPortal>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchRow: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
    fontSize: 15,
    outlineWidth: 0,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleOn: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  toggleText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  toggleTextOn: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  // Priority dropdown
  ddWrap: {
    position: 'relative',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 120,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  triggerText: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  menu: {
    minWidth: 180,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 1,
  },
  itemPressed: {
    backgroundColor: colors.border,
  },
  itemText: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  itemTextActive: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
}));
