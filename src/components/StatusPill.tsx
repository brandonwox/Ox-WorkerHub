import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';
import { JobStatus } from '@/types';

const statusStyles: Record<JobStatus, { bg: string; fg: string }> = {
  Upcoming: { bg: colors.primaryDim, fg: colors.primary },
  'In Progress': { bg: colors.warningDim, fg: colors.warning },
  Finished: { bg: colors.successDim, fg: colors.success },
};

export function StatusPill({ status }: { status: JobStatus }) {
  const palette = statusStyles[status];
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
