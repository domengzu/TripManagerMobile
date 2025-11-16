import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Vehicle, TripLogFormData, TripTicket } from '@/types';
import ApiService from '@/services/api';
import { Picker } from '@react-native-picker/picker';

export default function TripLogFormScreen() {
  const { trip_ticket_id, id } = useLocalSearchParams();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState<TripLogFormData>({
    trip_ticket_id: Number(trip_ticket_id) || 0,
    vehicle_id: 0,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    departure_time_office: '',
    arrival_time_destination: '',
    departure_time_destination: '',
    arrival_time_office: '',
    destination: '',
    purpose: '',
    distance: 0,
    fuel_balance_start: 0,
    fuel_issued_office: 0,
    fuel_purchased_trip: 0,
    fuel_total: 0,
    fuel_used: 0,
    fuel_balance_end: 0,
    gear_oil: 0,
    lubrication_oil: 0,
    brake_fluid: 0,
    grease: 0,
    speedometer_start: 0,
    speedometer_end: 0,
    speedometer_distance: 0,
    odometer_start: 0,
    odometer_end: 0,
    notes: '',
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tripTicket, setTripTicket] = useState<TripTicket | null>(null);
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Refs for auto-calculations
  const fuelInputsRef = useRef<TextInput[]>([]);
  const speedometerInputsRef = useRef<TextInput[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    // Set up auto-calculations when component mounts
    setupCalculations();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoadingData(true);
      
      // Load trip ticket details if trip_ticket_id is provided
      if (trip_ticket_id) {
        const ticketResponse = await ApiService.getTripTicket(Number(trip_ticket_id));
        setTripTicket(ticketResponse.tripTicket);
        
        // Pre-populate form with trip ticket data
        if (ticketResponse.tripTicket) {
          setFormData(prev => ({
            ...prev,
            destination: ticketResponse.tripTicket.destinations || '',
            purpose: ticketResponse.tripTicket.travel_request?.purpose || '',
          }));
        }
      }

      // Load vehicles
      const vehiclesResponse = await ApiService.getVehicles();
      setVehicles(vehiclesResponse.vehicles || []);
      
      // Load fuel records for the driver's vehicle
      try {
        const fuelRecordsResponse = await ApiService.getFuelRecords();
        console.log('Fuel records response:', fuelRecordsResponse);
        
        // Handle different response formats
        let fuelRecords: any[] = [];
        if (Array.isArray(fuelRecordsResponse)) {
          fuelRecords = fuelRecordsResponse;
        } else if (fuelRecordsResponse && Array.isArray(fuelRecordsResponse.fuel_records)) {
          fuelRecords = fuelRecordsResponse.fuel_records;
        } else if (fuelRecordsResponse && typeof fuelRecordsResponse === 'object') {
          fuelRecords = Object.values(fuelRecordsResponse).filter((item: any) => 
            item && typeof item === 'object' && 'amount' in item
          );
        }
        
        console.log('Processed fuel records:', fuelRecords);
        setFuelRecords(fuelRecords);
        
        // Calculate total fuel balance from fuel records
        const totalFuelBalance = fuelRecords.reduce((sum: number, record: any) => {
          const amount = record.amount;
          const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : (typeof amount === 'number' ? amount : 0);
          console.log('Processing fuel record amount:', amount, 'parsed:', parsedAmount);
          return sum + parsedAmount;
        }, 0);
        
        console.log('Calculated total fuel balance:', totalFuelBalance);
        
        // Set fuel balance start to the total fuel in tank
        setFormData(prev => ({ ...prev, fuel_balance_start: totalFuelBalance }));
        console.log('Set fuel_balance_start to:', totalFuelBalance);
      } catch (fuelError) {
        console.error('Failed to load fuel records:', fuelError);
        // Show a warning but continue - user can enter fuel balance manually
        console.warn('Could not load fuel records for fuel balance calculation');
      }
      
      // Set default vehicle if available (use first vehicle like web app)
      if (vehiclesResponse.vehicles && vehiclesResponse.vehicles.length > 0) {
        setFormData(prev => ({ ...prev, vehicle_id: vehiclesResponse.vehicles[0].id }));
      }

      // If editing, load existing trip log data
      if (isEditing) {
        // Since there's no getTripLog method, we'll need to handle editing differently
        // For now, we'll just use default values and let the user populate the form
        console.log('Editing mode - trip log ID:', id);
      } else {
        // Set default departure time for new logs
        setDefaultTimes();
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      Alert.alert('Error', 'Failed to load form data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const setupCalculations = () => {
    // Fuel calculations
    const calculateFuelTotals = () => {
      const balance = formData.fuel_balance_start || 0;
      const issued = formData.fuel_issued_office || 0;
      const purchased = formData.fuel_purchased_trip || 0;
      const used = formData.fuel_used || 0;

      const total = balance + issued + purchased;
      const endBalance = total - used;

      setFormData(prev => ({
        ...prev,
        fuel_total: total,
        fuel_balance_end: endBalance >= 0 ? endBalance : 0,
      }));
    };

    // Speedometer calculations
    const calculateSpeedometerDistance = () => {
      const start = formData.speedometer_start || 0;
      const end = formData.speedometer_end || 0;
      
      if (start > 0 && end > 0 && end > start) {
        const distance = end - start;
        setFormData(prev => ({
          ...prev,
          speedometer_distance: distance,
          distance: distance, // Also update main distance field
        }));
      }
    };

    // Set up listeners (we'll call these functions when inputs change)
    // The actual calculations will be triggered by onChangeText handlers
  };

  const setDefaultTimes = () => {
    // Set current time as default for departure time from office
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    setFormData(prev => ({
      ...prev,
      departure_time_office: currentTime,
    }));
  };

  const handleSubmit = async () => {
    try {
      setErrors({});
      setIsLoading(true);

      // Basic validation
      const newErrors: { [key: string]: string } = {};
      
      if (!formData.date) {
        newErrors.date = 'Date is required';
      }
      
      if (!formData.departure_time_office) {
        newErrors.departure_time_office = 'Departure time from office is required';
      }

      if (!formData.arrival_time_office) {
        newErrors.arrival_time_office = 'Arrival time at office is required';
      }

      if (!formData.distance || formData.distance <= 0) {
        newErrors.distance = 'Valid distance is required';
      }

      // Time validation
      if (formData.departure_time_office && formData.arrival_time_office) {
        if (formData.departure_time_office >= formData.arrival_time_office) {
          newErrors.arrival_time_office = 'Arrival time must be after departure time';
        }
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      if (isEditing) {
        // updateTripLog expects a simplified interface
        const updateData = {
          vehicle_id: formData.vehicle_id!,
          date: formData.date,
          departure_time_office: formData.departure_time_office,
          arrival_time_office: formData.arrival_time_office!,
          destination: formData.destination,
          purpose: formData.purpose!,
          distance: formData.distance,
          fuel_used: formData.fuel_used || 0,
          notes: formData.notes,
        };
        await ApiService.updateTripLog(Number(id), updateData);
        Alert.alert('Success', 'Trip log updated successfully');
      } else {
        await ApiService.createTripLog(formData);
        Alert.alert('Success', 'Trip log created successfully');
      }

      router.back();
    } catch (error: any) {
      console.error('Failed to save trip log:', error);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        Alert.alert('Error', 'Failed to save trip log');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: keyof TripLogFormData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);

    // Trigger auto-calculations
    setTimeout(() => {
      if (['fuel_balance_start', 'fuel_issued_office', 'fuel_purchased_trip', 'fuel_used'].includes(field)) {
        const balance = newData.fuel_balance_start || 0;
        const issued = newData.fuel_issued_office || 0;
        const purchased = newData.fuel_purchased_trip || 0;
        const used = newData.fuel_used || 0;

        const total = balance + issued + purchased;
        const endBalance = total - used;

        setFormData(prev => ({
          ...prev,
          fuel_total: total,
          fuel_balance_end: endBalance >= 0 ? endBalance : 0,
        }));
      }

      if (['speedometer_start', 'speedometer_end'].includes(field)) {
        const start = newData.speedometer_start || 0;
        const end = newData.speedometer_end || 0;
        
        if (start > 0 && end > 0 && end > start) {
          const distance = end - start;
          setFormData(prev => ({
            ...prev,
            speedometer_distance: distance,
            distance: distance,
          }));
        }
      }
    }, 100);
  };

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Edit Trip Log' : 'New Trip Log'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Trip Ticket Information Header */}
          {tripTicket && (
            <View style={styles.ticketInfoContainer}>
              <View style={styles.ticketInfoHeader}>
                <View style={styles.ticketInfoIcon}>
                  <Text style={styles.ticketInfoIconText}>🚗</Text>
                </View>
                <Text style={styles.ticketInfoTitle}>Record Trip Log Entry</Text>
              </View>
              
              <View style={styles.ticketInfoNote}>
                <Text style={styles.ticketInfoNoteText}>
                  <Text style={styles.noteBold}>Note:</Text> You can save partial information and edit the trip log anytime. Fill in what you know now and update later as needed.
                </Text>
              </View>

              <View style={styles.ticketDetailsContainer}>
                <View style={styles.ticketDetailsGrid}>
                  <View style={styles.ticketDetailItem}>
                    <Text style={styles.ticketDetailLabel}>Trip Ticket:</Text>
                    <Text style={styles.ticketDetailValue}>{tripTicket.ticket_number}</Text>
                  </View>
                  
                  <View style={styles.ticketDetailItem}>
                    <Text style={styles.ticketDetailLabel}>Passenger:</Text>
                    <Text style={styles.ticketDetailValue}>
                      {tripTicket.travelRequest?.user?.name || 'N/A'}
                    </Text>
                  </View>
                  
                  <View style={styles.ticketDetailItem}>
                    <Text style={styles.ticketDetailLabel}>Travel Date:</Text>
                    <Text style={styles.ticketDetailValue}>
                      {tripTicket.travelRequest?.start_date || 'N/A'}
                    </Text>
                  </View>
                  
                  <View style={styles.ticketDetailItem}>
                    <Text style={styles.ticketDetailLabel}>Purpose:</Text>
                    <Text style={styles.ticketDetailValue}>
                      {tripTicket.travelRequest?.purpose || 'N/A'}
                    </Text>
                  </View>
                  
                  <View style={[styles.ticketDetailItem, styles.ticketDetailFullWidth]}>
                    <Text style={styles.ticketDetailLabel}>Destinations:</Text>
                    <Text style={styles.ticketDetailValue}>
                      {tripTicket.travelRequest?.destinations ? 
                        (Array.isArray(tripTicket.travelRequest.destinations) 
                          ? tripTicket.travelRequest.destinations.join(', ')
                          : tripTicket.travelRequest.destinations)
                        : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Trip Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trip Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date *</Text>
              <TextInput
                style={[styles.input, errors.date && styles.inputError]}
                value={formData.date}
                onChangeText={(text) => updateFormData('date', text)}
                placeholder="YYYY-MM-DD"
                editable={!isLoading}
              />
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Driver Name</Text>
              <TextInput
                style={[styles.input, styles.readOnly]}
                value="Current User" // TODO: Replace with actual user name from auth
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Vehicle</Text>
              <TextInput
                style={[styles.input, styles.readOnly]}
                value={vehicles.length > 0 ? `${vehicles[0].type} ${vehicles[0].model} (${vehicles[0].plate_number})` : 'No vehicle assigned'}
                editable={false}
              />
            </View>
          </View>

          {/* Time Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Time Information</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Departure from Office *</Text>
                <TextInput
                  style={[styles.input, errors.departure_time_office && styles.inputError]}
                  value={formData.departure_time_office}
                  onChangeText={(text) => updateFormData('departure_time_office', text)}
                  placeholder="HH:MM"
                  editable={!isLoading}
                />
                {errors.departure_time_office && <Text style={styles.errorText}>{errors.departure_time_office}</Text>}
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Arrival at Destination</Text>
                <TextInput
                  style={styles.input}
                  value={formData.arrival_time_destination || ''}
                  onChangeText={(text) => updateFormData('arrival_time_destination', text)}
                  placeholder="HH:MM"
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Departure from Destination</Text>
                <TextInput
                  style={styles.input}
                  value={formData.departure_time_destination || ''}
                  onChangeText={(text) => updateFormData('departure_time_destination', text)}
                  placeholder="HH:MM"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Arrival at Office *</Text>
                <TextInput
                  style={[styles.input, errors.arrival_time_office && styles.inputError]}
                  value={formData.arrival_time_office || ''}
                  onChangeText={(text) => updateFormData('arrival_time_office', text)}
                  placeholder="HH:MM"
                  editable={!isLoading}
                />
                {errors.arrival_time_office && <Text style={styles.errorText}>{errors.arrival_time_office}</Text>}
              </View>
            </View>
          </View>

          {/* Fuel Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fuel Information</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Fuel Balance in Tank</Text>
                <TextInput
                  style={[styles.input, styles.readOnly]}
                  value={formData.fuel_balance_start?.toString() || '0'}
                  editable={false}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Fuel Issued at Office</Text>
                <TextInput
                  style={styles.input}
                  value={formData.fuel_issued_office?.toString() || '0'}
                  onChangeText={(text) => updateFormData('fuel_issued_office', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Fuel Purchased on Trip</Text>
                <TextInput
                  style={styles.input}
                  value={formData.fuel_purchased_trip?.toString() || '0'}
                  onChangeText={(text) => updateFormData('fuel_purchased_trip', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Fuel Total</Text>
                <TextInput
                  style={[styles.input, styles.readOnly]}
                  value={formData.fuel_total?.toString() || '0'}
                  editable={false}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Fuel Used</Text>
                <TextInput
                  style={styles.input}
                  value={formData.fuel_used?.toString() || '0'}
                  onChangeText={(text) => updateFormData('fuel_used', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Fuel Balance End</Text>
                <TextInput
                  style={[styles.input, styles.readOnly]}
                  value={formData.fuel_balance_end?.toString() || '0'}
                  editable={false}
                />
              </View>
            </View>
          </View>

          {/* Lubricants Information Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lubricants Information</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Gear Oil</Text>
                <TextInput
                  style={styles.input}
                  value={formData.gear_oil?.toString() || '0'}
                  onChangeText={(text) => updateFormData('gear_oil', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Lubrication Oil</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lubrication_oil?.toString() || '0'}
                  onChangeText={(text) => updateFormData('lubrication_oil', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Brake Fluid</Text>
                <TextInput
                  style={styles.input}
                  value={formData.brake_fluid?.toString() || '0'}
                  onChangeText={(text) => updateFormData('brake_fluid', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Grease</Text>
                <TextInput
                  style={styles.input}
                  value={formData.grease?.toString() || '0'}
                  onChangeText={(text) => updateFormData('grease', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>
            </View>
          </View>

          {/* Speedometer & Odometer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Speedometer & Odometer</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Speedometer Start</Text>
                <TextInput
                  style={styles.input}
                  value={formData.speedometer_start?.toString() || '0'}
                  onChangeText={(text) => updateFormData('speedometer_start', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Speedometer End</Text>
                <TextInput
                  style={styles.input}
                  value={formData.speedometer_end?.toString() || '0'}
                  onChangeText={(text) => updateFormData('speedometer_end', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Speedometer Distance</Text>
                <TextInput
                  style={[styles.input, styles.readOnly]}
                  value={formData.speedometer_distance?.toString() || '0'}
                  editable={false}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Distance (km) *</Text>
                <TextInput
                  style={[styles.input, errors.distance && styles.inputError]}
                  value={formData.distance.toString()}
                  onChangeText={(text) => updateFormData('distance', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
                {errors.distance && <Text style={styles.errorText}>{errors.distance}</Text>}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Odometer Start</Text>
                <TextInput
                  style={styles.input}
                  value={formData.odometer_start?.toString() || '0'}
                  onChangeText={(text) => updateFormData('odometer_start', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Odometer End</Text>
                <TextInput
                  style={styles.input}
                  value={formData.odometer_end?.toString() || '0'}
                  onChangeText={(text) => updateFormData('odometer_end', parseFloat(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes/Remarks</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes || ''}
                onChangeText={(text) => updateFormData('notes', text)}
                placeholder="Additional notes or comments..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!isLoading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitButtonText}>
              {isLoading 
                ? (isEditing ? 'Updating...' : 'Creating...') 
                : (isEditing ? 'Update Trip Log' : 'Create Trip Log')
              }
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 20,
  },
  // Ticket Information Styles
  ticketInfoContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ticketInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketInfoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ticketInfoIconText: {
    fontSize: 16,
  },
  ticketInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
  },
  ticketInfoNote: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  ticketInfoNoteText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  noteBold: {
    fontWeight: 'bold',
  },
  ticketDetailsContainer: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 8,
    padding: 16,
  },
  ticketDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ticketDetailItem: {
    width: '48%',
    marginBottom: 12,
    marginRight: '4%',
  },
  ticketDetailFullWidth: {
    width: '100%',
    marginRight: 0,
  },
  ticketDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ticketDetailValue: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  section: {
    marginBottom: 30,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  readOnly: {
    backgroundColor: '#f8f9fa',
    color: '#6c757d',
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  textArea: {
    height: 80,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
