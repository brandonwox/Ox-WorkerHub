import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { JobPhotosModal } from '@/components/desktop/JobPhotosModal';
import { JobPicsList } from '@/components/photos/JobPicsList';
import { useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';
import { Job } from '@/types';

/**
 * Installer → Pics on the web console. Same job list as the phone tab; a job
 * opens its photo wall in a popup. There's no camera on web — photos are added
 * from the computer via the popup's upload button.
 */
export default function InstallerPicsScreen() {
  const role = useCurrentRole();
  const [viewJob, setViewJob] = useState<Job | null>(null);

  if (role !== 'installer') return <AccessDenied />;

  return (
    <View style={styles.screen}>
      <Text style={styles.sectionHint}>
        Open a job to browse its photos or upload pictures from this computer.
      </Text>
      <JobPicsList onSelectJob={setViewJob} />
      <JobPhotosModal job={viewJob} onClose={() => setViewJob(null)} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
    maxWidth: 1100,
  },
  sectionHint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
}));
