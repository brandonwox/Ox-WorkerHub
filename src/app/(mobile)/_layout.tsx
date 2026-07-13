import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationToaster } from '@/components/NotificationToaster';
import { SyncStatusChip } from '@/components/SyncStatusChip';
import {
  desktopHomeHref,
  MOBILE_NAV,
  MOBILE_TAB_NAMES,
  roleCanAccessMobilePath,
} from '@/roles';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

/** Phone tab layout. Every role gets its own tab set (MOBILE_NAV). */
export default function MobileTabsLayout() {
  const authResolved = useAppStore((s) => s.authResolved);
  const authWorker = useAppStore((s) => s.authWorker);
  const passwordRecovery = useAppStore((s) => s.passwordRecovery);
  const worker = useCurrentWorker();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

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

  // The split is by form factor, not role: web is the desktop console, native
  // is the tabs. A web visit landing here bounces to the role's console home.
  const role = worker.role;
  if (Platform.OS === 'web') {
    return <Redirect href={desktopHomeHref(role)} />;
  }

  // Landed on another role's tab (e.g. via a stale deep link) → go home. Only
  // tab paths are policed; stack routes like /job/[id] pass through untouched.
  if (!roleCanAccessMobilePath(role, pathname)) {
    return <Redirect href="/" />;
  }

  const nav = MOBILE_NAV[role];
  const navNames = new Set(nav.map((item) => item.name));
  const hidden = MOBILE_TAB_NAMES.filter((name) => !navNames.has(name));

  return (
    // Wrap the tabs so the notification toaster can overlay them (it plays the
    // ping and slides in when the worker's schedule changes for today).
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="index"
        // The bar is a floating island above the home indicator; zero out the
        // navigator's own bottom inset so it doesn't pad the bar's inside too.
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          // Floating island: in normal layout flow (not absolute) so screen
          // content — lists, the clock controls — still ends above it.
          tabBarStyle: {
            backgroundColor: colors.surface,
            height: 62,
            marginHorizontal: spacing.lg,
            marginBottom: insets.bottom + spacing.xs,
            marginTop: spacing.xs,
            borderRadius: radii.lg * 2,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: colors.border,
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
          },
          // Nudges the icons (and labels) down — they sat a little high.
          tabBarItemStyle: {
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontFamily: fonts.medium,
            fontSize: 11,
          },
        }}
      >
        {nav.map((item) => (
          <Tabs.Screen
            key={item.name}
            name={item.name}
            options={{
              title: item.label,
              tabBarIcon: ({ color, size }) => (
                <Feather name={item.icon} size={size} color={color} />
              ),
            }}
          />
        ))}
        {/* Tabs must declare every file in the group; hide the other roles'. */}
        {hidden.map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>
      <NotificationToaster />
      <SyncStatusChip variant="floating" />
    </View>
  );
}
