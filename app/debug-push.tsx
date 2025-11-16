import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import PushNotificationService from '@/services/PushNotificationService';
import { Ionicons } from '@expo/vector-icons';

export default function PushNotificationDebugScreen() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [isDevice, setIsDevice] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    // Check if physical device
    setIsDevice(Device.isDevice);

    // Check permissions
    const { status } = await Notifications.getPermissionsAsync();
    setPermissions(status);

    // Get current token
    const token = PushNotificationService.getPushToken();
    setPushToken(token);
  };

  const requestPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissions(status);
      if (status === 'granted') {
        Alert.alert('Success', 'Push notification permissions granted!');
      } else {
        Alert.alert('Error', 'Push notification permissions denied');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const registerForPushNotifications = async () => {
    try {
      Alert.alert('Registering...', 'Please wait...');
      const token = await PushNotificationService.registerForPushNotifications();
      setPushToken(token);
      if (token) {
        Alert.alert('Success', `Token registered!\n\n${token.substring(0, 50)}...`);
      } else {
        Alert.alert('Warning', 'No token obtained. Check console logs for details.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const sendTestLocalNotification = async () => {
    try {
      await PushNotificationService.scheduleLocalNotification(
        '🧪 Test Notification',
        'This is a local test notification from the app!',
        { test: true },
        0 // Immediate
      );
      Alert.alert('Success', 'Local notification sent! You should see it appear.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const sendTestDelayedNotification = async () => {
    try {
      await PushNotificationService.scheduleLocalNotification(
        '⏰ Delayed Test',
        'This notification was scheduled 5 seconds ago!',
        { test: true, delayed: true },
        5
      );
      Alert.alert('Success', 'Notification scheduled for 5 seconds from now.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const copyTokenToClipboard = () => {
    if (pushToken) {
      // Note: You'll need to install expo-clipboard for this to work
      Alert.alert('Token', pushToken);
    }
  };

  const StatusItem = ({ label, value, status }: any) => {
    const getStatusColor = () => {
      if (status === 'success') return '#27ae60';
      if (status === 'error') return '#e74c3c';
      return '#95a5a6';
    };

    return (
      <View style={styles.statusItem}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={[styles.statusValue, { color: getStatusColor() }]}>{value}</Text>
      </View>
    );
  };

  const ActionButton = ({ title, onPress, icon, color = '#3498db' }: any) => (
    <TouchableOpacity 
      style={[styles.actionButton, { backgroundColor: color }]} 
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color="white" style={styles.buttonIcon} />
      <Text style={styles.actionButtonText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="notifications" size={48} color="#3498db" />
          <Text style={styles.title}>Push Notification Debugger</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Status</Text>
          <StatusItem 
            label="Device Type" 
            value={isDevice ? '✅ Physical Device' : '❌ Emulator/Simulator'}
            status={isDevice ? 'success' : 'error'}
          />
          <StatusItem 
            label="Permissions" 
            value={permissions === 'granted' ? '✅ Granted' : permissions || '❌ Not Granted'}
            status={permissions === 'granted' ? 'success' : 'error'}
          />
          <StatusItem 
            label="Push Token" 
            value={pushToken ? '✅ Registered' : '❌ Not Registered'}
            status={pushToken ? 'success' : 'error'}
          />
        </View>

        {pushToken && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎫 Your Push Token</Text>
            <TouchableOpacity 
              style={styles.tokenContainer}
              onPress={copyTokenToClipboard}
            >
              <Text style={styles.tokenText} numberOfLines={3}>
                {pushToken}
              </Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Tap to view full token</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Actions</Text>
          
          {permissions !== 'granted' && (
            <ActionButton
              title="Request Permissions"
              icon="shield-checkmark"
              onPress={requestPermissions}
              color="#9b59b6"
            />
          )}

          <ActionButton
            title="Register for Push Notifications"
            icon="log-in"
            onPress={registerForPushNotifications}
            color="#3498db"
          />

          <ActionButton
            title="Send Test Local Notification"
            icon="notifications-outline"
            onPress={sendTestLocalNotification}
            color="#27ae60"
          />

          <ActionButton
            title="Send Delayed Notification (5s)"
            icon="time-outline"
            onPress={sendTestDelayedNotification}
            color="#f39c12"
          />

          <ActionButton
            title="Refresh Status"
            icon="refresh"
            onPress={checkStatus}
            color="#16a085"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💡 Troubleshooting</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              • Make sure you're using a physical device{'\n'}
              • Expo Go doesn't support push notifications in SDK 53+{'\n'}
              • Use a development build: npx expo run:android{'\n'}
              • Check that permissions are granted{'\n'}
              • Verify your backend is running and accessible{'\n'}
              • Check console logs for detailed error messages
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Testing Backend</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              To test push notifications from your backend:{'\n\n'}
              1. Make sure your push token is registered{'\n'}
              2. Run: php test-push.php [user_id]{'\n'}
              3. You should receive a test notification{'\n\n'}
              The test script is located in your Laravel root folder.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    color: '#2c3e50',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  statusLabel: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  tokenContainer: {
    backgroundColor: '#ecf0f1',
    padding: 15,
    borderRadius: 8,
    marginBottom: 5,
  },
  tokenText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#2c3e50',
  },
  hint: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonIcon: {
    marginRight: 10,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 22,
  },
});
