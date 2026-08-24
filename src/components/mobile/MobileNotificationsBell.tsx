import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationList } from '@/components/notifications/NotificationList';
import { useUnreadNotificationCount } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

/**
 * The phone's notification bell — mobile previously had only the 5-second
 * toasts, so a missed toast was gone until the user opened the web console.
 * An icon-only item (no label) inside the tab bar's second island, next to
 * Settings, carrying the unread badge; tapping it opens a full-screen sheet
 * with the shared {@link NotificationList}.
 */
export function MobileNotificationsBell() {
  const unread = useUnreadNotificationCount();
  const [open, setOpen] = useState(false);
  // The sheet lives in a bare RN Modal — a separate native root with no
  // SafeAreaProvider inside it, where SafeAreaView resolves the top inset to
  // 0 and the header rides under the iOS status bar / Dynamic Island. The
  // hook reads the inset from the app's provider instead (same trick as the
  // work request sheet).
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.tabButton,
          pressed && styles.tabPressed,
        ]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
        }
      >
        {/* The badge anchors to the icon, not the (taller) touch target. */}
        <View>
          <Feather name="bell" size={22} color={colors.textSecondary} />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.sheet,
            { paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Notifications</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <NotificationList onNavigate={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}

const styles = themed(() => StyleSheet.create({
  tabButton: {
    width: 52,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: {
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
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
    color: colors.textOnAccent,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 13,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
}));
