import { ScrollView, StyleSheet, View } from 'react-native';

import { SettingsContent } from '@/components/SettingsContent';
import { spacing, themed } from '@/theme';

/**
 * Settings on the web console (every role) — profile + appearance in a
 * centered column. Sign-out and the Developer role switcher live in the top
 * bar here, so unlike the mobile tab they aren't repeated on the page.
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
