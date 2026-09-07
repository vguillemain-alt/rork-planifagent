import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ChangeLogEntry } from '@/types/planning';
import { API_BASE } from '@/utils/api';

const DEFAULT_TITLE = 'PlanifAgent';
const ANDROID_CHANNEL_ID = 'planning-updates';

let webPermissionRequested = false;

export async function configureNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        console.log('Web notifications are not supported in this browser');
        return;
      }

      if (!webPermissionRequested && Notification.permission === 'default') {
        webPermissionRequested = true;
        const permission = await Notification.requestPermission();
        console.log('Web notification permission:', permission);
      }

      return;
    }

    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Modifications du planning',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#3B82F6',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    console.log('Native notification permission:', status);
  } catch (error) {
    console.log('Error configuring notifications:', error);
  }
}

export async function notifyPlanningChangeAsync(entry: ChangeLogEntry): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        return;
      }

      if (Notification.permission !== 'granted') {
        return;
      }

      new Notification('Planning modifié', {
        body: entry.description,
        tag: entry.id,
      });
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') {
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Planning modifié',
        body: entry.description,
        data: {
          changeId: entry.id,
          action: entry.action,
        },
        sound: 'default',
      },
      trigger: null,
    });
  } catch (error) {
    console.log('Error sending planning notification:', error);
  }
}

export type PushRole = 'admin' | 'viewer';

/**
 * Registers the device for remote push notifications and stores the Expo
 * push token on the backend for the given role. Silently skips platforms
 * that cannot receive push tokens (web); errors on emulators or denied
 * permission are caught and logged without breaking the app.
 */
export async function registerPushTokenAsync(role: PushRole): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      return;
    }

    const permissions = await Notifications.getPermissionsAsync();
    let status = permissions.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) {
      console.log('Missing EXPO_PUBLIC_PROJECT_ID for push registration');
      return;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;

    const response = await fetch(`${API_BASE}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, role }),
    });

    if (!response.ok) {
      throw new Error(`push token registration failed: ${response.status}`);
    }

    console.log('Push token registered for role:', role);
  } catch (error) {
    console.log('Error registering push token:', error);
  }
}

export function syncWebNotificationBadge(unseenChanges: number): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  document.title = unseenChanges > 0 ? `(${unseenChanges}) ${DEFAULT_TITLE}` : DEFAULT_TITLE;

  const navigatorWithBadge = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  if (typeof navigatorWithBadge.setAppBadge === 'function' && unseenChanges > 0) {
    navigatorWithBadge.setAppBadge(unseenChanges).catch((error: unknown) => {
      console.log('Error setting app badge:', error);
    });
  }

  if (typeof navigatorWithBadge.clearAppBadge === 'function' && unseenChanges <= 0) {
    navigatorWithBadge.clearAppBadge().catch((error: unknown) => {
      console.log('Error clearing app badge:', error);
    });
  }
}
