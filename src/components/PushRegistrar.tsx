import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  configureForegroundPresentation,
  registerPushToken,
} from '@/lib/pushNotifications';
import { useAppStore } from '@/store/useAppStore';
import { AppNotification, NotificationType } from '@/types';
import { notificationTarget } from '@/utils/notificationNav';

/**
 * Mounted once in the root layout (native only — renders nothing). Registers
 * the device for phone pushes whenever a real worker is signed in, and routes
 * a TAP on a push to the same screen the in-app notification opens (the
 * work request, the job, …) via utils/notificationNav — both for a tap while
 * the app is running and for the tap that launched it.
 */
export function PushRegistrar() {
  const authWorker = useAppStore((s) => s.authWorker);
  const router = useRouter();
  // The response that launched a cold-started app (null while running).
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseIds = useRef(new Set<string>());

  // Foreground presentation rule, once.
  useEffect(() => {
    configureForegroundPresentation();
  }, []);

  // Register (or re-register) for the signed-in worker.
  useEffect(() => {
    if (Platform.OS === 'web' || !authWorker) return;
    void registerPushToken(authWorker.id);
  }, [authWorker?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tap → open the notification's destination.
  const open = (response: Notifications.NotificationResponse) => {
    const key = response.notification.request.identifier;
    if (handledResponseIds.current.has(key)) return;
    handledResponseIds.current.add(key);
    const data = (response.notification.request.content.data ?? {}) as Record<
      string,
      unknown
    >;
    const role = useAppStore.getState().authWorker?.role ?? null;
    const shaped: AppNotification = {
      id: typeof data.notificationId === 'string' ? data.notificationId : key,
      recipientId: authWorker?.id ?? '',
      type: (typeof data.type === 'string' ? data.type : 'schedule_change') as NotificationType,
      title: response.notification.request.content.title ?? '',
      body: response.notification.request.content.body ?? '',
      data,
      read: true,
      createdAt: new Date().toISOString(),
    };
    if (typeof shaped.id === 'string' && data.notificationId) {
      useAppStore.getState().markNotificationRead(shaped.id);
    }
    const target = notificationTarget(shaped, role);
    if (target) {
      router.push({ pathname: target.pathname as never, params: target.params });
    }
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [authWorker?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Platform.OS === 'web' || !lastResponse || !authWorker) return;
    open(lastResponse);
  }, [lastResponse, authWorker?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
