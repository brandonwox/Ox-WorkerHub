import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { InstallerTimesheets } from '@/components/mobile/InstallerTimesheets';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * The installer's own timesheet history on the web console, in a centered
 * column.
 */
export default function InstallerTimesheetsPage() {
  const role = useCurrentRole();
  if (role !== 'installer') return <AccessDenied />;

  return (
    <View style={styles.wrap}>
      <View style={styles.column}>
        <InstallerTimesheets />
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
    maxWidth: 720,
  },
});
