import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthControl } from '@/components/AuthControl';
import { SettingsContent } from '@/components/SettingsContent';
import { spacing, themed } from '@/theme';

/**
 * Settings on the web console (every role) — profile + appearance in a
 * centered column, reached from the top bar's profile chip. Sign out sits at
 * the bottom of the page; the Developer role switcher stays in the top bar.
 */
export default function SettingsPage() {
  return (
    <View style={styles.wrap}>
      <ScrollView
        style={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SettingsContent />
        <AuthControl variant="card" />
      </ScrollView>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
    },
    column: {
      flex: 1,
      width: '100%',
      maxWidth: 720,
    },
    content: {
      gap: spacing.lg,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
  })
);
