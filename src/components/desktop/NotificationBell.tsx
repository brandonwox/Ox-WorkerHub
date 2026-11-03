import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SystemMessages,
  useSystemIssues,
} from '@/components/desktop/SystemMessages';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useUnreadNotificationCount } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * Header bell for the desktop top bar (ConsoleShell). Its badge counts the
 * current worker's unread notifications plus any persistent system issues
 * (red while something is unread, amber when only system issues remain). It
 * opens a dropdown with the System section on top (double-bookings and the
 * like — see {@link SystemMessages}) and the shared {@link NotificationList}
 * under it (filter, groups, mark-all/clear-all, deep links).
 */
export function NotificationBell() {
  const unread = useUnreadNotificationCount();
  const issues = useSystemIssues();
  const [open, setOpen] = useState(false);

  const total = unread + issues.length;
  const parts: string[] = [];
  if (unread > 0) parts.push(`${unread} unread`);
  if (issues.length > 0) {
    parts.push(`${issues.length} system issue${issues.length === 1 ? '' : 's'}`);
  }
  const label =
    parts.length > 0 ? `Notifications, ${parts.join(', ')}` : 'Notifications';

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Feather name="bell" size={20} color={colors.textSecondary} />
        {total > 0 && (
          <View style={[styles.badge, unread === 0 && styles.badgeWarning]}>
            <Text style={[styles.badgeText, unread === 0 && styles.badgeTextWarning]}>
              {total > 99 ? '99+' : total}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.panel} pointerEvents="box-none">
          <View style={styles.panelCard}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
            </View>
            <SystemMessages issues={issues} />
            <NotificationList onNavigate={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  bell: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellPressed: {
    backgroundColor: colors.surfaceLight,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  // Only system issues, nothing unread: amber instead of red. The page
  // background is the readable ink on the warning tone in both themes.
  badgeWarning: {
    backgroundColor: colors.warning,
  },
  badgeText: {
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
  },
  badgeTextWarning: {
    color: colors.background,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Anchor the panel just under the top bar on the right, mirroring the bell.
  panel: {
    position: 'absolute',
    top: 60,
    right: spacing.xl,
  },
  panelCard: {
    width: 460,
    maxHeight: 600,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
}));
