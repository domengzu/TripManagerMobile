import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ErrorComponentProps {
  message: string;
  onRetry?: () => void;
  showRetry?: boolean;
  title?: string;
  type?: 'error' | 'warning' | 'network';
}

const { width } = Dimensions.get('window');

export const ErrorComponent: React.FC<ErrorComponentProps> = ({
  message,
  onRetry,
  showRetry = true,
  title,
  type = 'error'
}) => {
  const getIconConfig = () => {
    switch (type) {
      case 'network':
        return { name: 'wifi-off-outline', color: '#8E8E93' };
      case 'warning':
        return { name: 'warning-outline', color: '#8E8E93' };
      default:
        return { name: 'alert-circle-outline', color: '#8E8E93' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <Ionicons 
            name={iconConfig.name} 
            size={64} 
            color={iconConfig.color} 
          />
        </View>
        
        {title && (
          <Text style={styles.errorTitle}>
            {title}
          </Text>
        )}
        
        <Text style={styles.errorMessage}>{message}</Text>
        
        {showRetry && onRetry && (
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={onRetry}
            activeOpacity={0.6}
          >
            <Text style={styles.retryButtonText}>
              Try Again
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  contentContainer: {
    alignItems: 'center',
    maxWidth: width - 80,
  },
  iconContainer: {
    marginBottom: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  errorMessage: {
    fontSize: 17,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    fontWeight: '400',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minWidth: 120,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ErrorComponent;