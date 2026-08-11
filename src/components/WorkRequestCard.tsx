import { Feather } from '@expo/vector-icons';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '@/components/StatusPill';
import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, getThemeScheme, radii, spacing, themed } from '@/theme';
import { WorkRequest } from '@/types';
import { formatJobWindow } from '@/utils/time';
import { usePulse } from '@/utils/usePulse';
import { workRequestPoLabel } from '@/utils/workRequestJobs';

interface Props {
  workRequest: WorkRequest;
  onPress: () => void;
  /** Shows a highlight border indicating the card can be tapped to clock in. */
  selectable?: boolean;
  /** The worker is currently clocked in on this work request — pulses the border. */
  active?: boolean;
}

export function WorkRequestCard({ workRequest, onPress, selectable, active }: Props) {
  const pulse = usePulse(active);
  const timeWindow = formatJobWindow(workRequest.startTime, workRequest.endTime);
  // The linked job(s) show as their PO, right above the title. (No priority
  // pill here — work request priority is office-side; installers don't need it.)
  const jobs = useAppStore((s) => s.jobs);
  const poLabel = workRequestPoLabel(workRequest, jobs);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selectable && styles.selectable,
        pressed && styles.pressed,
      ]}
    >
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeBorder,
            {
              borderColor: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.primary, 'rgba(62, 150, 244, 0.3)'],
              }),
            },
          ]}
        />
      )}
      {poLabel ? (
        <Text style={styles.poLine} numberOfLines={1}>
          {poLabel}
        </Text>
      ) : null}
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {workRequest.title}
        </Text>
        <StatusPill status={workRequest.status} />
      </View>
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={14} color={colors.textSecondary} />
        <Text style={styles.metaText} numberOfLines={1}>
          {workRequest.address}
        </Text>
      </View>
      {timeWindow && (
        <View style={styles.metaRow}>
          <Feather name="clock" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{timeWindow}</Text>
        </View>
      )}
      {workRequest.notes ? (
        <View style={styles.metaRow}>
          <Feather name="file-text" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {workRequest.notes}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  card: {
    position: 'relative',
    // Light mode: a touch darker than the page (#FEFEFE) so the schedule
    // cards read as cards — plain `surface` (#FFFFFF) vanishes into it.
    backgroundColor:
      getThemeScheme() === 'light' ? '#F6F7F9' : colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  poLine: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: -spacing.xs,
  },
  selectable: {
    borderColor: colors.primary,
  },
  activeBorder: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: radii.lg + 1.5,
    borderWidth: 2,
  },
  pressed: {
    backgroundColor: colors.surfaceLight,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
}));
