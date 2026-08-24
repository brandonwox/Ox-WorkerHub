import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthControl } from '@/components/AuthControl';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { SettingsContent } from '@/components/SettingsContent';
import { useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, spacing, themed } from '@/theme';

export default function SettingsScreen() {
  const user = useCurrentWorker();

  // Gated by the installer layout; null only during the sign-out transition.
  if (!user) return null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>Settings</Text>

          <SettingsContent personalInfoSubPage />

          <DevRoleSwitcher variant="card" />
          <AuthControl variant="card" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    heading: {
      color: colors.textPrimary,
      fontFamily: fonts.bold,
      fontSize: 24,
    },
  })
);
