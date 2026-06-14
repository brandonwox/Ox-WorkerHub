import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ROLE_LABELS } from '@/roles';
import { currentWorkerOf, useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing } from '@/theme';

interface Props {
  /** 'card' for the mobile Settings screen, 'bar' for the desktop top bar. */
  variant?: 'card' | 'bar';
}

/**
 * Dev-only "View as" switcher. Lets us preview every role before real auth
 * lands. Renders nothing in production builds.
 */
export function DevRoleSwitcher({ variant = 'card' }: Props) {
  const workers = useAppStore((s) => s.workers);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const current = useAppStore(currentWorkerOf);
  const [open, setOpen] = useState(false);

  if (!__DEV__) return null;

  const isBar = variant === 'bar';

  return (
    <View style={isBar ? styles.barWrap : styles.cardWrap}>
      {!isBar && (
        <Text style={styles.devLabel}>
          <Feather name="tool" size={11} color={colors.warning} /> Dev · View as
        </Text>
      )}
      <Pressable
        style={({ pressed }) => [
          isBar ? styles.barTrigger : styles.cardTrigger,
          pressed && styles.pressed,
        ]}
        onPress={() => setOpen((o) => !o)}
      >
        <View style={styles.triggerText}>
          <Text style={styles.currentName} numberOfLines={1}>
            {current.name}
          </Text>
          <Text style={styles.currentRole}>{ROLE_LABELS[current.role]}</Text>
        </View>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View style={[styles.menu, isBar && styles.menuBar]}>
          {workers.map((w) => {
            const active = w.id === current.id;
            return (
              <Pressable
                key={w.id}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={() => {
                  setCurrentUser(w.id);
                  setOpen(false);
                }}
              >
                <View style={styles.menuItemText}>
                  <Text style={styles.menuName} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={styles.menuRole}>{ROLE_LABELS[w.role]}</Text>
                </View>
                {active && (
                  <Feather name="check" size={15} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.warningDim,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  barWrap: {
    position: 'relative',
    minWidth: 200,
  },
  devLabel: {
    color: colors.warning,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  barTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  triggerText: {
    flex: 1,
  },
  currentName: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  currentRole: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  menu: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  menuBar: {
    position: 'absolute',
    top: '100%',
    right: 0,
    left: 0,
    zIndex: 50,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  menuItemPressed: {
    backgroundColor: colors.border,
  },
  menuItemText: {
    flex: 1,
  },
  menuName: {
    color: colors.textPrimary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  menuRole: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
