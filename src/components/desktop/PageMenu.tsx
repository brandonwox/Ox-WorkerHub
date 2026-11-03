import { Link } from 'expo-router';
import { Check, ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { DropdownPortal } from '@/components/desktop/DropdownPortal';
import { DesktopNavItem } from '@/roles';
import { colors, fonts, modalShadow, radii, spacing, themed } from '@/theme';

interface Props {
  /** This role's pages, in menu order. */
  items: DesktopNavItem[];
  /** The page being shown — its icon and name make up the trigger. */
  title: string;
  icon: LucideIcon;
  /** The menu row to mark as current (none on a page outside the menu, e.g. Settings). */
  activeHref?: string;
}

/**
 * The top bar's page switcher — what replaced the left sidebar. The current
 * page's icon and name are the button (a chevron and a hover highlight make it
 * read as a dropdown); it opens a compact card just under the bar's bottom
 * edge listing this role's pages — icon and name on one line, a tick at the
 * right of the current one. Only the hovered row takes a highlight; the
 * current row is told apart by its tick and stronger text, so two rows never
 * light up at once. Rows are real links, so a middle-click or cmd-click
 * still opens the page in a new tab.
 */
export function PageMenu({ items, title, icon: Icon, activeHref }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const anchorRef = useRef<View>(null);
  const lit = hovered || open;
  const Chevron = open ? ChevronUp : ChevronDown;

  // Web: Escape closes the menu (outside clicks are handled by the portal).
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <View ref={anchorRef} style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. Switch page`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [
          styles.trigger,
          (lit || pressed) && styles.triggerLit,
        ]}
      >
        <Icon size={20} color={colors.textPrimary} strokeWidth={2} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Chevron
          size={18}
          color={lit ? colors.textPrimary : colors.textTertiary}
          strokeWidth={2}
        />
      </Pressable>

      <DropdownPortal
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        align="left"
        minWidth={224}
        offset={spacing.sm}
      >
        <View style={styles.menu}>
          {items.map((item) => (
            <PageMenuItem
              key={item.href}
              item={item}
              active={item.href === activeHref}
              onSelect={() => setOpen(false)}
            />
          ))}
        </View>
      </DropdownPortal>
    </View>
  );
}

function PageMenuItem({
  item,
  active,
  onSelect,
}: {
  item: DesktopNavItem;
  active: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;
  const strong = active || hovered;
  return (
    <Link href={item.href} asChild>
      {/* `asChild` merges props through Radix Slot, which SPREADS the child's
          `style`, so it must be one flat object: a Pressable style function
          spreads to `{}` (every row style lost — icon, name and tick stacked
          in a column) and an array to `{0: …}` (react-dom throws setting
          style[0]). Hence the flatten, and hover tracked by hand. */}
      <Pressable
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={onSelect}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={StyleSheet.flatten([styles.item, hovered && styles.itemHovered])}
      >
        <Icon
          size={16}
          color={strong ? colors.textPrimary : colors.textSecondary}
          strokeWidth={2}
        />
        <Text
          style={[styles.itemLabel, strong && styles.itemLabelStrong]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {/* The tick keeps its slot on every row so names line up and the
            current row's tick sits flush right. */}
        <View style={styles.tick}>
          {active && (
            <Check size={15} color={colors.primary} strokeWidth={2.5} />
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = themed(() => StyleSheet.create({
  // Spans the bar's height so the portal measures the bar's bottom edge as
  // the anchor's bottom, and the menu opens under the bar instead of inside
  // it.
  wrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    flexShrink: 1,
  },
  // Icon · name · chevron in a rounded button; the highlight shows on hover
  // and while the menu is open.
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  triggerLit: {
    backgroundColor: colors.surfaceLight,
  },
  title: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    ...modalShadow,
  },
  // One line per page: 16pt icon, 14pt name, tick slot; 36pt tall.
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm + 1,
    // Concentric with the card: its radius less its padding.
    borderRadius: radii.md - spacing.xs,
  },
  // Only the hovered row takes a background; the current row is marked by
  // its tick and stronger text instead, so two rows never light up at once.
  itemHovered: {
    backgroundColor: colors.surfaceLight,
  },
  itemLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  itemLabelStrong: {
    color: colors.textPrimary,
    fontFamily: fonts.semiBold,
  },
  tick: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
