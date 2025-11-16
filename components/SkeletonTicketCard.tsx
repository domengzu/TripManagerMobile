import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export const SkeletonTicketCard: React.FC = () => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.skeletonTicketNumber, { opacity }]} />
        <View style={styles.statusContainer}>
          <Animated.View style={[styles.skeletonBadge, { opacity }]} />
          <Animated.View style={[styles.skeletonProcurement, { opacity }]} />
        </View>
      </View>

      {/* Requestor Section */}
      <View style={styles.requestorSection}>
        <Animated.View style={[styles.skeletonAvatar, { opacity }]} />
        <View style={styles.requestorInfo}>
          <Animated.View style={[styles.skeletonName, { opacity }]} />
          <Animated.View style={[styles.skeletonDepartment, { opacity }]} />
        </View>
      </View>

      {/* Purpose */}
      <View style={styles.purposeSection}>
        <Animated.View style={[styles.skeletonLabel, { opacity }]} />
        <Animated.View style={[styles.skeletonPurpose, { opacity }]} />
        <Animated.View style={[styles.skeletonPurposeShort, { opacity }]} />
      </View>

      {/* Destination */}
      <View style={styles.destinationSection}>
        <Animated.View style={[styles.skeletonDestinationLabel, { opacity }]} />
        <Animated.View style={[styles.skeletonDestination, { opacity }]} />
      </View>

      {/* Dates */}
      <View style={styles.datesSection}>
        <View style={styles.dateItem}>
          <Animated.View style={[styles.skeletonDateLabel, { opacity }]} />
          <Animated.View style={[styles.skeletonDateValue, { opacity }]} />
        </View>
        <View style={styles.dateItem}>
          <Animated.View style={[styles.skeletonDateLabel, { opacity }]} />
          <Animated.View style={[styles.skeletonDateValue, { opacity }]} />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Animated.View style={[styles.skeletonFooterText, { opacity }]} />
        <Animated.View style={[styles.skeletonFooterText, { opacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonTicketNumber: {
    width: 120,
    height: 20,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skeletonBadge: {
    width: 100,
    height: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  skeletonProcurement: {
    width: 24,
    height: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  requestorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    marginRight: 12,
  },
  requestorInfo: {
    flex: 1,
  },
  skeletonName: {
    width: '60%',
    height: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 6,
  },
  skeletonDepartment: {
    width: '40%',
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  purposeSection: {
    marginBottom: 12,
  },
  skeletonLabel: {
    width: 60,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 6,
  },
  skeletonPurpose: {
    width: '100%',
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 4,
  },
  skeletonPurposeShort: {
    width: '70%',
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  destinationSection: {
    marginBottom: 12,
  },
  skeletonDestinationLabel: {
    width: 80,
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 4,
  },
  skeletonDestination: {
    width: '85%',
    height: 14,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  datesSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateItem: {
    flex: 1,
  },
  skeletonDateLabel: {
    width: 80,
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    marginBottom: 4,
  },
  skeletonDateValue: {
    width: 90,
    height: 13,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  skeletonFooterText: {
    width: 100,
    height: 11,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
  },
});
