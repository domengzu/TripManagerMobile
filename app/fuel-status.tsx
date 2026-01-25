import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import ApiService from '@/services/api';
import { VehicleFuelStatus } from '@/types';

export const options = {
  headerShown: false,
};

const { width } = Dimensions.get('window');

export default function FuelStatusScreen() {
  const { vehicleId } = useLocalSearchParams();
  const [fuelStatus, setFuelStatus] = useState<VehicleFuelStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFuelStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await ApiService.getVehicleFuelStatus(Number(vehicleId));
      setFuelStatus(response);
    } catch (error: any) {
      console.error('Error loading fuel status:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to load fuel status');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [vehicleId]);

  useFocusEffect(
    useCallback(() => {
      loadFuelStatus();
    }, [loadFuelStatus])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadFuelStatus();
  };

  const getFuelLevelColor = (percentage: number) => {
    if (percentage >= 70) return '#10B981';
    if (percentage >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const handleRecordRefuel = () => {
    router.push({
      pathname: '/refuel-form',
      params: { vehicleId: vehicleId as string }
    });
  };

  const handleViewHistory = () => {
    router.push({
      pathname: '/fuel-history',
      params: { vehicleId: vehicleId as string }
    });
  };

  if (isLoading && !fuelStatus) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fuel Status</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading fuel status...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fuel Status</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color="#1F2937" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      >
        {fuelStatus && (
          <>
            {/* Vehicle Info */}
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <Icon name="car" size={28} color="#3B82F6" />
                <Text style={styles.plateNumber}>{fuelStatus.plate_number}</Text>
              </View>
              <View style={styles.fuelTypeContainer}>
                <Icon name="water" size={18} color="#6B7280" />
                <Text style={styles.fuelType}>{fuelStatus.fuel_type || 'Gasoline'}</Text>
              </View>
            </View>

            {/* Fuel Level Display */}
            <View style={styles.fuelLevelCard}>
              <Text style={styles.cardTitle}>Current Fuel Level</Text>
              
              {/* Fuel Tank Visualization */}
              <View style={styles.tankContainer}>
                <View style={styles.tank}>
                  <View 
                    style={[
                      styles.fuelFill,
                      {
                        height: `${fuelStatus.fuel_percentage}%`,
                        backgroundColor: getFuelLevelColor(fuelStatus.fuel_percentage),
                      }
                    ]}
                  />
                </View>
                <Text style={[
                  styles.percentageText,
                  { color: getFuelLevelColor(fuelStatus.fuel_percentage) }
                ]}>
                  {fuelStatus.fuel_percentage.toFixed(1)}%
                </Text>
              </View>

              {/* Fuel Details */}
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Current Level:</Text>
                  <Text style={styles.detailValue}>
                    {parseFloat(fuelStatus.current_fuel_level || '0').toFixed(1)} L
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tank Capacity:</Text>
                  <Text style={styles.detailValue}>
                    {parseFloat(fuelStatus.fuel_tank_capacity || '0').toFixed(1)} L
                  </Text>
                </View>
                {fuelStatus.estimated_range_km && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Estimated Range:</Text>
                    <Text style={styles.detailValue}>
                      ~{fuelStatus.estimated_range_km} km
                    </Text>
                  </View>
                )}
              </View>

              {/* Low Fuel Warning */}
              {fuelStatus.fuel_percentage < 25 && (
                <View style={styles.warningContainer}>
                  <Icon name="warning" size={20} color="#EF4444" />
                  <Text style={styles.warningText}>Low fuel! Please refuel soon.</Text>
                </View>
              )}
            </View>

            {/* Last Refuel Info */}
            {fuelStatus.last_refuel_date && (
              <View style={styles.lastRefuelCard}>
                <Text style={styles.cardTitle}>Last Refuel</Text>
                <View style={styles.refuelInfo}>
                  <View style={styles.refuelRow}>
                    <Icon name="calendar" size={18} color="#6B7280" />
                    <Text style={styles.refuelText}>
                      {new Date(fuelStatus.last_refuel_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  {fuelStatus.last_refuel_amount && (
                    <View style={styles.refuelRow}>
                      <Icon name="water" size={18} color="#6B7280" />
                      <Text style={styles.refuelText}>
                        {fuelStatus.last_refuel_amount.toFixed(1)} liters added
                      </Text>
                    </View>
                  )}
                  {fuelStatus.last_refuel_location && (
                    <View style={styles.refuelRow}>
                      <Icon name="location" size={18} color="#6B7280" />
                      <Text style={styles.refuelText}>
                        {fuelStatus.last_refuel_location}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRecordRefuel}
              >
                <Icon name="add-circle" size={24} color="#FFF" />
                <Text style={styles.primaryButtonText}>Record Refuel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleViewHistory}
              >
                <Icon name="time" size={24} color="#3B82F6" />
                <Text style={styles.secondaryButtonText}>Fuel History</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backButton: {
    padding: 8,
  },
  refreshButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  vehicleCard: {
    backgroundColor: '#FFF',
    margin: 16,
    marginBottom: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  plateNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 12,
  },
  fuelTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  fuelType: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  fuelLevelCard: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  tankContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  tank: {
    width: 120,
    height: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#9CA3AF',
    justifyContent: 'flex-end',
  },
  fuelFill: {
    width: '100%',
    borderRadius: 8,
  },
  percentageText: {
    fontSize: 36,
    fontWeight: '700',
    marginTop: 16,
  },
  detailsContainer: {
    marginTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#EF4444',
    marginLeft: 8,
    fontWeight: '600',
  },
  lastRefuelCard: {
    backgroundColor: '#FFF',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  refuelInfo: {
    marginTop: 8,
  },
  refuelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  refuelText: {
    fontSize: 15,
    color: '#374151',
    marginLeft: 8,
  },
  actionButtons: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
