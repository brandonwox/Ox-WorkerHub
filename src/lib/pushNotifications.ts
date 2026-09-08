import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSupabase } from '@/integrations/supabase/client';

/**
 * Phone push registration. On sign-in the app asks for notification
 * permission, fetches this install's Expo push token (a free identifier for
 * one app install on one phone — no quota), and upserts it into
 * public.push_tokens for the signed-in worker; the push-notification Edge
 * Function reads that table to know where to send. Sign-out deletes the row
 * (before the session ends, since the row is RLS-owned by the worker).
 *
 * Skipped entirely on web, on simulators, and in Expo Go (which can't receive
 * remote pushes since SDK 53) — every step is best-effort and never throws
 * into the UI.
 */

/** The token this install registered (so sign-out can remove exactly it). */
let registeredToken: string | null = null;

/** Whether this runtime can register for remote pushes at all. */
export function pushSupported(): boolean {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;
  // Expo Go can't receive remote pushes (SDK 53+); installed builds can.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return false;
  }
  return true;
}

/**
 * How a push presents while the app is in the FOREGROUND: the in-app toaster
 * already shows the same notification, so no duplicate banner — it still
 * lands in the system tray list so it can be found later.
 */
export function configureForegroundPresentation(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask permission (first time only), fetch the Expo push token, and store it
 * for `workerId`. Returns the token, or null when unsupported / declined.
 */
export async function registerPushToken(workerId: string): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    if (Platform.OS === 'android') {
      // The channel the Edge Function targets (channelId: 'default').
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Ox WorkerHub',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!token) return null;

    const { error } = await getSupabase().from('push_tokens').upsert(
      {
        token,
        worker_id: workerId,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );
    if (error) {
      console.warn('Push token registration failed:', error.message);
      return null;
    }
    registeredToken = token;
    return token;
  } catch (e) {
    console.warn('Push registration skipped:', e);
    return null;
  }
}

/** Remove this install's token (call BEFORE signing out — the row is RLS-owned). */
export async function unregisterPushToken(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await getSupabase().from('push_tokens').delete().eq('token', token);
  } catch (e) {
    console.warn('Push token removal failed:', e);
  }
}
