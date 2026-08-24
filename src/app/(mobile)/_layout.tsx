import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MobileNotificationsBell } from '@/components/mobile/MobileNotificationsBell';
import { NotificationToaster } from '@/components/NotificationToaster';
import { UndefinedStatusCatchUp } from '@/components/UndefinedStatusCatchUp';
import { SyncStatusChip } from '@/components/SyncStatusChip';
import {
  desktopHomeHref,
  MOBILE_NAV,
  MOBILE_TAB_NAMES,
  roleCanAccessMobilePath,
} from '@/roles';
import { useAppStore, useCurrentWorker } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * The floating tab bar, split into two islands in one row: the role's page
 * tabs on the left, and a utility island (notification bell — icon only — +
 * Settings) on the right. Rendered in normal layout flow (not absolute) so
 * screen content — lists, the clock controls — still ends above it.
 */
function IslandTabBar({
  state,
  descriptors,
  navigation,
  navNames,
}: BottomTabBarProps & { navNames: string[] }) {
  const insets = useSafeAreaInsets();

  // The role's tabs, in nav order (state.routes also holds the hidden ones).
  const ordered = navNames
    .map((name) => state.routes.find((r) => r.name === name))
    .filter((r): r is (typeof state.routes)[number] => !!r);
  const pages = ordered.filter((r) => r.name !== 'settings');
  const settings = ordered.find((r) => r.name === 'settings');

  const renderTab = (
    route: (typeof state.routes)[number],
    compact = false
  ) => {
    const { options } = descriptors[route.key];
    const focused = state.routes[state.index]?.key === route.key;
    const color = focused ? colors.primary : colors.textSecondary;
    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };
    return (
      <Pressable
        key={route.key}
        style={({ pressed }) => [
          compact ? styles.tabItemCompact : styles.tabItem,
          pressed && styles.tabPressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={options.title}
      >
        {options.tabBarIcon?.({ focused, color, size: 22 })}
        <Text style={[styles.tabLabel, { color }]}>{options.title}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.barRow, { marginBottom: insets.bottom + spacing.xs }]}
    >
      <View style={[styles.island, styles.islandPages]}>
        {pages.map((r) => renderTab(r))}
      </View>
      <View style={styles.island}>
        <MobileNotificationsBell />
        {settings && renderTab(settings, true)}
      </View>
    </View>
  );
}

/** Phone tab layout. Every role gets its own tab set (MOBILE_NAV). */
export default function MobileTabsLayout() {
  const authResolved = useAppStore((s) => s.authResolved);
  const authWorker = useAppStore((s) => s.authWorker);
  const passwordRecovery = useAppStore((s) => s.passwordRecovery);
  const worker = useCurrentWorker();
  const pathname = usePathname();

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
  // tab paths are policed; stack routes like /work-request/[id] pass through untouched.
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
        tabBar={(props) => (
          <IslandTabBar {...props} navNames={nav.map((item) => item.name)} />
        )}
        screenOptions={{ headerShown: false }}
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
      <UndefinedStatusCatchUp />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  barRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  island: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    backgroundColor: colors.surface,
    // A touch less rounded than the old radii.lg * 2 pill look.
    borderRadius: radii.lg + 4,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
    paddingHorizontal: spacing.xs,
  },
  islandPages: {
    flex: 1,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabItemCompact: {
    width: 58,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
}));
