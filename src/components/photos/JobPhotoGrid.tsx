import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DisplayPhoto } from '@/components/photos/useJobPhotos';
import { useAppStore } from '@/store/useAppStore';
import { colors, darkColors, fonts, radii, spacing, themed } from '@/theme';

/** Thumbnails per row. */
const COLUMNS = 5;
const GAP = spacing.xs;

interface Props {
  /** Photos to show (any order — grouped by day, newest first, internally). */
  photos: DisplayPhoto[];
  /** Open the tapped photo (index is into the grid's own day-sorted order). */
  onPhotoPress: (photo: DisplayPhoto, sorted: DisplayPhoto[]) => void;
}

/** Day-grouped, 5-across thumbnail grid of a job's photos. */
export function JobPhotoGrid({ photos, onPhotoPress }: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  // Group by calendar day, newest day (and newest photo within a day) first.
  const { days, sorted } = useMemo(() => {
    const ordered = [...photos].sort((a, b) =>
      b.takenAt.localeCompare(a.takenAt)
    );
    const byDay = new Map<string, DisplayPhoto[]>();
    for (const photo of ordered) {
      const day = photo.takenAt.slice(0, 10);
      const list = byDay.get(day);
      if (list) list.push(photo);
      else byDay.set(day, [photo]);
    }
    return { days: [...byDay.entries()], sorted: ordered };
  }, [photos]);

  // Photos aren't kept on the device — offline, the whole area is one message
  // (photos taken offline are safe in the upload queue; noted so nobody
  // panics that their shots vanished).
  if (!isOnline) {
    const waiting = photos.filter((p) => p.pending).length;
    return (
      <View style={styles.empty}>
        <Feather name="cloud-off" size={30} color={colors.textTertiary} />
        <Text style={styles.emptyText}>
          Connect to the internet to view photos.
        </Text>
        {waiting > 0 && (
          <Text style={styles.emptySubText}>
            {waiting} photo{waiting === 1 ? '' : 's'} taken on this device will
            upload when you&apos;re back online.
          </Text>
        )}
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="image" size={30} color={colors.textTertiary} />
        <Text style={styles.emptyText}>No photos yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {days.map(([day, dayPhotos]) => (
        <View key={day} style={styles.daySection}>
          <Text style={styles.dayHeader}>
            {format(parseISO(day), 'EEEE, MMMM d, yyyy')}
          </Text>
          <View style={styles.grid}>
            {dayPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                style={styles.cell}
                onPress={() => onPhotoPress(photo, sorted)}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={styles.thumb}
                  contentFit="cover"
                  transition={100}
                />
                {photo.pending && (
                  <View style={styles.pendingBadge}>
                    <Feather
                      name={
                        photo.pending === 'failed' ? 'alert-circle' : 'upload-cloud'
                      }
                      size={11}
                      // Badges sit on a dark scrim over the photo — dark
                      // palette in both themes.
                      color={
                        photo.pending === 'failed'
                          ? darkColors.warning
                          : darkColors.textPrimary
                      }
                    />
                  </View>
                )}
                {!!photo.note && !photo.pending && (
                  <View style={styles.noteBadge}>
                    <Feather
                      name="message-square"
                      size={10}
                      color={darkColors.textPrimary}
                    />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  daySection: {
    gap: spacing.sm,
  },
  dayHeader: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Cells carry half the gap on every side; pull the grid out by the same
    // amount so the outer edges stay flush.
    margin: -GAP / 2,
  },
  cell: {
    width: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    padding: GAP / 2,
  },
  thumb: {
    flex: 1,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceLight,
  },
  pendingBadge: {
    position: 'absolute',
    top: spacing.xs + GAP / 2,
    right: spacing.xs + GAP / 2,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: 3,
  },
  noteBadge: {
    position: 'absolute',
    bottom: spacing.xs + GAP / 2,
    right: spacing.xs + GAP / 2,
    backgroundColor: colors.overlay,
    borderRadius: radii.pill,
    padding: 3,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  emptySubText: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 280,
  },
}));
