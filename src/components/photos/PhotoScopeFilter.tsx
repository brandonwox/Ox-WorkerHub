import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, JobScope } from '@/types';

/**
 * A Pictures-section filter choice: everything, one scope, Completion Photos,
 * or SGD videos.
 */
export type PhotoScopeFilterValue =
  | 'all'
  | 'sgd-videos'
  | 'completion-photos'
  | JobScope;

/**
 * Scope filtering for a Pictures section: each photo is bucketed by its work
 * request's scopes (a photo not taken from a work request only shows under
 * "All"), plus a "Completion Photos" bucket for photos tagged with that type
 * and an "SGD Videos" bucket for tagged videos. Returns the selected filter,
 * the photos passing it, and the options worth offering — only buckets that
 * actually have photos appear, and the whole control hides when there is
 * nothing to filter by.
 */
export function usePhotoScopeFilter(photos: DisplayPhoto[]): {
  filter: PhotoScopeFilterValue;
  setFilter: (value: PhotoScopeFilterValue) => void;
  options: PhotoScopeFilterValue[];
  filtered: DisplayPhoto[];
} {
  const [filter, setFilter] = useState<PhotoScopeFilterValue>('all');
  const workRequests = useAppStore((s) => s.workRequests);

  const { options, byId } = useMemo(() => {
    // Photo id → its work request's scopes.
    const scopeMap = new Map<string, JobScope[]>();
    const present = new Set<JobScope>();
    let anySgd = false;
    let anyCompletion = false;
    for (const photo of photos) {
      if (photo.sgdVideo) anySgd = true;
      if (photo.photoType === 'Completion Photos') anyCompletion = true;
      if (!photo.workRequestId) continue;
      const scopes =
        workRequests.find((c) => c.id === photo.workRequestId)?.scopes ?? [];
      scopeMap.set(photo.id, scopes);
      for (const scope of scopes) present.add(scope);
    }
    const opts: PhotoScopeFilterValue[] = [];
    // A lone "All" + one option is still useful; zero options isn't.
    if (present.size > 0 || anySgd || anyCompletion) {
      opts.push('all');
      for (const scope of JOB_SCOPES) if (present.has(scope)) opts.push(scope);
      if (anyCompletion) opts.push('completion-photos');
      if (anySgd) opts.push('sgd-videos');
    }
    return { options: opts, byId: scopeMap };
  }, [photos, workRequests]);

  // A filter can go stale (its last photo deleted) — fall back to All.
  const active = options.includes(filter) ? filter : 'all';

  const filtered = useMemo(() => {
    if (active === 'all') return photos;
    if (active === 'sgd-videos') return photos.filter((p) => p.sgdVideo);
    if (active === 'completion-photos') {
      return photos.filter((p) => p.photoType === 'Completion Photos');
    }
    return photos.filter((p) => byId.get(p.id)?.includes(active));
  }, [photos, active, byId]);

  return { filter: active, setFilter, options, filtered };
}

/** Display label for a filter value. */
const labelFor = (value: PhotoScopeFilterValue): string =>
  value === 'all'
    ? 'All'
    : value === 'sgd-videos'
      ? 'SGD Videos'
      : value === 'completion-photos'
        ? 'Completion Photos'
        : value;

/**
 * The filter control for {@link usePhotoScopeFilter}: a single dropdown-style
 * button showing the active filter (chevron flips while open); tapping it
 * expands the option chips underneath, and picking one collapses them again.
 * Hides entirely when there's nothing to filter by.
 */
export function PhotoScopeFilterChips({
  filter,
  setFilter,
  options,
}: {
  filter: PhotoScopeFilterValue;
  setFilter: (value: PhotoScopeFilterValue) => void;
  options: PhotoScopeFilterValue[];
}) {
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [
          styles.dropdownButton,
          open && styles.dropdownButtonOpen,
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`Photo filter: ${labelFor(filter)}`}
      >
        <Feather name="filter" size={12} color={colors.textSecondary} />
        <Text style={styles.dropdownText}>{labelFor(filter)}</Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textSecondary}
        />
      </Pressable>
      {open && (
        <View style={styles.optionsRow}>
          {options.map((option) => {
            const active = option === filter;
            return (
              <Pressable
                key={option}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setFilter(option);
                  setOpen(false);
                }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {labelFor(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs + 2,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    dropdownButtonOpen: {
      borderColor: colors.primary,
    },
    dropdownText: {
      color: colors.textPrimary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontFamily: fonts.semiBold,
      fontSize: 12,
    },
    chipTextActive: {
      color: colors.textOnAccent,
    },
    pressed: {
      opacity: 0.85,
    },
  })
);
