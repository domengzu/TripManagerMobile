import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import PushNotificationService from '@/services/PushNotificationService';
import { notificationService } from '@/services/NotificationService';
import ApiService from '@/services/api';
import { TripTicket } from '@/types';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Function to check for trips scheduled for today and send notifications
  const checkAndScheduleTripNotifications = async () => {
    try {
      console.log('📅 Checking for trips scheduled for today...');
      
      // Fetch all trip tickets
      const response = await ApiService.getTripTickets({ 
        status: 'ready_for_trip',
        with_relations: true 
      });
      
      let ticketsData: TripTicket[] = [];
      if (response.trip_tickets?.data && Array.isArray(response.trip_tickets.data)) {
        ticketsData = response.trip_tickets.data;
      } else if (Array.isArray(response.trip_tickets)) {
        ticketsData = response.trip_tickets;
      } else if (Array.isArray(response)) {
        ticketsData = response;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let notificationsSent = 0;
      
      for (const ticket of ticketsData) {
        if (ticket.travelRequest?.start_date) {
          const travelDate = new Date(ticket.travelRequest.start_date);
          travelDate.setHours(0, 0, 0, 0);
          
          if (travelDate.getTime() === today.getTime()) {
            const destination = Array.isArray(ticket.travelRequest.destinations)
              ? ticket.travelRequest.destinations.join(', ')
              : ticket.travelRequest.destinations;
            
            console.log(`✅ Found trip for today: ${ticket.ticket_number} to ${destination}`);
            
            // Create both in-app and push notification
            await notificationService.createTripReadyForTodayNotification(
              ticket.id,
              ticket.ticket_number,
              destination
            );
            notificationsSent++;
          }
        }
      }
      
      if (notificationsSent > 0) {
        console.log(`🔔 Sent ${notificationsSent} notification(s) for today's trips`);
      } else {
        console.log('ℹ️ No trips scheduled for today');
      }
    } catch (error) {
      console.error('❌ Failed to check for trip notifications:', error);
    }
  };

  // Setup push notifications when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Register for push notifications (will handle Expo Go limitations gracefully)
      PushNotificationService.registerForPushNotifications().then(token => {
        if (token) {
          console.log('✅ Push notifications registered successfully');
        } else {
          console.log('ℹ️ Push notifications not available (may be using Expo Go)');
          console.log('ℹ️ Local notifications will still work for testing');
        }
      });

      // Check for trips scheduled for today immediately on app launch
      checkAndScheduleTripNotifications();
      
      // Schedule a daily notification at 6 AM to check for trips
      // This will trigger even when the app is closed
      PushNotificationService.scheduleDailyNotification(
        6, // hour (6 AM)
        0, // minute
        '🌅 Good Morning - Trip Check',
        'Checking if you have any trips scheduled for today...',
        { type: 'daily_trip_check' }
      ).then(identifier => {
        if (identifier) {
          console.log('✅ Daily 6 AM trip check notification scheduled');
        }
      });

      // Setup notification listeners (these work in Expo Go)
      notificationListener.current = Notifications.addNotificationReceivedListener(async notification => {
        console.log('🔔 Notification received in foreground:', notification);
        console.log('📦 Notification data:', notification.request.content.data);
        
        // Refresh notifications list from backend - this will trigger UI update
        try {
          await notificationService.loadNotifications();
          console.log('✅ Notifications list refreshed from backend');
        } catch (error) {
          console.error('❌ Failed to refresh notifications:', error);
        }
        
        // Update badge count
        const unreadCount = notificationService.getUnreadCount();
        await PushNotificationService.setBadgeCount(unreadCount);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
        console.log('👆 Notification tapped:', response);
        console.log('📦 Tap data:', response.notification.request.content.data);
        
        const data = response.notification.request.content.data as Record<string, any>;
        
        // Mark notification as read if notification_id is present
        if (data.notification_id && typeof data.notification_id === 'number') {
          try {
            await notificationService.markAsRead(data.notification_id);
            console.log('✅ Notification marked as read:', data.notification_id);
          } catch (error) {
            console.error('❌ Failed to mark notification as read:', error);
          }
        }
        
        // Refresh notifications when tapped
        try {
          await notificationService.loadNotifications();
        } catch (error) {
          console.error('Failed to refresh notifications on tap:', error);
        }
        
        // If it's a daily trip check notification, check for trips now
        if (data.type === 'daily_trip_check') {
          console.log('📅 Daily trip check notification tapped - checking for trips...');
          await checkAndScheduleTripNotifications();
          router.push('/(tabs)/tickets');
          return;
        }
        
        // Navigate to relevant screen based on notification type
        // Handle trip ready notifications from server
        if (data.type === 'trip_ready_today' && data.ticket_id) {
          console.log('🚗 Trip ready notification tapped - navigating to trip details:', data.ticket_id);
          router.push(`/trip-ticket-details?id=${data.ticket_id}`);
          return;
        }
        
        // Handle trip ticket notifications (general)
        if (data.trip_ticket_id) {
          router.push(`/trip-ticket-details?id=${data.trip_ticket_id}`);
        } else if (data.ticket_id) {
          // Handle server-side notifications that use ticket_id instead of trip_ticket_id
          router.push(`/trip-ticket-details?id=${data.ticket_id}`);
        } else {
          router.push('/(tabs)/notifications');
        }
      });

      return () => {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      };
    } else {
      // Clear badge count when not authenticated
      PushNotificationService.clearBadgeCount();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inPublicRoute = ['login', 'register'].includes(segments[0]);
    const inProtectedRoute = ['trip-ticket-details', 'vehicle-form', 'trip-log-form', 'trip-log-history', 'modal'].includes(segments[0]);

    if (!isAuthenticated && !inPublicRoute) {
      // Redirect to login if not authenticated and trying to access protected routes
      router.replace('/login');
    } else if (isAuthenticated && inPublicRoute) {
      // Redirect to main app if authenticated and on public routes
      router.replace('/(tabs)');
    }
    // Allow authenticated users to access tabs group and other protected routes
  }, [isAuthenticated, segments, isLoading]);

  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(screens)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="trip-ticket-details" options={{ headerShown: false }} />
        <Stack.Screen name="trip-log-history" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle-form" options={{ headerShown: false }} />
        <Stack.Screen name="trip-log-form" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
