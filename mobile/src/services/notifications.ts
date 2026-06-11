import { Platform, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import messaging from '@react-native-firebase/messaging';
import { apiFetch } from './api';

async function getFcmToken(): Promise<string | null> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      return null;
    }

    return messaging().getToken();
  } catch {
    return null;
  }
}

export async function registerForPushNotifications() {
  try {
    const token = await getFcmToken();
    if (!token) return;

    const user = auth().currentUser;
    if (!user) return;

    try {
      await apiFetch('/notifications/register-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch {
      // Silently fail if backend not configured
    }
  } catch {
    // Silently fail
  }
}

export async function unregisterPushNotifications() {
  try {
    const user = auth().currentUser;
    if (!user) return;
    await apiFetch('/notifications/register-token', { method: 'DELETE' });
  } catch {
    // Silently fail
  }
}

export function onMessageReceived(callback: (remoteMessage: any) => void) {
  return messaging().onMessage(callback);
}

export function onBackgroundMessageReceived(callback: (remoteMessage: any) => void) {
  return messaging().setBackgroundMessageHandler(callback);
}

export async function getInitialNotification() {
  try {
    return messaging().getInitialNotification();
  } catch {
    return null;
  }
}
