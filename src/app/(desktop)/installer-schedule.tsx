import { StyleSheet, View } from 'react-native';

import { AccessDenied } from '@/components/desktop/AccessDenied';
import { InstallerAgenda } from '@/components/mobile/InstallerAgenda';
import { useCurrentRole } from '@/store/useAppStore';

/**
 * The installer's schedule on the web console: the same agenda (week ribbon,
 * day's work requests, clock in/out) in a centered phone-width column.
 */
export default function InstallerSchedulePage() {
  const role = useCurrentRole();
  if (role !== 'installer') return <AccessDenied />;

  return (
    <View style={styles.wrap}>
      <View style={styles.column}>
        <InstallerAgenda />
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
    maxWidth: 560,
  },
});
