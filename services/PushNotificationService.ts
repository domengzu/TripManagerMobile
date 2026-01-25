import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './api';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Shows notification banner at the top
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowList: true,   // Shows notification in notification list
  }),
});

export interface PushNotificationData {
  notification_id?: number;
  trip_ticket_id?: number;
  travel_request_id?: number;
  type?: string;
  [key: string]: any;
}

class PushNotificationService {
  private static instance: PushNotificationService;
  private fcmToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Setup Android notification channels
   */
  private async setupAndroidChannels() {
    // High priority channel for important notifications (heads-up display)
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Notifications',
      importance: Notifications.AndroidImportance.MAX, // MAX = heads-up notification
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3E0703',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      bypassDnd: false,
    });

    // High priority channel for trip notifications (heads-up display)
    await Notifications.setNotificationChannelAsync('trip-updates', {
      name: 'Trip Updates',
      importance: Notifications.AndroidImportance.MAX, // MAX = heads-up notification
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3E0703',
      sound: 'default',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      description: 'Notifications for trip ticket updates and assignments',
    });

    console.log('✅ Android notification channels configured for heads-up display');
  }

  /**
   * Register for push notifications using Expo Push Tokens
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Check if running on a physical device
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications require a physical device');
        return null;
      }

      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('⚠️ Push notification permissions not granted');
        return null;
      }

      console.log('✅ Push notification permissions granted');

      // Get Expo Push Token
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'e1b00319-5b81-40c9-8d01-065a0313572d', // Your EAS project ID
        });
        
        const token = tokenData.data;

        if (!token) {
          console.error('❌ Failed to get Expo Push Token');
          return null;
        }

        this.fcmToken = token;
        console.log('✅ Expo Push Token obtained:', this.fcmToken);

        // Store token locally
        await AsyncStorage.setItem('expoPushToken', this.fcmToken);

        // Send token to backend
        await this.sendTokenToBackend(this.fcmToken);

        // Configure notification channels for Android
        if (Platform.OS === 'android') {
          await this.setupAndroidChannels();
        }

        return this.fcmToken;
      } catch (error: any) {
        console.error('❌ Error getting Expo Push Token:', error);
        return null;
      }
    } catch (error: any) {
      console.error('❌ Error registering for push notifications:', error.message || error);
      return null;
    }
  }

  /**
   * Send push token to Laravel backend
   */
  private async sendTokenToBackend(token: string): Promise<void> {
    try {
      await apiService.registerPushToken(token, Platform.OS);
      console.log('Push token registered with backend');
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
    }
  }

  /**
   * Setup notification listeners
   */
  setupNotificationListeners(
    onNotificationReceived?: (notification: Notifications.Notification) => void,
    onNotificationResponse?: (response: Notifications.NotificationResponse) => void
  ) {
    // Listener for notifications received while app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );

    // Listener for notification interactions (tapped)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    );
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners() {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
  }

  /**
   * Schedule a daily notification at a specific time
   */
  async scheduleDailyNotification(
    hour: number,
    minute: number,
    title: string,
    body: string,
    data?: PushNotificationData
  ) {
    try {
      // Cancel any existing daily notifications first
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const scheduled of allScheduled) {
        if (scheduled.content.data?.type === 'daily_trip_check') {
          await Notifications.cancelScheduledNotificationAsync(scheduled.identifier);
        }
      }

      // Schedule daily notification
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {}, // Use empty object if no data provided
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      console.log(`📅 Daily notification scheduled for ${hour}:${minute} - ID: ${identifier}`);
      return identifier;
    } catch (error) {
      console.error('Error scheduling daily notification:', error);
      return null;
    }
  }

  /**
   * Schedule a local notification (for testing)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: PushNotificationData,
    seconds: number = 0
  ) {
    try {
      const trigger = seconds > 0 ? { seconds } : null;
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
        },
        trigger: trigger as any, // Type assertion for trigger
      });
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get notification badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set notification badge count
   */
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear badge count
   */
  async clearBadgeCount() {
    await Notifications.setBadgeCountAsync(0);
  }

  /**
   * Get the current push token
   */
  getPushToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Unregister push token from backend
   */
  async unregisterPushToken(): Promise<void> {
    try {
      if (this.fcmToken) {
        await apiService.unregisterPushToken(this.fcmToken);
        await AsyncStorage.removeItem('fcmToken');
        this.fcmToken = null;
        console.log('Push token unregistered from backend');
      }
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }
}

export default PushNotificationService.getInstance();
