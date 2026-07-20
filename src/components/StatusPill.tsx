import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, themed } from '@/theme';
import { WorkRequestStatus } from '@/types';

/** Pill colors per work request status — shared by every status UI (pill, dropdown). */
export const workRequestStatusColors: Record<
  WorkRequestStatus,
  { bg: string; fg: string }
> = themed(() => ({
  Undefined: { bg: colors.surfaceLight, fg: colors.textSecondary },
  Untouched: { bg: colors.warningDim, fg: colors.warning },
  'False Start': { bg: colors.dangerDim, fg: colors.danger },
  'Made Progress': { bg: colors.primaryDim, fg: colors.primary },
  Finished: { bg: colors.successDim, fg: colors.success },
}));

export function StatusPill({ status }: { status: WorkRequestStatus }) {
  // Fall back for any legacy status string still in flight from the DB.
  const palette = workRequestStatusColors[status] ?? workRequestStatusColors.Undefined;
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.label, { color: palette.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
