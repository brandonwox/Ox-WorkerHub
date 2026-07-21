import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet, View } from 'react-native';

/**
 * One video page inside the photo viewer's pager. Native playback controls
 * handle play/pause/scrub (so no tap-to-hide-details or pinch-zoom here —
 * those stay photo-only behaviors).
 */
export function VideoPage({
  uri,
  width,
  height,
}: {
  uri: string;
  width: number;
  height: number;
}) {
  const player = useVideoPlayer(uri);
  return (
    <View style={[styles.page, { width, height }]}>
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
