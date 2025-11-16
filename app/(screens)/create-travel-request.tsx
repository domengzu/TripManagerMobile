import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';

export default function CreateTravelRequestScreen() {
  const [loading, setLoading] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [destinations, setDestinations] = useState(['']);
  const [passengers, setPassengers] = useState(['']);
  const [startDate, setStartDate] = useState('');
  const [details, setDetails] = useState('');

  const addDestination = () => {
    setDestinations([...destinations, '']);
  };

  const removeDestination = (index: number) => {
    if (destinations.length > 1) {
      const newDestinations = destinations.filter((_, i) => i !== index);
      setDestinations(newDestinations);
    }
  };

  const updateDestination = (index: number, value: string) => {
    const newDestinations = [...destinations];
    newDestinations[index] = value;
    setDestinations(newDestinations);
  };

  const addPassenger = () => {
    setPassengers([...passengers, '']);
  };

  const removePassenger = (index: number) => {
    if (passengers.length > 1) {
      const newPassengers = passengers.filter((_, i) => i !== index);
      setPassengers(newPassengers);
    }
  };

  const updatePassenger = (index: number, value: string) => {
    const newPassengers = [...passengers];
    newPassengers[index] = value;
    setPassengers(newPassengers);
  };

  const handleSubmit = async () => {
    // Validation
    if (!purpose.trim()) {
      Alert.alert('Error', 'Please enter the purpose of travel');
      return;
    }

    const validDestinations = destinations.filter(d => d.trim());
    if (validDestinations.length === 0) {
      Alert.alert('Error', 'Please enter at least one destination');
      return;
    }

    const validPassengers = passengers.filter(p => p.trim());
    if (validPassengers.length === 0) {
      Alert.alert('Error', 'Please enter at least one passenger');
      return;
    }

    if (!startDate.trim()) {
      Alert.alert('Error', 'Please enter the start date (YYYY-MM-DD)');
      return;
    }

    try {
      setLoading(true);
      await ApiService.createTravelRequest({
        purpose: purpose.trim(),
        destinations: validDestinations,
        passengers: validPassengers,
        start_date: startDate,
        details: details.trim(),
      });

      Alert.alert(
        'Success',
        'Travel request created and automatically approved!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to create travel request'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Travel Request</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Auto-Approval Notice */}
        <View style={styles.noticeContainer}>
          <Ionicons name="information-circle" size={24} color="#C28F22" />
          <Text style={styles.noticeText}>
            As a director, your travel requests are automatically approved
          </Text>
        </View>

        {/* Purpose */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Purpose *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter purpose of travel"
            value={purpose}
            onChangeText={setPurpose}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Destinations */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Destinations *</Text>
            <TouchableOpacity onPress={addDestination} style={styles.addButton}>
              <Ionicons name="add-circle" size={24} color="#C28F22" />
            </TouchableOpacity>
          </View>
          {destinations.map((destination, index) => (
            <View key={index} style={styles.listItemRow}>
              <TextInput
                style={[styles.input, styles.listInput]}
                placeholder={`Destination ${index + 1}`}
                value={destination}
                onChangeText={(value) => updateDestination(index, value)}
              />
              {destinations.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeDestination(index)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Passengers */}
        <View style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Passengers *</Text>
            <TouchableOpacity onPress={addPassenger} style={styles.addButton}>
              <Ionicons name="add-circle" size={24} color="#C28F22" />
            </TouchableOpacity>
          </View>
          {passengers.map((passenger, index) => (
            <View key={index} style={styles.listItemRow}>
              <TextInput
                style={[styles.input, styles.listInput]}
                placeholder={`Passenger ${index + 1} name`}
                value={passenger}
                onChangeText={(value) => updatePassenger(index, value)}
              />
              {passengers.length > 1 && (
                <TouchableOpacity
                  onPress={() => removePassenger(index)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Start Date */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Start Date * (Must be 7 days ahead)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD (e.g., 2025-11-05)"
            value={startDate}
            onChangeText={setStartDate}
          />
          <Text style={styles.helperText}>
            Format: YYYY-MM-DD. Request must be made at least 7 days in advance.
          </Text>
        </View>

        {/* Additional Details */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Additional Details (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter any additional information..."
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.submitButtonText}>Create Request</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  noticeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3e8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    alignItems: 'center',
  },
  noticeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '500',
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    padding: 4,
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#65676B',
    marginTop: 4,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});
