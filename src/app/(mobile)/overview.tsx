import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { OverviewContent } from '@/components/OverviewContent';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';

/**
 * Overview tab — the Scheduler's / Field Super's "what needs attention"
 * dashboard. Tapping a work request opens its page.
 */
export default function OverviewTab() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);
  const router = useRouter();

  // Field Supers see only their own jobs' cards; schedulers see everything.
  const jobs = useMemo(
    () =>
      role === 'field_super' && me
        ? jobsForFieldSuper(allJobs, me.id)
        : allJobs,
    [role, me, allJobs]
  );

  if (role !== 'scheduler' && role !== 'field_super') return <AccessDenied />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>Overview</Text>
      <OverviewContent
        mode={role}
        jobs={jobs}
        onOpenWorkRequest={(id) =>
          router.push({ pathname: '/work-request/[id]', params: { id } })
        }
        onOpenWorkRequests={
          role === 'scheduler' ? () => router.push('/backlog') : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    title: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 24,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
  })
);
