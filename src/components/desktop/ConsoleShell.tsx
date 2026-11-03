import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthControl } from '@/components/AuthControl';
import { NotificationBell } from '@/components/desktop/NotificationBell';
import { PageMenu } from '@/components/desktop/PageMenu';
import { SyncStatusChip } from '@/components/SyncStatusChip';
import { SystemFlash } from '@/components/desktop/SystemFlash';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { DesktopNavItem } from '@/roles';
import { colors, spacing, themed } from '@/theme';

interface Props {
  navItems: DesktopNavItem[];
  children: ReactNode;
}

/**
 * Desktop chrome for the web consoles: one fixed 64px top bar over the page,
 * no sidebar.
 *
 * Left: the brand mark and the page menu — the current page's icon and name
 * as a dropdown of this role's pages. Right: the sync-status chip (offline /
 * syncing), the transient flash pill ("Changes Saved", floated into the bar's
 * empty middle so it never shifts the cluster), the notification bell (which
 * also carries the persistent system messages, e.g. double-bookings), the
 * Developer's "View as" switcher, and the profile chip. Page controls belong
 * in the page, under the bar.
 */
export function ConsoleShell({ navItems, children }: Props) {
  const pathname = usePathname();

  // Settings has no menu entry (it's reached via the profile chip), so it
  // titles the bar itself and marks nothing in the menu as current.
  const onSettings = pathname.startsWith('/console-settings');
  const active =
    navItems.find((n) => pathname.startsWith(n.href)) ??
    (onSettings ? undefined : navItems[0]);
  const title = onSettings ? 'Settings' : (active?.label ?? '');
  const icon = onSettings || !active ? Settings : active.icon;

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <View style={styles.topbarLeft}>
          <Image
            source={require('../../../assets/images/ox-logo.png')}
            style={styles.brandMark}
            contentFit="contain"
          />
          <PageMenu
            items={navItems}
            title={title}
            icon={icon}
            activeHref={active?.href}
          />
        </View>

        <View style={styles.topbarRight}>
          <View style={styles.flashSlot} pointerEvents="none">
            <SystemFlash />
          </View>
          <SyncStatusChip variant="bar" />
          <NotificationBell />
          <DevRoleSwitcher variant="bar" />
          <AuthControl variant="bar" />
        </View>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // A fixed 64px single row: brand + page menu on the left, the bell / profile
  // cluster on the right.
  topbar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    zIndex: 10,
  },
  // Spans the bar's height so the page menu can anchor its dropdown to the
  // bar's bottom edge.
  topbarLeft: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexShrink: 1,
  },
  brandMark: {
    width: 36,
    height: 36,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  // The flash pill's slot: hangs off the cluster's left edge into the bar's
  // empty middle, vertically centred, the pill hugging the cluster. Fixed
  // width so the pill has room for two lines of text without ever pushing
  // the bell or profile chip around; ignores the pointer (it's transient).
  flashSlot: {
    position: 'absolute',
    right: '100%',
    top: 0,
    bottom: 0,
    width: 360,
    marginRight: spacing.md,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
  },
}));
