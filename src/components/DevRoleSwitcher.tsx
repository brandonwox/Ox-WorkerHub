import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { ROLE_LABELS } from '@/roles';
import { currentWorkerOf, useAppStore, useIsDeveloper } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

interface Props {
  /** 'card' for the mobile Settings screen, 'bar' for the desktop top bar. */
  variant?: 'card' | 'bar';
}

/**
 * "View as" switcher. Available ONLY to the Developer role (the base identity) —
 * it impersonates the other roles for the UI. Renders nothing for everyone else.
 */
export function DevRoleSwitcher({ variant = 'card' }: Props) {
  const workers = useAppStore((s) => s.workers);
  const setViewAs = useAppStore((s) => s.setViewAs);
  const current = useAppStore(currentWorkerOf);
  const isDeveloper = useIsDeveloper();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<View>(null);

  if (!isDeveloper || !current) return null;

  // You impersonate real roles — never the Developer itself.
  const viewTargets = workers.filter((w) => w.role !== 'developer');
  const isBar = variant === 'bar';

  const items = viewTargets.map((w) => {
    const active = w.id === current.id;
    return (
      <Pressable
        key={w.id}
        style={({ pressed }) => [
          styles.menuItem,
          pressed && styles.menuItemPressed,
        ]}
        onPress={() => {
          setViewAs(w.id);
          setOpen(false);
        }}
      >
        <View style={styles.menuItemText}>
          <Text style={styles.menuName} numberOfLines={1}>
            {w.name}
          </Text>
          <Text style={styles.menuRole}>{ROLE_LABELS[w.role]}</Text>
        </View>
        {active && <Feather name="check" size={15} color={colors.primary} />}
      </Pressable>
    );
  });

  return (
    <View ref={wrapRef} style={isBar ? styles.barWrap : styles.cardWrap}>
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

      {isBar ? (
        <DropdownPortal
          anchorRef={wrapRef}
          open={open}
          onClose={() => setOpen(false)}
        >
          <View style={styles.menu}>{items}</View>
        </DropdownPortal>
      ) : (
        open && <View style={styles.menu}>{items}</View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
}));
