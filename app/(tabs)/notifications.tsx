import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { notificationService, NotificationWithRead } from '@/services/NotificationService';
import Icon from 'react-native-vector-icons/Ionicons';
import { LoadingComponent } from '@/components/LoadingComponent';
import PushNotificationService from '@/services/PushNotificationService';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();

    // Subscribe to notification updates
    const unsubscribe = notificationService.subscribe((updatedNotifications) => {
      setNotifications(updatedNotifications);
      const count = updatedNotifications.filter(n => !n.read).length;
      setUnreadCount(count);
      // Update badge count
      PushNotificationService.setBadgeCount(count);
    });

    return unsubscribe;
  }, []);

  // Clear badge when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Clear badge count when viewing notifications
      PushNotificationService.clearBadgeCount();
    }, [])
  );

  const loadNotifications = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      // Load notifications from Laravel API
      const apiNotifications = await notificationService.loadNotifications();
      setNotifications(apiNotifications);
      setUnreadCount(notificationService.getUnreadCount());
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load notifications. Please check your connection.';
      setError(errorMessage);
      
      // Show error only if it's not a refresh (to avoid spam during pull-to-refresh)
      if (!isRefresh) {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadNotifications(true);
  };

  const markAsRead = async (notificationId: number) => {
    try {
      await notificationService.markAsRead(notificationId);
      // State will be updated automatically via subscription
    } catch (error: any) {
      console.error('Failed to mark notification as read:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to mark notification as read';
      Alert.alert('Error', errorMessage);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      // State will be updated automatically via subscription
    } catch (error: any) {
      console.error('Failed to mark all notifications as read:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to mark all notifications as read';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleNotificationPress = async (notification: NotificationWithRead) => {
    // Mark as read when tapped
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to relevant screen if trip ticket ID exists
    if (notification.data?.trip_ticket_id) {
      router.push(`/trip-ticket-details?id=${notification.data.trip_ticket_id}`);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationService.deleteNotification(notificationId);
              // State will be updated automatically via subscription
            } catch (error: any) {
              console.error('Failed to delete notification:', error);
              const errorMessage = error.response?.data?.message || error.message || 'Failed to delete notification';
              Alert.alert('Error', errorMessage);
            }
          }
        }
      ]
    );
  };

  const getNotificationIcon = (type: string) => {
    const iconName = notificationService.getNotificationIcon(type as any);
    return iconName;
  };

  const getNotificationTypeColor = (type: string) => {
    return notificationService.getNotificationColor(type as any);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const renderNotificationItem = ({ item: notification }: { item: NotificationWithRead }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !notification.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.iconContainer}>
            <Icon 
              name={getNotificationIcon(notification.type)} 
              size={20} 
              color={getNotificationTypeColor(notification.type)} 
            />
          </View>
          <View style={styles.notificationInfo}>
            <Text style={[
              styles.notificationTitle,
              !notification.read && styles.unreadTitle
            ]}>
              {notification.title}
            </Text>
            <Text style={styles.notificationTime}>
              {formatTimeAgo(notification.created_at)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteNotification(notification.id)}
          >
            <Text style={styles.deleteButtonText}>×</Text>
          </TouchableOpacity>
        </View>
        <Text style={[
          styles.notificationMessage,
          !notification.read && styles.unreadMessage
        ]}>
          {notification.message}
        </Text>
        {!notification.read && <View style={styles.unreadIndicator} />}
      </View>
    </TouchableOpacity>
  );

  if (isLoading && notifications.length === 0) {
    return (
      <LoadingComponent 
        message="Loading your notifications..." 
        color="#3E0703"
      />
    );
  }



  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Icon name="notifications-outline" size={24} color="#3E0703" />
            <Text style={styles.title}>Notifications</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      {notifications.length > 0 && unreadCount > 0 && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.markAllReadButton} onPress={markAllAsRead}>
            <Text style={styles.markAllReadText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Display */}
      {error && !isLoading && (
        <View style={styles.errorContainer}>
          <Icon name="warning-outline" size={48} color="#dc2626" style={styles.errorIcon} />
          <Text style={styles.errorText}>Connection Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadNotifications()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      {!error && notifications.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Icon name="notifications-outline" size={48} color="#9ca3af" style={styles.emptyIcon} />
          </View>
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You&apos;ll receive notifications about your trip tickets and important updates here.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : !error && notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.notificationsList}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              colors={['#3E0703']}
              tintColor="#3E0703"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5', // TripManager gray-50
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 10,
    minHeight: 60, // Ensure minimum height for content
    backgroundColor: '#FFFFFF', // TripManager primary brand color
    borderBottomWidth: 1,
    borderBottomColor: '#C28F22', // TripManager secondary brand color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703',
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  markAllReadButton: {
    alignSelf: 'flex-end',
  },
  markAllReadText: {
    fontSize: 14,
    color: '#3E0703',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  emptyIcon: {
    // Icon styling handled by react-native-vector-icons
  },
  emptyText: {
    fontSize: 18,
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#65676B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  refreshButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fef2f2',
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#dc2626',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  errorMessage: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  notificationsList: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#C28F22', // TripManager secondary brand color
    backgroundColor: '#fefefe',
  },
  notificationContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },

  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#3E0703',
  },
  notificationTime: {
    fontSize: 12,
    color: '#65676B',
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#65676B',
    fontWeight: 'bold',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#050505',
    lineHeight: 20,
  },
  unreadMessage: {
    color: '#000000',
    fontWeight: '500',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#C28F22',
  },
});
