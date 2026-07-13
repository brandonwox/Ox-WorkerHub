import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { FinanceJobs } from '@/components/finance/FinanceJobs';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * Finance Manager → Jobs: labor budgets vs wages paid out, and QBT jobcode
 * mapping, in a centered column.
 */
export default function FinanceJobsPage() {
  const role = useCurrentRole();
  if (role !== 'finance_manager') return <AccessDenied />;

  return (
    <View style={styles.wrap}>
      <View style={styles.column}>
        <FinanceJobs />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 860,
  },
});
