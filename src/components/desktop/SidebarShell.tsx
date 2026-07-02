import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, usePathname } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthControl } from '@/components/AuthControl';
import { NotificationBell } from '@/components/desktop/NotificationBell';
import { SavedPill } from '@/components/desktop/SavedPill';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { DesktopNavItem } from '@/roles';
import { colors, fonts, radii, spacing } from '@/theme';

interface Props {
  navItems: DesktopNavItem[];
  children: ReactNode;
}

/** Desktop chrome for the Scheduler/Operator consoles: left sidebar + top bar. */
export function SidebarShell({ navItems, children }: Props) {
  const pathname = usePathname();
  const active = navItems.find((n) => pathname.startsWith(n.href)) ?? navItems[0];

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.brand}>
          <Image
            source={require('../../../assets/images/ox-logo.png')}
            style={styles.brandMark}
            contentFit="contain"
          />
          <Text style={styles.brandText}>WorkerHub</Text>
        </View>

        <View style={styles.nav}>
          {navItems.map((item) => {
            const isActive = item.href === active?.href;
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  style={({ pressed }) => [
                    styles.navItem,
                    isActive && styles.navItemActive,
                    pressed && styles.navItemPressed,
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={18}
                    color={isActive ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>

        <View style={styles.sidebarFooter}>
          <SavedPill />
        </View>
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <Text style={styles.pageTitle}>{active?.label ?? ''}</Text>
          <View style={styles.topbarRight}>
            <NotificationBell />
            <DevRoleSwitcher variant="bar" />
            <AuthControl variant="bar" />
          </View>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  sidebar: {
    width: 240,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  // Brand header bar: same 64px height and bottom border as the top bar, and
  // spans the full sidebar width by cancelling the sidebar's horizontal padding.
  brand: {
    height: 64,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandMark: {
    width: 42,
    height: 42,
  },
  brandText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  nav: {
    gap: spacing.xs,
  },
  // Pushes the "Changes Saved" pill to the bottom of the sidebar.
  sidebarFooter: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  navItemActive: {
    backgroundColor: colors.primaryDim,
  },
  navItemPressed: {
    backgroundColor: colors.surfaceLight,
  },
  navLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  navLabelActive: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  main: {
    flex: 1,
  },
  topbar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    zIndex: 10,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
});
