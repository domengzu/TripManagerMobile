import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';
import { ErrorHandler } from '../../utils/errorHandler';
import { NotificationBellButton } from '@/components/NotificationBellButton';
import { useAuth } from '@/contexts/AuthContext';

interface TravelRequest {
  id: number;
  purpose: string;
  destinations: string[];
  start_date: string;
  passengers: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  is_emergency?: boolean;
  emergency_reason?: string;
  user: {
    id: number;
    name: string;
  };
  approver?: {
    name: string;
  };
  rejection_reason?: string;
}

type TabType = 'pending' | 'my_requests' | 'all';

export default function TravelRequestsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [requests, setRequests] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isTabRefreshing, setIsTabRefreshing] = useState(false);

  const loadRequests = async () => {
    try {
      let response;
      if (activeTab === 'my_requests') {
        response = await ApiService.getMyTravelRequests('all');
      } else if (activeTab === 'pending') {
        response = await ApiService.getTravelRequests('pending');
      } else {
        response = await ApiService.getTravelRequests('all');
      }
      
      // Sort emergency trips to the top for pending tab
      let sortedRequests = response.data || [];
      if (activeTab === 'pending') {
        sortedRequests = sortedRequests.sort((a: TravelRequest, b: TravelRequest) => {
          if (a.is_emergency && !b.is_emergency) return -1;
          if (!a.is_emergency && b.is_emergency) return 1;
          return 0;
        });
      }
      
      setRequests(sortedRequests);
    } catch (error) {
      ErrorHandler.handle(error, 'Failed to load travel requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsTabRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsTabRefreshing(true);
      const timer = setTimeout(async () => {
        await loadRequests();
      }, 300);

      return () => clearTimeout(timer);
    }, [activeTab])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
  };

  const handleApprove = async (id: number) => {
    try {
      await ApiService.approveTravelRequest(id);
      await loadRequests();
    } catch (error) {
      ErrorHandler.handle(error, 'Failed to approve request');
    }
  };

  const handleReject = (request: TravelRequest) => {
    router.push({
      pathname: '/(screens)/reject-travel-request',
      params: { requestId: request.id, requestData: JSON.stringify(request) }
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading || isTabRefreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3E0703" />
        <Text style={styles.loadingText}>
          {isTabRefreshing ? 'Refreshing requests...' : 'Loading travel requests...'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={24} color="#C28F22" />
          <Text style={styles.headerTitle}>Travel Requests</Text>
        </View>
        <View style={styles.headerRight}>
          <NotificationBellButton color="#3E0703" size={26} />
          {/* Only show create button for non-director users */}
          {user?.role !== 'director' ? (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/(screens)/create-travel-request')}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        {/* Only show "My Requests" tab for non-director users */}
        {user?.role !== 'director' ? (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'my_requests' && styles.tabActive]}
            onPress={() => setActiveTab('my_requests')}
          >
            <Text style={[styles.tabText, activeTab === 'my_requests' && styles.tabTextActive]}>
              My Requests
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All Requests
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#9ca3af" />
            <Text style={styles.emptyText}>No travel requests found</Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'my_requests'
                ? 'Create your first travel request'
                : activeTab === 'pending'
                ? 'No pending requests to review'
                : 'No requests to display'}
            </Text>
          </View>
        ) : (
          requests.map((request) => (
            <View 
              key={request.id} 
              style={[
                styles.requestCard,
                request.is_emergency && styles.emergencyCard
              ]}
            >
              {/* Emergency Badge - Top of Card */}
              {request.is_emergency ? (
                <View style={styles.emergencyBanner}>
                  <View style={styles.emergencyBadge}>
                    <Ionicons name="alert-circle" size={18} color="#fff" />
                    <Text style={styles.emergencyBadgeText}>EMERGENCY TRIP</Text>
                  </View>
                  <View style={styles.urgencyIndicator}>
                    <Ionicons name="flash" size={14} color="#ff0000" />
                    <Text style={styles.urgencyText}>URGENT</Text>
                  </View>
                </View>
              ) : null}

              {/* Header */}
              <View style={styles.requestHeader}>
                <View style={styles.requestHeaderLeft}>
                  <Ionicons name="person-outline" size={18} color="#65676B" />
                  <Text style={styles.requesterName}>{request.user.name}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(request.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{request.status}</Text>
                </View>
              </View>

              {/* Purpose */}
              <Text style={styles.purposeText}>{request.purpose}</Text>

              {/* Details */}
              <View style={styles.detailsContainer}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color="#65676B" />
                  <Text style={styles.detailText}>
                    {formatDate(request.start_date)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color="#65676B" />
                  <Text style={styles.detailText} numberOfLines={1}>
                    {request.destinations.join(' → ')}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Ionicons name="people-outline" size={16} color="#65676B" />
                  <Text style={styles.detailText}>
                    {request.passengers.length} passenger(s)
                  </Text>
                </View>

                {/* Emergency Reason */}
                {request.is_emergency && request.emergency_reason ? (
                  <View style={styles.emergencyReasonContainer}>
                    <View style={styles.emergencyReasonHeader}>
                      <Ionicons name="warning" size={16} color="#dc2626" />
                      <Text style={styles.emergencyReasonLabel}>Emergency Reason:</Text>
                    </View>
                    <Text style={styles.emergencyReasonText}>{request.emergency_reason}</Text>
                  </View>
                ) : null}
              </View>

              {/* Rejection Reason */}
              {request.status === 'rejected' && request.rejection_reason ? (
                <View style={styles.rejectionContainer}>
                  <Ionicons name="close-circle" size={16} color="#ef4444" />
                  <Text style={styles.rejectionText}>{request.rejection_reason}</Text>
                </View>
              ) : null}

              {/* Actions for Pending Requests */}
              {request.status === 'pending' && activeTab === 'pending' ? (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApprove(request.id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleReject(request)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* View Details Button */}
              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() =>
                  router.push({
                    pathname: '/(screens)/travel-request-details',
                    params: { requestId: request.id },
                  })
                }
              >
                <Text style={styles.viewDetailsText}>View Full Details</Text>
                <Ionicons name="chevron-forward" size={16} color="#C28F22" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button - Only show for non-director users */}
      {user?.role !== 'director' ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/(screens)/create-travel-request')}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      ) : null}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 48,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703',
    marginLeft: 12,
  },
  createButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#C28F22',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#65676B',
  },
  tabTextActive: {
    color: '#C28F22',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#65676B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emergencyCard: {
    borderWidth: 2,
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOpacity: 0.2,
    elevation: 5,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requesterName: {
    fontSize: 14,
    color: '#65676B',
    marginLeft: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  purposeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  detailsContainer: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#65676B',
    flex: 1,
    marginLeft: 8,
  },
  rejectionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
    marginBottom: 12,
  },
  rejectionText: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 6,
  },
  approveButton: {
    backgroundColor: '#10b981',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C28F22',
    marginRight: 4,
  },
  emergencyBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emergencyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    marginLeft: 6,
  },
  urgencyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ff0000',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  emergencyReasonContainer: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
    marginTop: 4,
  },
  emergencyReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  emergencyReasonLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991b1b',
    marginLeft: 6,
  },
  emergencyReasonText: {
    fontSize: 13,
    color: '#7f1d1d',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
