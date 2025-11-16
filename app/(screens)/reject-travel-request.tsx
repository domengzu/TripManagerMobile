import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';

export default function RejectTravelRequestScreen() {
  const params = useLocalSearchParams();
  const requestId = params.requestId as string;
  const requestData = params.requestData ? JSON.parse(params.requestData as string) : null;
  
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    try {
      setLoading(true);
      await ApiService.rejectTravelRequest(parseInt(requestId), rejectionReason.trim());
      
      Alert.alert(
        'Success',
        'Travel request has been rejected',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to reject travel request'
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
        <Text style={styles.headerTitle}>Reject Travel Request</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* Request Info */}
        {requestData && (
          <View style={styles.requestInfo}>
            <Text style={styles.infoLabel}>Requester:</Text>
            <Text style={styles.infoValue}>{requestData.user.name}</Text>
            
            <Text style={styles.infoLabel}>Purpose:</Text>
            <Text style={styles.infoValue}>{requestData.purpose}</Text>
          </View>
        )}

        {/* Warning */}
        <View style={styles.warningContainer}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={styles.warningText}>
            This action cannot be undone. The requester will be notified of the rejection.
          </Text>
        </View>

        {/* Rejection Reason */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Reason for Rejection *</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Please provide a clear reason for rejecting this request..."
            value={rejectionReason}
            onChangeText={setRejectionReason}
            multiline
            numberOfLines={6}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {rejectionReason.length}/500 characters
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.rejectButton, loading && styles.buttonDisabled]}
            onPress={handleReject}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#fff" />
                <Text style={styles.rejectButtonText}>Reject Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: '#ef4444',
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
  content: {
    flex: 1,
    padding: 16,
  },
  requestInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    color: '#65676B',
    marginTop: 8,
  },
  infoValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
    marginBottom: 4,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#92400e',
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
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000000',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#65676B',
    textAlign: 'right',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#65676B',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
