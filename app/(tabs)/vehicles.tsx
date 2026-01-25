import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '@/contexts/AuthContext';
import Icon from 'react-native-vector-icons/Ionicons';
import ApiService from '@/services/api';
import { LoadingComponent } from '@/components/LoadingComponent';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SuccessModal } from '@/components/SuccessModal';
import { useModals } from '@/hooks/useModals';
import { NotificationBellButton } from '@/components/NotificationBellButton';

const { width } = Dimensions.get('window');

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Van', 'Truck', 'Bus', 'Motorcycle', 'Car', 'Other'];
const FUEL_TYPES = ['Gasoline', 'Diesel', 'Hybrid'];
const CAPACITY_OPTIONS = [2, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 40, 50];

// Generate years from 1990 to current year + 1
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear + 1 - i);

interface Vehicle {
  id: number;
  driver_id: number;
  plate_number: string;
  type: string;
  model: string;
  year: number;
  capacity: number;
  fuel_type?: string;
  color?: string;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
  status_notes?: string;
  fuel_tank_capacity?: number;
  current_fuel_level?: number;
  last_refuel_date?: string;
  last_refuel_location?: string;
  license_restriction?: string;
  active_trip?: {
    id: number;
    status: string;
    driver_name: string;
    driver_id: number;
    destination: string;
    departure_time: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface FuelRecord {
  id: string | number; // Can be "refuel-1" or "fuel-1" from API
  vehicle_id: number;
  driver_id: number;
  date: string;
  amount: number;
  fuel_type: string;
  type?: 'add' | 'usage'; // Type of fuel record
  purpose?: string | null; // Purpose/reason for the record
  created_at: string;
  updated_at: string;
  vehicle?: Vehicle;
}

export default function VehiclesScreen() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [fuelActionType, setFuelActionType] = useState<'add' | 'usage'>('add'); // Track if adding fuel or recording usage
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Vehicle['status'] | null>(null);
  const [statusNotes, setStatusNotes] = useState('');

  // Check if driver can manage fuel for this vehicle based on license restrictions
  const canManageFuel = (vehicle: Vehicle): boolean => {
    // Debug logging
    console.log('🔍 Checking fuel management access:', {
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.plate_number,
      vehicleRestriction: vehicle.license_restriction,
      driverLicenseType: user?.license_type,
      driverName: user?.name
    });

    // If no license restriction or 'Any', anyone can manage
    if (!vehicle.license_restriction || vehicle.license_restriction === 'Any') {
      console.log('✅ Vehicle has no restriction or Any - access granted');
      return true;
    }
    
    // If driver has no license type, they can't manage restricted vehicles
    if (!user?.license_type) {
      console.log('❌ Driver has no license_type - access denied');
      return false;
    }
    
    // Check if driver's license matches vehicle restriction
    const hasAccess = user.license_type === vehicle.license_restriction;
    console.log(hasAccess ? '✅ License match - access granted' : '❌ License mismatch - access denied');
    return hasAccess;
  };
  const {
    confirmationState,
    successState,
    showConfirmation,
    hideConfirmation,
    showSuccess,
    hideSuccess
  } = useModals();

  // Removed form states - drivers cannot add/edit vehicles

  // Fuel records state
  const [fuelRecords, setFuelRecords] = useState<FuelRecord[]>([]);

  // Fuel form state
  const [fuelFormData, setFuelFormData] = useState(() => {
    // Initialize with today's date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    return {
      date: todayString,
      amount: '',
      fuel_type: 'Gasoline',
      purpose: '', // For usage tracking
      odometer: '', // Optional odometer reading
    };
  });

  useEffect(() => {
    loadVehicles();
  }, []);

  // Auto-refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Vehicles tab focused - refreshing data');
      loadVehicles(true);
    }, [])
  );

  const loadVehicles = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      console.log('🚗 Loading vehicles...');
      const response = await ApiService.getDriverVehicles();
      console.log('📦 Raw API response:', response);
      
      // Handle response - drivers can view all vehicles
      const vehiclesData = Array.isArray(response) ? response : (response.vehicles || []);
      console.log('🚙 Processed vehicles data:', vehiclesData);
      console.log('📊 Number of vehicles:', vehiclesData.length);
      
      // Sort vehicles: your active trips at top, then matching license, then others
      const sortedVehicles = vehiclesData.sort((a: Vehicle, b: Vehicle) => {
        const aHasMyTrip = a.active_trip?.driver_id === user?.id;
        const bHasMyTrip = b.active_trip?.driver_id === user?.id;
        const aCanManage = !a.license_restriction || a.license_restriction === 'Any' || a.license_restriction === user?.license_type;
        const bCanManage = !b.license_restriction || b.license_restriction === 'Any' || b.license_restriction === user?.license_type;
        
        // Priority 1: Your active trips first
        if (aHasMyTrip && !bHasMyTrip) return -1;
        if (!aHasMyTrip && bHasMyTrip) return 1;
        
        // Priority 2: If both have your trips or neither, sort by license match
        if (aCanManage && !bCanManage) return -1;
        if (!aCanManage && bCanManage) return 1;
        
        // Priority 3: If same license access, sort by plate number
        return a.plate_number.localeCompare(b.plate_number);
      });
      
      console.log('✅ Sorted vehicles (your trips → matching license → others)');
      
      // Debug: Check fuel data for each vehicle
      sortedVehicles.forEach((v: any) => {
        console.log(`🔍 Vehicle ${v.plate_number}:`, {
          id: v.id,
          fuel_tank_capacity: v.fuel_tank_capacity,
          current_fuel_level: v.current_fuel_level,
          last_refuel_date: v.last_refuel_date
        });
      });
      
      setVehicles(sortedVehicles);
      
      // Load fuel records if there are vehicles
      if (vehiclesData.length > 0) {
        try {
          const fuelRecordsResponse = await ApiService.getFuelRecords();
          console.log('🔥 Fuel records API response:', fuelRecordsResponse);
          console.log('🔥 Number of fuel records:', fuelRecordsResponse?.length || 0);
          
          // Debug: Log each record's type
          if (Array.isArray(fuelRecordsResponse)) {
            fuelRecordsResponse.forEach((r: any, idx: number) => {
              console.log(`  Record ${idx + 1}: ID=${r.id}, Type=${r.type}, Amount=${r.amount}, Date=${r.date}`);
            });
          }
          
          setFuelRecords(fuelRecordsResponse);
        } catch (fuelError) {
          console.error('Failed to load fuel records:', fuelError);
        }
      } else {
        setFuelRecords([]);
        console.log('⚠️ No vehicles found in the system');
      }
    } catch (error: any) {
      console.error('❌ Failed to load vehicles:', error);
      console.error('Error details:', error.response?.data);
      showConfirmation({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to load vehicles data. Please try again.',
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadVehicles(true);
  };

  // Removed add/edit modal functions - drivers cannot add/edit vehicles

  const openStatusModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedStatus(null);
    setStatusNotes('');
    setShowStatusModal(true);
  };

  const openFuelModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    // Always set today's date and reset form when opening the modal
    const today = new Date();
    // Ensure we get the correct date by using local date components
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    setFuelFormData({
      date: todayString,
      amount: '',
      fuel_type: 'Gasoline',
      purpose: '',
      odometer: '',
    });
    setFuelActionType('add'); // Default to add fuel
    setShowFuelModal(true);
  };

  const openUsageModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    // Set today's date for usage tracking
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;

    setFuelFormData({
      date: todayString,
      amount: '',
      fuel_type: 'Gasoline',
      purpose: '',
      odometer: '',
    });
    setFuelActionType('usage'); // Set to usage tracking
    setShowFuelModal(true);
  };

  // Removed handleAddVehicle and handleUpdateVehicle - drivers cannot add/edit vehicles

  const handleStatusSelection = (status: Vehicle['status']) => {
    if (status === 'Maintenance' || status === 'Out of Service') {
      setSelectedStatus(status);
      setStatusNotes('');
    } else {
      handleUpdateStatus(status, '');
    }
  };

  const confirmStatusWithNotes = () => {
    if (selectedStatus) {
      handleUpdateStatus(selectedStatus, statusNotes);
      setSelectedStatus(null);
      setStatusNotes('');
    }
  };

  const handleUpdateStatus = async (newStatus: Vehicle['status'], notes: string = '') => {
    if (!selectedVehicle) return;

    try {
      setIsSubmitting(true);

      // Include all required vehicle fields along with status update
      const updateData = {
        plate_number: selectedVehicle.plate_number,
        type: selectedVehicle.type,
        model: selectedVehicle.model,
        year: selectedVehicle.year,
        capacity: selectedVehicle.capacity,
        fuel_type: selectedVehicle.fuel_type,
        color: selectedVehicle.color,
        status: newStatus,
        status_notes: notes || null,
      };
      
      console.log('Updating vehicle status to:', newStatus);
      console.log('Sending data:', updateData);
      
      await ApiService.updateDriverVehicle(selectedVehicle.id, updateData);
      
      showSuccess({
        title: 'Status Updated',
        message: 'Vehicle status has been updated successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      setShowStatusModal(false);
      setSelectedVehicle(null);
      loadVehicles();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      
      // Log the full error for debugging
      console.error('Full update error:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          (error.response?.data?.errors ? 
                           Object.values(error.response.data.errors).flat().join(', ') : 
                           'Failed to update status');
      showConfirmation({
        title: 'Error',
        message: errorMessage,
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFuelSubmit = async () => {
    if (!selectedVehicle) return;

    try {
      setIsSubmitting(true);

      console.log('=== FUEL SUBMIT DEBUG ===');
      console.log('fuelActionType:', fuelActionType);
      console.log('fuelFormData:', fuelFormData);

      // Validate form
      if (!fuelFormData.date || !fuelFormData.amount || !fuelFormData.fuel_type) {
        showConfirmation({
          title: 'Validation Error',
          message: 'Please fill in all required fields.',
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
        return;
      }

      // For usage tracking, purpose is required
      if (fuelActionType === 'usage' && !fuelFormData.purpose?.trim()) {
        showConfirmation({
          title: 'Validation Error',
          message: 'Please enter the purpose/reason for fuel usage.',
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
        return;
      }

      const amount = parseFloat(fuelFormData.amount);
      if (isNaN(amount) || amount <= 0) {
        showConfirmation({
          title: 'Validation Error',
          message: 'Please enter a valid fuel amount.',
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
        return;
      }

      const fuelData = {
        vehicle_id: selectedVehicle.id,
        date: fuelFormData.date,
        amount: amount, // Send positive amount, backend will handle negation for usage
        fuel_type: fuelFormData.fuel_type,
        purpose: fuelFormData.purpose || null,
        odometer: fuelFormData.odometer ? parseFloat(fuelFormData.odometer) : null,
        type: fuelActionType, // 'add' or 'usage'
      };

      console.log('=== FUEL DATA TO SEND ===');
      console.log('fuelData:', fuelData);
      console.log('type field:', fuelData.type);

      await ApiService.createFuelRecord(fuelData);

      showSuccess({
        title: fuelActionType === 'usage' ? 'Fuel Usage Recorded' : 'Fuel Record Added',
        message: fuelActionType === 'usage' 
          ? 'Fuel usage has been recorded successfully!' 
          : 'Fuel record has been added successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });

      setShowFuelModal(false);
      setSelectedVehicle(null);
      // Reset form
      setFuelFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        fuel_type: 'Gasoline',
        purpose: '',
        odometer: '',
      });
      // Reload fuel records
      loadVehicles();
    } catch (error: any) {
      console.error('Failed to add fuel record:', error);
      const errorMessage = error.response?.data?.message ||
                          (error.response?.data?.errors ?
                           Object.values(error.response.data.errors).flat().join(', ') :
                           'Failed to add fuel record');
      showConfirmation({
        title: 'Error',
        message: errorMessage,
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: Vehicle['status']) => {
    switch (status) {
      case 'Available':
        return '#10b981';
      case 'In Use':
        return '#f59e0b';
      case 'Maintenance':
        return '#ef4444';
      case 'Out of Service':
        return '#65676B';
      default:
        return '#65676B';
    }
  };

  const getStatusIcon = (status: Vehicle['status']) => {
    switch (status) {
      case 'Available':
        return 'checkmark-circle';
      case 'In Use':
        return 'car-sport';
      case 'Maintenance':
        return 'construct';
      case 'Out of Service':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const getVehicleTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'car':
        return 'car-sport';
      case 'truck':
        return 'car';
      case 'van':
        return 'car-outline';
      case 'bus':
        return 'bus';
      default:
        return 'car-sport';
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
        return '#10b981'; // green
      case 'diesel':
        return '#3b82f6'; // blue
      case 'electric':
        return '#8b5cf6'; // purple
      case 'hybrid':
        return '#f59e0b'; // amber
      case 'lpg':
        return '#ef4444'; // red
      default:
        return '#65676B'; // gray
    }
  };

  if (isLoading) {
    return (
      <LoadingComponent 
        message="Loading vehicles..." 
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
            <Icon name="car-sport" size={24} color="#3E0703" />
            <Text style={styles.title}>Vehicles</Text>
            {vehicles.length > 0 && (
              <View style={styles.vehicleCountBadge}>
                <Text style={styles.vehicleCountText}>{vehicles.length}</Text>
              </View>
            )}
          </View>
          <NotificationBellButton color="#3E0703" size={26} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={isRefreshing} 
            onRefresh={handleRefresh}
            colors={['#3E0703']}
            tintColor="#3E0703"
          />
        }
      >
        {vehicles.length > 0 ? (
          <>
            {/* Fleet Statistics */}
            <View style={styles.statsCard}>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Icon name="car-sport" size={16} color="#3E0703" />
                  <Text style={styles.statValue}>{vehicles.length}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.statValue}>
                    {vehicles.filter(v => v.status === 'Available').length}
                  </Text>
                  <Text style={styles.statLabel}>Available</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="construct" size={16} color="#f59e0b" />
                  <Text style={styles.statValue}>
                    {vehicles.filter(v => v.status === 'Maintenance').length}
                  </Text>
                  <Text style={styles.statLabel}>Maintenance</Text>
                </View>
              </View>
            </View>

            {/* Vehicles List */}
            {vehicles.map((vehicle) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                <View style={styles.vehicleHeader}>
                  <View style={styles.vehicleHeaderContent}>
                    <Icon name={getVehicleTypeIcon(vehicle.type)} size={24} color="#C28F22" />
                    <View style={styles.vehicleHeaderText}>
                      <Text style={styles.vehicleTitle}>{vehicle.plate_number}</Text>
                      <Text style={styles.vehicleSubtitle}>{vehicle.model} • {vehicle.year}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(vehicle.status) }]}>
                      <Text style={styles.statusText}>{vehicle.status}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.vehicleContent}>
                  <View style={styles.vehicleDetailsGrid}>
                    <View style={styles.vehicleDetailItem}>
                      <Text style={styles.detailLabel}>Type</Text>
                      <Text style={styles.detailValue}>{vehicle.type}</Text>
                    </View>
                    <View style={styles.vehicleDetailItem}>
                      <Text style={styles.detailLabel}>Capacity</Text>
                      <Text style={styles.detailValue}>{vehicle.capacity}</Text>
                    </View>
                    <View style={styles.vehicleDetailItem}>
                      <Text style={styles.detailLabel}>Fuel</Text>
                      <Text style={styles.detailValue}>{vehicle.fuel_type || 'N/A'}</Text>
                    </View>
                    {vehicle.color && (
                      <View style={styles.vehicleDetailItem}>
                        <Text style={styles.detailLabel}>Color</Text>
                        <Text style={styles.detailValue}>{vehicle.color}</Text>
                      </View>
                    )}
                  </View>

                  {/* Fuel Level Indicator */}
                  <View style={styles.fuelIndicatorContainer}>
                    <View style={styles.fuelIndicatorHeader}>
                      <View style={styles.fuelIndicatorLabelRow}>
                        <Icon name="water" size={14} color="#3b82f6" />
                        <Text style={styles.fuelIndicatorLabel}>Fuel Level</Text>
                      </View>
                      {vehicle.fuel_tank_capacity && vehicle.current_fuel_level !== null && vehicle.current_fuel_level !== undefined ? (
                        <Text style={styles.fuelIndicatorValue}>
                          {parseFloat(vehicle.current_fuel_level.toString()).toFixed(1)}L / {parseFloat(vehicle.fuel_tank_capacity.toString()).toFixed(0)}L
                        </Text>
                      ) : (
                        <Text style={styles.fuelIndicatorValueEmpty}>No fuel data</Text>
                      )}
                    </View>
                    {vehicle.fuel_tank_capacity && vehicle.current_fuel_level !== null && vehicle.current_fuel_level !== undefined ? (
                      <>
                        <View style={styles.fuelProgressBar}>
                          <View 
                            style={[
                              styles.fuelProgressFill, 
                              { 
                                width: `${Math.min(100, (parseFloat(vehicle.current_fuel_level.toString()) / parseFloat(vehicle.fuel_tank_capacity.toString())) * 100)}%`,
                                backgroundColor: 
                                  (parseFloat(vehicle.current_fuel_level.toString()) / parseFloat(vehicle.fuel_tank_capacity.toString())) > 0.5 
                                    ? '#10b981' 
                                    : (parseFloat(vehicle.current_fuel_level.toString()) / parseFloat(vehicle.fuel_tank_capacity.toString())) > 0.25 
                                      ? '#f59e0b' 
                                      : '#ef4444'
                              }
                            ]} 
                          />
                        </View>
                        <Text style={styles.fuelPercentageText}>
                          {((parseFloat(vehicle.current_fuel_level.toString()) / parseFloat(vehicle.fuel_tank_capacity.toString())) * 100).toFixed(0)}% remaining
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.fuelEmptyMessage}>
                        Add fuel records to track fuel level
                      </Text>
                    )}
                  </View>

                  {/* Active Trip Indicator */}
                  {vehicle.active_trip && (
                    <View style={[
                      styles.activeTripIndicator,
                      vehicle.active_trip.driver_id === user?.id ? styles.myActiveTripIndicator : styles.otherActiveTripIndicator
                    ]}>
                      <View style={styles.activeTripHeader}>
                        <Icon 
                          name={vehicle.active_trip.driver_id === user?.id ? "checkmark-circle" : "car"} 
                          size={16} 
                          color={vehicle.active_trip.driver_id === user?.id ? "#059669" : "#6B7280"} 
                        />
                        <Text style={[
                          styles.activeTripTitle,
                          vehicle.active_trip.driver_id === user?.id ? styles.myActiveTripTitle : styles.otherActiveTripTitle
                        ]}>
                          {vehicle.active_trip.driver_id === user?.id ? '🚗 Your Active Trip' : 'Active Trip (Other Driver)'}
                        </Text>
                      </View>
                      <View style={styles.activeTripInfo}>
                        {vehicle.active_trip.driver_id !== user?.id && (
                          <View style={styles.activeTripRow}>
                            <Icon name="person" size={14} color="#6B7280" />
                            <Text style={styles.activeTripLabel}>Driver:</Text>
                            <Text style={styles.activeTripValue}>{vehicle.active_trip.driver_name}</Text>
                          </View>
                        )}
                        <View style={styles.activeTripRow}>
                          <Icon name="navigate" size={14} color="#6B7280" />
                          <Text style={styles.activeTripLabel}>To:</Text>
                          <Text style={styles.activeTripValue} numberOfLines={1}>{vehicle.active_trip.destination}</Text>
                        </View>
                        <View style={styles.activeTripRow}>
                          <Icon name="ticket" size={14} color="#6B7280" />
                          <Text style={styles.activeTripLabel}>Trip #:</Text>
                          <Text style={styles.activeTripValue}>{vehicle.active_trip.id}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {vehicle.status_notes && (
                    <View style={styles.statusNotesDisplay}>
                      <Icon name="information-circle" size={16} color="#65676B" />
                      <Text style={styles.statusNotesText}>{vehicle.status_notes}</Text>
                    </View>
                  )}

                  <View style={styles.vehicleActions}>
                    <TouchableOpacity 
                      style={styles.statusButton} 
                      onPress={() => openStatusModal(vehicle)}
                    >
                      <Icon name="refresh" size={16} color="#10b981" />
                      <Text style={styles.statusButtonText}>Status</Text>
                    </TouchableOpacity>
                    
                    {canManageFuel(vehicle) ? (
                      <TouchableOpacity 
                        style={styles.fuelButton} 
                        onPress={() => router.push({
                          pathname: '/fuel-status',
                          params: { vehicleId: vehicle.id.toString() }
                        })}
                      >
                        <Icon name="water" size={16} color="#3b82f6" />
                        <Text style={styles.fuelButtonText}>Fuel</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.fuelButtonDisabled}>
                        <Icon name="lock-closed" size={16} color="#9CA3AF" />
                        <Text style={styles.fuelButtonDisabledText}>Fuel</Text>
                      </View>
                    )}
                  </View>
                  
                  {!canManageFuel(vehicle) && vehicle.license_restriction && vehicle.license_restriction !== 'Any' && (
                    <View style={styles.licenseRestrictionNotice}>
                      <Icon name="information-circle" size={14} color="#F59E0B" />
                      <Text style={styles.licenseRestrictionText}>
                        Requires {vehicle.license_restriction} license to manage fuel
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* Fuel Records Card */}
            <View style={styles.fuelCard}>
              <View style={styles.fuelHeader}>
                <View style={styles.fuelHeaderContent}>
                  <Icon name="water" size={24} color="#f59e0b" />
                  <View style={styles.fuelHeaderText}>
                    <Text style={styles.fuelTitle}>Fuel Management</Text>
                    <Text style={styles.fuelSubtitle}>
                      {fuelRecords.length} record{fuelRecords.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Fuel Summary */}
              {fuelRecords.length > 0 && (
                <View style={styles.fuelSummary}>
                  <View style={styles.fuelSummaryItem}>
                    <Icon name="add-circle" size={20} color="#10b981" />
                    <View style={styles.fuelSummaryText}>
                      <Text style={styles.fuelSummaryLabel}>Total Added</Text>
                      <Text style={[styles.fuelSummaryValue, { color: '#10b981' }]}>
                        +{fuelRecords.filter((r: any) => r.type === 'add')
                          .reduce((sum, record) => sum + (parseFloat(record.amount?.toString() || '0') || 0), 0).toFixed(2)} L
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fuelSummaryDivider} />
                  <View style={styles.fuelSummaryItem}>
                    <Icon name="remove-circle" size={20} color="#ef4444" />
                    <View style={styles.fuelSummaryText}>
                      <Text style={styles.fuelSummaryLabel}>Total Used</Text>
                      <Text style={[styles.fuelSummaryValue, { color: '#ef4444' }]}>
                        -{fuelRecords.filter((r: any) => r.type === 'usage')
                          .reduce((sum, record) => sum + (parseFloat(record.amount?.toString() || '0') || 0), 0).toFixed(2)} L
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fuelSummaryDivider} />
                  <View style={styles.fuelSummaryItem}>
                    <Icon name="speedometer" size={20} color="#3b82f6" />
                    <View style={styles.fuelSummaryText}>
                      <Text style={styles.fuelSummaryLabel}>Balance</Text>
                      <Text style={[styles.fuelSummaryValue, { color: '#3b82f6', fontWeight: 'bold' }]}>
                        {fuelRecords.reduce((sum, record: any) => {
                          const amount = parseFloat(record.amount?.toString() || '0') || 0;
                          return record.type === 'usage' ? sum - amount : sum + amount;
                        }, 0).toFixed(2)} L
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.fuelContent}>
                {fuelRecords.length > 0 ? (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {fuelRecords.map((record: any) => {
                      const amount = parseFloat(record.amount?.toString() || '0');
                      const isUsage = record.type === 'usage';
                      
                      // Debug logging
                      console.log('🔍 Rendering fuel record:', {
                        id: record.id,
                        type: record.type,
                        isUsage,
                        amount,
                        purpose: record.purpose
                      });
                      
                      return (
                        <View key={record.id} style={[
                          styles.fuelRecordItem,
                          isUsage && styles.fuelRecordItemConsumption
                        ]}>
                          <View style={{ flex: 1 }}>
                            <View style={styles.fuelRecordHeader}>
                              <View style={styles.fuelRecordDateContainer}>
                                <Icon 
                                  name={isUsage ? "remove-circle" : "add-circle"} 
                                  size={16} 
                                  color={isUsage ? "#ef4444" : "#10b981"} 
                                />
                                <Text style={styles.fuelRecordDate}>{formatDate(record.date)}</Text>
                              </View>
                              <View style={[styles.fuelTypeBadge, { backgroundColor: getFuelTypeColor(record.fuel_type) }]}>
                                <Text style={styles.fuelTypeBadgeText}>{record.fuel_type}</Text>
                              </View>
                            </View>
                            {record.purpose && (
                              <Text style={styles.fuelRecordPurpose}>{record.purpose}</Text>
                            )}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[
                              styles.fuelRecordAmount,
                              { color: isUsage ? '#ef4444' : '#10b981' }
                            ]}>
                              {isUsage ? '-' : '+'}{amount.toFixed(2)} L
                            </Text>
                            <Text style={[
                              styles.fuelRecordLabel,
                              { color: isUsage ? '#ef4444' : '#10b981' }
                            ]}>
                              {isUsage ? 'Usage' : (amount > 50 ? 'Issued/Purchased' : 'Added')}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.noFuelRecords}>
                    <Icon name="water-outline" size={48} color="#d1d5db" />
                    <Text style={styles.noFuelText}>No fuel records yet</Text>
                    <Text style={styles.noFuelSubtext}>Add your first fuel record to track consumption</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        ) : (
          /* No Vehicle State */
          <View style={styles.noVehicleCard}>
            <View style={styles.noVehicleContent}>
              <View style={styles.noVehicleIcon}>
                <Icon name="car-sport-outline" size={64} color="#C28F22" />
              </View>
              <Text style={styles.noVehicleTitle}>No Vehicle Assigned</Text>
              <Text style={styles.noVehicleText}>
                You don&apos;t have a vehicle assigned yet. Please contact your administrator.
              </Text>
            </View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowStatusModal(false)}>
              <Icon name="close" size={24} color="#050505" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Vehicle Status</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.statusModalDescription}>
              Current status: <Text style={{ fontWeight: 'bold', color: getStatusColor(selectedVehicle?.status || 'Available') }}>{selectedVehicle?.status}</Text>
            </Text>
            
            {!selectedStatus ? (
              <>
                <View style={styles.statusOptions}>
                  {(['Available', 'Maintenance', 'Out of Service'] as Vehicle['status'][]).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        selectedVehicle?.status === status && styles.statusOptionSelected
                      ]}
                      onPress={() => handleStatusSelection(status)}
                      disabled={isSubmitting || selectedVehicle?.status === status}
                    >
                      {isSubmitting && selectedVehicle?.status !== status ? (
                        <ActivityIndicator size={24} color={getStatusColor(status)} />
                      ) : (
                        <Icon
                          name={getStatusIcon(status)}
                          size={24}
                          color={selectedVehicle?.status === status ? '#fff' : getStatusColor(status)}
                        />
                      )}
                      <Text
                        style={[
                          styles.statusOptionText,
                          selectedVehicle?.status === status && styles.statusOptionTextSelected
                        ]}
                      >
                        {status}
                      </Text>
                      {selectedVehicle?.status === status && (
                        <Icon name="checkmark" size={16} color="#fff" style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                
                {/* Status updates immediately when tapped (for Available) */}
                <Text style={[styles.statusModalDescription, { textAlign: 'center', marginTop: 16, fontSize: 12 }]}>
                  Maintenance and Out of Service will require a reason
                </Text>
              </>
            ) : (
              <>
                <View style={styles.statusNotesContainer}>
                  <View style={styles.statusNotesHeader}>
                    <Icon 
                      name={getStatusIcon(selectedStatus)} 
                      size={32} 
                      color={getStatusColor(selectedStatus)} 
                    />
                    <Text style={[styles.statusNotesTitle, { color: getStatusColor(selectedStatus) }]}>
                      {selectedStatus}
                    </Text>
                  </View>
                  
                  <Text style={styles.inputLabel}>Reason / Notes *</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={statusNotes}
                    onChangeText={setStatusNotes}
                    placeholder={`Why is the vehicle ${selectedStatus === 'Maintenance' ? 'under maintenance' : 'out of service'}?`}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <Text style={styles.helpText}>
                    This will be visible to users when they create travel requests
                  </Text>
                  
                  <View style={styles.statusNotesActions}>
                    <TouchableOpacity 
                      style={styles.statusCancelButton}
                      onPress={() => {
                        setSelectedStatus(null);
                        setStatusNotes('');
                      }}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.statusCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.statusConfirmButton,
                        (!statusNotes.trim() || isSubmitting) && styles.statusConfirmButtonDisabled
                      ]}
                      onPress={confirmStatusWithNotes}
                      disabled={!statusNotes.trim() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Icon name="checkmark-circle" size={20} color="#fff" />
                          <Text style={styles.statusConfirmButtonText}>Update Status</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Fuel Modal */}
      <Modal
        visible={showFuelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFuelModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.fuelModalOverlay}
        >
          <View style={styles.fuelModalContent}>
            <View style={styles.fuelModalHeader}>
              <Text style={styles.fuelModalTitle}>
                {fuelActionType === 'usage' ? 'Record Fuel Usage' : 'Record Fuel Purchase'}
              </Text>
              <TouchableOpacity onPress={() => setShowFuelModal(false)}>
                <Icon name="close" size={24} color="#65676B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.fuelModalBody} showsVerticalScrollIndicator={false}>
              {/* Information Banner */}
              <View style={styles.personalFuelBanner}>
                <Icon name="information-circle" size={20} color="#10b981" />
                <View style={styles.personalFuelBannerText}>
                  <Text style={styles.personalFuelBannerTitle}>Personal Fuel Tracking</Text>
                  <Text style={styles.personalFuelBannerDescription}>
                    {fuelActionType === 'usage' 
                      ? 'Track fuel used for urgent trips without an official trip ticket.'
                      : 'Track personal fuel purchases and refills outside of official trip logs.'}
                  </Text>
                </View>
              </View>

              {/* Date Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date *</Text>
                <TextInput
                  style={styles.readonlyTextInput}
                  value={formatDate(fuelFormData.date)}
                  onChangeText={(text) => setFuelFormData({ ...fuelFormData, date: text })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  editable={false}
                />
              </View>

              {/* Amount Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Fuel Amount (Liters) * {fuelActionType === 'usage' && '(Used)'}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={fuelFormData.amount}
                  onChangeText={(text) => setFuelFormData({ ...fuelFormData, amount: text })}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              {/* Purpose Input - Only for usage */}
              {fuelActionType === 'usage' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Purpose/Reason *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fuelFormData.purpose}
                    onChangeText={(text) => setFuelFormData({ ...fuelFormData, purpose: text })}
                    placeholder="E.g., Emergency errand, urgent delivery, etc."
                    placeholderTextColor="#9ca3af"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Odometer Input - Optional for usage */}
              {fuelActionType === 'usage' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Odometer Reading (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fuelFormData.odometer}
                    onChangeText={(text) => setFuelFormData({ ...fuelFormData, odometer: text })}
                    placeholder="Current odometer reading"
                    keyboardType="numeric"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              )}

              {/* Fuel Type Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fuel Type *</Text>
                <View style={styles.fuelTypeContainer}>
                  {['Gasoline', 'Diesel', 'Hybrid'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.fuelTypeOption,
                        fuelFormData.fuel_type === type && styles.fuelTypeOptionSelected
                      ]}
                      onPress={() => setFuelFormData({ ...fuelFormData, fuel_type: type })}
                    >
                      <Text style={[
                        styles.fuelTypeText,
                        fuelFormData.fuel_type === type && styles.fuelTypeTextSelected
                      ]}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.fuelModalFooter}>
              <TouchableOpacity
                style={[styles.fuelModalButton, styles.fuelCancelButton]}
                onPress={() => setShowFuelModal(false)}
              >
                <Text style={styles.fuelCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.fuelModalButton, styles.fuelSubmitButton, isSubmitting && styles.fuelSubmitButtonDisabled]}
                onPress={handleFuelSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.fuelSubmitButtonText}>
                    {fuelActionType === 'usage' ? 'Record Usage' : 'Add Fuel Record'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom Modals */}
      <ConfirmationModal
        visible={confirmationState.visible}
        title={confirmationState.title}
        message={confirmationState.message}
        type={confirmationState.type}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        onConfirm={confirmationState.onConfirm}
        onCancel={confirmationState.onCancel}
      />

      <SuccessModal
        visible={successState.visible}
        title={successState.title}
        message={successState.message}
        buttonText={successState.buttonText}
        autoClose={successState.autoClose}
        autoCloseDelay={successState.autoCloseDelay}
        onClose={hideSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 10,
    minHeight: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#C28F22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#050505',
  },
  vehicleCountBadge: {
    backgroundColor: '#3E0703',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C28F22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },

  // Content Styles
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },

  // Fleet Statistics Styles
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#FAFAFA',
    gap: 4,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Vehicle Card Styles
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  vehicleHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  vehicleHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  vehicleSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  vehicleContent: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  vehicleMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vehicleMainDetails: {
    flex: 1,
  },
  plateNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 4,
  },
  vehicleModel: {
    fontSize: 14,
    color: '#65676B',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statusNotesDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    gap: 6,
  },
  statusNotesText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  vehicleActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  vehicleDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  vehicleDetailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F5',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  editButtonText: {
    color: '#3E0703',
    fontWeight: '600',
    marginLeft: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    gap: 6,
  },
  statusButtonText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 13,
  },
  fuelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    gap: 6,
  },
  fuelButtonText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 13,
  },
  fuelButtonDisabled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 6,
    opacity: 0.6,
  },
  fuelButtonDisabledText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 13,
  },
  licenseRestrictionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 6,
    gap: 8,
  },
  licenseRestrictionText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    flex: 1,
  },

  // Fuel Indicator Styles (in vehicle card)
  fuelIndicatorContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fuelIndicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fuelIndicatorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fuelIndicatorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  fuelIndicatorValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  fuelIndicatorValueEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  fuelProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fuelProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  fuelPercentageText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
    fontWeight: '500',
  },
  fuelEmptyMessage: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },

  // Details Card Styles
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  detailsHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  detailsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  detailsSubtitle: {
    fontSize: 14,
    color: '#b6b6b6ff',
  },
  detailsContent: {
    padding: 16,
  },
  detailsGrid: {
    gap: 16,
  },
  detailItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  detailLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 3,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
  },

  // No Vehicle Styles
  noVehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  noVehicleContent: {
    padding: 40,
    alignItems: 'center',
  },
  noVehicleIcon: {
    marginBottom: 20,
  },
  noVehicleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  noVehicleText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  addVehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
  },
  addVehicleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 2,
    borderBottomColor: '#C28F22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703',
    letterSpacing: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 100, // Extra bottom padding for navigation
  },
  formGroup: {
    marginBottom: 24,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3E0703',
    marginBottom: 10,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  formInput: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    color: '#1F2937',
    minHeight: 54,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  formInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 54,
    justifyContent: 'center',
  },
  picker: {
    height: 54,
    color: '#1F2937',
    fontSize: 16,
  },
  pickerIcon: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
    pointerEvents: 'none',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 6,
    fontWeight: '500',
    marginLeft: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3E0703',
    paddingVertical: 18,
    borderRadius: 12,
    marginTop: 32,
    marginBottom: Platform.OS === 'ios' ? 20 : 40,
    shadowColor: '#3E0703',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  },

  // Status Modal Styles
  statusModalDescription: {
    fontSize: 16,
    color: '#65676B',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  statusOptions: {
    gap: 12,
    marginBottom: 32,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CCD0D5',
    backgroundColor: '#fff',
  },
  statusOptionSelected: {
    borderColor: '#3E0703',
    backgroundColor: '#3E0703',
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#050505',
    marginLeft: 12,
  },
  statusOptionTextSelected: {
    color: '#fff',
  },
  statusNotesContainer: {
    marginTop: 16,
  },
  statusNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  statusNotesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#65676B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  statusNotesActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  statusCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
  },
  statusCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#050505',
  },
  statusConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#3E0703',
    gap: 8,
  },
  statusConfirmButtonDisabled: {
    opacity: 0.5,
  },
  statusConfirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },

  // Fuel Modal Styles
  fuelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  fuelModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  fuelModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  fuelModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  fuelModalBody: {
    padding: 20,
    marginBottom: 10,
  },
  personalFuelBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  personalFuelBannerText: {
    flex: 1,
  },
  personalFuelBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065f46',
    marginBottom: 4,
  },
  personalFuelBannerDescription: {
    fontSize: 12,
    color: '#065f46',
    lineHeight: 18,
  },
  fuelModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
    gap: 12,
  },
  fuelModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fuelCancelButton: {
    backgroundColor: '#F0F2F5',
  },
  fuelCancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#050505',
  },
  fuelSubmitButton: {
    backgroundColor: '#3E0703',
  },
  fuelSubmitButtonDisabled: {
    opacity: 0.6,
  },
  fuelSubmitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#050505',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#b6b6b6ff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  readonlyTextInput: {
    borderWidth: 1,
    borderColor: '#CCD0D5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F0F2F5',
    color: '#65676B',
  },
  fuelTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fuelTypeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b6b6b6ff',
    backgroundColor: '#fff',
  },
  fuelTypeOptionSelected: {
    borderColor: '#3E0703',
    backgroundColor: '#3E0703',
  },
  fuelTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#050505',
  },
  fuelTypeTextSelected: {
    color: '#fff',
  },

  // Fuel Card Styles
  fuelCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  fuelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  fuelHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fuelHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  fuelTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  fuelSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  fuelActionsSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  fuelActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#050505',
    marginBottom: 4,
  },
  fuelActionsSubtitle: {
    fontSize: 13,
    color: '#65676B',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  fuelButtonsContainer: {
    gap: 12,
  },
  addFuelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  addFuelButtonText: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
  },
  addFuelButtonSubtext: {
    color: '#6b7280',
    fontSize: 12,
    marginLeft: 32,
  },
  usageFuelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  usageFuelButtonText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 12,
    flex: 1,
  },
  usageFuelButtonSubtext: {
    color: '#6b7280',
    fontSize: 12,
    marginLeft: 32,
  },
  fuelSummary: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  fuelSummaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fuelSummaryText: {
    flex: 1,
  },
  fuelSummaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#65676B',
    marginBottom: 2,
  },
  fuelSummaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  fuelSummaryDivider: {
    width: 1,
    backgroundColor: '#CCD0D5',
    marginHorizontal: 8,
  },
  fuelContent: {
    padding: 16,
    maxHeight: 300,
  },
  fuelRecordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  fuelRecordItemConsumption: {
    backgroundColor: '#fef2f2',
    borderLeftColor: '#ef4444',
  },
  fuelRecordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fuelRecordDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  fuelRecordDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#050505',
  },
  fuelTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fuelTypeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  fuelRecordAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  fuelRecordLabel: {
    fontSize: 11,
    color: '#65676B',
  },
  
  // Active Trip Indicator Styles
  activeTripIndicator: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  myActiveTripIndicator: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  otherActiveTripIndicator: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  activeTripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTripTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  myActiveTripTitle: {
    color: '#059669',
  },
  otherActiveTripTitle: {
    color: '#6B7280',
  },
  activeTripInfo: {
    gap: 6,
  },
  activeTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeTripLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTripValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
  },
  fuelRecordPurpose: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  noFuelRecords: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noFuelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#65676B',
    marginTop: 12,
  },
  noFuelSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },

  // Bottom Spacing
  bottomSpacing: {
    height: 20,
  },
});
