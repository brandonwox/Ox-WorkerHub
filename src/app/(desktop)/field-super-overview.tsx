import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { WorkRequestQuickView } from '@/components/desktop/WorkRequestQuickView';
import { OverviewContent } from '@/components/OverviewContent';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';

/**
 * Field Super → Overview (their landing page): their work requests with open
 * issues, and this week's false starts. Clicking a card opens the work request
 * quick-view sidebar.
 */
export default function FieldSuperOverviewScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);
  const workRequests = useAppStore((s) => s.workRequests);
  const deleteWorkRequest = useAppStore((s) => s.deleteWorkRequest);
  const flash = useAppStore((s) => s.flash);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // Same scoping as every Field Super page: only their own jobs' cards.
  const jobs = useMemo(
    () => (me ? jobsForFieldSuper(allJobs, me.id) : []),
    [allJobs, me]
  );

  if (role !== 'field_super') return <AccessDenied />;

  return (
    <View style={styles.root}>
      <OverviewContent
        mode="field_super"
        jobs={jobs}
        onOpenWorkRequest={setViewingId}
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
