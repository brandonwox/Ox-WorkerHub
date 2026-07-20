import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { WorkRequestQuickView } from '@/components/desktop/WorkRequestQuickView';
import { OverviewContent } from '@/components/OverviewContent';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';

/**
 * Scheduler → Overview (their landing page): new "Now" priority work requests, the
 * work-request pool size, and cards freshly marked Finished. Clicking a card
 * opens the work request quick-view sidebar.
 */
export default function SchedulerOverviewScreen() {
  const role = useCurrentRole();
  const jobs = useAppStore((s) => s.jobs);
  const workRequests = useAppStore((s) => s.workRequests);
  const deleteWorkRequest = useAppStore((s) => s.deleteWorkRequest);
  const flash = useAppStore((s) => s.flash);
  const router = useRouter();
  const [viewingId, setViewingId] = useState<string | null>(null);

  if (role !== 'scheduler') return <AccessDenied />;

  return (
    <View style={styles.root}>
      <OverviewContent
        mode="scheduler"
        jobs={jobs}
        onOpenWorkRequest={setViewingId}
        onOpenWorkRequests={() => router.push('/scheduler-calendar')}
      />
      <WorkRequestQuickView
        workRequestId={viewingId}
        jobs={jobs}
        variant="sidebar"
        onClose={() => setViewingId(null)}
        onDelete={(id) => {
          const title = workRequests.find((c) => c.id === id)?.title;
          deleteWorkRequest(id);
          setViewingId(null);
          flash(
            title ? `Work Request "${title}" deleted` : 'Work Request deleted',
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
