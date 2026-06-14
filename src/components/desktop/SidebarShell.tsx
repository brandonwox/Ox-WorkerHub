import { Feather } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>Ox</Text>
          </View>
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
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <Text style={styles.pageTitle}>{active?.label ?? ''}</Text>
          <DevRoleSwitcher variant="bar" />
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
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primaryDim,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  brandText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  nav: {
    gap: spacing.xs,
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
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
});
