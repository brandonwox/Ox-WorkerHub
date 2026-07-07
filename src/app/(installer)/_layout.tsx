import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';

import { NotificationToaster } from '@/components/NotificationToaster';
import { roleHomeHref } from '@/roles';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const authResolved = useAppStore((s) => s.authResolved);
  const authWorker = useAppStore((s) => s.authWorker);
  const passwordRecovery = useAppStore((s) => s.passwordRecovery);
  const worker = useCurrentWorker();

  // Wait for the Supabase session to resolve before deciding, so a returning
  // user isn't flashed the login screen on launch.
  if (!authResolved) return null;

  // No identity (signed out, and not in local dev mode) → require sign-in.
  if (!worker) return <Redirect href="/sign-in" />;

  // Invited workers (setting up) and recovery-link sessions (resetting) both
  // need the password screen before anything else.
  if (authWorker?.status === 'invited' || passwordRecovery) {
    return <Redirect href="/set-password" />;
  }

  // Desktop roles don't belong in the mobile tabs — send them to their console.
  const role = worker.role;
  if (role !== 'installer') {
    return <Redirect href={roleHomeHref(role)} />;
  }

  return (
    // Wrap the tabs so the notification toaster can overlay them (it plays the
    // ping and slides in when the installer's schedule changes for today).
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border
          },
          tabBarLabelStyle: {
            fontFamily: fonts.medium,
            fontSize: 11,
          },
        }}
      >
        <Tabs.Screen
          name="timesheets"
          options={{
            title: 'Timesheets',
            tabBarIcon: ({ color, size }) => (
              <Feather name="file-text" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <Feather name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => (
              <Feather name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <NotificationToaster />
    </View>
  );
}
