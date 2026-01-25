import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import ApiService from '@/services/api';
import { TripTicket } from '@/types';
import { LoadingComponent } from '@/components/LoadingComponent';

type DateFilter = 'all' | 'this_year' | 'this_month' | 'last_30_days';

export default function TripLogHistory() {
  const [completedTrips, setCompletedTrips] = useState<TripTicket[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<TripTicket[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    loadCompletedTrips();
  }, []);

  useEffect(() => {
    // Filter trips based on search query
    if (searchQuery.trim() === '') {
      setFilteredTrips(completedTrips);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = completedTrips.filter((trip: any) => {
        const travelRequest = trip.travelRequest || trip.travel_request;
        const ticketNumber = trip.ticket_number?.toLowerCase() || '';
        const passengerName = (travelRequest?.user?.name || trip.passenger_name || '').toLowerCase();
        const destination = getDestination(trip).toLowerCase();
        
        return (
          ticketNumber.includes(query) ||
          passengerName.includes(query) ||
          destination.includes(query)
        );
      });
      setFilteredTrips(filtered);
    }
  }, [searchQuery, completedTrips]);

  useEffect(() => {
    // Apply date filter
    applyDateFilter();
  }, [dateFilter, completedTrips, searchQuery]);

  const applyDateFilter = () => {
    let filtered = [...completedTrips];

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter((trip: any) => {
        const completedDate = new Date(trip.completed_at);
        
        switch (dateFilter) {
          case 'this_year':
            return completedDate.getFullYear() === now.getFullYear();
          case 'this_month':
            return (
              completedDate.getFullYear() === now.getFullYear() &&
              completedDate.getMonth() === now.getMonth()
            );
          case 'last_30_days':
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            return completedDate >= thirtyDaysAgo;
          default:
            return true;
        }
      });
    }

    // Apply search query if exists
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((trip: any) => {
        const travelRequest = trip.travelRequest || trip.travel_request;
        const ticketNumber = trip.ticket_number?.toLowerCase() || '';
        const passengerName = (travelRequest?.user?.name || trip.passenger_name || '').toLowerCase();
        const destination = getDestination(trip).toLowerCase();
        
        return (
          ticketNumber.includes(query) ||
          passengerName.includes(query) ||
          destination.includes(query)
        );
      });
    }

    setFilteredTrips(filtered);
  };

  const getDateFilterLabel = (filter: DateFilter): string => {
    switch (filter) {
      case 'all':
        return 'All Time';
      case 'this_year':
        return 'This Year';
      case 'this_month':
        return 'This Month';
      case 'last_30_days':
        return 'Last 30 Days';
      default:
        return 'All Time';
    }
  };

  const loadCompletedTrips = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      console.log('📥 Loading completed trip tickets...');

      // Get completed trip tickets with history
      const response = await ApiService.getTripTicketsHistory({
        status: 'completed',
        per_page: 50,
      });

      console.log('📦 Raw response:', response);

      // Handle both paginated and direct array responses (similar to tickets.tsx)
      let ticketsData;
      
      if (response.trip_tickets?.data && Array.isArray(response.trip_tickets.data)) {
        // Paginated response
        ticketsData = response.trip_tickets.data;
        console.log(`📊 Using paginated data: ${ticketsData.length} completed trips`);
      } else if (Array.isArray(response.trip_tickets)) {
        // Direct trip_tickets array response
        ticketsData = response.trip_tickets;
        console.log(`📊 Using trip_tickets array: ${ticketsData.length} completed trips`);
      } else if (response.data && Array.isArray(response.data)) {
        // Response.data is array
        ticketsData = response.data;
        console.log(`📊 Using response.data array: ${ticketsData.length} completed trips`);
      } else if (Array.isArray(response)) {
        // Response is direct array
        ticketsData = response;
        console.log(`📊 Using direct response array: ${ticketsData.length} completed trips`);
      } else {
        console.log('❌ No valid completed trips data found in response');
        ticketsData = [];
      }

      console.log(`✅ Loaded ${ticketsData.length} completed trips`);
      
      // Log first trip data to inspect structure
      if (ticketsData.length > 0) {
        console.log('🔍 First trip data:', JSON.stringify(ticketsData[0], null, 2));
        console.log('🎯 travelRequest:', ticketsData[0].travelRequest);
        console.log('🎯 destinations:', ticketsData[0].travelRequest?.destinations);
        console.log('🎯 destination:', ticketsData[0].destination);
      }
      
      setCompletedTrips(ticketsData);
      setFilteredTrips(ticketsData); // Initialize filtered trips
    } catch (error: any) {
      console.error('Failed to load trip history:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load trip history';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadCompletedTrips(true);
  };

  const downloadTripLogPDF = async (tripTicket: TripTicket) => {
    try {
      setDownloadingId(tripTicket.id);

      // Call API to generate PDF (this may take a moment)
      const response = await ApiService.downloadTripLogPDF(tripTicket.id);

      if (!response.pdf_base64) {
        throw new Error('PDF data not provided by server');
      }

      // Create filename
      const filename = response.filename || `trip_log_${tripTicket.ticket_number}_${Date.now()}.pdf`;
      
      // Create file in cache directory using expo-file-system v19 API
      const file = new File(Paths.cache, filename);
      
      // Write base64 PDF to file
      await file.write(response.pdf_base64, { encoding: 'base64' });

      console.log('PDF saved to:', file.uri);

      // Share the PDF - on Android, user can select PDF viewer or save to Downloads
      // on iOS, user can select "Open in..." to view in PDF reader
      // Clear loading state before opening sharing dialog
      setDownloadingId(null);
      
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'View or Save Trip Log PDF',
        UTI: 'com.adobe.pdf',
      });
    } catch (error: any) {
      console.error('Failed to download trip log PDF:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to generate trip log PDF';
      
      const errorDetails = error.response?.data?.error || '';
      const fullMessage = errorDetails ? `${errorMessage}\n\nDetails: ${errorDetails}` : errorMessage;
      
      Alert.alert('Download Error', fullMessage);
      setDownloadingId(null);
    }
  };

  const viewTripDetails = (tripTicket: TripTicket) => {
    router.push(`/trip-ticket-details?id=${tripTicket.id}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDestination = (trip: any): string => {
    // Check both camelCase and snake_case property names
    const travelRequest = trip.travelRequest || trip.travel_request;
    const destinations = travelRequest?.destinations;
    
    console.log(`🔍 getDestination called for trip ${trip.id}:`, {
      hasTravelRequest: !!travelRequest,
      hasDestinations: !!destinations,
      destinationsType: typeof destinations,
      destinationsValue: destinations,
      hasTripDestination: !!trip.destination,
      tripDestination: trip.destination,
    });
    
    if (!destinations) {
      // Fallback to trip.destination if travelRequest.destinations is not available
      console.log(`⚠️ No travelRequest.destinations, using fallback: ${trip.destination || 'N/A'}`);
      return trip.destination || 'N/A';
    }

    // If destinations is already an array, join them
    if (Array.isArray(destinations)) {
      console.log(`✅ destinations is array:`, destinations);
      return destinations.join(', ');
    }

    // If destinations is a string, try to parse it as JSON
    if (typeof destinations === 'string') {
      console.log(`🔄 destinations is string: "${destinations}"`);
      try {
        const parsed = JSON.parse(destinations);
        if (Array.isArray(parsed)) {
          console.log(`✅ Parsed as array:`, parsed);
          return parsed.join(', ');
        }
        console.log(`✅ Using as plain string: ${destinations}`);
        return destinations; // Return as-is if it's just a string
      } catch {
        // Not valid JSON, return as plain string
        console.log(`✅ Not JSON, using as plain string: ${destinations}`);
        return destinations;
      }
    }

    console.log(`❌ Unexpected type, returning N/A`);
    return 'N/A';
  };

  const renderTripLogItem = ({ item: trip }: { item: any }) => (
    <View style={styles.tripCard}>
      {/* Header */}
      <View style={styles.tripHeader}>
        <View style={styles.tripHeaderLeft}>
          <Icon name="receipt" size={20} color="#C28F22" />
          <View style={styles.tripHeaderText}>
            <Text style={styles.ticketNumber}>#{trip.ticket_number}</Text>
            <Text style={styles.tripDate}>
              {trip.travelRequest?.start_date || trip.travel_request?.start_date 
                ? formatDate(trip.travelRequest?.start_date || trip.travel_request?.start_date) 
                : formatDate(trip.created_at)}
            </Text>
          </View>
        </View>
        <View style={styles.completedBadge}>
          <Icon name="checkmark-circle" size={16} color="#10b981" />
          <Text style={styles.completedText}>Completed</Text>
        </View>
      </View>

      {/* Trip Details */}
      <View style={styles.tripDetails}>
        <View style={styles.detailRow}>
          <Icon name="location-outline" size={16} color="#6b7280" />
          <Text style={styles.detailLabel}>Destination:</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {getDestination(trip)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="person-outline" size={16} color="#6b7280" />
          <Text style={styles.detailLabel}>Passenger:</Text>
          <Text style={styles.detailValue} numberOfLines={1}>
            {trip.travelRequest?.user?.name || 
             trip.travel_request?.user?.name || 
             trip.passenger_name || 
             'N/A'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Icon name="calendar-outline" size={16} color="#6b7280" />
          <Text style={styles.detailLabel}>Completed:</Text>
          <Text style={styles.detailValue}>{formatDateTime(trip.completed_at)}</Text>
        </View>

        {trip.end_mileage != null && (
          <View style={styles.detailRow}>
            <Icon name="speedometer-outline" size={16} color="#6b7280" />
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>
              {Number(trip.end_mileage).toFixed(1)} km
            </Text>
          </View>
        )}

        {trip.fuel_consumed && (
          <View style={styles.detailRow}>
            <Icon name="water-outline" size={16} color="#6b7280" />
            <Text style={styles.detailLabel}>Fuel Used:</Text>
            <Text style={styles.detailValue}>{trip.fuel_consumed} L</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.tripActions}>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => viewTripDetails(trip)}
        >
          <Icon name="eye-outline" size={18} color="#3E0703" />
          <Text style={styles.viewButtonText}>View Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.downloadButton,
            downloadingId === trip.id && styles.downloadButtonDisabled
          ]}
          onPress={() => downloadTripLogPDF(trip)}
          disabled={downloadingId === trip.id}
        >
          {downloadingId === trip.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="document-text-outline" size={18} color="#fff" />
              <Text style={styles.downloadButtonText}>View PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading && completedTrips.length === 0) {
    return <LoadingComponent message="Loading trip log history..." color="#3E0703" />;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Icon name="arrow-back" size={24} color="#3E0703" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Icon name="receipt" size={24} color="#3E0703" />
          <Text style={styles.headerTitle}>Trip Log History</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar with Date Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ticket, passenger, or destination..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
            >
              <Icon name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* Date Filter Button */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDateFilterModal(true)}
        >
          <Icon name="calendar-outline" size={20} color="#3E0703" />
          {dateFilter !== 'all' && <View style={styles.filterActiveDot} />}
        </TouchableOpacity>
      </View>

      {/* Active Filter Badge */}
      {dateFilter !== 'all' && (
        <View style={styles.activeFilterContainer}>
          <View style={styles.activeFilterBadge}>
            <Text style={styles.activeFilterText}>{getDateFilterLabel(dateFilter)}</Text>
            <TouchableOpacity onPress={() => setDateFilter('all')}>
              <Icon name="close" size={16} color="#3E0703" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trip List */}
      {filteredTrips.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Icon name="receipt-outline" size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No Results Found' : 'No Completed Trips'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery 
              ? 'Try adjusting your search terms' 
              : 'Your completed trip logs will appear here'}
          </Text>
          {searchQuery && (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchButtonText}>Clear Search</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          renderItem={renderTripLogItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#3E0703']}
              tintColor="#3E0703"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* PDF Loading Modal */}
      <Modal
        visible={downloadingId !== null}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalOverlay}>
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#3E0703" />
            <Text style={styles.loadingModalTitle}>Generating PDF...</Text>
            <Text style={styles.loadingModalMessage}>
              This may take a moment. Please wait while we prepare your trip log.
            </Text>
          </View>
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilterModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDateFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateFilterModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Date</Text>
              <TouchableOpacity onPress={() => setShowDateFilterModal(false)}>
                <Icon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptions}>
              {[
                { value: 'all' as DateFilter, label: 'All Time', icon: 'infinite' },
                { value: 'this_year' as DateFilter, label: 'This Year', icon: 'calendar' },
                { value: 'this_month' as DateFilter, label: 'This Month', icon: 'calendar-outline' },
                { value: 'last_30_days' as DateFilter, label: 'Last 30 Days', icon: 'time-outline' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    dateFilter === option.value && styles.filterOptionActive
                  ]}
                  onPress={() => {
                    setDateFilter(option.value);
                    setShowDateFilterModal(false);
                  }}
                >
                  <Icon
                    name={option.icon}
                    size={20}
                    color={dateFilter === option.value ? '#3E0703' : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      dateFilter === option.value && styles.filterOptionTextActive
                    ]}
                  >
                    {option.label}
                  </Text>
                  {dateFilter === option.value && (
                    <Icon name="checkmark-circle" size={20} color="#3E0703" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },

  // Header
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    width: 40,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703',
  },
  headerRight: {
    width: 40,
  },

  // Search Bar with Filter
  searchRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C28F22',
  },

  // Active Filter Badge
  activeFilterContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  activeFilterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  activeFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3E0703',
  },

  // Loading Modal Styles
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E0703',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingModalMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  filterOptions: {
    padding: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  filterOptionActive: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#C28F22',
  },
  filterOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#3E0703',
    fontWeight: '600',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Trip Card
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tripHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  tripHeaderText: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E0703',
  },
  tripDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },

  // Trip Details
  tripDetails: {
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    width: 90,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },

  // Actions
  tripActions: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3E0703',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E0703',
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C28F22',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  clearSearchButton: {
    marginTop: 16,
    backgroundColor: '#3E0703',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
