import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  NOTIFICATION_TYPE_ICON,
  NotificationBodyText,
  useOpenNotification,
} from '@/components/notifications/NotificationList';
import { useAppStore, useMyNotifications } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';
import { AppNotification } from '@/types';
import { installAudioUnlock, playNotificationSound } from '@/utils/sound';

// react-native-web has no native animation module; opt out there (the animation
// still runs JS-side) to avoid the "useNativeDriver is not supported" warning.
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// How long a toast stays before it slides away on its own.
const VISIBLE_MS = 5000;

/**
 * Watches the current worker's notifications and, when a new one arrives, plays
 * a ping and pops a toast that slides in from the right and auto-dismisses. The
 * unread badge on the bell carries anything the worker doesn't acknowledge.
 *
 * Mount once inside the desktop shell so it persists across page navigation
 * (its "already shown" memory survives route changes, but resets on full reload
 * so old notifications aren't replayed as pings on every launch).
 */
export function NotificationToaster() {
  const notifications = useMyNotifications();
  const mutedTypes = useAppStore((s) => s.mutedNotificationTypes);
  const shownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const [active, setActive] = useState<AppNotification[]>([]);

  // Prime the audio context on the first user gesture so pings aren't muted by
  // the browser's autoplay policy when a notification arrives later.
  useEffect(() => {
    installAudioUnlock();
  }, []);

  useEffect(() => {
    // First pass: treat everything already present as seen — these are history,
    // not fresh arrivals, so they shouldn't ping.
    if (!initialized.current) {
      notifications.forEach((n) => shownIds.current.add(n.id));
      initialized.current = true;
      return;
    }
    const fresh = notifications.filter(
      (n) => !n.read && !shownIds.current.has(n.id)
    );
    if (fresh.length === 0) return;
    fresh.forEach((n) => shownIds.current.add(n.id));
    // Muted types are marked seen (so unmuting won't replay them) but never
    // toast or ping — they still land on the bell for the badge/panel.
    const audible = fresh.filter((n) => !mutedTypes.includes(n.type));
    if (audible.length === 0) return;
    playNotificationSound();
    setActive((prev) => [...audible, ...prev]);
  }, [notifications, mutedTypes]);

  const dismiss = (id: string) =>
    setActive((prev) => prev.filter((n) => n.id !== id));

  if (active.length === 0) return null;

  return (
    <View style={styles.stack} pointerEvents="box-none">
      {active.map((n) => (
        <NotificationToast
          key={n.id}
          notification={n}
          onDismiss={() => dismiss(n.id)}
        />
      ))}
    </View>
  );
}

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: AppNotification;
  onDismiss: () => void;
}) {
  const markRead = useAppStore((s) => s.markNotificationRead);
  // Tapping the toast body jumps to the notification's target (work request /
  // job) — same deep link as the bell rows; the X only acknowledges.
  const open = useOpenNotification();
  // 0 = off-screen/hidden, 1 = fully in. useState (not useRef) so the value can
  // be interpolated during render without tripping the refs-in-render lint rule.
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start(() => onDismiss());
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
    // Run once on mount; onDismiss is stable enough for this transient toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  // Acknowledging from the toast marks it read so it never re-counts on the bell.
  const acknowledge = () => {
    markRead(notification.id);
    onDismiss();
  };

  return (
    <Animated.View style={[styles.toast, { opacity: anim, transform: [{ translateX }] }]}>
      <Pressable
        style={styles.toastPress}
        onPress={() => {
          open(notification);
          onDismiss();
        }}
      >
        <View style={styles.toastIcon}>
          <Feather
            name={NOTIFICATION_TYPE_ICON[notification.type] ?? 'bell'}
            size={18}
            color={colors.primary}
          />
        </View>
        <View style={styles.toastBody}>
          <Text style={styles.toastTitle}>{notification.title}</Text>
          <NotificationBodyText
            notification={notification}
            style={styles.toastText}
            numberOfLines={2}
          />
        </View>
      </Pressable>
      <Pressable style={styles.toastClose} onPress={acknowledge} hitSlop={6}>
        <Feather name="x" size={16} color={colors.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = themed(() => StyleSheet.create({
  stack: {
    position: 'absolute',
    top: 76,
    right: spacing.xl,
    gap: spacing.sm,
    zIndex: 50,
  },
  toast: {
    width: 340,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
  },
  toastPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  toastIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastBody: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  toastText: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  toastClose: {
    padding: 2,
  },
}));
