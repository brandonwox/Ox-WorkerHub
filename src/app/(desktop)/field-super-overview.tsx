import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { JobcardQuickView } from '@/components/desktop/JobcardQuickView';
import { OverviewContent } from '@/components/OverviewContent';
import {
  jobsForFieldSuper,
  useAppStore,
  useCurrentRole,
  useCurrentWorker,
} from '@/store/useAppStore';

/**
 * Field Super → Overview (their landing page): their jobcards with open
 * issues, and this week's false starts. Clicking a card opens the jobcard
 * quick-view sidebar.
 */
export default function FieldSuperOverviewScreen() {
  const role = useCurrentRole();
  const me = useCurrentWorker();
  const allJobs = useAppStore((s) => s.jobs);
  const jobcards = useAppStore((s) => s.jobcards);
  const deleteJobcard = useAppStore((s) => s.deleteJobcard);
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
        onOpenJobcard={setViewingId}
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
