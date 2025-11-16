import React, { useState, useEffect } from 'react';
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
  created_at: string;
  updated_at: string;
}

interface FuelRecord {
  id: number;
  vehicle_id: number;
  driver_id: number;
  date: string;
  amount: number;
  fuel_type: string;
  created_at: string;
  updated_at: string;
  vehicle?: Vehicle;
}

export default function VehiclesScreen() {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    confirmationState,
    successState,
    showConfirmation,
    hideConfirmation,
    showSuccess,
    hideSuccess
  } = useModals();

  // Form states
  const [formData, setFormData] = useState({
    plate_number: '',
    type: '',
    model: '',
    year: '',
    capacity: '',
    fuel_type: 'Gasoline', // Default required fuel type
    color: '',
    status: 'Available' as Vehicle['status'],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
    };
  });

  useEffect(() => {
    loadVehicle();
  }, []);

  const loadVehicle = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await ApiService.getDriverVehicles();
      // Handle response - driver should only have one vehicle
      const vehiclesData = Array.isArray(response) ? response : (response.vehicles || []);
      
      if (vehiclesData.length > 0) {
        setVehicle(vehiclesData[0]); // Take the first (and likely only) vehicle
        
        // Load fuel records for the vehicle
        try {
          const fuelRecordsResponse = await ApiService.getFuelRecords();
          setFuelRecords(fuelRecordsResponse);
        } catch (fuelError) {
          console.error('Failed to load fuel records:', fuelError);
          // Don't show error for fuel records, just log it
        }
      } else {
        setVehicle(null);
        setFuelRecords([]);
      }
    } catch (error: any) {
      console.error('Failed to load vehicle:', error);
      showConfirmation({
        title: 'Error',
        message: 'Failed to load vehicle data. Please try again.',
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
    loadVehicle(true);
  };

  const resetForm = () => {
    setFormData({
      plate_number: '',
      type: '',
      model: '',
      year: '',
      capacity: '',
      fuel_type: 'Gasoline', // Default required fuel type
      color: '',
      status: 'Available',
    });
    setErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = () => {
    if (vehicle) {
      setFormData({
        plate_number: vehicle.plate_number,
        type: vehicle.type,
        model: vehicle.model,
        year: vehicle.year.toString(),
        capacity: vehicle.capacity.toString(),
        fuel_type: vehicle.fuel_type || '',
        color: vehicle.color || '',
        status: vehicle.status,
      });
      setErrors({});
      setShowEditModal(true);
    }
  };

  const openStatusModal = () => {
    setShowStatusModal(true);
  };

  const openFuelModal = () => {
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
    });
    setShowFuelModal(true);
  };

  const handleAddVehicle = async () => {
    try {
      setIsSubmitting(true);
      setErrors({});

      const vehicleData = {
        plate_number: formData.plate_number.trim(),
        type: formData.type.trim(),
        model: formData.model.trim(),
        year: parseInt(formData.year),
        capacity: parseInt(formData.capacity),
        fuel_type: formData.fuel_type.trim() || '',
        color: formData.color.trim() || '',
        status: formData.status,
      };

      // Log the data being sent for debugging
      console.log('Creating vehicle with data:', vehicleData);

      await ApiService.createDriverVehicle(vehicleData);
      
      showSuccess({
        title: 'Vehicle Added',
        message: 'Your vehicle has been added successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      setShowAddModal(false);
      loadVehicle();
      resetForm();
    } catch (error: any) {
      console.error('Failed to add vehicle:', error);
      console.error('Full add error:', error.response?.data);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        const errorMessage = error.response?.data?.message || 
                            (error.response?.data?.errors ? 
                             Object.values(error.response.data.errors).flat().join(', ') : 
                             'Failed to add vehicle');
        showConfirmation({
          title: 'Error',
          message: errorMessage,
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVehicle = async () => {
    if (!vehicle) return;

    try {
      setIsSubmitting(true);
      setErrors({});

      const vehicleData = {
        plate_number: formData.plate_number.trim(),
        type: formData.type.trim(),
        model: formData.model.trim(),
        year: parseInt(formData.year),
        capacity: parseInt(formData.capacity),
        fuel_type: formData.fuel_type.trim() || '',
        color: formData.color.trim() || '',
        status: formData.status,
      };

      // Log the data being sent for debugging
      console.log('Updating vehicle with data:', vehicleData);

      await ApiService.updateDriverVehicle(vehicle.id, vehicleData);
      
      showSuccess({
        title: 'Vehicle Updated',
        message: 'Your vehicle has been updated successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      setShowEditModal(false);
      loadVehicle();
    } catch (error: any) {
      console.error('Failed to update vehicle:', error);
      console.error('Full update error:', error.response?.data);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        const errorMessage = error.response?.data?.message || 
                            (error.response?.data?.errors ? 
                             Object.values(error.response.data.errors).flat().join(', ') : 
                             'Failed to update vehicle');
        showConfirmation({
          title: 'Error',
          message: errorMessage,
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: Vehicle['status']) => {
    if (!vehicle) return;

    try {
      setIsSubmitting(true);

      // Use correct database field names with the web route
      const updateData = {
        plate_number: vehicle.plate_number,
        type: vehicle.type,
        model: vehicle.model,
        year: vehicle.year,
        capacity: vehicle.capacity,
        fuel_type: vehicle.fuel_type || '',
        color: vehicle.color || '',
        status: newStatus,
      };
      
      console.log('Updating vehicle status to:', newStatus);
      console.log('Sending data:', updateData);
      
      await ApiService.updateDriverVehicle(vehicle.id, updateData);
      
      showSuccess({
        title: 'Status Updated',
        message: 'Vehicle status has been updated successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      setShowStatusModal(false);
      loadVehicle();
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
    if (!vehicle) return;

    try {
      setIsSubmitting(true);

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
        vehicle_id: vehicle.id,
        date: fuelFormData.date,
        amount: amount,
        fuel_type: fuelFormData.fuel_type,
      };

      await ApiService.createFuelRecord(fuelData);

      showSuccess({
        title: 'Fuel Record Added',
        message: 'Fuel record has been added successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });

      setShowFuelModal(false);
      // Reset form
      setFuelFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        fuel_type: 'Gasoline',
      });
      // Reload fuel records
      loadVehicle();
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
        message="Loading your vehicle..." 
        color="#3E0703"
      />
    );
  }



  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleContainer}>
            <Icon name="car-sport" size={24} color="#3E0703" />
            <Text style={styles.headerTitle}>Vehicle Information</Text>
          </View>
          <NotificationBellButton color="#3E0703" size={26} />
        </View>
        {!vehicle && (
          <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
            <Icon name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Vehicle</Text>
          </TouchableOpacity>
        )}
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
        {vehicle ? (
          <>
            {/* Vehicle Status Card */}
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleHeader}>
                <View style={styles.vehicleHeaderContent}>
                  <Icon name={getVehicleTypeIcon(vehicle.type)} size={24} color="#C28F22" />
                  <View style={styles.vehicleHeaderText}>
                    <Text style={styles.vehicleTitle}>Vehicle Status</Text>
                    <Text style={styles.vehicleSubtitle}>Current vehicle information</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.vehicleContent}>
                <View style={styles.vehicleMainInfo}>
                  <View style={[styles.statusIcon, { backgroundColor: getStatusColor(vehicle.status) + '20' }]}>
                    <Icon
                      name={getStatusIcon(vehicle.status)}
                      size={32}
                      color={getStatusColor(vehicle.status)}
                    />
                  </View>
                  <View style={styles.vehicleMainDetails}>
                    <Text style={styles.plateNumber}>{vehicle.plate_number}</Text>
                    <Text style={styles.vehicleModel}>{vehicle.type} • {vehicle.model}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(vehicle.status) }]}>
                      <Text style={styles.statusText}>{vehicle.status}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.vehicleActions}>
                  <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
                    <Icon name="create" size={16} color="#3E0703" />
                    <Text style={styles.editButtonText}>Details</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statusButton} onPress={openStatusModal}>
                    <Icon name="refresh" size={16} color="#10b981" />
                    <Text style={styles.statusButtonText}>Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fuelButton} onPress={openFuelModal}>
                    <Icon name="water" size={16} color="#f59e0b" />
                    <Text style={styles.fuelButtonText}>Fuel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Vehicle Details Card */}
            <View style={styles.detailsCard}>
              <View style={styles.detailsHeader}>
                <View style={styles.detailsHeaderContent}>
                  <Icon name="information-circle" size={24} color="#C28F22" />
                  <View style={styles.detailsHeaderText}>
                    <Text style={styles.detailsTitle}>Vehicle Details</Text>
                    <Text style={styles.detailsSubtitle}>Complete vehicle information</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.detailsContent}>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Plate Number</Text>
                    <Text style={styles.detailValue}>{vehicle.plate_number}</Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>{vehicle.type}</Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Model</Text>
                    <Text style={styles.detailValue}>{vehicle.model}</Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Year</Text>
                    <Text style={styles.detailValue}>{vehicle.year}</Text>
                  </View>
                  
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Capacity</Text>
                    <Text style={styles.detailValue}>{vehicle.capacity} persons</Text>
                  </View>
                  
                  {vehicle.fuel_type && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Fuel Type</Text>
                      <Text style={styles.detailValue}>{vehicle.fuel_type}</Text>
                    </View>
                  )}
                  
                  {vehicle.color && (
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Color</Text>
                      <Text style={styles.detailValue}>{vehicle.color}</Text>
                    </View>
                  )}
                  
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Added On</Text>
                    <Text style={styles.detailValue}>{formatDate(vehicle.created_at)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Fuel Records Card */}
            <View style={styles.fuelCard}>
              <View style={styles.fuelHeader}>
                <View style={styles.fuelHeaderContent}>
                  <Icon name="water" size={24} color="#f59e0b" />
                  <View style={styles.fuelHeaderText}>
                    <Text style={styles.fuelTitle}>Fuel Management</Text>
                    <Text style={styles.fuelSubtitle}>
                      {fuelRecords.length} record{fuelRecords.length !== 1 ? 's' : ''} • End Balance: {
                        fuelRecords.reduce((sum, record) => sum + (parseFloat(record.amount?.toString() || '0') || 0), 0).toFixed(2)
                      } L
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.addFuelButton} onPress={openFuelModal}>
                  <Icon name="add" size={16} color="#f59e0b" />
                  <Text style={styles.addFuelButtonText}>Add Fuel</Text>
                </TouchableOpacity>
              </View>

              {/* Fuel Summary */}
              {fuelRecords.length > 0 && (
                <View style={styles.fuelSummary}>
                  <View style={styles.fuelSummaryItem}>
                    <Icon name="add-circle" size={20} color="#10b981" />
                    <View style={styles.fuelSummaryText}>
                      <Text style={styles.fuelSummaryLabel}>Total Added</Text>
                      <Text style={[styles.fuelSummaryValue, { color: '#10b981' }]}>
                        +{fuelRecords.filter(r => parseFloat(r.amount?.toString() || '0') > 0)
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
                        {fuelRecords.filter(r => parseFloat(r.amount?.toString() || '0') < 0)
                          .reduce((sum, record) => sum + (parseFloat(record.amount?.toString() || '0') || 0), 0).toFixed(2)} L
                      </Text>
                    </View>
                  </View>
                  <View style={styles.fuelSummaryDivider} />
                  <View style={styles.fuelSummaryItem}>
                    <Icon name="speedometer" size={20} color="#3b82f6" />
                    <View style={styles.fuelSummaryText}>
                      <Text style={styles.fuelSummaryLabel}>Balance End</Text>
                      <Text style={[styles.fuelSummaryValue, { color: '#3b82f6', fontWeight: 'bold' }]}>
                        {fuelRecords.reduce((sum, record) => sum + (parseFloat(record.amount?.toString() || '0') || 0), 0).toFixed(2)} L
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.fuelContent}>
                {fuelRecords.length > 0 ? (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {fuelRecords.map((record) => {
                      const amount = parseFloat(record.amount?.toString() || '0');
                      const isConsumption = amount < 0;
                      return (
                        <View key={record.id} style={[
                          styles.fuelRecordItem,
                          isConsumption && styles.fuelRecordItemConsumption
                        ]}>
                          <View style={styles.fuelRecordHeader}>
                            <View style={styles.fuelRecordDateContainer}>
                              <Icon 
                                name={isConsumption ? "remove-circle" : "add-circle"} 
                                size={16} 
                                color={isConsumption ? "#ef4444" : "#10b981"} 
                              />
                              <Text style={styles.fuelRecordDate}>{formatDate(record.date)}</Text>
                            </View>
                            <View style={[styles.fuelTypeBadge, { backgroundColor: getFuelTypeColor(record.fuel_type) }]}>
                              <Text style={styles.fuelTypeBadgeText}>{record.fuel_type}</Text>
                            </View>
                          </View>
                          <Text style={[
                            styles.fuelRecordAmount,
                            { color: isConsumption ? '#ef4444' : '#10b981' }
                          ]}>
                            {isConsumption ? '' : '+'}{amount.toFixed(2)} L
                          </Text>
                          {isConsumption ? (
                            <Text style={styles.fuelRecordLabel}>Consumption</Text>
                          ) : (
                            <Text style={[styles.fuelRecordLabel, { color: '#10b981' }]}>
                              {amount > 50 ? 'Issued/Purchased' : 'Added'}
                            </Text>
                          )}
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
                You don&apos;t have a vehicle assigned yet. Add your vehicle to start managing trips.
              </Text>
              <TouchableOpacity style={styles.addVehicleButton} onPress={openAddModal}>
                <Icon name="add" size={20} color="#fff" />
                <Text style={styles.addVehicleButtonText}>Add My Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Add Vehicle Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Icon name="close" size={24} color="#050505" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Vehicle</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 80 }}
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Plate Number *</Text>
              <TextInput
                style={[styles.formInput, errors.plate_number && styles.formInputError]}
                value={formData.plate_number}
                onChangeText={(text) => setFormData({ ...formData, plate_number: text })}
                placeholder="Enter plate number"
                autoCapitalize="characters"
              />
              {errors.plate_number && <Text style={styles.errorText}>{errors.plate_number[0]}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Vehicle Type *</Text>
              <View style={[styles.pickerContainer, errors.type && styles.formInputError]}>
                <Picker
                  selectedValue={formData.type || 'Sedan'}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  style={styles.picker}
                >
                  {VEHICLE_TYPES.map((type) => (
                    <Picker.Item key={type} label={type} value={type} />
                  ))}
                </Picker>
                <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
              </View>
              {errors.type && <Text style={styles.errorText}>{errors.type[0]}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Model *</Text>
              <TextInput
                style={[styles.formInput, errors.model && styles.formInputError]}
                value={formData.model}
                onChangeText={(text) => setFormData({ ...formData, model: text })}
                placeholder="e.g., Toyota Hiace, Ford Transit"
              />
              {errors.model && <Text style={styles.errorText}>{errors.model[0]}</Text>}
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Year *</Text>
                <View style={[styles.pickerContainer, errors.year && styles.formInputError]}>
                  <Picker
                    selectedValue={parseInt(formData.year) || currentYear}
                    onValueChange={(value) => setFormData({ ...formData, year: value.toString() })}
                    style={styles.picker}
                  >
                    {YEAR_OPTIONS.map((year) => (
                      <Picker.Item key={year} label={year.toString()} value={year} />
                    ))}
                  </Picker>
                  <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
                </View>
                {errors.year && <Text style={styles.errorText}>{errors.year[0]}</Text>}
              </View>
              
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Capacity *</Text>
                <View style={[styles.pickerContainer, errors.capacity && styles.formInputError]}>
                  <Picker
                    selectedValue={parseInt(formData.capacity) || 5}
                    onValueChange={(value) => setFormData({ ...formData, capacity: value.toString() })}
                    style={styles.picker}
                  >
                    {CAPACITY_OPTIONS.map((capacity) => (
                      <Picker.Item key={capacity} label={capacity.toString()} value={capacity} />
                    ))}
                  </Picker>
                  <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
                </View>
                {errors.capacity && <Text style={styles.errorText}>{errors.capacity[0]}</Text>}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Fuel Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.fuel_type || 'Gasoline'}
                  onValueChange={(value) => setFormData({ ...formData, fuel_type: value })}
                  style={styles.picker}
                >
                  {FUEL_TYPES.map((fuelType) => (
                    <Picker.Item key={fuelType} label={fuelType} value={fuelType} />
                  ))}
                </Picker>
                <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Color</Text>
              <TextInput
                style={styles.formInput}
                value={formData.color}
                onChangeText={(text) => setFormData({ ...formData, color: text })}
                placeholder="e.g., White, Blue, Red"
              />
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleAddVehicle}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Add Vehicle</Text>
                </>
              )}
            </TouchableOpacity>
            
            {/* Bottom Safety Space */}
            <View style={{ height: Platform.OS === 'ios' ? 50 : 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Vehicle Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Icon name="close" size={24} color="#050505" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Vehicle</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <ScrollView 
            style={styles.modalContent} 
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 80 }}
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Plate Number *</Text>
              <TextInput
                style={[styles.formInput, errors.plate_number && styles.formInputError]}
                value={formData.plate_number}
                onChangeText={(text) => setFormData({ ...formData, plate_number: text })}
                placeholder="Enter plate number"
                autoCapitalize="characters"
              />
              {errors.plate_number && <Text style={styles.errorText}>{errors.plate_number[0]}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Vehicle Type *</Text>
              <View style={[styles.pickerContainer, errors.type && styles.formInputError]}>
                <Picker
                  selectedValue={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  style={styles.picker}
                >
                  {VEHICLE_TYPES.map((type) => (
                    <Picker.Item key={type} label={type} value={type} />
                  ))}
                </Picker>
                <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
              </View>
              {errors.type && <Text style={styles.errorText}>{errors.type[0]}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Model *</Text>
              <TextInput
                style={[styles.formInput, errors.model && styles.formInputError]}
                value={formData.model}
                onChangeText={(text) => setFormData({ ...formData, model: text })}
                placeholder="e.g., Toyota Hiace, Ford Transit"
              />
              {errors.model && <Text style={styles.errorText}>{errors.model[0]}</Text>}
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Year *</Text>
                <View style={[styles.pickerContainer, errors.year && styles.formInputError]}>
                  <Picker
                    selectedValue={parseInt(formData.year) || currentYear}
                    onValueChange={(value) => setFormData({ ...formData, year: value.toString() })}
                    style={styles.picker}
                  >
                    {YEAR_OPTIONS.map((year) => (
                      <Picker.Item key={year} label={year.toString()} value={year} />
                    ))}
                  </Picker>
                  <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
                </View>
                {errors.year && <Text style={styles.errorText}>{errors.year[0]}</Text>}
              </View>
              
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Capacity *</Text>
                <View style={[styles.pickerContainer, errors.capacity && styles.formInputError]}>
                  <Picker
                    selectedValue={parseInt(formData.capacity) || 5}
                    onValueChange={(value) => setFormData({ ...formData, capacity: value.toString() })}
                    style={styles.picker}
                  >
                    {CAPACITY_OPTIONS.map((capacity) => (
                      <Picker.Item key={capacity} label={capacity.toString()} value={capacity} />
                    ))}
                  </Picker>
                  <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
                </View>
                {errors.capacity && <Text style={styles.errorText}>{errors.capacity[0]}</Text>}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Fuel Type</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.fuel_type || 'Gasoline'}
                  onValueChange={(value) => setFormData({ ...formData, fuel_type: value })}
                  style={styles.picker}
                >
                  {FUEL_TYPES.map((fuelType) => (
                    <Picker.Item key={fuelType} label={fuelType} value={fuelType} />
                  ))}
                </Picker>
                <Icon name="chevron-down" size={20} color="#9CA3AF" style={styles.pickerIcon} />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Color</Text>
              <TextInput
                style={styles.formInput}
                value={formData.color}
                onChangeText={(text) => setFormData({ ...formData, color: text })}
                placeholder="e.g., White, Blue, Red"
              />
            </View>
            
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleUpdateVehicle}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="checkmark" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Update Vehicle</Text>
                </>
              )}
            </TouchableOpacity>
            
            {/* Bottom Safety Space */}
            <View style={{ height: Platform.OS === 'ios' ? 50 : 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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
              Current status: <Text style={{ fontWeight: 'bold', color: getStatusColor(vehicle?.status || 'Available') }}>{vehicle?.status}</Text>
            </Text>
            
            <View style={styles.statusOptions}>
              {(['Available', 'Maintenance', 'Out of Service'] as Vehicle['status'][]).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    vehicle?.status === status && styles.statusOptionSelected
                  ]}
                  onPress={() => handleUpdateStatus(status)}
                  disabled={isSubmitting || vehicle?.status === status}
                >
                  {isSubmitting && vehicle?.status !== status ? (
                    <ActivityIndicator size={24} color={getStatusColor(status)} />
                  ) : (
                    <Icon
                      name={getStatusIcon(status)}
                      size={24}
                      color={vehicle?.status === status ? '#fff' : getStatusColor(status)}
                    />
                  )}
                  <Text
                    style={[
                      styles.statusOptionText,
                      vehicle?.status === status && styles.statusOptionTextSelected
                    ]}
                  >
                    {status}
                  </Text>
                  {vehicle?.status === status && (
                    <Icon name="checkmark" size={16} color="#fff" style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Status updates immediately when tapped */}
            <Text style={[styles.statusModalDescription, { textAlign: 'center', marginTop: 16 }]}>
              Tap any status above to update immediately
            </Text>
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
              <Text style={styles.fuelModalTitle}>Add Fuel Record</Text>
              <TouchableOpacity onPress={() => setShowFuelModal(false)}>
                <Icon name="close" size={24} color="#65676B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.fuelModalBody} showsVerticalScrollIndicator={false}>
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
                <Text style={styles.inputLabel}>Fuel Amount (Liters) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={fuelFormData.amount}
                  onChangeText={(text) => setFuelFormData({ ...fuelFormData, amount: text })}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>

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
                  <Text style={styles.fuelSubmitButtonText}>Add Fuel Record</Text>
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
    minHeight: 60, // Ensure minimum height for content
    backgroundColor: '#FFFFFF', // TripManager primary brand color
    borderBottomWidth: 1,
    borderBottomColor: '#C28F22', // TripManager secondary brand color
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
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
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
    padding: 16,
  },

  // Vehicle Card Styles
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  vehicleHeader: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  vehicleHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  vehicleSubtitle: {
    fontSize: 14,
    color: '#b6b6b6ff',
  },
  vehicleContent: {
    padding: 16,
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
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  vehicleActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F2F5',
    paddingVertical: 12,
    borderRadius: 8,
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
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    borderRadius: 8,
  },
  statusButtonText: {
    color: '#10b981',
    fontWeight: '600',
    marginLeft: 8,
  },
  fuelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fffbeb',
    paddingVertical: 12,
    borderRadius: 8,
  },
  fuelButtonText: {
    color: '#f59e0b',
    fontWeight: '600',
    marginLeft: 8,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#65676B',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#050505',
  },

  // No Vehicle Styles
  noVehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  noVehicleContent: {
    padding: 32,
    alignItems: 'center',
  },
  noVehicleIcon: {
    marginBottom: 24,
  },
  noVehicleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 12,
    textAlign: 'center',
  },
  noVehicleText: {
    fontSize: 16,
    color: '#65676B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 300,
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
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  fuelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
    backgroundColor: '#FFFFFF',
  },
  fuelHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fuelHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  fuelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  fuelSubtitle: {
    fontSize: 14,
    color: '#65676B',
    marginTop: 2,
  },
  addFuelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addFuelButtonText: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
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
    fontStyle: 'italic',
    position: 'absolute',
    bottom: 4,
    right: 16,
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
    height: 40,
  },
});
