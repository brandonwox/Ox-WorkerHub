import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { JOB_SCOPES, JobScope } from '@/types';

/** A Pictures-section filter choice: everything, one scope, or SGD videos. */
export type PhotoScopeFilterValue = 'all' | 'sgd-videos' | JobScope;

/**
 * Scope filtering for a Pictures section: each photo is bucketed by its work
 * request's scopes (a photo not taken from a work request only shows under
 * "All"), plus an "SGD Videos" bucket for tagged videos. Returns the selected
 * filter, the photos passing it, and the chips worth showing — only scopes
 * that actually have photos appear, and the whole row hides when there is
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
    for (const photo of photos) {
      if (photo.sgdVideo) anySgd = true;
      if (!photo.workRequestId) continue;
      const scopes =
        workRequests.find((c) => c.id === photo.workRequestId)?.scopes ?? [];
      scopeMap.set(photo.id, scopes);
      for (const scope of scopes) present.add(scope);
    }
    const opts: PhotoScopeFilterValue[] = [];
    // A lone chip row ("All" + one option) is still useful; zero options isn't.
    if (present.size > 0 || anySgd) {
      opts.push('all');
      for (const scope of JOB_SCOPES) if (present.has(scope)) opts.push(scope);
      if (anySgd) opts.push('sgd-videos');
    }
    return { options: opts, byId: scopeMap };
  }, [photos, workRequests]);

  // A filter can go stale (its last photo deleted) — fall back to All.
  const active = options.includes(filter) ? filter : 'all';

  const filtered = useMemo(() => {
    if (active === 'all') return photos;
    if (active === 'sgd-videos') return photos.filter((p) => p.sgdVideo);
    return photos.filter((p) => byId.get(p.id)?.includes(active));
  }, [photos, active, byId]);

  return { filter: active, setFilter, options, filtered };
}

/** Chip label for a filter value. */
const labelFor = (value: PhotoScopeFilterValue): string =>
  value === 'all' ? 'All' : value === 'sgd-videos' ? 'SGD Videos' : value;

/** The horizontal chip row for {@link usePhotoScopeFilter}. Hides when empty. */
export function PhotoScopeFilterChips({
  filter,
  setFilter,
  options,
}: {
  filter: PhotoScopeFilterValue;
  setFilter: (value: PhotoScopeFilterValue) => void;
  options: PhotoScopeFilterValue[];
}) {
  if (options.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((option) => {
        const active = option === filter;
        return (
          <Pressable
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => setFilter(option)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
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
  })
);
