import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardData, TripTicket } from '@/types';
import ApiService from '@/services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LoadingComponent } from '@/components/LoadingComponent';
import { NotificationBellButton } from '@/components/NotificationBellButton';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initial load on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      loadDashboardData();
      if (user.role === 'driver') {
        loadActiveTrip();
      }
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Reload data whenever user focuses on this tab (real-time updates)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user) {
        console.log('🔄 Dashboard tab focused - refreshing data');
        loadDashboardData(true); // Silent refresh
        if (user.role === 'driver') {
          loadActiveTrip();
        }
      }
    }, [isAuthenticated, user])
  );

  const loadDashboardData = async (isRefresh = false) => {
    // Check if user is authenticated before loading
    if (!isAuthenticated || !user) {
      console.log('⚠️ User not authenticated, skipping dashboard load');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Fetch dashboard data based on role
      let dashboardData;
      let statistics = null;

      if (user.role === 'driver') {
        // Fetch both dashboard and enhanced statistics for drivers
        [dashboardData, statistics] = await Promise.all([
          ApiService.getDriverDashboard(),
          ApiService.getDriverStatistics()
        ]);
      } else if (user.role === 'director') {
        // Fetch director dashboard
        dashboardData = await ApiService.getDirectorDashboard();
      } else if (user.role === 'regular') {
        // Fetch regular user dashboard
        dashboardData = await ApiService.getRegularUserDashboard();
      }

      // Merge the data
      const mergedData = statistics ? {
        ...dashboardData,
        stats: {
          ...dashboardData.stats,
          ...statistics.statistics
        }
      } : dashboardData;

      // Debug: Log recent trips data
      console.log('Recent trips data:', mergedData.recent_trips);
      if (mergedData.recent_trips && mergedData.recent_trips.length > 0) {
        mergedData.recent_trips.forEach((trip: TripTicket, index: number) => {
          console.log(`Trip ${index + 1}:`, {
            id: trip.id,
            hasTravelRequest: !!trip.travelRequest,
            purpose: trip.travelRequest?.purpose,
            destinations: trip.travelRequest?.destinations,
            endMileage: trip.end_mileage
          });
        });
      }

      // Check if recent trips are missing travelRequest data and fetch individual details
      if (mergedData.recent_trips && mergedData.recent_trips.length > 0) {
        const tripsWithMissingData = mergedData.recent_trips.filter((trip: TripTicket) => !trip.travelRequest);
        
        if (tripsWithMissingData.length > 0 && tripsWithMissingData.length <= 10) {
          console.log(`📝 Found ${tripsWithMissingData.length} recent trips missing travelRequest data, fetching individual details...`);
          
          try {
            // Fetch individual trip details for trips missing travelRequest (limit to 10 to avoid too many requests)
            const enhancedTrips = await Promise.all(
              mergedData.recent_trips.map(async (trip: TripTicket) => {
                if (!trip.travelRequest) {
                  try {
                    console.log(`🔍 Fetching details for trip ${trip.id}...`);
                    const detailedTripResponse = await ApiService.getTripTicket(trip.id);
                    const detailedTrip = detailedTripResponse.trip_ticket || detailedTripResponse.data || detailedTripResponse;
                    console.log(`✅ Enhanced trip ${trip.id} with travelRequest:`, {
                      hasTravelRequest: !!detailedTrip.travelRequest,
                      hasUser: !!detailedTrip.travelRequest?.user,
                      hasPurpose: !!detailedTrip.travelRequest?.purpose,
                      hasDestinations: !!detailedTrip.travelRequest?.destinations
                    });
                    return detailedTrip;
                  } catch (error) {
                    console.error(`❌ Failed to fetch details for trip ${trip.id}:`, error);
                    return trip; // Return original trip if detailed fetch fails
                  }
                }
                return trip;
              })
            );
            
            mergedData.recent_trips = enhancedTrips;
            console.log('✅ Enhanced recent trips with travelRequest data');
          } catch (error) {
            console.error('❌ Error enhancing recent trips with individual details:', error);
            // Keep original data if enhancement fails
          }
        } else if (tripsWithMissingData.length > 10) {
          console.log(`⚠️ Too many recent trips (${tripsWithMissingData.length}) missing travelRequest data, skipping individual fetch to avoid performance issues`);
        } else {
          console.log('✅ All recent trips have travelRequest data');
        }
      }

      setDashboardData(mergedData);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      Alert.alert('Error', 'Failed to load dashboard data. Please check your connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadActiveTrip = async () => {
    // Only drivers have active trips - check role
    if (!isAuthenticated || !user || user.role !== 'driver') {
      console.log('⚠️ User not a driver, skipping active trip load');
      return;
    }

    try {
      const response = await ApiService.getActiveTrip();
      console.log('Active trip response:', response);
      let activeTripData = response.active_trip || null;
      
      // If active trip exists but is missing travelRequest data, fetch detailed data
      if (activeTripData && !activeTripData.travelRequest) {
        console.log('Active trip missing travelRequest data, fetching detailed data...');
        try {
          const detailedResponse = await ApiService.getTripTicket(activeTripData.id);
          const detailedTrip = detailedResponse.trip_ticket || detailedResponse.data || detailedResponse;
          console.log('Enhanced active trip with travelRequest:', {
            hasTravelRequest: !!detailedTrip.travelRequest,
            hasUser: !!detailedTrip.travelRequest?.user,
            hasPurpose: !!detailedTrip.travelRequest?.purpose
          });
          activeTripData = detailedTrip;
        } catch (error) {
          console.error('Failed to fetch detailed active trip data:', error);
          // Keep original data if detailed fetch fails
        }
      }
      
      setActiveTrip(activeTripData);
    } catch (error: any) {
      console.error('Failed to load active trip:', error);
      // Don't show alert for this as it's not critical
    }
  };

  const handleRefresh = () => {
    loadDashboardData(true);
    loadActiveTrip();
  };

  const handleStartTrip = async (tripTicket: TripTicket) => {
    try {
      await ApiService.startTrip(tripTicket.id);
      Alert.alert('Success', 'Trip started successfully');
      loadDashboardData();
    } catch (error: any) {
      console.error('Failed to start trip:', error);
      const errorMessage = error.response?.status === 401 
        ? 'Session expired. Please log in again.'
        : 'Failed to start trip. Please try again.';
      Alert.alert('Error', errorMessage);
    }
  };

  const navigateToTripTickets = () => {
    router.push('/(tabs)/tickets');
  };

  const navigateToVehicles = () => {
    router.push('/(tabs)/vehicles');
  };

  const navigateToTrips = () => {
    router.push('/(tabs)/trips');
  };

  if (isLoading && !dashboardData) {
    return (
      <LoadingComponent 
        message="Loading your dashboard..." 
        color="#000000"
      />
    );
  }

  // If user is not authenticated, show unauthorized message
  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Icon name="lock-closed" size={64} color="#999" />
        <Text style={styles.unauthorizedText}>
          Please log in to view dashboard
        </Text>
      </View>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Director Dashboard Render Function
  const renderDirectorDashboard = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleContainer}>
            {user?.profile_picture ? (
              <Image
                source={{ uri: user.profile_picture }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0).toUpperCase() || 'D'}
                </Text>
              </View>
            )}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.driverName}>{user?.name || 'Director'}</Text>
              <Text style={styles.driverRole}>Director Dashboard</Text>
            </View>
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
        {dashboardData && (
          <>
            {/* Statistics Cards */}
            <View style={styles.statsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <Icon name="stats-chart" size={24} color="#C28F22" />
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Statistics</Text>
                    <Text style={styles.sectionSubtitle}>Travel request overview</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="hourglass" size={24} color="#f59e0b" />
                    <Text style={styles.statValue}>{dashboardData.stats.pending_requests || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Pending Requests</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="checkmark-circle" size={24} color="#10b981" />
                    <Text style={styles.statValue}>{dashboardData.stats.approved_today || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Approved Today</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="document-text" size={24} color="#000" />
                    <Text style={styles.statValue}>{dashboardData.stats.my_requests || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>My Requests</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="time" size={24} color="#ef4444" />
                    <Text style={styles.statValue}>{dashboardData.stats.my_pending || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>My Pending</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <Icon name="flash" size={24} color="#C28F22" />
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <Text style={styles.sectionSubtitle}>Common tasks</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity 
                  style={styles.actionCard}
                  onPress={() => router.push('/(tabs)/travel-requests')}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: '#fef3c7' }]}>
                    <Icon name="hourglass-outline" size={28} color="#f59e0b" />
                  </View>
                  <Text style={styles.actionLabel}>Review Pending</Text>
                  <Text style={styles.actionSubtext}>
                    {dashboardData.stats.pending_requests || 0} waiting
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionCard}
                  onPress={() => router.push('/(tabs)/travel-requests')}
                >
                  <View style={[styles.actionIconContainer, { backgroundColor: '#dcfce7' }]}>
                    <Icon name="checkmark-circle-outline" size={28} color="#10b981" />
                  </View>
                  <Text style={styles.actionLabel}>View Approved</Text>
                  <Text style={styles.actionSubtext}>Check history</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Pending Requests - Priority Section */}
            {dashboardData.pending_requests && dashboardData.pending_requests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderContent}>
                    <View style={styles.priorityBadge}>
                      <Icon name="alert-circle" size={20} color="#fff" />
                      <Text style={styles.priorityBadgeText}>Action Required</Text>
                    </View>
                    <View style={styles.sectionHeaderText}>
                      <Text style={styles.sectionTitle}>Pending Approvals</Text>
                      <Text style={styles.sectionSubtitle}>
                        {dashboardData.pending_requests.length} request{dashboardData.pending_requests.length !== 1 ? 's' : ''} awaiting review
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/travel-requests')}>
                    <Text style={styles.viewAllText}>View All →</Text>
                  </TouchableOpacity>
                </View>
                
                {dashboardData.pending_requests.slice(0, 5).map((request: any, index: number) => (
                  <TouchableOpacity 
                    key={request.id} 
                    style={styles.requestCard}
                    onPress={() => router.push('/(tabs)/travel-requests')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.requestCardHeader}>
                      <View style={styles.requestUserSection}>
                        <View style={styles.userAvatar}>
                          <Text style={styles.userAvatarText}>
                            {request.user?.name?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        </View>
                        <View style={styles.requestUserInfo}>
                          <Text style={styles.requestUser}>{request.user?.name || 'Unknown'}</Text>
                          <Text style={styles.requestTime}>
                            Requested {formatDate(request.created_at)}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, styles.pendingBadge]}>
                        <Icon name="time-outline" size={14} color="#f59e0b" />
                        <Text style={[styles.statusText, { color: '#f59e0b' }]}>Pending</Text>
                      </View>
                    </View>
                    
                    <View style={styles.requestContent}>
                      <View style={styles.requestInfoRow}>
                        <Icon name="location" size={16} color="#C28F22" />
                        <Text style={styles.requestPurpose} numberOfLines={2}>
                          {request.purpose}
                        </Text>
                      </View>
                      
                      {request.destinations && request.destinations.length > 0 && (
                        <View style={styles.requestInfoRow}>
                          <Icon name="navigate" size={16} color="#65676B" />
                          <Text style={styles.requestDestination} numberOfLines={1}>
                            {request.destinations.join(', ')}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.requestInfoRow}>
                        <Icon name="calendar" size={16} color="#65676B" />
                        <Text style={styles.requestDate}>
                          {formatDate(request.start_date)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.requestFooter}>
                      <Text style={styles.tapToReviewText}>Tap to review and approve</Text>
                      <Icon name="chevron-forward" size={18} color="#C28F22" />
                    </View>
                  </TouchableOpacity>
                ))}

                {dashboardData.pending_requests.length > 5 && (
                  <TouchableOpacity 
                    style={styles.showMoreButton}
                    onPress={() => router.push('/(tabs)/travel-requests')}
                  >
                    <Text style={styles.showMoreText}>
                      Show {dashboardData.pending_requests.length - 5} more pending request{dashboardData.pending_requests.length - 5 !== 1 ? 's' : ''}
                    </Text>
                    <Icon name="chevron-down" size={20} color="#C28F22" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* My Recent Requests */}
            {dashboardData.my_requests && dashboardData.my_requests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderContent}>
                    <Icon name="document-text" size={24} color="#C28F22" />
                    <View style={styles.sectionHeaderText}>
                      <Text style={styles.sectionTitle}>My Travel Requests</Text>
                      <Text style={styles.sectionSubtitle}>Your recent submissions</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/travel-requests' as any)}>
                    <Text style={styles.viewAllText}>View All →</Text>
                  </TouchableOpacity>
                </View>
                
                {dashboardData.my_requests.slice(0, 3).map((request: any) => (
                  <View key={request.id} style={styles.myRequestCard}>
                    <View style={styles.requestHeader}>
                      <Text style={styles.myRequestPurpose} numberOfLines={2}>
                        {request.purpose}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        request.status === 'approved' 
                          ? styles.approvedBadge 
                          : request.status === 'rejected'
                          ? styles.rejectedBadge
                          : styles.pendingBadge
                      ]}>
                        <Icon 
                          name={
                            request.status === 'approved' 
                              ? 'checkmark-circle' 
                              : request.status === 'rejected'
                              ? 'close-circle'
                              : 'time-outline'
                          } 
                          size={14} 
                          color={
                            request.status === 'approved' 
                              ? '#10b981' 
                              : request.status === 'rejected'
                              ? '#ef4444'
                              : '#f59e0b'
                          } 
                        />
                        <Text style={[
                          styles.statusText,
                          { 
                            color: request.status === 'approved' 
                              ? '#10b981' 
                              : request.status === 'rejected'
                              ? '#ef4444'
                              : '#f59e0b'
                          }
                        ]}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.myRequestDetails}>
                      <View style={styles.requestInfoRow}>
                        <Icon name="calendar-outline" size={14} color="#65676B" />
                        <Text style={styles.myRequestDate}>
                          {formatDate(request.start_date)}
                        </Text>
                      </View>
                      {request.approver && (
                        <View style={styles.requestInfoRow}>
                          <Icon name="person-outline" size={14} color="#65676B" />
                          <Text style={styles.approverText}>
                            Reviewed by {request.approver.name}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Empty State - No Pending Requests */}
            {(!dashboardData.pending_requests || dashboardData.pending_requests.length === 0) && (
              <View style={styles.emptyStateSection}>
                <View style={styles.emptyStateIconContainer}>
                  <Icon name="checkmark-done-circle" size={64} color="#10b981" />
                </View>
                <Text style={styles.emptyStateTitle}>All Caught Up! 🎉</Text>
                <Text style={styles.emptyStateMessage}>
                  No pending travel requests at the moment. Great work staying on top of approvals!
                </Text>
              </View>
            )}
          </>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );

  // Regular User Dashboard Render Function
  const renderRegularUserDashboard = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleContainer}>
            {user?.profile_picture ? (
              <Image
                source={{ uri: user.profile_picture }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.driverName}>{user?.name || 'User'}</Text>
              <Text style={styles.driverRole}>Dashboard</Text>
            </View>
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
            colors={['#000']}
            tintColor="#000"
          />
        }
      >
        {dashboardData && (
          <>
            {/* Statistics Cards */}
            <View style={styles.statsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <Icon name="stats-chart" size={24} color="#C28F22" />
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Overview</Text>
                    <Text style={styles.sectionSubtitle}>Current trip statistics</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="car-sport" size={24} color="#10b981" />
                    <Text style={styles.statValue}>{dashboardData.stats.active_trips || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Active Trips</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="today" size={24} color="#FFFFFF" />
                    <Text style={styles.statValue}>{dashboardData.stats.total_trips_today || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Trips Today</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <Icon name="navigate" size={24} color="#C28F22" />
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <Text style={styles.sectionSubtitle}>Track active trips</Text>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.trackingActionCard}
                onPress={() => router.push('/(tabs)/gps-tracking')}
              >
                <View style={styles.trackingActionIconContainer}>
                  <Icon name="location" size={32} color="#10b981" />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>GPS Tracking</Text>
                  <Text style={styles.actionDescription}>
                    Track {dashboardData.stats.active_trips || 0} active trip{dashboardData.stats.active_trips !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {/* Active Trips List */}
            {dashboardData.active_trips && dashboardData.active_trips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderContent}>
                    <Icon name="map" size={24} color="#C28F22" />
                    <View style={styles.sectionHeaderText}>
                      <Text style={styles.sectionTitle}>Active Trips</Text>
                      <Text style={styles.sectionSubtitle}>Currently ongoing</Text>
                    </View>
                  </View>
                </View>
                
                {dashboardData.active_trips.map((trip: any) => (
                  <View key={trip.id} style={styles.tripCard}>
                    <View style={styles.tripHeader}>
                      <View>
                        <Text style={styles.tripDriver}>
                          {trip.driver?.name || 'Unknown Driver'}
                        </Text>
                        <Text style={styles.tripVehicle}>
                          {trip.vehicle?.plate_number || 'N/A'} - {trip.vehicle?.type || 'N/A'}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.statusText, { color: '#10b981' }]}>Ongoing</Text>
                      </View>
                    </View>
                    {trip.travelRequest && (
                      <Text style={styles.tripPurpose}>{trip.travelRequest.purpose}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );

  // Render based on user role
  if (user.role === 'director') {
    return renderDirectorDashboard();
  } else if (user.role === 'regular') {
    return renderRegularUserDashboard();
  }

  // Default: Driver Dashboard
  return (
    <View style={styles.container}>
      {/* Header with Driver Info */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleContainer}>
            {user?.profile_picture ? (
              <Image
                source={{ uri: user.profile_picture }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0).toUpperCase() || 'D'}
                </Text>
              </View>
            )}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.driverName}>{user?.name || 'Driver'}</Text>
              <Text style={styles.driverRole}>Driver Dashboard</Text>
            </View>
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

        {/* Main Statistics Cards */}
        {dashboardData && (
          <>
            {/* Overview Stats */}
            <View style={styles.statsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <Icon name="stats-chart" size={24} color="#C28F22" />
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Today&apos;s Overview</Text>
                    <Text style={styles.sectionSubtitle}>Your current statistics</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="car-sport" size={24} color="#000" />
                    <Text style={styles.statValue}>{dashboardData.stats.vehicles_count || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Available Vehicles</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="today" size={24} color="#000" />
                    <Text style={styles.statValue}>{dashboardData.stats.trips_today || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Trips Today</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="documents" size={24} color="#000" />
                    <Text style={styles.statValue}>{dashboardData.stats.active_trips || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Active Tickets</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Icon name="checkmark-circle" size={24} color="#000" />
                    <Text style={styles.statValue}>{dashboardData.stats.completed_tickets || 0}</Text>
                  </View>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
              </View>
            </View>

            {/* Monthly Performance */}
            <View style={styles.performanceSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderContent}>
                  <Icon name="trending-up" size={24} color="#C28F22" />
                  <View style={styles.sectionHeaderText}>
                    <Text style={styles.sectionTitle}>Monthly Performance</Text>
                    <Text style={styles.sectionSubtitle}>Your driving statistics this month</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.performanceGrid}>
                <View style={styles.performanceCard}>
                  <View style={styles.performanceHeader}>
                    <Icon name="speedometer" size={20} color="#C28F22" />
                    <Text style={styles.performanceLabel}>Distance Covered</Text>
                  </View>
                  <Text style={styles.performanceValue}>{dashboardData.stats.monthly_distance || 0} km</Text>
                  <Text style={styles.performanceChange}>+12% from last month</Text>
                </View>
                
                <View style={styles.performanceCard}>
                  <View style={styles.performanceHeader}>
                    <Icon name="water" size={20} color="#C28F22" />
                    <Text style={styles.performanceLabel}>Fuel Consumed</Text>
                  </View>
                  <Text style={styles.performanceValue}>{dashboardData.stats.monthly_fuel || 0} L</Text>
                  <Text style={styles.performanceChange}>-5% from last month</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Active Trips */}
        {activeTrip && (
          <View style={styles.activeTripsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderContent}>
                <Icon name="car" size={24} color="#C28F22" />
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Active Trips</Text>
                  <Text style={styles.sectionSubtitle}>On going trip</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.activeTripsContent}>
              <View key={activeTrip.id} style={styles.activeTripCard}>
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripStatus}>
                    <Icon 
                      name={activeTrip.status === 'ready_for_trip' ? 'play-circle' : 'car-sport'} 
                      size={16} 
                      color="#C28F22" 
                    />
                    <Text style={styles.tripStatusText}>{activeTrip.status.replace('_', ' ').toUpperCase()}</Text>
                  </View>
                </View>
                
                <View style={styles.tripDetails}>
                  {/* Purpose */}
                  <View style={styles.purposeSection}>
                    <Text style={styles.purposeLabel}>Purpose</Text>
                    <Text style={styles.purposeText} numberOfLines={2}>
                      {activeTrip.travelRequest?.purpose || 'No purpose specified'}
                    </Text>
                  </View>

                  {/* Destination */}
                  {activeTrip.travelRequest?.destinations && (
                    <View style={styles.destinationSection}>
                      <View style={styles.destinationContainer}>
                        <Icon name="location-outline" size={16} color="#666" />
                        <Text style={styles.destinationLabel}>Destination</Text>
                      </View>
                      <Text style={styles.destinationText} numberOfLines={1}>
                        {Array.isArray(activeTrip.travelRequest.destinations) 
                          ? activeTrip.travelRequest.destinations.join(', ')
                          : activeTrip.travelRequest.destinations}
                      </Text>
                    </View>
                  )}
                </View>
                
                {activeTrip.status === 'ready_for_trip' && (
                  <TouchableOpacity
                    style={styles.startTripButton}
                    onPress={() => handleStartTrip(activeTrip)}
                  >
                    <Icon name="play" size={16} color="#fff" />
                    <Text style={styles.startTripButtonText}>Start Trip</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderContent}>
              <Icon name="flash" size={24} color="#C28F22" />
              <View style={styles.sectionHeaderText}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <Text style={styles.sectionSubtitle}>Navigate to frequently used features</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={navigateToTripTickets}>
              <View style={styles.actionIconContainer}>
                <Icon name="document-text" size={24} color="#000" />
              </View>
              <Text style={styles.actionLabel}>Trip Tickets</Text>
              <Text style={styles.actionSubtext}>View & manage</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={navigateToVehicles}>
              <View style={styles.actionIconContainer}>
                <Icon name="car-sport" size={24} color="#000" />
              </View>
              <Text style={styles.actionLabel}>Vehicles</Text>
              <Text style={styles.actionSubtext}>Fleet management</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={navigateToTrips}>
              <View style={styles.actionIconContainer}>
                <Icon name="map" size={24} color="#000" />
              </View>
              <Text style={styles.actionLabel}>My Trips</Text>
              <Text style={styles.actionSubtext}>Trip history</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/vehicles')}>
              <View style={styles.actionIconContainer}>
                <Icon name="search" size={24} color="#000" />
              </View>
              <Text style={styles.actionLabel}>Search</Text>
              <Text style={styles.actionSubtext}>Find vehicles</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Trips */}
        {dashboardData && dashboardData.recent_trips && dashboardData.recent_trips.length > 0 && (
          <View style={styles.recentTripsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderContent}>
                <Icon name="time" size={24} color="#C28F22" />
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.sectionTitle}>Recent Trips</Text>
                  <Text style={styles.sectionSubtitle}>Your latest completed journeys</Text>
                </View>
              </View>
            </View>
            
            <View style={styles.recentTripsContent}>
              {dashboardData.recent_trips.map((trip) => {
                // Enhanced data extraction with fallbacks
                const getDestination = () => {
                  // Try travelRequest.destinations first
                  if (trip.travelRequest?.destinations) {
                    if (Array.isArray(trip.travelRequest.destinations) && trip.travelRequest.destinations.length > 0) {
                      return trip.travelRequest.destinations.join(', ');
                    }
                    if (typeof trip.travelRequest.destinations === 'string' && trip.travelRequest.destinations.trim()) {
                      return trip.travelRequest.destinations;
                    }
                  }
                  // Fallback to direct destination field
                  if (trip.destination && typeof trip.destination === 'string' && trip.destination.trim()) {
                    return trip.destination;
                  }
                  return 'Destination not specified';
                };

                const getPurpose = () => {
                  // Try travelRequest.purpose first
                  if (trip.travelRequest?.purpose && trip.travelRequest.purpose.trim()) {
                    return trip.travelRequest.purpose;
                  }
                  // Fallback to direct purpose field
                  if (trip.purpose && typeof trip.purpose === 'string' && trip.purpose.trim()) {
                    return trip.purpose;
                  }
                  return 'No purpose specified';
                };

                const getPassengerName = () => {
                  // Try travelRequest.user.name first
                  if (trip.travelRequest?.user?.name) {
                    return trip.travelRequest.user.name;
                  }
                  // Fallback to direct passenger_name field
                  if (trip.passenger_name) {
                    return trip.passenger_name;
                  }
                  return null;
                };

                const destination = getDestination();
                const purpose = getPurpose();
                const passengerName = getPassengerName();

                return (
                  <TouchableOpacity 
                    key={trip.id} 
                    style={styles.recentTripCard}
                    onPress={() => router.push(`/trip-ticket-details?id=${trip.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.recentTripHeader}>
                      <View style={styles.tripDateContainer}>
                        <Icon name="calendar-outline" size={16} color="#C28F22" />
                        <Text style={styles.recentTripDate}>
                          {formatDate(trip.completed_at || trip.created_at)}
                        </Text>
                      </View>
                      <View style={styles.tripDistanceContainer}>
                        <Icon name="speedometer-outline" size={16} color="#10b981" />
                        <Text style={styles.recentTripDistance}>
                          {trip.end_mileage ? `${trip.end_mileage} km` : 'N/A'}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Passenger Name */}
                    {passengerName && (
                      <View style={styles.passengerSection}>
                        <View style={styles.passengerAvatar}>
                          <Text style={styles.passengerAvatarText}>
                            {passengerName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.passengerName}>{passengerName}</Text>
                      </View>
                    )}
                    
                    <View style={styles.recentTripDetails}>
                      <View style={styles.tripDetailRow}>
                        <Icon name="location" size={16} color="#65676B" />
                        <Text style={styles.recentTripDestination} numberOfLines={2}>
                          {destination}
                        </Text>
                      </View>
                      
                      <View style={styles.tripDetailRow}>
                        <Icon name="document-text" size={16} color="#65676B" />
                        <Text style={styles.recentTripPurpose} numberOfLines={2}>
                          {purpose}
                        </Text>
                      </View>
                    </View>

                    {/* Ticket Number */}
                    <View style={styles.tripFooter}>
                      <Text style={styles.tripTicketNumber}>
                        {trip.ticket_number || `TT-${trip.id}`}
                      </Text>
                      <Text style={styles.viewDetailsText}>Tap to view →</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileImage: {
    width: 45,
    height: 45,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#C28F22',
  },
  profilePlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 50,
    backgroundColor: '#C28F22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  welcomeSection: {
    justifyContent: 'center', // Center the content vertically
  },
  welcomeText: {
    fontSize: 12,
    color: '#65676B',
    marginBottom: 2,
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000', // Ensure full white color
    marginBottom: 2,
  },
  driverRole: {
    fontSize: 10,
    color: '#C28F22',
    fontWeight: '600',
  },

  // Content Styles
  content: {
    flex: 1,
    padding: 16,
  },

  // Section Styles
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#65676B',
  },
  sectionHeader: {
    backgroundColor: '#FBFCF8',
    padding: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderText: {
    marginLeft: 12,
    flex: 1,
  },

  // Statistics Section
  statsSection: {
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
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CCD0D5',
    borderLeftWidth: 1,
    borderLeftColor: '#CCD0D5',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 14,
    color: '#65676B',
    fontWeight: '500',
  },

  // Performance Section
  performanceSection: {
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
  performanceGrid: {
    padding: 16,
  },
  performanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
    marginLeft: 8,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  performanceChange: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  // Active Trips Section
  activeTripsSection: {
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
  activeTripsContent: {
    padding: 16,
  },
  activeTripCard: {
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tripStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C28F22',
    marginLeft: 6,
  },
  tripDetails: {
    marginBottom: 12,
  },
  tripDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  purposeSection: {
    marginBottom: 12,
  },
  purposeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65676B',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  purposeText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  destinationSection: {
    marginBottom: 12,
  },
  destinationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  destinationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e67e22',
    marginLeft: 4,
  },
  destinationText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  startTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3E0703',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  startTripButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  // Quick Actions Section
  quickActionsSection: {
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
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSubtext: {
    fontSize: 12,
    color: '#65676B',
    textAlign: 'center',
  },
  // Recent Trips Section
  recentTripsSection: {
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
  recentTripsContent: {
    padding: 16,
  },
  recentTripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  recentTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentTripDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C28F22',
    marginLeft: 6,
  },
  tripDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentTripDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 6,
  },
  recentTripDetails: {
    gap: 8,
  },
  recentTripDestination: {
    fontSize: 14,
    fontWeight: '500',
    color: '#050505',
    marginLeft: 8,
    flex: 1,
  },
  recentTripPurpose: {
    fontSize: 14,
    color: '#65676B',
    marginLeft: 8,
    flex: 1,
  },
  passengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  passengerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 50,
    backgroundColor: '#C28F22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  passengerAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  passengerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
  },
  tripTicketNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#65676B',
    fontStyle: 'italic',
  },

  // Request Card Styles (for Director)
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  requestPurpose: {
    fontSize: 14,
    fontWeight: '500',
    color: '#050505',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#65676B',
  },

  // Trip Card Styles (for Regular User)
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tripDriver: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  tripVehicle: {
    fontSize: 14,
    color: '#65676B',
    marginTop: 4,
  },
  tripPurpose: {
    fontSize: 14,
    color: '#050505',
  },

  // Action Card Styles (for Regular User GPS Tracking)
  trackingActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  trackingActionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#65676B',
  },

  // Enhanced Director Dashboard Styles
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  priorityBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  requestUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C28F22',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestUserInfo: {
    flex: 1,
  },
  requestTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  requestContent: {
    gap: 8,
    marginBottom: 12,
  },
  requestInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestDestination: {
    fontSize: 13,
    color: '#65676B',
    flex: 1,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  tapToReviewText: {
    fontSize: 13,
    color: '#C28F22',
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  approvedBadge: {
    backgroundColor: '#dcfce7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rejectedBadge: {
    backgroundColor: '#fee2e2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  showMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  showMoreText: {
    fontSize: 14,
    color: '#C28F22',
    fontWeight: '600',
  },
  myRequestCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  myRequestPurpose: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    marginRight: 12,
  },
  myRequestDetails: {
    marginTop: 12,
    gap: 6,
  },
  myRequestDate: {
    fontSize: 13,
    color: '#65676B',
  },
  approverText: {
    fontSize: 13,
    color: '#65676B',
  },
  emptyStateSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 40,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyStateIconContainer: {
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#65676B',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Bottom Spacing
  bottomSpacing: {
    height: 40,
  },

  // Unauthorized styles
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  unauthorizedText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
});
