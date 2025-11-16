import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';

interface TravelRequest {
  id: number;
  purpose: string;
  destinations: string[];
  start_date: string;
  passengers: string[];
  status: 'pending' | 'approved' | 'rejected';
  details?: string;
  is_emergency?: boolean;
  emergency_reason?: string;
  created_at: string;
  approved_at?: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  approver?: {
    name: string;
  };
  rejection_reason?: string;
}

export default function TravelRequestDetailsScreen() {
  const params = useLocalSearchParams();
  const requestId = params.requestId as string;
  
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadRequestDetails();
  }, [requestId]);

  const loadRequestDetails = async () => {
    try {
      // For now, we'll fetch from the list. In a real app, you'd have a specific endpoint
      const response = await ApiService.getTravelRequests('all');
      const foundRequest = response.data?.find((r: TravelRequest) => r.id === parseInt(requestId));
      if (foundRequest) {
        setRequest(foundRequest);
      } else {
        Alert.alert('Error', 'Travel request not found');
        router.back();
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load request details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!request) return;

    Alert.alert(
      'Approve Request',
      `Are you sure you want to approve this travel request for ${request.user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              setActionLoading(true);
              await ApiService.approveTravelRequest(request.id);
              Alert.alert('Success', 'Travel request approved successfully', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to approve request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!request) return;
    
    router.push({
      pathname: '/(screens)/reject-travel-request',
      params: { requestId: request.id.toString(), requestData: JSON.stringify(request) }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10b981';
      case 'rejected':
        return '#ef4444';
      case 'pending':
        return '#f59e0b';
      default:
        return '#65676B';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3E0703" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Request not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3E0703" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) }]}
          >
            <Text style={styles.statusText}>{request.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Emergency Trip Indicator */}
        {request.is_emergency && (
          <View style={styles.emergencySection}>
            <View style={styles.emergencyHeader}>
              <Ionicons name="alert-circle" size={24} color="#dc2626" />
              <Text style={styles.emergencyTitle}>EMERGENCY TRIP REQUEST</Text>
            </View>
            <View style={styles.urgencyBadge}>
              <Ionicons name="flash" size={16} color="#ff0000" />
              <Text style={styles.urgencyBadgeText}>URGENT - Priority Processing</Text>
            </View>
            {request.emergency_reason && (
              <View style={styles.emergencyReasonBox}>
                <Text style={styles.emergencyReasonLabel}>Emergency Justification:</Text>
                <Text style={styles.emergencyReasonText}>{request.emergency_reason}</Text>
              </View>
            )}
          </View>
        )}

        {/* Requester Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requester Information</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{request.user.name}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{request.user.email}</Text>
            </View>
          </View>
        </View>

        {/* Travel Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Travel Details</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="document-text" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Purpose</Text>
              <Text style={styles.infoValue}>{request.purpose}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Start Date</Text>
              <Text style={styles.infoValue}>{formatDate(request.start_date)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Destinations</Text>
              {request.destinations.map((dest, index) => (
                <Text key={index} style={styles.listItem}>
                  {index + 1}. {dest}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="people" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Passengers</Text>
              {request.passengers.map((passenger, index) => (
                <Text key={index} style={styles.listItem}>
                  {index + 1}. {passenger}
                </Text>
              ))}
            </View>
          </View>

          {request.details && (
            <View style={styles.infoRow}>
              <Ionicons name="information-circle" size={20} color="#65676B" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Additional Details</Text>
                <Text style={styles.infoValue}>{request.details}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Approval Info */}
        {(request.status === 'approved' || request.status === 'rejected') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {request.status === 'approved' ? 'Approval' : 'Rejection'} Information
            </Text>
            
            {request.approver && (
              <View style={styles.infoRow}>
                <Ionicons name="person-circle" size={20} color="#65676B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>
                    {request.status === 'approved' ? 'Approved By' : 'Rejected By'}
                  </Text>
                  <Text style={styles.infoValue}>{request.approver.name}</Text>
                </View>
              </View>
            )}

            {request.approved_at && (
              <View style={styles.infoRow}>
                <Ionicons name="time" size={20} color="#65676B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{formatDate(request.approved_at)}</Text>
                </View>
              </View>
            )}

            {request.status === 'rejected' && request.rejection_reason && (
              <View style={styles.rejectionReasonContainer}>
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Reason for Rejection</Text>
                  <Text style={styles.rejectionReasonText}>{request.rejection_reason}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Timestamps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timestamps</Text>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#65676B" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Created At</Text>
              <Text style={styles.infoValue}>{formatDate(request.created_at)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions for Pending Requests */}
      {request.status === 'pending' && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={actionLoading}
          >
            <Ionicons name="close" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton, actionLoading && styles.buttonDisabled]}
            onPress={handleApprove}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#65676B',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
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
    color: '#3E0703',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    // paddingBottom: 120, // Add space for action buttons and navigation bar
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#65676B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  listItem: {
    fontSize: 15,
    color: '#000000',
    marginTop: 4,
  },
  rejectionReasonContainer: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  rejectionReasonText: {
    fontSize: 15,
    color: '#dc2626',
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 50, // Extra padding for navigation bar
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emergencySection: {
    backgroundColor: '#fef2f2',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
    letterSpacing: 0.5,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  urgencyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    letterSpacing: 0.5,
  },
  emergencyReasonBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  emergencyReasonLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7f1d1d',
    marginBottom: 6,
  },
  emergencyReasonText: {
    fontSize: 14,
    color: '#450a0a',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

