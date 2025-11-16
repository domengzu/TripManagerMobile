import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NotificationBadge } from '@/components/ui/notification-badge';
import { ProfileTabIcon } from '@/components/ProfileTabIcon';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

  // Determine which tabs to show based on user role
  const userRole = user?.role || null;
  
  // Debug logging
  console.log('TabLayout - User Role:', userRole);
  console.log('TabLayout - User:', user);
  console.log('TabLayout - Is Loading:', isLoading);

  // If loading or no user (during logout), show nothing to prevent view manipulation errors
  if (isLoading || !user) {
    return null;
  }

  const tabBarStyle = {
    height: 50 + insets.bottom,
    paddingBottom: Math.max(insets.bottom, 8),
    paddingTop: 3,
    paddingHorizontal: 5,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  };

  const screenOptions = {
    tabBarActiveTintColor: '#C28F22',
    tabBarInactiveTintColor: '#000000',
    tabBarShowLabel: false,
    headerShown: false,
    tabBarButton: HapticTab,
    tabBarStyle,
    tabBarIconStyle: {
      marginTop: 4,
      marginBottom: 4,
    },
  };

  // DRIVER ROLE
  if (userRole === 'driver') {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trip Logs',
            tabBarIcon: ({ color }) => <Icon name="document-text" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="tickets"
          options={{
            title: 'Tickets',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="ticket.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="vehicles"
          options={{
            title: 'Vehicles',
            tabBarIcon: ({ color }) => <Icon name="car-sport" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <ProfileTabIcon color={color} size={24} />,
          }}
        />
        {/* Hide notifications from tab bar - now in header */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        {/* Hide screens not for drivers */}
        <Tabs.Screen name="gps-tracking" options={{ href: null }} />
        <Tabs.Screen name="travel-requests" options={{ href: null }} />
      </Tabs>
    );
  }

  // REGULAR USER ROLE
  if (userRole === 'regular') {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="gps-tracking"
          options={{
            title: 'Track Drivers',
            tabBarIcon: ({ color }) => <Icon name="navigate" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <ProfileTabIcon color={color} size={24} />,
          }}
        />
        {/* Hide notifications from tab bar - now in header */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        {/* Hide screens not for regular users */}
        <Tabs.Screen name="trips" options={{ href: null }} />
        <Tabs.Screen name="tickets" options={{ href: null }} />
        <Tabs.Screen name="vehicles" options={{ href: null }} />
        <Tabs.Screen name="travel-requests" options={{ href: null }} />
      </Tabs>
    );
  }

  // DIRECTOR ROLE
  if (userRole === 'director') {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="travel-requests"
          options={{
            title: 'Travel Requests',
            tabBarIcon: ({ color }) => <Icon name="document-text" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <ProfileTabIcon color={color} size={24} />,
          }}
        />
        {/* Hide notifications from tab bar - now in header */}
        <Tabs.Screen name="notifications" options={{ href: null }} />
        {/* Hide screens not for directors */}
        <Tabs.Screen name="trips" options={{ href: null }} />
        <Tabs.Screen name="tickets" options={{ href: null }} />
        <Tabs.Screen name="vehicles" options={{ href: null }} />
        <Tabs.Screen name="gps-tracking" options={{ href: null }} />
      </Tabs>
    );
  }

  // Default fallback (should not reach here)
  return null;
}
