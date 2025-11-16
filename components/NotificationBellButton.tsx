import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NotificationBadge } from '@/components/ui/notification-badge';

interface NotificationBellButtonProps {
  color?: string;
  size?: number;
}

export const NotificationBellButton: React.FC<NotificationBellButtonProps> = ({ 
  color = '#3E0703', 
  size = 24 
}) => {
  const handlePress = () => {
    router.push('/notifications');
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      style={styles.container}
      activeOpacity={0.7}
    >
      <View style={{ position: 'relative' }}>
        <IconSymbol size={size} name="bell.fill" color={color} />
        <NotificationBadge />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    marginRight: 4,
  },
});
