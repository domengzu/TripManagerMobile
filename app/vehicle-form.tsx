import React, { useState, useEffect } from 'react';
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
import { Vehicle, VehicleFormData } from '@/types';
import ApiService from '@/services/api';
import { Picker } from '@react-native-picker/picker';

const VEHICLE_STATUSES = ['Available', 'In Use', 'Maintenance', 'Out of Service'];
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Van', 'Truck', 'Bus', 'Motorcycle', 'Other'];
const FUEL_TYPES = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG'];
const CAPACITY_OPTIONS = [2, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 40, 50];

// Generate years from 1990 to current year + 1
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear + 1 - i);

export default function VehicleFormScreen() {
  const { id } = useLocalSearchParams();
  const isEditing = !!id;
  
  const [formData, setFormData] = useState<VehicleFormData>({
    plate_number: '',
    type: 'Sedan',
    model: '',
    year: new Date().getFullYear(),
    capacity: 5,
    fuel_type: 'Gasoline',
    color: '',
    status: 'Available',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVehicle, setIsLoadingVehicle] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
      loadVehicle();
    }
  }, [id]);

  const loadVehicle = async () => {
    try {
      setIsLoadingVehicle(true);
      const vehicleData = await ApiService.getVehicle(Number(id));
      
      setFormData({
        plate_number: vehicleData.plate_number || '',
        type: vehicleData.type || 'Sedan',
        model: vehicleData.model || '',
        year: vehicleData.year || new Date().getFullYear(),
        capacity: vehicleData.capacity || 5,
        fuel_type: vehicleData.fuel_type || 'Gasoline',
        color: vehicleData.color || '',
        status: vehicleData.status || 'Available',
      });
    } catch (error) {
      console.error('Failed to load vehicle:', error);
      Alert.alert('Error', 'Failed to load vehicle details');
      router.back();
    } finally {
      setIsLoadingVehicle(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setErrors({});
      setIsLoading(true);

      // Basic validation
      const newErrors: { [key: string]: string } = {};
      
      if (!formData.plate_number.trim()) {
        newErrors.plate_number = 'License plate is required';
      }
      
      if (!formData.type.trim()) {
        newErrors.type = 'Vehicle type is required';
      }
      
      if (!formData.model.trim()) {
        newErrors.model = 'Model is required';
      }
      
      if (!formData.year || formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
        newErrors.year = 'Valid year is required';
      }
      
      if (!formData.capacity || formData.capacity < 1) {
        newErrors.capacity = 'Valid capacity is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      if (isEditing) {
        await ApiService.updateVehicle(Number(id), formData);
        Alert.alert('Success', 'Vehicle updated successfully');
      } else {
        await ApiService.createVehicle(formData);
        Alert.alert('Success', 'Vehicle added successfully');
      }

      router.back();
    } catch (error: any) {
      console.error('Failed to save vehicle:', error);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        Alert.alert('Error', 'Failed to save vehicle');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: keyof VehicleFormData, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  if (isLoadingVehicle) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading vehicle...</Text>
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
            {isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>License Plate *</Text>
            <TextInput
              style={[styles.input, errors.plate_number && styles.inputError]}
              value={formData.plate_number}
              onChangeText={(text) => updateFormData('plate_number', text.toUpperCase())}
              placeholder="e.g., ABC-123"
              autoCapitalize="characters"
              editable={!isLoading}
            />
            {errors.plate_number && <Text style={styles.errorText}>{errors.plate_number}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vehicle Type *</Text>
            <View style={[styles.pickerContainer, errors.type && styles.inputError]}>
              <Picker
                selectedValue={formData.type}
                onValueChange={(value) => updateFormData('type', value)}
                enabled={!isLoading}
                style={styles.picker}
              >
                {VEHICLE_TYPES.map((type) => (
                  <Picker.Item key={type} label={type} value={type} />
                ))}
              </Picker>
            </View>
            {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Model *</Text>
            <TextInput
              style={[styles.input, errors.model && styles.inputError]}
              value={formData.model}
              onChangeText={(text) => updateFormData('model', text)}
              placeholder="e.g., Camry, Civic, F-150"
              editable={!isLoading}
            />
            {errors.model && <Text style={styles.errorText}>{errors.model}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Year *</Text>
            <View style={[styles.pickerContainer, errors.year && styles.inputError]}>
              <Picker
                selectedValue={formData.year}
                onValueChange={(value) => updateFormData('year', value)}
                enabled={!isLoading}
                style={styles.picker}
              >
                {YEAR_OPTIONS.map((year) => (
                  <Picker.Item key={year} label={year.toString()} value={year} />
                ))}
              </Picker>
            </View>
            {errors.year && <Text style={styles.errorText}>{errors.year}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Capacity (Passengers) *</Text>
            <View style={[styles.pickerContainer, errors.capacity && styles.inputError]}>
              <Picker
                selectedValue={formData.capacity}
                onValueChange={(value) => updateFormData('capacity', value)}
                enabled={!isLoading}
                style={styles.picker}
              >
                {CAPACITY_OPTIONS.map((capacity) => (
                  <Picker.Item key={capacity} label={capacity.toString()} value={capacity} />
                ))}
              </Picker>
            </View>
            {errors.capacity && <Text style={styles.errorText}>{errors.capacity}</Text>}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Status *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.status}
                onValueChange={(value) => updateFormData('status', value)}
                enabled={!isLoading}
                style={styles.picker}
              >
                {VEHICLE_STATUSES.map((status) => (
                  <Picker.Item key={status} label={status} value={status} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fuel Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.fuel_type}
                onValueChange={(value) => updateFormData('fuel_type', value)}
                enabled={!isLoading}
                style={styles.picker}
              >
                {FUEL_TYPES.map((fuelType) => (
                  <Picker.Item key={fuelType} label={fuelType} value={fuelType} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              value={formData.color}
              onChangeText={(text) => updateFormData('color', text)}
              placeholder="e.g., White, Black, Silver"
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.submitButtonText}>
              {isLoading 
                ? (isEditing ? 'Updating...' : 'Adding...') 
                : (isEditing ? 'Update Vehicle' : 'Add Vehicle')
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
  inputGroup: {
    marginBottom: 20,
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
