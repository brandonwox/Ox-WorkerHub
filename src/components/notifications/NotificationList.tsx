import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow, isToday } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  useAppStore,
  useCurrentRole,
  useMyNotifications,
} from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { AppNotification, AppRole, NotificationType } from '@/types';
import { notificationTarget } from '@/utils/notificationNav';

/** Feather glyph per notification type (panel rows AND toasts). */
export const NOTIFICATION_TYPE_ICON: Record<
  NotificationType,
  keyof typeof Feather.glyphMap
> = {
  work_request_now: 'alert-circle',
  schedule_change: 'calendar',
  save_failed: 'alert-triangle',
  status_update_needed: 'clock',
  status_reported: 'flag',
  work_request_created: 'file-plus',
  issue_raised: 'alert-octagon',
  issue_resolved: 'check-circle',
  work_request_scheduled: 'clipboard',
  job_assigned: 'user-plus',
  job_needs_qbt: 'link',
  qbt_push_result: 'upload-cloud',
};

/** Human labels — the Settings mute toggles. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  work_request_now: 'Priority "Now" work requests',
  schedule_change: "Today's schedule changes",
  save_failed: 'Failed saves',
  status_update_needed: 'Overdue status reminders',
  status_reported: 'Field status reports',
  work_request_created: 'New work requests',
  issue_raised: 'New issues',
  issue_resolved: 'Resolved issues',
  work_request_scheduled: 'Work requests scheduled',
  job_assigned: 'Job assignments',
  job_needs_qbt: 'Jobs needing a QBT jobcode',
  qbt_push_result: 'QuickBooks Time pushes',
};

/**
 * The types each role can actually receive — drives which mute toggles their
 * Settings shows. `save_failed` is deliberately absent everywhere: a discarded
 * change must never be missable, so it can't be muted.
 */
export const ROLE_NOTIFICATION_TYPES: Record<AppRole, NotificationType[]> = {
  installer: ['schedule_change', 'status_update_needed'],
  scheduler: [
    'work_request_now',
    'work_request_created',
    'status_reported',
    'issue_raised',
  ],
  field_super: [
    'status_reported',
    'issue_raised',
    'issue_resolved',
    'work_request_scheduled',
    'job_assigned',
  ],
  operator: ['qbt_push_result'],
  finance_manager: ['job_needs_qbt', 'qbt_push_result'],
  developer: [
    'work_request_now',
    'schedule_change',
    'status_update_needed',
    'status_reported',
    'work_request_created',
    'issue_raised',
    'issue_resolved',
    'work_request_scheduled',
    'job_assigned',
    'job_needs_qbt',
    'qbt_push_result',
  ],
};

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Hook: open a notification — mark it read and jump to its target (work
 * request / job) when it has one. `onDone` closes the containing panel; it is
 * called only when navigation actually happens.
 */
export function useOpenNotification(onDone?: () => void) {
  const markRead = useAppStore((s) => s.markNotificationRead);
  const role = useCurrentRole();
  const router = useRouter();
  return (n: AppNotification) => {
    markRead(n.id);
    const target = notificationTarget(n, role);
    if (target) {
      onDone?.();
      router.push({
        pathname: target.pathname as never,
        params: target.params,
      });
    }
  };
}

/**
 * The notification list shared by the desktop bell dropdown and the mobile
 * notifications sheet: an All/Unread filter, Mark-all-read and Clear-all
 * actions, and the rows grouped Today / Earlier. The parent supplies the
 * surrounding chrome (panel card / full-screen sheet) and passes `onNavigate`
 * so a row click can close it.
 */
export function NotificationList({ onNavigate }: { onNavigate?: () => void }) {
  const notifications = useMyNotifications();
  const markAllRead = useAppStore((s) => s.markAllNotificationsRead);
  const clearAll = useAppStore((s) => s.clearAllNotifications);
  const dismiss = useAppStore((s) => s.dismissNotification);
  const openNotification = useOpenNotification(onNavigate);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const visible = useMemo(
    () => (unreadOnly ? notifications.filter((n) => !n.read) : notifications),
    [notifications, unreadOnly]
  );
  const groups = useMemo(() => {
    const today: AppNotification[] = [];
    const earlier: AppNotification[] = [];
    for (const n of visible) {
      let inToday = false;
      try {
        inToday = isToday(new Date(n.createdAt));
      } catch {
        // Bad timestamp → Earlier.
      }
      (inToday ? today : earlier).push(n);
    }
    return { today, earlier };
  }, [visible]);

  return (
    <>
      <View style={styles.controls}>
        <View style={styles.filterChips}>
          <FilterChip
            label="All"
            active={!unreadOnly}
            onPress={() => setUnreadOnly(false)}
          />
          <FilterChip
            label={unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread'}
            active={unreadOnly}
            onPress={() => setUnreadOnly(true)}
          />
        </View>
        <View style={styles.controlActions}>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={6}>
              <Text style={styles.controlAction}>Mark all read</Text>
            </Pressable>
          )}
          {notifications.length > 0 && (
            <Pressable onPress={clearAll} hitSlop={6}>
              <Text style={styles.controlAction}>Clear all</Text>
            </Pressable>
          )}
        </View>
      </View>

      {visible.length === 0 ? (
        <Text style={styles.empty}>
          {unreadOnly && notifications.length > 0
            ? 'No unread notifications.'
            : 'You’re all caught up.'}
        </Text>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {groups.today.length > 0 && (
            <Text style={styles.groupLabel}>Today</Text>
          )}
          {groups.today.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onPress={() => openNotification(n)}
              onDismiss={() => dismiss(n.id)}
            />
          ))}
          {groups.earlier.length > 0 && (
            <Text style={styles.groupLabel}>Earlier</Text>
          )}
          {groups.earlier.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onPress={() => openNotification(n)}
              onDismiss={() => dismiss(n.id)}
            />
          ))}
        </ScrollView>
      )}
    </>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function NotificationItem({
  notification,
  onPress,
  onDismiss,
}: {
  notification: AppNotification;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const icon = NOTIFICATION_TYPE_ICON[notification.type] ?? 'bell';
  const [hovered, setHovered] = useState(false);
  // No hover on touch — the dismiss X stays visible on native instead of
  // living behind the web hover swap.
  const touch = Platform.OS !== 'web';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        !notification.read && styles.itemUnread,
        pressed && styles.itemPressed,
      ]}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      <View style={styles.itemIcon}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemTitle}>{notification.title}</Text>
        <Text style={styles.itemText}>{notification.body}</Text>
        <Text style={styles.itemTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
      {/* Web: hover swaps the unread dot for the dismiss X. The button stays
          MOUNTED while hidden: unmounting it on the row's hover-out is what
          made it vanish as the pointer reached it (the row's hover-out fires
          when the pointer crosses onto the nested button), and its own
          hover-in re-asserts the row's state. Native: the X is just always
          shown beside the dot. */}
      <View style={styles.itemRight}>
        <Pressable
          style={({ pressed, hovered: h }: {
            pressed: boolean;
            hovered?: boolean;
          }) => [
            styles.dismiss,
            !touch && !hovered && styles.dismissHidden,
            (h || pressed) && styles.dismissHover,
          ]}
          onPress={() => {
            if (touch || hovered) onDismiss();
            else onPress();
          }}
          onHoverIn={() => setHovered(true)}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Feather name="x" size={14} color={colors.textSecondary} />
        </Pressable>
        {(touch || !hovered) && !notification.read && (
          <View style={[styles.unreadDot, touch && styles.unreadDotBeside]} />
        )}
      </View>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.primary,
  },
  controlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  controlAction: {
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
  groupLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
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
  // Fixed-size slot so the dot and the (possibly hidden) dismiss button
  // occupy the same spot without layout shift on web.
  itemRight: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  // Native shows dot AND X together — nudge the dot off the button.
  unreadDotBeside: {
    left: -8,
    top: 8,
  },
  dismiss: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissHidden: {
    opacity: 0,
  },
  dismissHover: {
    backgroundColor: colors.surfaceLight,
  },
}));
