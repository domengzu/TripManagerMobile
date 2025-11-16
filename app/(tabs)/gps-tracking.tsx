import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import ApiService from '../../services/api';
import { ErrorHandler } from '../../utils/errorHandler';
import { NotificationBellButton } from '@/components/NotificationBellButton';

interface TripLocation {
  trip_ticket_id: string;
  ticket_number: string;
  status: string;
  driver: {
    id: number;
    name: string;
    phone: string;
  };
  vehicle: {
    plate_number: string;
    type: string;
    model: string;
  };
  current_location: {
    latitude: number;
    longitude: number;
    updated_at: string;
  } | null;
  travel_request: {
    purpose: string;
    destinations: string[];
    passengers: string[];
  };
}

export default function GPSTrackingScreen() {
  const [trips, setTrips] = useState<TripLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isTabRefreshing, setIsTabRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripLocation | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995, // Philippines default
    longitude: 120.9842,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });
  const mapRef = React.useRef<MapView>(null);

  const loadTrips = async () => {
    try {
      const response = await ApiService.trackDrivers();
      setTrips(response.trips || []);
      
      // If there are trips with locations, center map on first one
      if (response.trips && response.trips.length > 0) {
        const firstTripWithLocation = response.trips.find(
          (trip: TripLocation) => trip.current_location
        );
        if (firstTripWithLocation?.current_location) {
          setMapRegion({
            latitude: firstTripWithLocation.current_location.latitude,
            longitude: firstTripWithLocation.current_location.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
        }
      }
    } catch (error) {
      ErrorHandler.handle(error, 'Failed to load GPS tracking data');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsTabRefreshing(false);
    }
  };

  // Tab focus refresh
  useFocusEffect(
    useCallback(() => {
      setIsTabRefreshing(true);
      const timer = setTimeout(async () => {
        await loadTrips();
      }, 300);

      return () => clearTimeout(timer);
    }, [])
  );

  // Auto-refresh GPS data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadTrips();
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return '#3b82f6'; // Blue
      case 'completed':
        return '#10b981'; // Green
      default:
        return '#f59e0b'; // Amber
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleViewDetails = async (trip: TripLocation) => {
    try {
      const response = await ApiService.getTripLocation(trip.trip_ticket_id);
      Alert.alert(
        'Trip Details',
        `Driver: ${response.trip.driver.name}\n` +
        `Vehicle: ${response.trip.vehicle.plate_number}\n` +
        `Purpose: ${response.trip.travel_request.purpose}\n` +
        `Destinations: ${response.trip.travel_request.destinations.join(', ')}\n` +
        `Last Update: ${formatTime(response.trip.current_location.updated_at)}`
      );
    } catch (error) {
      ErrorHandler.handle(error, 'Failed to load trip details');
    }
  };

  if (loading || isTabRefreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>
          {isTabRefreshing ? 'Refreshing GPS data...' : 'Loading GPS tracking...'}
        </Text>
      </View>
    );
  }

  const activeTrips = trips.filter(trip => trip.current_location);

  return (
    <View style={styles.container}>
      {/* Map View */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={mapRegion}
        >
          {activeTrips.map((trip) => (
            trip.current_location && (
              <Marker
                key={trip.trip_ticket_id}
                coordinate={{
                  latitude: trip.current_location.latitude,
                  longitude: trip.current_location.longitude,
                }}
                pinColor={getMarkerColor(trip.status)}
                title={`${trip.driver.name} - ${trip.vehicle.plate_number}`}
                description={trip.travel_request.purpose}
                onCalloutPress={() => setSelectedTrip(trip)}
              />
            )
          ))}
        </MapView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <NotificationBellButton color="#3E0703" size={26} />
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <Ionicons 
              name="refresh" 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Trip List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>
            Active Trips ({activeTrips.length})
          </Text>
          <View style={styles.autoRefreshBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.autoRefreshText}>Auto-updating</Text>
          </View>
        </View>

        <ScrollView
          style={styles.tripList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTrips.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="car-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyText}>No active trips at the moment</Text>
              <Text style={styles.emptySubtext}>
                GPS tracking will appear here when drivers start their trips
              </Text>
            </View>
          ) : (
            activeTrips.map((trip) => (
              <TouchableOpacity
                key={trip.trip_ticket_id}
                style={[
                  styles.tripCard,
                  selectedTrip?.trip_ticket_id === trip.trip_ticket_id &&
                    styles.tripCardSelected,
                ]}
                onPress={() => {
                  setSelectedTrip(trip);
                  if (trip.current_location && mapRef.current) {
                    mapRef.current.animateToRegion({
                      latitude: trip.current_location.latitude,
                      longitude: trip.current_location.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }, 1000);
                  }
                }}
              >
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripCardLeft}>
                    <Ionicons name="person" size={20} color="#10b981" />
                    <Text style={styles.driverName}>{trip.driver.name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getMarkerColor(trip.status) }]}>
                    <Text style={styles.statusText}>{trip.status}</Text>
                  </View>
                </View>

                <View style={styles.tripCardBody}>
                  <View style={styles.tripInfoRow}>
                    <Ionicons name="car" size={16} color="#65676B" />
                    <Text style={styles.tripInfoText}>
                      {trip.vehicle.plate_number} - {trip.vehicle.type}
                    </Text>
                  </View>

                  <View style={styles.tripInfoRow}>
                    <Ionicons name="location" size={16} color="#65676B" />
                    <Text style={styles.tripInfoText} numberOfLines={1}>
                      {trip.travel_request.destinations.join(' → ')}
                    </Text>
                  </View>

                  <View style={styles.tripInfoRow}>
                    <Ionicons name="time" size={16} color="#65676B" />
                    <Text style={styles.tripInfoText}>
                      Last update: {trip.current_location && formatTime(trip.current_location.updated_at)}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  onPress={() => handleViewDetails(trip)}
                >
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color="#10b981" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#65676B',
  },
  mapContainer: {
    height: '45%',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  actionButtons: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  refreshButton: {
    backgroundColor: '#10b981',
    width: 48,
    height: 48,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  listHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  autoRefreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  autoRefreshText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  tripList: {
    flex: 1,
    paddingHorizontal: 16,
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tripCardSelected: {
    borderColor: '#10b981',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
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
  tripCardBody: {
    gap: 8,
  },
  tripInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tripInfoText: {
    fontSize: 14,
    color: '#65676B',
    flex: 1,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginRight: 4,
  },
});
