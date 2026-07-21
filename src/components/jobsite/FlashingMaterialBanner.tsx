import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';
import { Job } from '@/types';
import { jobAllowsWindows } from '@/utils/jobScopes';

/**
 * Job details warning: a windows-covering job with no Window Opening Flashing
 * Material set blocks work request creation, so office roles that can fix it
 * (Field Supers, the Operator, Schedulers) see a plain warning row under the
 * job header — same quiet style as the layout-plan banners. Non-window jobs
 * never show it (flashing material doesn't exist for them).
 */
export function FlashingMaterialBanner({ job }: { job: Job }) {
  const role = useCurrentRole();
  if (
    !['field_super', 'operator', 'scheduler'].includes(role ?? '') ||
    !jobAllowsWindows(job) ||
    job.flashingMaterial?.trim()
  ) {
    return null;
  }
  return (
    <View style={styles.row}>
      <Feather name="alert-triangle" size={16} color={colors.warning} />
      <Text style={styles.warningText}>
        No Window Opening Flashing Material set — work requests can&apos;t be
        created for this job until it is.
      </Text>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    // Bare text, no background/border — matches LayoutPlanBanner.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm + 2,
      alignSelf: 'center',
      maxWidth: '94%',
    },
    warningText: {
      flexShrink: 1,
      color: colors.textPrimary,
      fontFamily: fonts.medium,
      fontSize: 14,
    },
  })
);
