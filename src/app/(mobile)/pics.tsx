import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { JobPicsList } from '@/components/photos/JobPicsList';
import { useCurrentRole } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';

/** Jobs tab (formerly Pics) — the installer's job dashboard and photo gateway. */
export default function PicsTab() {
  const role = useCurrentRole();
  const router = useRouter();

  if (role !== 'installer') return <AccessDenied />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.heading}>Jobs</Text>
      <Text style={styles.hint}>
        Open a job to see its photos or take new ones.
      </Text>
      <JobPicsList
        onSelectJob={(job) =>
          router.push({ pathname: '/job-site/[id]', params: { id: job.id } })
        }
      />
    </SafeAreaView>
  );
}

const styles = themed(() => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heading: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
}));
