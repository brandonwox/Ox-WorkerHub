import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';
import { JobcardStatus } from '@/types';

/** Pill colors per jobcard status — shared by every status UI (pill, dropdown). */
export const jobcardStatusColors: Record<
  JobcardStatus,
  { bg: string; fg: string }
> = {
  Untouched: { bg: colors.surfaceLight, fg: colors.textSecondary },
  'False Start': { bg: colors.dangerDim, fg: colors.danger },
  'No Progress': { bg: colors.warningDim, fg: colors.warning },
  'Made Progress': { bg: colors.primaryDim, fg: colors.primary },
  Finished: { bg: colors.successDim, fg: colors.success },
};

export function StatusPill({ status }: { status: JobcardStatus }) {
  // Fall back for any legacy status string still in flight from the DB.
  const palette = jobcardStatusColors[status] ?? jobcardStatusColors.Untouched;
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
