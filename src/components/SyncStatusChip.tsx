import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { colors, fonts, radii, spacing, themed } from '@/theme';

interface Props {
  /**
   * 'floating' overlays the mobile tabs (top-right, under the status bar);
   * 'sidebar' sits inline in the desktop sidebar's system area.
   */
  variant: 'floating' | 'sidebar';
}

/**
 * Live sync status: shows when the device is offline (changes are parking in
 * the on-device queue) or when queued changes are still uploading. Hidden
 * entirely when online with nothing pending — silence means all synced.
 */
export function SyncStatusChip({ variant }: Props) {
  const isOnline = useAppStore((s) => s.isOnline);
  const pendingWrites = useAppStore((s) => s.pendingWriteCount);
  const pendingPhotoCount = useAppStore((s) => s.pendingPhotos.length);
  const insets = useSafeAreaInsets();

  const pending = pendingWrites + pendingPhotoCount;
  if (isOnline && pending === 0) return null;

  const offline = !isOnline;
  const label = offline
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? '' : 's'} saved on device`
      : 'Offline — changes save to this device'
    : `Syncing ${pending} change${pending === 1 ? '' : 's'}…`;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.chip,
        offline ? styles.chipOffline : styles.chipSyncing,
        variant === 'floating' && [
          styles.floating,
          { top: insets.top + spacing.sm },
        ],
      ]}
    >
      <Feather
        name={offline ? 'cloud-off' : 'upload-cloud'}
        size={13}
        color={offline ? colors.warning : colors.primary}
      />
      <Text
        style={[
          styles.label,
          { color: offline ? colors.warning : colors.primary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipOffline: {
    backgroundColor: colors.warningDim,
    borderColor: colors.warning,
  },
  chipSyncing: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  floating: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 60,
    backgroundColor: colors.surface,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
  },
  label: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
}));
