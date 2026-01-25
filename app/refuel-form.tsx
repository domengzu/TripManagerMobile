import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import ApiService from '@/services/api';

export const options = {
  headerShown: false,
};

interface Vehicle {
  id: number;
  plate_number: string;
  type: string;
  model: string;
  fuel_tank_capacity?: number;
  current_fuel_level?: number;
}

interface ActiveTrip {
  id: number;
  status: string;
  trip_number: string;
  vehicle_id: number;
  departure_date?: string;
  destination?: string;
  pos_control_number?: string;
}

export default function RefuelFormScreen() {
  const params = useLocalSearchParams();
  const vehicleId = params.vehicleId as string;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    liters_added: '',
    pos_control_number: '',
    cost: '',
    location: '',
    odometer_reading: '',
    gas_station: '',
    notes: '',
  });

  useEffect(() => {
    loadVehicle();
  }, []);

  const loadVehicle = async () => {
    try {
      const vehicles = await ApiService.getDriverVehicles();
      const found = vehicles.find((v: Vehicle) => v.id === parseInt(vehicleId));
      
      if (found) {
        setVehicle(found);
        // Check for active trip with this vehicle
        await checkForActiveTrip(parseInt(vehicleId));
      } else {
        Alert.alert('Error', 'Vehicle not found');
        router.back();
      }
    } catch (error) {
      console.error('Failed to load vehicle:', error);
      Alert.alert('Error', 'Failed to load vehicle data');
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill POS when active trip is detected
  useEffect(() => {
    if (activeTrip?.pos_control_number && !formData.pos_control_number) {
      setFormData(prev => ({
        ...prev,
        pos_control_number: activeTrip.pos_control_number || '',
      }));
      console.log('✅ Auto-filled POS from trip:', activeTrip.pos_control_number);
    }
  }, [activeTrip]);

  const checkForActiveTrip = async (vId: number) => {
    try {
      const tickets = await ApiService.getActiveTripTickets();
      console.log('🔍 Active trip tickets response:', tickets);
      
      // Ensure tickets is an array
      const ticketsArray = Array.isArray(tickets) ? tickets : [];
      
      const inProgressTrip = ticketsArray.find(
        (t: any) => t.vehicle_id === vId && t.status === 'in_progress'
      );
      if (inProgressTrip) {
        console.log('🚗 Found active in-progress trip:', inProgressTrip.trip_number);
        
        // Extract trip details
        const travelRequest = inProgressTrip.travel_request || inProgressTrip.travelRequest;
        const departureDate = travelRequest?.start_date || inProgressTrip.departure_date;
        const destination = travelRequest?.destinations || inProgressTrip.destination || 'N/A';
        
        setActiveTrip({
          id: inProgressTrip.id,
          status: inProgressTrip.status,
          trip_number: inProgressTrip.trip_number,
          vehicle_id: inProgressTrip.vehicle_id,
          departure_date: departureDate,
          destination: destination,
          pos_control_number: inProgressTrip.pos_control_number,
        });
        
        console.log('📋 Trip details:', {
          trip_number: inProgressTrip.trip_number,
          departure_date: departureDate,
          destination: destination,
          pos: inProgressTrip.pos_control_number || 'Not yet generated',
        });
      } else {
        console.log('ℹ️ No active in-progress trip found for vehicle', vId);
      }
    } catch (error) {
      console.error('Failed to check for active trip:', error);
      // Non-critical, continue without trip linking
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.liters_added || parseFloat(formData.liters_added) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount of fuel');
      return;
    }

    const litersAdded = parseFloat(formData.liters_added);
    const currentLevel = vehicle?.current_fuel_level || 0;
    const tankCapacity = vehicle?.fuel_tank_capacity || 100;

    if (currentLevel + litersAdded > tankCapacity) {
      Alert.alert(
        'Warning',
        `Adding ${litersAdded}L would exceed tank capacity (${tankCapacity}L). Continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => submitRefuel() },
        ]
      );
    } else {
      submitRefuel();
    }
  };

  const submitRefuel = async () => {
    setSubmitting(true);
    try {
      const payload = {
        vehicle_id: parseInt(vehicleId),
        liters_added: parseFloat(formData.liters_added),
        pos_control_number: formData.pos_control_number || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        location: formData.location || null,
        odometer_reading: formData.odometer_reading ? parseFloat(formData.odometer_reading) : null,
        gas_station: formData.gas_station || null,
        notes: formData.notes || null,
        trip_ticket_id: activeTrip ? activeTrip.id : null, // Link to active trip if exists
      };

      console.log('📝 Submitting refuel with payload:', payload);
      await ApiService.recordRefuel(payload);
      
      const successMessage = activeTrip
        ? `Fuel added successfully!\n\n✅ Linked to active trip: ${activeTrip.trip_number}\n\nThis will be reflected in your trip log.`
        : 'Fuel record added successfully!';
      
      Alert.alert('Success', successMessage, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Failed to add fuel record:', error);
      Alert.alert('Error', error.message || 'Failed to add fuel record');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3E0703" />
      </View>
    );
  }

  if (!vehicle) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Vehicle not found</Text>
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
          <Text style={styles.headerTitle}>Record Refuel</Text>
          <Text style={styles.headerSubtitle}>{vehicle.plate_number}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Active Trip Indicator */}
        {activeTrip && (
          <View style={styles.activeTripBanner}>
            <Icon name="checkmark-circle" size={20} color="#059669" />
            <View style={styles.activeTripBannerText}>
              <Text style={styles.activeTripBannerTitle}>Active Trip Detected: {activeTrip.trip_number}</Text>
              <Text style={styles.activeTripBannerDescription}>
                📍 Destination: {activeTrip.destination || 'N/A'}
              </Text>
              {activeTrip.departure_date && (
                <Text style={styles.activeTripBannerDescription}>
                  📅 Departure: {new Date(activeTrip.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
              {activeTrip.pos_control_number && (
                <Text style={styles.activeTripBannerDescription}>
                  🧾 POS: {activeTrip.pos_control_number}
                </Text>
              )}
              {!activeTrip.pos_control_number && (
                <Text style={[styles.activeTripBannerDescription, { fontStyle: 'italic', color: '#92400E' }]}>
                  ⚠️ POS not yet generated - You can still refuel and link later
                </Text>
              )}
              <Text style={[styles.activeTripBannerDescription, { marginTop: 6, fontWeight: '600' }]}>
                ✅ Fuel will be automatically linked to this trip log
              </Text>
            </View>
          </View>
        )}

        {/* Vehicle Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Vehicle</Text>
          <Text style={styles.infoValue}>
            {vehicle.plate_number} - {vehicle.model}
          </Text>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Current Level</Text>
              <Text style={styles.infoValue}>
                {parseFloat(vehicle.current_fuel_level || '0').toFixed(1)} L
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tank Capacity</Text>
              <Text style={styles.infoValue}>
                {parseFloat(vehicle.fuel_tank_capacity || '0').toFixed(1)} L
              </Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Liters Added - Required */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Liters Added <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={formData.liters_added}
              onChangeText={(text) => setFormData({ ...formData, liters_added: text })}
              placeholder="e.g., 45.5"
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* POS Control Number */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>
              POS Control Number
              {activeTrip && activeTrip.pos_control_number && (
                <Text style={{ color: '#059669', fontSize: 11 }}> (Auto-filled from trip)</Text>
              )}
            </Text>
            <TextInput
              style={[
                styles.input,
                activeTrip?.pos_control_number && { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' }
              ]}
              value={formData.pos_control_number}
              onChangeText={(text) => setFormData({ ...formData, pos_control_number: text })}
              placeholder={activeTrip && !activeTrip.pos_control_number ? "POS not yet generated - can be added later" : "e.g., POS-12345"}
              placeholderTextColor="#9CA3AF"
              editable={true}
            />
            {activeTrip && !activeTrip.pos_control_number && (
              <Text style={styles.helpText}>
                💡 You can proceed without POS. It will be updated once procurement generates it.
              </Text>
            )}
          </View>

          {/* Cost */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Cost (₱)</Text>
            <TextInput
              style={styles.input}
              value={formData.cost}
              onChangeText={(text) => setFormData({ ...formData, cost: text })}
              placeholder="e.g., 2500.00"
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Location */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={formData.location}
              onChangeText={(text) => setFormData({ ...formData, location: text })}
              placeholder="e.g., Manila City"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Gas Station */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Gas Station</Text>
            <TextInput
              style={styles.input}
              value={formData.gas_station}
              onChangeText={(text) => setFormData({ ...formData, gas_station: text })}
              placeholder="e.g., Petron, Shell"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Odometer Reading */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Odometer Reading (km)</Text>
            <TextInput
              style={styles.input}
              value={formData.odometer_reading}
              onChangeText={(text) => setFormData({ ...formData, odometer_reading: text })}
              placeholder="e.g., 15000"
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Notes */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              placeholder="Additional notes (optional)"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Record Refuel</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  activeTripBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 10,
  },
  activeTripBannerText: {
    flex: 1,
  },
  activeTripBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 4,
  },
  activeTripBannerDescription: {
    fontSize: 12,
    color: '#065F46',
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 6,
  },
  infoLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  form: {
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
  },
  helpText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    backgroundColor: '#3E0703',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
