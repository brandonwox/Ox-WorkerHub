import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useAppStore,
  useMyNotifications,
  useUnreadNotificationCount,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';
import { AppNotification, NotificationType } from '@/types';

/** Feather glyph per notification type. */
const TYPE_ICON: Record<NotificationType, keyof typeof Feather.glyphMap> = {
  jobcard_now: 'alert-circle',
  schedule_change: 'calendar',
};

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Header bell: shows the current worker's unread count and opens a dropdown of
 * their notifications. Lives in the desktop top bar (see SidebarShell).
 */
export function NotificationBell() {
  const notifications = useMyNotifications();
  const unread = useUnreadNotificationCount();
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.bell, pressed && styles.bellPressed]}
        onPress={() => setOpen(true)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }
      >
        <Feather name="bell" size={20} color={colors.textSecondary} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
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
              {unread > 0 && (
                <Pressable onPress={markAllRead} hitSlop={6}>
                  <Text style={styles.markAll}>Mark all read</Text>
                </Pressable>
              )}
            </View>

            {notifications.length === 0 ? (
              <Text style={styles.empty}>You&apos;re all caught up.</Text>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
              >
                {notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onPress={() => markRead(n.id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function NotificationItem({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const icon = TYPE_ICON[notification.type] ?? 'bell';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        !notification.read && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.itemIcon}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{notification.title}</Text>
        <Text style={styles.itemText}>{notification.body}</Text>
        <Text style={styles.itemTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  badgeText: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
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
    width: 360,
    maxHeight: 460,
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
  markAll: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  itemUnread: {
    backgroundColor: colors.primaryDim,
  },
  itemPressed: {
    backgroundColor: colors.surfaceLight,
  },
  itemIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  itemText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  itemTime: {
    color: colors.textTertiary,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
