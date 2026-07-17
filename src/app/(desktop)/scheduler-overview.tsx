import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { JobcardQuickView } from '@/components/desktop/JobcardQuickView';
import { OverviewContent } from '@/components/OverviewContent';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';

/**
 * Scheduler → Overview (their landing page): new "Now" priority jobcards, the
 * work-request pool size, and cards freshly marked Finished. Clicking a card
 * opens the jobcard quick-view sidebar.
 */
export default function SchedulerOverviewScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const deleteJobcard = useAppStore((s) => s.deleteJobcard);
  const flash = useAppStore((s) => s.flash);
  const router = useRouter();
  const [viewingId, setViewingId] = useState<string | null>(null);

  if (role !== 'scheduler') return <AccessDenied />;

  return (
    <View style={styles.root}>
      <OverviewContent
        mode="scheduler"
        jobs={jobs}
        onOpenJobcard={setViewingId}
        onOpenWorkRequests={() => router.push('/scheduler-calendar')}
      />
      <JobcardQuickView
        jobcardId={viewingId}
        jobs={jobs}
        variant="sidebar"
        onClose={() => setViewingId(null)}
        onDelete={(id) => {
          const title = jobcards.find((c) => c.id === id)?.title;
          deleteJobcard(id);
          setViewingId(null);
          flash(
            title ? `Jobcard "${title}" deleted` : 'Jobcard deleted',
            'success'
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
