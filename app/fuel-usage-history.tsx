import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import ApiService from '@/services/api';
import { LoadingComponent } from '@/components/LoadingComponent';

interface FuelRecord {
  id: number;
  vehicle_id: number;
  date: string;
  amount: string;
  fuel_type: string;
  type: 'add' | 'usage';
  odometer?: number;
  purpose?: string;
  created_at: string;
}

export default function FuelUsageHistoryScreen() {
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchFuelRecords();
  }, []);

  const fetchFuelRecords = async () => {
    try {
      setIsLoading(true);
      console.log('📥 Fetching fuel records...');
      const data = await ApiService.getFuelRecords();
      console.log('📦 Fuel records response:', data);
      
      // Handle different response structures
      let records = [];
      if (Array.isArray(data)) {
        records = data;
      } else if (data.fuel_records && Array.isArray(data.fuel_records)) {
        records = data.fuel_records;
      } else if (data.data && Array.isArray(data.data)) {
        records = data.data;
      }
      
      console.log(`✅ Loaded ${records.length} fuel records`);
      setFuelRecords(records);
    } catch (error) {
      console.error('Failed to fetch fuel records:', error);
      setFuelRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const data = await ApiService.getFuelRecords();
      
      let records = [];
      if (Array.isArray(data)) {
        records = data;
      } else if (data.fuel_records && Array.isArray(data.fuel_records)) {
        records = data.fuel_records;
      } else if (data.data && Array.isArray(data.data)) {
        records = data.data;
      }
      
      setFuelRecords(records);
    } catch (error) {
      console.error('Failed to refresh fuel records:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getFuelTypeColor = (fuelType: string) => {
    switch (fuelType.toLowerCase()) {
      case 'petrol':
      case 'gasoline':
        return '#10b981';
      case 'diesel':
        return '#3b82f6';
      case 'electric':
        return '#8b5cf6';
      case 'hybrid':
        return '#f59e0b';
      case 'lpg':
        return '#ef4444';
      default:
        return '#65676B';
    }
  };

  const calculateTotals = () => {
    const totalAdded = fuelRecords
      .filter(r => r.type === 'add')
      .reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
    
    const totalUsed = fuelRecords
      .filter(r => r.type === 'usage')
      .reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0);
    
    const balance = totalAdded - totalUsed;

    return { totalAdded, totalUsed, balance };
  };

  const renderFuelRecord = ({ item: record }: { item: FuelRecord }) => {
    const amount = parseFloat(record.amount || '0');
    const isUsage = record.type === 'usage';
    
    return (
      <View 
        style={[
          styles.recordCard,
          isUsage && styles.usageCard
        ]}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordHeaderLeft}>
            <Icon 
              name={isUsage ? "remove-circle" : "add-circle"} 
              size={20} 
              color={isUsage ? "#ef4444" : "#10b981"} 
            />
            <View style={styles.recordHeaderText}>
              <Text style={styles.recordType}>
                {isUsage ? 'Fuel Usage' : 'Fuel Added'}
              </Text>
              <Text style={styles.recordDate}>{formatDate(record.date)}</Text>
            </View>
          </View>
          <View style={[
            styles.fuelTypeBadge, 
            { backgroundColor: getFuelTypeColor(record.fuel_type) }
          ]}>
            <Text style={styles.fuelTypeBadgeText}>{record.fuel_type}</Text>
          </View>
        </View>

        <View style={styles.recordBody}>
          <View style={styles.recordAmountContainer}>
            <Text style={[
              styles.recordAmount,
              { color: isUsage ? '#ef4444' : '#10b981' }
            ]}>
              {isUsage ? '-' : '+'}{amount.toFixed(2)} L
            </Text>
          </View>

          <View style={styles.recordDetails}>
            {record.odometer && (
              <View style={styles.detailRow}>
                <Icon name="speedometer-outline" size={16} color="#6b7280" />
                <Text style={styles.detailLabel}>Odometer:</Text>
                <Text style={styles.detailValue}>
                  {record.odometer.toLocaleString()} km
                </Text>
              </View>
            )}
            {record.purpose && (
              <View style={styles.detailRow}>
                <Icon name="document-text-outline" size={16} color="#6b7280" />
                <Text style={styles.detailLabel}>Purpose:</Text>
                <Text style={styles.detailValue}>{record.purpose}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <LoadingComponent 
        message="Loading fuel history..." 
        color="#3E0703"
      />
    );
  }

  const { totalAdded, totalUsed, balance } = calculateTotals();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#3E0703" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Icon name="water" size={24} color="#3E0703" />
            <Text style={styles.headerTitle}>Fuel Usage History</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#ecfdf5' }]}>
          <Icon name="add-circle" size={24} color="#10b981" />
          <Text style={styles.summaryLabel}>Total Added</Text>
          <Text style={[styles.summaryValue, { color: '#10b981' }]}>
            {totalAdded.toFixed(2)} L
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#fef2f2' }]}>
          <Icon name="remove-circle" size={24} color="#ef4444" />
          <Text style={styles.summaryLabel}>Total Used</Text>
          <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
            {totalUsed.toFixed(2)} L
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: '#fef3c7' }]}>
          <Icon name="water" size={24} color="#C28F22" />
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.summaryValue, { color: '#3E0703' }]}>
            {balance.toFixed(2)} L
          </Text>
        </View>
      </View>

      {/* Records List */}
      {fuelRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="water-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Fuel Records</Text>
          <Text style={styles.emptyText}>
            Your fuel usage history will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={fuelRecords}
          renderItem={renderFuelRecord}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
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
      )}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  
  // Header
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C28F22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703',
  },
  headerRight: {
    width: 40,
  },

  // Summary Cards
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Record Card (matching trip card style)
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  usageCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  recordHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  recordHeaderText: {
    flex: 1,
  },
  recordType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E0703',
  },
  recordDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  fuelTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fuelTypeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recordBody: {
    gap: 12,
  },
  recordAmountContainer: {
    alignItems: 'flex-start',
  },
  recordAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  recordDetails: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    width: 90,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});
