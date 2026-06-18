import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { roleHomeHref } from '@/roles';
import { useAppStore, useCurrentRole } from '@/store/useAppStore';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const role = useCurrentRole();
  const authWorker = useAppStore((s) => s.authWorker);

  // Invited workers must set a password before using the app.
  if (authWorker?.status === 'invited') {
    return <Redirect href="/set-password" />;
  }

  // Desktop roles don't belong in the mobile tabs — send them to their console.
  if (role !== 'installer') {
    return <Redirect href={roleHomeHref(role)} />;
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
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
  );
}
