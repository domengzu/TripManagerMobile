import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import PushNotificationService from '@/services/PushNotificationService';
import { notificationService } from '@/services/NotificationService';

/**
 * Push Notification Test Screen
 * 
 * This screen helps test push notification functionality.
 * Add this to your app for testing purposes.
 * 
 * To use:
 * 1. Import this component in any screen
 * 2. Or create a new screen route for it
 */
export default function PushNotificationTestScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const pushToken = await PushNotificationService.registerForPushNotifications();
      setToken(pushToken);
      if (pushToken) {
        Alert.alert('Success', `Registered! Token: ${pushToken.substring(0, 20)}...`);
      } else {
        Alert.alert('Error', 'Failed to register. Are you on a physical device?');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetToken = () => {
    const currentToken = PushNotificationService.getPushToken();
    setToken(currentToken);
    if (currentToken) {
      Alert.alert('Current Token', currentToken);
    } else {
      Alert.alert('No Token', 'No push token registered yet');
    }
  };

  const handleSendTestNotification = async () => {
    try {
      await PushNotificationService.scheduleLocalNotification(
        'Test Notification',
        'This is a test push notification from TripManager',
        { test: true, trip_ticket_id: 1 },
        3
      );
      Alert.alert('Scheduled', 'Test notification will appear in 3 seconds');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSendImmediateNotification = async () => {
    try {
      await PushNotificationService.scheduleLocalNotification(
        'Immediate Test',
        'This notification appears immediately',
        { test: true },
        0
      );
      Alert.alert('Sent', 'Notification sent immediately');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleLoadNotifications = async () => {
    try {
      await notificationService.loadNotifications();
      Alert.alert('Success', 'Notifications refreshed from server');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleGetBadgeCount = async () => {
    try {
      const count = await PushNotificationService.getBadgeCount();
      Alert.alert('Badge Count', `Current badge count: ${count}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSetBadge = async () => {
    try {
      await PushNotificationService.setBadgeCount(5);
      Alert.alert('Success', 'Badge count set to 5');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleClearBadge = async () => {
    try {
      await PushNotificationService.clearBadgeCount();
      Alert.alert('Success', 'Badge count cleared');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleUnregister = async () => {
    try {
      await PushNotificationService.unregisterPushToken();
      setToken(null);
      Alert.alert('Success', 'Push token unregistered from backend');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Push Notification Test</Text>
        <Text style={styles.subtitle}>Test push notification functionality</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Registration</Text>
        <Button
          title={loading ? 'Registering...' : 'Register for Push Notifications'}
          onPress={handleRegister}
          disabled={loading}
        />
        <View style={styles.spacer} />
        <Button title="Get Current Token" onPress={handleGetToken} />
        <View style={styles.spacer} />
        <Button title="Unregister Token" onPress={handleUnregister} color="#dc2626" />
      </View>

      {token && (
        <View style={styles.tokenContainer}>
          <Text style={styles.tokenLabel}>Current Token:</Text>
          <Text style={styles.tokenText} numberOfLines={3}>
            {token}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        <Button
          title="Send Test Notification (3s delay)"
          onPress={handleSendTestNotification}
        />
        <View style={styles.spacer} />
        <Button
          title="Send Immediate Notification"
          onPress={handleSendImmediateNotification}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badge Management</Text>
        <Button title="Get Badge Count" onPress={handleGetBadgeCount} />
        <View style={styles.spacer} />
        <Button title="Set Badge to 5" onPress={handleSetBadge} />
        <View style={styles.spacer} />
        <Button title="Clear Badge" onPress={handleClearBadge} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server Integration</Text>
        <Button
          title="Refresh Notifications from Server"
          onPress={handleLoadNotifications}
        />
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>Testing Instructions:</Text>
        <Text style={styles.instructionsText}>
          1. Click "Register for Push Notifications"{'\n'}
          2. Grant permissions when prompted{'\n'}
          3. Copy the token and test at expo.dev/notifications{'\n'}
          4. Use "Send Test Notification" to test local notifications{'\n'}
          5. Create a trip ticket from another account to test real notifications
        </Text>
      </View>

      <View style={styles.notes}>
        <Text style={styles.notesTitle}>Notes:</Text>
        <Text style={styles.notesText}>
          • Push notifications only work on physical devices{'\n'}
          • Simulators/emulators are not supported{'\n'}
          • Token is automatically sent to backend when registered{'\n'}
          • Check Laravel logs for backend integration status
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#3E0703',
    borderBottomWidth: 2,
    borderBottomColor: '#C28F22',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
  },
  section: {
    padding: 20,
    backgroundColor: '#ffffff',
    marginTop: 12,
    borderRadius: 8,
    marginHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  spacer: {
    height: 10,
  },
  tokenContainer: {
    padding: 20,
    backgroundColor: '#f3f4f6',
    marginTop: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tokenLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  tokenText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  instructions: {
    padding: 20,
    backgroundColor: '#e0f2fe',
    marginTop: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#075985',
    lineHeight: 22,
  },
  notes: {
    padding: 20,
    backgroundColor: '#fef3c7',
    marginTop: 12,
    marginBottom: 40,
    borderRadius: 8,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: '#fde047',
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#713f12',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 22,
  },
});
