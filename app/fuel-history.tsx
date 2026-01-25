import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import ApiService from '@/services/api';

export const options = {
  headerShown: false,
};

interface RefuelRecord {
  id: number;
  vehicle_id: number;
  liters_added: number;
  cost: number | null;
  fuel_type: string | null;
  refuel_date: string;
  location: string | null;
  odometer_reading: number | null;
  gas_station: string | null;
  pos_control_number: string | null;
  notes: string | null;
  created_at: string;
}

interface Vehicle {
  id: number;
  plate_number: string;
  model: string;
  fuel_tank_capacity?: number;
  current_fuel_level?: number;
}

export default function FuelHistoryScreen() {
  const params = useLocalSearchParams();
  const vehicleId = params.vehicleId as string;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<RefuelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load vehicle info
      const vehicles = await ApiService.getDriverVehicles();
      const found = vehicles.find((v: Vehicle) => v.id === parseInt(vehicleId));
      
      if (found) {
        setVehicle(found);
      }

      // Load fuel history
      const history = await ApiService.getVehicleFuelHistory(parseInt(vehicleId));
      setRecords(history.data || history.refuel_records?.data || []);
    } catch (error) {
      console.error('Failed to load fuel history:', error);
      Alert.alert('Error', 'Failed to load fuel history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderRecord = ({ item }: { item: RefuelRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.recordIconContainer}>
          <Icon name="water" size={18} color="#2563EB" />
        </View>
        <View style={styles.recordHeaderContent}>
          <Text style={styles.recordAmount}>{parseFloat(item.liters_added || '0').toFixed(1)} L</Text>
          <Text style={styles.recordDate}>
            {formatDate(item.refuel_date)} • {formatTime(item.refuel_date)}
          </Text>
        </View>
        {item.cost && (
          <Text style={styles.recordCost}>₱{parseFloat(item.cost || '0').toFixed(2)}</Text>
        )}
      </View>

      {(item.location || item.gas_station) && (
        <View style={styles.recordDetails}>
          {item.gas_station && (
            <View style={styles.recordDetailRow}>
              <Icon name="business" size={14} color="#6B7280" />
              <Text style={styles.recordDetailText}>{item.gas_station}</Text>
            </View>
          )}
          {item.location && (
            <View style={styles.recordDetailRow}>
              <Icon name="location" size={14} color="#6B7280" />
              <Text style={styles.recordDetailText}>{item.location}</Text>
            </View>
          )}
        </View>
      )}

      {item.odometer_reading && (
        <View style={styles.recordFooter}>
          <Icon name="speedometer" size={12} color="#9CA3AF" />
          <Text style={styles.recordFooterText}>
            {item.odometer_reading.toLocaleString()} km
          </Text>
        </View>
      )}

      {item.pos_control_number && (
        <View style={styles.recordFooter}>
          <Icon name="receipt" size={12} color="#9CA3AF" />
          <Text style={styles.recordFooterText}>{item.pos_control_number}</Text>
        </View>
      )}

      {item.notes && (
        <View style={styles.recordNotes}>
          <Text style={styles.recordNotesText}>{item.notes}</Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="water-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Fuel Records</Text>
      <Text style={styles.emptySubtitle}>
        No refueling history available for this vehicle
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3E0703" />
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Fuel History</Text>
          {vehicle && (
            <Text style={styles.headerSubtitle}>{vehicle.plate_number}</Text>
          )}
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{records.length}</Text>
        </View>
      </View>

      {/* Summary Card */}
      {vehicle && records.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Refuels</Text>
            <Text style={styles.summaryValue}>{records.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Liters</Text>
            <Text style={styles.summaryValue}>
              {records.reduce((sum, r) => sum + parseFloat(r.liters_added || '0'), 0).toFixed(1)} L
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Cost</Text>
            <Text style={styles.summaryValue}>
              ₱{records.reduce((sum, r) => sum + parseFloat(r.cost || '0'), 0).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Records List */}
      <FlatList
        data={records}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 6,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recordHeaderContent: {
    flex: 1,
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  recordDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  recordCost: {
    fontSize: 15,
    fontWeight: '600',
    color: '#059669',
  },
  recordDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  recordDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordDetailText: {
    fontSize: 13,
    color: '#374151',
  },
  recordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  recordFooterText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  recordNotes: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  recordNotesText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
