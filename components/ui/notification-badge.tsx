import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { notificationService } from '@/services/NotificationService';

interface NotificationBadgeProps {
  size?: number;
  backgroundColor?: string;
  textColor?: string;
}

export function NotificationBadge({ 
  size = 18, 
  backgroundColor = '#C28F22', 
  textColor = '#ffffff' 
}: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let intervalId: any = null;

    const loadAndSetCount = async () => {
      try {
        // Load notifications from API to get accurate count
        await notificationService.loadNotifications();
        setUnreadCount(notificationService.getUnreadCount());
      } catch (error) {
        console.error('Failed to load notifications for badge:', error);
        // Fallback to cached count
        setUnreadCount(notificationService.getUnreadCount());
      }
    };

    // Initial load
    loadAndSetCount();

    // Subscribe to updates
    const unsubscribe = notificationService.subscribe((notifications) => {
      setUnreadCount(notifications.filter(n => !n.read).length);
    });

    // Periodically refresh count (every 2 minutes since notifications are loaded on auth)
    intervalId = setInterval(() => {
      loadAndSetCount();
    }, 120000);

    return () => {
      unsubscribe();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  if (unreadCount === 0) {
    return null;
  }

  return (
    <View style={[
      styles.badge,
      { 
        width: size, 
        height: size, 
        borderRadius: size / 2,
        backgroundColor 
      }
    ]}>
      <Text style={[
        styles.badgeText,
        { 
          color: textColor,
          fontSize: size * 0.6
        }
      ]}>
        {unreadCount > 99 ? '99+' : unreadCount.toString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 18,
    zIndex: 1,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
  },
});