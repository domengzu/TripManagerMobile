import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  TextInput,
  Platform,
  Linking,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { TripLog, Vehicle, TripStats, TripTicket, LocationCoordinates } from '@/types';
import ApiService from '@/services/api';
import Icon from 'react-native-vector-icons/Ionicons';
import { LoadingComponent } from '@/components/LoadingComponent';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SuccessModal } from '@/components/SuccessModal';
import { useModals } from '@/hooks/useModals';
import { NotificationBellButton } from '@/components/NotificationBellButton';
import POSReceiptUpload from '@/components/POSReceiptUpload';

// Define background location task
const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Define the background task handler (must be at top level)
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    if (location) {
      console.log('📍 Background location update:', location.coords);
      
      // Get active trip ID from storage (with error handling)
      try {
        const activeTrip = await AsyncStorage.getItem('activeTrip');
        if (activeTrip) {
          const trip = JSON.parse(activeTrip);
          
          // Send location to server
          try {
            await ApiService.updateLocation({
              trip_ticket_id: trip.id,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy,
              speed: location.coords.speed,
              heading: location.coords.heading,
            });
            console.log('✅ Background location sent to server');
          } catch (error) {
            console.error('❌ Failed to send background location:', error);
          }
        }
      } catch (storageError) {
        console.error('❌ Failed to access AsyncStorage in background task:', storageError);
        // Continue without crashing
      }
    }
  }
});

const TRIP_LOG_FORM_STORAGE_KEY = '@trip_log_form_data';

export default function TripsScreen() {
  const { startTracking } = useLocalSearchParams();
  
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);
  
  const [trips, setTrips] = useState<TripLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState<TripStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fuel records state
  const [fuelRecords, setFuelRecords] = useState<any[]>([]);
  const [totalFuelBalance, setTotalFuelBalance] = useState<number>(0);

  // Active trip and GPS tracking state
  const [activeTrip, setActiveTrip] = useState<TripTicket | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationCoordinates | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'error' | 'stopped'>('stopped');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('Location not available');
  const [mapRegion, setMapRegion] = useState<any>(null);
  const [locationHistory, setLocationHistory] = useState<Array<{location: LocationCoordinates, timestamp: Date}>>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{latitude: number, longitude: number}>>([]);

  // Animation for real-time location pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const updateFlashAnim = useRef(new Animated.Value(0)).current;

  // Active trip tickets for logging
  const [activeTripTickets, setActiveTripTickets] = useState<TripTicket[]>([]);

  // Trip logging modal state
  const [showTripLogModal, setShowTripLogModal] = useState(false);
  const [selectedTripTicket, setSelectedTripTicket] = useState<TripTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tripLogForm, setTripLogForm] = useState({
    trip_ticket_id: 0,
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

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState<string | null>(null);

  // Text input states for decimal fields (to preserve decimal point while typing)
  const [fuelIssuedText, setFuelIssuedText] = useState('');
  const [fuelPurchasedText, setFuelPurchasedText] = useState('');
  const [fuelUsedText, setFuelUsedText] = useState('');

  // Available refuel records state
  const [availableRefuels, setAvailableRefuels] = useState<any[]>([]);
  const [selectedRefuelIds, setSelectedRefuelIds] = useState<number[]>([]);
  const [showRefuelSelectionModal, setShowRefuelSelectionModal] = useState(false);

  // Debounce timer for form data saving
  const saveTimeoutRef = useRef<number | null>(null);

  // Debounced save function to optimize performance
  const debouncedSave = useCallback((formData: any, tripTicketId: number) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const storageKey = `${TRIP_LOG_FORM_STORAGE_KEY}_${tripTicketId}`;
        await AsyncStorage.setItem(storageKey, JSON.stringify(formData));
        console.log(`💾 Auto-saved trip log form for trip ticket ${tripTicketId}`);
      } catch (error) {
        console.error('Failed to save trip log form data:', error);
      }
    }, 500); // 500ms delay
  }, []);
  const [tempTime, setTempTime] = useState(new Date());

  // Time format utility functions
  const convertTo12Hour = (time24: string): string => {
    if (!time24 || time24.trim() === '') return '';
    
    const [hours, minutes] = time24.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return time24;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const convertTo24Hour = (time12: string): string => {
    if (!time12 || time12.trim() === '') return '';
    
    // Handle both formats: "11:30 AM" or "11:30"
    const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return time12;
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // Time picker helper functions
  const openTimePicker = (fieldName: string, currentValue?: string) => {
    let timeValue = new Date();
    
    if (currentValue && currentValue.trim() !== '') {
      // Convert 12-hour format to 24-hour for Date object
      const time24 = currentValue.includes('AM') || currentValue.includes('PM') 
        ? convertTo24Hour(currentValue)
        : currentValue;
      timeValue = new Date(`2000-01-01T${time24}:00`);
    }
    
    setTempTime(timeValue);
    setShowTimePicker(fieldName);
  };

  const handleTimeChange = (selectedDate: Date) => {
    if (showTimePicker) {
      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const time12 = convertTo12Hour(time24);
      
      // Store in 12-hour format with AM/PM
      updateTripLogForm(showTimePicker, time12);
    }
    setShowTimePicker(null);
  };

  const {
    confirmationState,
    showConfirmation,
    hideConfirmation,
    successState,
    showSuccess,
    hideSuccess,
  } = useModals();

  useEffect(() => {
    loadTrips();
    loadActiveTrip();
    loadActiveTripTickets();
    requestLocationPermissions();
    
    // Check if GPS is actually running despite state saying otherwise
    if (locationSubscription && !isTracking) {
      console.log('⚠️ Found orphaned location subscription, syncing state...');
      setIsTracking(true);
      setGpsStatus('active');
    }
    
    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-start GPS tracking when active trip is loaded (only once when trip becomes active)
  useEffect(() => {
    if (activeTrip && !isTracking) {
      console.log('Auto-starting GPS tracking for active trip:', activeTrip.id);
      
      // Check permissions before auto-starting
      const checkAndStartGPS = async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            await startGPSTracking();
          } else {
            console.log('GPS auto-start skipped: Location permissions not granted');
            setGpsStatus('stopped');
          }
        } catch (error) {
          console.error('Failed to check location permissions:', error);
          setGpsStatus('error');
        }
      };
      
      checkAndStartGPS();
    }
    
    // Don't add startGPSTracking to dependencies to avoid infinite loop
    // Only trigger when activeTrip.id changes (when trip starts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrip?.id]);
  
  // Debug: Log when tracking state changes
  useEffect(() => {
    console.log('🔄 Tracking state changed - isTracking:', isTracking, ', gpsStatus:', gpsStatus);
  }, [isTracking, gpsStatus]);
  
  // Sync isTracking with locationSubscription state
  useEffect(() => {
    if (locationSubscription && !isTracking) {
      console.log('⚠️ State mismatch detected: subscription exists but isTracking is false. Syncing...');
      setIsTracking(true);
      if (gpsStatus === 'stopped') {
        setGpsStatus('active');
      }
    } else if (!locationSubscription && isTracking) {
      console.log('⚠️ State mismatch detected: no subscription but isTracking is true. Syncing...');
      setIsTracking(false);
      setGpsStatus('stopped');
    }
  }, [locationSubscription, isTracking, gpsStatus]);

  // Cleanup location subscription on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Pulse animation for GPS indicator when active
  useEffect(() => {
    if (isTracking && gpsStatus === 'active') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isTracking, gpsStatus]);

  // Flash animation when location updates
  useEffect(() => {
    if (lastUpdate && isTracking) {
      Animated.sequence([
        Animated.timing(updateFlashAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(updateFlashAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [lastUpdate]);

  // Start background location tracking when GPS becomes active
  useEffect(() => {
    if (isTracking && gpsStatus === 'active' && activeTrip) {
      console.log('🔄 GPS is active, starting background location tracking...');
      startBackgroundLocationTracking();
    }
  }, [isTracking, gpsStatus, activeTrip]);

  // Optimized parallel data loading
  const loadAllData = async (isRefresh = false) => {
    console.log('🔄 Loading all data in parallel...');
    const startTime = Date.now();
    
    try {
      // Load all data in parallel for better performance
      await Promise.all([
        loadTrips(isRefresh),
        loadActiveTrip(),
        loadActiveTripTickets(),
      ]);
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ All data loaded in ${loadTime}ms`);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('Trips screen focused, refreshing data...');
      loadAllData();
      
      // Also refresh fuel balance and update trip log form if it's open
      const refreshFuelBalance = async () => {
        try {
          // Get vehicles to access current fuel levels
          const vehiclesData = await ApiService.getDriverVehicles();
          
          // Calculate total fuel balance from all vehicles (for legacy support)
          const fuelRecordsResponse = await ApiService.getFuelRecords();
          const updatedTotalFuel = fuelRecordsResponse.reduce((sum: number, record: any) => {
            const amount = parseFloat(record.amount?.toString() || '0') || 0;
            return record.type === 'usage' ? sum - amount : sum + amount;
          }, 0);
          
          setTotalFuelBalance(updatedTotalFuel);
          console.log('✅ Fuel balance refreshed on focus:', updatedTotalFuel, 'L');
          
          // Update trip log form if it's currently showing (preserving other values)
          setTripLogForm(prev => {
            // Don't update fuel if modal isn't open or vehicle_id not set
            if (!prev.vehicle_id || prev.vehicle_id === 0) {
              console.log('⏭️ Skipping fuel update - no vehicle assigned yet');
              return prev;
            }
            
            // Get the specific vehicle's fuel level
            const assignedVehicle = vehiclesData.find((v: any) => v.id === prev.vehicle_id);
            
            if (!assignedVehicle) {
              console.warn('⚠️ Vehicle not found during refresh:', prev.vehicle_id);
              return prev; // Don't update if vehicle not found
            }
            
            const vehicleFuelLevel = assignedVehicle.current_fuel_level !== null && assignedVehicle.current_fuel_level !== undefined
              ? parseFloat(assignedVehicle.current_fuel_level.toString())
              : 0;
            
            console.log(`⛽ Refreshing fuel for vehicle #${prev.vehicle_id} (${assignedVehicle.plate_number}):`, vehicleFuelLevel, 'L');
            
            return {
              ...prev,
              fuel_balance_start: vehicleFuelLevel,
              // Recalculate fuel_total: balance + issued + purchased
              fuel_total: vehicleFuelLevel + (prev.fuel_issued_office || 0) + (prev.fuel_purchased_trip || 0),
              // Recalculate fuel_balance_end: total - used
              fuel_balance_end: Math.max(0, vehicleFuelLevel + (prev.fuel_issued_office || 0) + (prev.fuel_purchased_trip || 0) - (prev.fuel_used || 0)),
            };
          });
        } catch (error) {
          console.error('Failed to refresh fuel balance:', error);
        }
      };
      
      refreshFuelBalance();
      
      return () => {
        // Cleanup function
      };
    }, [])
  );

  // Immediately refresh active trip data when startTracking parameter is present
  useEffect(() => {
    if (startTracking === 'true') {
      console.log('startTracking parameter detected, immediately refreshing active trip data...');
      loadActiveTrip();
      loadActiveTripTickets();
    }
  }, [startTracking]);

  const loadTrips = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      // Parallel data loading for better performance
      const [tripsResponse, fuelRecordsResponse] = await Promise.all([
        ApiService.getTrips(),
        ApiService.getFuelRecords().catch(err => {
          console.warn('⚠️ Failed to load fuel records:', err);
          return [];
        })
      ]);

      const allTrips = tripsResponse.trips.data || tripsResponse.trips;
      
      console.log('📋 Total trips received:', allTrips.length);
      console.log('📋 Raw trip data:', JSON.stringify(allTrips.map((t: TripLog) => ({
        id: t.id,
        ticket_id: t.trip_ticket_id,
        date: t.date,
        created: t.created_at,
        route: t.route
      })), null, 2));
      
      // ENHANCED: Multi-layer deduplication strategy
      // Layer 1: Remove exact duplicate trip IDs
      // Layer 2: For each trip_ticket_id, keep only the latest entry
      // Layer 3: For trips with same date/route but no ticket_id, keep only one
      
      const seenTripIds = new Set<number>();
      const uniqueTrips: TripLog[] = [];
      
      // First pass: Remove exact duplicate trip IDs
      allTrips.forEach((trip: TripLog) => {
        if (!seenTripIds.has(trip.id)) {
          seenTripIds.add(trip.id);
          uniqueTrips.push(trip);
        } else {
          console.log(`⚠️ Removed duplicate trip ID: ${trip.id}`);
        }
      });
      
      console.log(`✅ After removing duplicate IDs: ${uniqueTrips.length} trips`);
      
      // Second pass: Group by trip_ticket_id and keep only the latest
      const ticketGroups = new Map<number, TripLog[]>();
      const noTicketTrips: TripLog[] = [];
      
      uniqueTrips.forEach((trip: TripLog) => {
        if (trip.trip_ticket_id) {
          if (!ticketGroups.has(trip.trip_ticket_id)) {
            ticketGroups.set(trip.trip_ticket_id, []);
          }
          ticketGroups.get(trip.trip_ticket_id)!.push(trip);
        } else {
          noTicketTrips.push(trip);
        }
      });
      
      console.log(`📊 Found ${ticketGroups.size} unique ticket IDs with trips`);
      
      // For each ticket group, keep only the most recent trip
      const latestPerTicket: TripLog[] = [];
      ticketGroups.forEach((trips, ticketId) => {
        console.log(`🎫 Ticket ${ticketId} has ${trips.length} trip logs`);
        
        if (trips.length === 1) {
          latestPerTicket.push(trips[0]);
        } else {
          // Sort by created_at descending and take the first (most recent)
          const sorted = trips.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          console.log(`  📅 Trip IDs for ticket ${ticketId}:`, trips.map(t => `${t.id} (${t.created_at})`).join(', '));
          console.log(`  ✅ Keeping most recent: Trip ID ${sorted[0].id} (${sorted[0].created_at})`);
          console.log(`  ❌ Filtering out ${sorted.length - 1} older entries`);
          
          latestPerTicket.push(sorted[0]);
        }
      });
      
      // Third pass: For trips without ticket_id, check for duplicates by date+route
      const dateRouteMap = new Map<string, TripLog>();
      noTicketTrips.forEach((trip: TripLog) => {
        const key = `${trip.date}_${trip.route || 'no-route'}`;
        const existing = dateRouteMap.get(key);
        
        if (!existing) {
          dateRouteMap.set(key, trip);
        } else {
          // Keep the one with the later created_at
          if (new Date(trip.created_at).getTime() > new Date(existing.created_at).getTime()) {
            console.log(`🔄 Replacing standalone trip ${existing.id} with ${trip.id} (same date/route)`);
            dateRouteMap.set(key, trip);
          }
        }
      });
      
      // Combine all filtered trips
      const filteredTrips = [
        ...latestPerTicket,
        ...Array.from(dateRouteMap.values())
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      console.log('✅ Final filtered trips:', filteredTrips.length);
      console.log('🆔 Final trip IDs:', filteredTrips.map(t => `${t.id}(ticket:${t.trip_ticket_id || 'none'})`).join(', '));
      
      // Verify no duplicates in final list
      const finalTicketIds = filteredTrips.map(t => t.trip_ticket_id).filter(Boolean);
      const uniqueFinalTickets = new Set(finalTicketIds);
      if (finalTicketIds.length !== uniqueFinalTickets.size) {
        console.error('❌ WARNING: Still have duplicate tickets in final list!');
        console.error('Duplicate tickets:', finalTicketIds);
      }
      
      setTrips(filteredTrips);
      setVehicles(tripsResponse.vehicles || []);
      setStats(tripsResponse.monthly_stats || null);

      // Process fuel records
      setFuelRecords(fuelRecordsResponse);
      
      // Calculate total fuel balance (add fuel additions, subtract fuel usage)
      const totalFuel = fuelRecordsResponse.reduce((sum: number, record: any) => {
        const amount = parseFloat(record.amount?.toString() || '0') || 0;
        return record.type === 'usage' ? sum - amount : sum + amount;
      }, 0);
      
      setTotalFuelBalance(totalFuel);
      console.log('✅ Total fuel balance calculated:', totalFuel, 'L from', fuelRecordsResponse.length, 'records');

    } catch (error: any) {
      console.error('Failed to load trips:', error);
      Alert.alert('Error', 'Failed to load trips');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadActiveTrip = async () => {
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

  const loadActiveTripTickets = async () => {
    try {
      // Load trip tickets that are in progress and can be logged
      const response = await ApiService.getTripTickets({ 
        status: 'in_progress',
        with_relations: true 
      });
      console.log('Active trip tickets response:', response);
      console.log('Trip tickets data:', response.trip_tickets?.data || response.trip_tickets);
      let tickets = response.trip_tickets?.data || response.trip_tickets || [];
      
      if (tickets.length > 0) {
        console.log('First ticket structure:', JSON.stringify(tickets[0], null, 2));
        console.log('First ticket travelRequest:', tickets[0].travelRequest);
        
        // Check if tickets are missing travelRequest or vehicle data and fetch individual details
        const ticketsWithMissingData = tickets.filter((ticket: any) => !ticket.travelRequest || !ticket.vehicle);
        
        if (ticketsWithMissingData.length > 0 && ticketsWithMissingData.length <= 10) {
          console.log(`📝 Found ${ticketsWithMissingData.length} tickets missing travelRequest or vehicle data, fetching individual details...`);
          
          try {
            // Fetch individual ticket details for tickets missing travelRequest or vehicle (limit to 10 to avoid too many requests)
            const enhancedTickets = await Promise.all(
              tickets.map(async (ticket: any) => {
                if (!ticket.travelRequest || !ticket.vehicle) {
                  try {
                    console.log(`🔍 Fetching details for ticket ${ticket.id}...`);
                    const detailedTicketResponse = await ApiService.getTripTicket(ticket.id);
                    const detailedTicket = detailedTicketResponse.trip_ticket || detailedTicketResponse.data || detailedTicketResponse;
                    console.log(`✅ Enhanced ticket ${ticket.id} with relations:`, {
                      hasTravelRequest: !!detailedTicket.travelRequest,
                      hasUser: !!detailedTicket.travelRequest?.user,
                      hasPurpose: !!detailedTicket.travelRequest?.purpose,
                      hasVehicle: !!detailedTicket.vehicle,
                      vehicleMake: detailedTicket.vehicle?.make,
                      vehicleModel: detailedTicket.vehicle?.model
                    });
                    return detailedTicket;
                  } catch (error) {
                    console.error(`Failed to fetch details for ticket ${ticket.id}:`, error);
                    return ticket;
                  }
                }
                return ticket;
              })
            );
            
            tickets = enhancedTickets;
          } catch (error) {
            console.error('❌ Error enhancing tickets with individual details:', error);
            // Keep original tickets if enhancement fails
          }
        } else if (ticketsWithMissingData.length > 10) {
          console.log(`⚠️ Too many tickets (${ticketsWithMissingData.length}) missing travelRequest or vehicle data, skipping individual fetch to avoid performance issues`);
        } else {
          console.log('✅ All tickets have travelRequest and vehicle data');
        }
      }
      
      setActiveTripTickets(tickets);
    } catch (error: any) {
      console.error('Failed to load active trip tickets:', error);
      // Don't show alert for this as it's not critical
    }
  };

  const requestLocationPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Location permission is required for GPS tracking during trips.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to request location permissions:', error);
      return false;
    }
  };

  // Calculate distance between two GPS coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };

  // Calculate total distance traveled from route coordinates
  const calculateTotalDistance = (): number => {
    if (routeCoordinates.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < routeCoordinates.length; i++) {
      const prev = routeCoordinates[i - 1];
      const curr = routeCoordinates[i];
      totalDistance += calculateDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }
    
    return totalDistance;
  };



  const startGPSTracking = async () => {
    console.log('🎯 startGPSTracking called - isTracking:', isTracking, 'gpsStatus:', gpsStatus);
    console.log('📌 isMountedRef.current:', isMountedRef.current);
    console.log('📌 locationSubscription:', locationSubscription ? 'exists' : 'null');
    
    // Prevent starting if already tracking
    if (isTracking) {
      console.log('⚠️ GPS already tracking, aborting duplicate start');
      return;
    }
    
    // Check if there's an existing subscription
    if (locationSubscription) {
      console.log('⚠️ Location subscription already exists, cleaning up first');
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    
    try {
      console.log('🔐 Checking permissions...');
      // Check and request permissions first
      const { status } = await Location.getForegroundPermissionsAsync();
      console.log('🔐 Permission status:', status);
      
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        console.log('🔐 New permission status:', newStatus);
        
        if (newStatus !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Location permissions are required for GPS tracking. Please enable location access in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
          setGpsStatus('error');
          return;
        }
      }

      console.log('📍 Getting current location...');
      setGpsStatus('searching');

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      console.log('✅ Location obtained:', location.coords.latitude, location.coords.longitude);

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };
      
      console.log('💾 Updating location state...');
      setCurrentLocation(newLocation);
      setLastUpdate(new Date());
      
      // Set map region
      setMapRegion({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      // Reverse geocode to get address
      await reverseGeocodeLocation(newLocation);

      // Start watching position with optimized settings for driving
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation, // Best accuracy for navigation/driving
          timeInterval: 1000, // Update every 1 second for driving (more frequent)
          distanceInterval: 3, // Update when moved 3 meters (better for driving speed)
          mayShowUserSettingsDialog: true, // Ask user to enable high accuracy if needed
        },
        async (location) => {
          const updatedLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            speed: location.coords.speed || undefined, // Add speed tracking
            heading: location.coords.heading || undefined, // Add heading/direction
          };
          
          // Always update location for real-time tracking while driving
          // Remove the "significant change" check for smoother driving updates
          console.log('📍 Location update:', updatedLocation, `Speed: ${updatedLocation.speed?.toFixed(2) || 'N/A'} m/s`);
          setCurrentLocation(updatedLocation);
          setLastUpdate(new Date());
          setGpsStatus('active');

          // Add to location history (keep last 10 for better tracking)
          setLocationHistory(prev => {
            const newHistory = [...prev, { location: updatedLocation, timestamp: new Date() }];
            return newHistory.slice(-10); // Increased from 5 to 10
          });

          // Add to route coordinates for trail visualization
          setRouteCoordinates(prev => [
            ...prev,
            {
              latitude: updatedLocation.latitude,
              longitude: updatedLocation.longitude,
            }
          ]);

          // Update map region to follow driver smoothly
          setMapRegion({
            latitude: updatedLocation.latitude,
            longitude: updatedLocation.longitude,
            latitudeDelta: 0.005, // Tighter zoom for driving (was 0.01)
            longitudeDelta: 0.005,
          });
          
          // Update address (throttled to avoid too many API calls)
          // Only reverse geocode every 5 updates to save API calls while driving
          if (!lastUpdate || new Date().getTime() - lastUpdate.getTime() > 5000) {
            await reverseGeocodeLocation(updatedLocation);
          }

          // Send location update to server
          if (activeTrip) {
            sendLocationUpdate(activeTrip.id, updatedLocation);
          }
        }
      );

      console.log('✅ Location watch started successfully');
      console.log('💾 Setting tracking state...');
      setLocationSubscription(subscription);
      setIsTracking(true);
      setGpsStatus('active');
      console.log('✅ GPS tracking ACTIVATED');
      console.log('📊 Final state should be - isTracking: true, gpsStatus: active');
    } catch (error: any) {
      console.error('❌ Failed to start GPS tracking:', error);
      console.error('❌ Error details:', error.message);
      setGpsStatus('error');
      setIsTracking(false);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to start GPS tracking. Please check your location settings.';
      if (error?.message?.includes('Not authorized') || error?.message?.includes('permission')) {
        errorMessage = 'Location permission denied. Please enable location access in your device settings to use GPS tracking.';
      } else if (error?.message?.includes('Location services')) {
        errorMessage = 'Location services are disabled. Please enable location services in your device settings.';
      }
      
      Alert.alert(
        'GPS Error', 
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          }
        ]
      );
    }
  };

  const stopGPSTracking = async () => {
    console.log('🛑 Stopping GPS tracking...');
    
    // Stop foreground tracking
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
      console.log('✅ Location subscription removed');
    }
    
    // Stop background tracking with error handling
    try {
      const isTaskDefined = await TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
      if (isTaskDefined) {
        const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (isTaskRegistered) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          console.log('✅ Background location tracking stopped');
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to stop background location tracking:', error);
      // Continue anyway - the important thing is that foreground tracking is stopped
    }
    
    // Clear active trip from storage
    try {
      await AsyncStorage.removeItem('activeTrip');
    } catch (storageError) {
      console.warn('⚠️ Failed to clear active trip from storage:', storageError);
    }
    
    setIsTracking(false);
    setGpsStatus('stopped');
    // Don't clear currentLocation and mapRegion - keep last known position visible
    // setCurrentLocation(null);
    // Clear route coordinates when stopping
    setRouteCoordinates([]);
    // setLocationHistory([]);
    
    console.log('✅ GPS tracking stopped successfully. Last position retained.');
  };

  const startBackgroundLocationTracking = async () => {
    try {
      // Request background location permission
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        Alert.alert(
          'Background Location Required',
          'To continue tracking your location when the app is closed, please enable "Always Allow" location access in your device settings.',
          [
            { text: 'Not Now', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return false;
      }

      // Save active trip to AsyncStorage for background task (with error handling)
      try {
        if (activeTrip) {
          await AsyncStorage.setItem('activeTrip', JSON.stringify(activeTrip));
        }
      } catch (storageError) {
        console.warn('⚠️ Failed to save active trip to AsyncStorage:', storageError);
        // Continue anyway - background tracking can still work
      }

      // Check if task is already registered
      const isRegistered = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) {
        console.log('ℹ️ Background location tracking is already active');
        return true;
      }

      // Start background location tracking
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000, // Update every 5 seconds in background (less frequent to save battery)
        distanceInterval: 10, // Update when moved 10 meters
        foregroundService: {
          notificationTitle: 'Trip in Progress',
          notificationBody: 'TripManager is tracking your location',
          notificationColor: '#3E0703',
        },
        pausesUpdatesAutomatically: false, // Keep tracking even when stationary
        showsBackgroundLocationIndicator: true, // Show blue bar on iOS
      });

      console.log('✅ Background location tracking started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start background location:', error);
      // Don't show alert to user - GPS tracking in foreground will continue to work
      console.log('ℹ️ Continuing with foreground GPS tracking only');
      return false;
    }
  };

  const sendLocationUpdate = async (tripTicketId: number, location: LocationCoordinates) => {
    // Safety check: Don't send updates if there's no active trip
    if (!activeTrip || activeTrip.id !== tripTicketId) {
      console.log('⚠️ Skipping location update - no active trip or trip ID mismatch');
      return;
    }

    try {
      console.log('🚀 Sending location update:', {
        trip_ticket_id: tripTicketId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
      
      const response = await ApiService.updateLocation({
        trip_ticket_id: tripTicketId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
      
      console.log('✅ Location update successful:', response);
    } catch (error: any) {
      console.error('❌ Failed to send location update:', error);
      console.error('Error details:', error.response?.data || error.message);
      
      // Show error only for critical failures, not every update
      if (error.response?.status === 401 || error.response?.status === 403) {
        Alert.alert('Location Update Error', 'Authentication failed. Please log in again.');
        setGpsStatus('error');
      }
    }
  };

  const reverseGeocodeLocation = async (location: LocationCoordinates) => {
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      
      if (address && address.length > 0) {
        const addr = address[0];
        const locationString = [
          addr.street,
          addr.city,
          addr.region,
          addr.country
        ].filter(Boolean).join(', ');
        
        setCurrentAddress(locationString || 'Location found');
      } else {
        setCurrentAddress('Location found');
      }
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      setCurrentAddress('Location unavailable');
    }
  };

  const handleCompleteTrip = () => {
    showConfirmation({
      title: 'Complete Trip',
      message: 'Are you sure you want to complete this trip? This action cannot be undone.',
      confirmText: 'Complete Trip',
      cancelText: 'Cancel',
      type: 'warning',
      onConfirm: confirmCompleteTrip,
    });
  };

  const confirmCompleteTrip = async () => {
    if (!activeTrip) return;

    // Prevent multiple simultaneous calls
    if (isSubmitting) {
      console.log('⚠️ Trip completion already in progress, ignoring duplicate call');
      return;
    }

    try {
      setIsSubmitting(true);
      const tripId = activeTrip.id; // Store trip ID before clearing state
      let tripLogData = null;
      
      // Check if there's saved trip log data for this trip
      try {
        const savedDataKey = `${TRIP_LOG_FORM_STORAGE_KEY}_${tripId}`;
        const savedData = await AsyncStorage.getItem(savedDataKey);
        
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          console.log('📝 Found saved trip log data, validating required fields...');
          
          // Validate required fields (excluding optional fields)
          const missingFields = [];
          
          // Time Information (all required)
          if (!parsedData.departure_time_office) missingFields.push('Departure Time from Office');
          if (!parsedData.arrival_time_destination) missingFields.push('Arrival Time at Destination');
          if (!parsedData.departure_time_destination) missingFields.push('Departure Time from Destination');
          if (!parsedData.arrival_time_office) missingFields.push('Arrival Time at Office');
          
          // Trip Details (all required)
          if (!parsedData.destination || parsedData.destination.trim() === '') missingFields.push('Destination');
          if (!parsedData.purpose || parsedData.purpose.trim() === '') missingFields.push('Purpose');
          if (!parsedData.distance || parsedData.distance === 0) missingFields.push('Distance');
          
          // Fuel Information (required: fuel_balance_start, fuel_used, fuel_balance_end)
          if (!parsedData.fuel_balance_start && parsedData.fuel_balance_start !== 0) missingFields.push('Fuel Balance Start');
          if (!parsedData.fuel_total && parsedData.fuel_total !== 0) missingFields.push('Total Fuel');
          if (!parsedData.fuel_used || parsedData.fuel_used === 0) missingFields.push('Fuel Used');
          if (!parsedData.fuel_balance_end && parsedData.fuel_balance_end !== 0) missingFields.push('Fuel Balance End');
          
          // Note: Lubricants Information is optional (gear_oil, lubrication_oil, brake_fluid, grease)
          // Note: Speedometer and Odometer are optional
          // Note: fuel_purchased_trip is optional
          
          if (missingFields.length > 0) {
            Alert.alert(
              'Incomplete Trip Log',
              `Please complete all required fields in the Trip Log before completing the trip:\n\n${missingFields.map(field => `• ${field}`).join('\n')}\n\nNote: Fuel Issued at Office, Fuel Purchased on Trip, Lubricants, and Speedometer/Odometer readings are optional.`,
              [{ text: 'OK' }]
            );
            return;
          }
          
          // Submit the trip log if we have all required fields
          if (parsedData.departure_time_office && parsedData.arrival_time_destination && parsedData.fuel_used) {
            // Convert 12-hour format times to 24-hour format for backend
            const departure24 = convertTo24Hour(parsedData.departure_time_office);
            const arrivalDest24 = convertTo24Hour(parsedData.arrival_time_destination || '');
            const departureDest24 = convertTo24Hour(parsedData.departure_time_destination || '');
            const arrivalOffice24 = convertTo24Hour(parsedData.arrival_time_office || '');
            
            tripLogData = {
              trip_ticket_id: tripId,
              vehicle_id: parsedData.vehicle_id || undefined,
              date: parsedData.date,
              // Backend expects 24-hour format
              departure_time: departure24,
              arrival_time: arrivalOffice24 || departure24, // Use departure time if arrival not set
              // Additional detailed time fields
              departure_time_office: departure24,
              arrival_time_destination: arrivalDest24 || undefined,
              departure_time_destination: departureDest24 || undefined,
              arrival_time_office: arrivalOffice24 || undefined,
              destination: parsedData.destination || '',
              purpose: parsedData.purpose || undefined,
              distance: parsedData.distance || 0,
              fuel_balance_start: parsedData.fuel_balance_start || 0,
              fuel_issued_office: parsedData.fuel_issued_office,
              fuel_purchased_trip: parsedData.fuel_purchased_trip || 0,
              fuel_total: parsedData.fuel_total || 0,
              fuel_used: parsedData.fuel_used,
              fuel_balance_end: parsedData.fuel_balance_end || 0,
              gear_oil: parsedData.gear_oil || 0,
              lubrication_oil: parsedData.lubrication_oil || 0,
              brake_fluid: parsedData.brake_fluid || 0,
              grease: parsedData.grease || 0,
              speedometer_start: parsedData.speedometer_start || 0,
              speedometer_end: parsedData.speedometer_end || 0,
              speedometer_distance: parsedData.speedometer_distance || 0,
              odometer_start: parsedData.odometer_start || 0,
              odometer_end: parsedData.odometer_end || 0,
              notes: parsedData.notes || '',
            } as any;

            try {
              // Check if trip log already exists (409 response includes existing trip log)
              let existingTripLog = null;
              try {
                console.log('📤 Request Data:', tripLogData);
                await ApiService.createTripLog(tripLogData);
                console.log('✅ Trip log created successfully');
              } catch (createError: any) {
                console.log('❌ Failed to create trip log:', createError);
                if (createError.response?.status === 409 && createError.response?.data?.trip_log) {
                  // Trip log already exists, update it instead
                  existingTripLog = createError.response.data.trip_log;
                  console.log('⚠️ Trip log already exists (ID:', existingTripLog.id, '), updating instead');
                  console.log('📤 Update Data:', tripLogData);
                  
                  try {
                    await ApiService.updateTripLog(existingTripLog.id, tripLogData);
                    console.log('✅ Trip log updated successfully');
                  } catch (updateError: any) {
                    console.error('❌ Failed to update trip log:', updateError);
                    console.error('Update error response:', updateError.response?.data);
                    throw updateError; // Re-throw update error
                  }
                } else {
                  throw createError; // Re-throw if it's a different error
                }
              }
              
              // Clear the saved form data after successful submission
              await AsyncStorage.removeItem(savedDataKey);
              console.log('✅ Cleared saved trip log data');
            } catch (logError: any) {
              console.error('❌ Failed to submit trip log:', logError);
              
              // For other errors, ask user what to do
              setIsSubmitting(false); // Allow retry
              Alert.alert(
                'Trip Log Error',
                'Failed to save trip log. Do you still want to complete the trip?',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => {
                    // Restore active trip if user cancels
                    loadActiveTrip();
                    throw new Error('Trip completion cancelled');
                  }},
                  { text: 'Complete Anyway', onPress: async () => {
                    // Continue with trip completion
                    console.log('⚠️ Continuing trip completion without trip log');
                  }}
                ]
              );
              return; // Wait for user decision
            }
          } else {
            // If saved data exists but is incomplete, show error
            Alert.alert(
              'Incomplete Trip Log',
              'Saved trip log data is incomplete. Please complete all required fields in the Trip Log before completing the trip.',
              [{ text: 'OK' }]
            );
            return;
          }
        } else {
          // No saved trip log data - require user to complete trip log first
          Alert.alert(
            'Trip Log Required',
            'You must complete the Trip Log before finishing this trip. Please fill out all required trip information.',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (storageError) {
        console.error('❌ Error checking for saved trip log:', storageError);
        Alert.alert(
          'Error',
          'Unable to verify trip log data. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Stop GPS tracking
      stopGPSTracking();
      
      // Clear active trip state immediately to prevent location updates
      setActiveTrip(null);

      // Complete the trip via API
      await ApiService.completeTrip(tripId);

      // Update fuel consumption if trip log data includes fuel_used and vehicle_id
      if (tripLogData?.fuel_used && tripLogData.fuel_used > 0 && activeTrip.vehicle_id) {
        try {
          console.log(`⛽ Updating fuel consumption: ${tripLogData.fuel_used}L for vehicle ${activeTrip.vehicle_id}`);
          await ApiService.updateFuelConsumption(activeTrip.vehicle_id, {
            liters_consumed: tripLogData.fuel_used,
            trip_ticket_id: tripId,
            notes: `Fuel consumed during trip to ${tripLogData.destination || 'destination'}`,
          });
          console.log('✅ Fuel consumption updated successfully');
        } catch (fuelError: any) {
          console.error('❌ Failed to update fuel consumption:', fuelError);
          // Don't block trip completion if fuel update fails
          console.warn('⚠️ Continuing trip completion despite fuel update failure');
        }
      } else {
        console.log('ℹ️ Skipping fuel consumption update - no fuel_used data or vehicle_id');
      }

      // Send trip completion report to director and procurement
      try {
        console.log('📨 Sending trip completion report to director and procurement...');
        
        // Prepare comprehensive trip report data
        const destination = Array.isArray(activeTrip.travelRequest?.destinations)
          ? activeTrip.travelRequest.destinations.join(', ')
          : activeTrip.travelRequest?.destinations || 'Unknown destination';
        
        const reportData = {
          trip_ticket_id: tripId,
          ticket_number: activeTrip.ticket_number,
          destination: destination,
          purpose: activeTrip.travelRequest?.purpose || 'N/A',
          passenger_name: activeTrip.travelRequest?.user?.name || activeTrip.passenger_name || 'Unknown',
          department: activeTrip.travelRequest?.user?.department || 'N/A',
          vehicle: activeTrip.vehicle ? `${activeTrip.vehicle.type} ${activeTrip.vehicle.model} (${activeTrip.vehicle.plate_number})` : 'N/A',
          driver_name: activeTrip.driver?.name || activeTrip.driver_name || 'Unknown',
          trip_log: tripLogData ? {
            date: tripLogData.date,
            departure_time_office: tripLogData.departure_time_office,
            arrival_time_destination: tripLogData.arrival_time_destination,
            departure_time_destination: tripLogData.departure_time_destination,
            arrival_time_office: tripLogData.arrival_time_office,
            distance: tripLogData.distance,
            fuel_balance_start: tripLogData.fuel_balance_start,
            fuel_issued_office: tripLogData.fuel_issued_office,
            fuel_purchased_trip: tripLogData.fuel_purchased_trip,
            fuel_total: tripLogData.fuel_total,
            fuel_used: tripLogData.fuel_used,
            fuel_balance_end: tripLogData.fuel_balance_end,
            fuel_type: activeTrip.vehicle?.fuel_type || 'Gasoline', // Include fuel type for consumption tracking
            gear_oil: tripLogData.gear_oil,
            lubrication_oil: tripLogData.lubrication_oil,
            brake_fluid: tripLogData.brake_fluid,
            grease: tripLogData.grease,
            speedometer_start: tripLogData.speedometer_start,
            speedometer_end: tripLogData.speedometer_end,
            speedometer_distance: tripLogData.speedometer_distance,
            odometer_start: tripLogData.odometer_start,
            odometer_end: tripLogData.odometer_end,
            notes: tripLogData.notes
          } : null
        };

        // Send report notification
        await ApiService.sendTripCompletionReport(reportData);
        console.log('✅ Trip completion report sent successfully');
      } catch (reportError) {
        console.error('❌ Failed to send trip completion report:', reportError);
        // Don't block completion if report sending fails
      }

      showSuccess({
        title: 'Trip Completed',
        message: 'Your trip has been successfully completed and the report has been sent to director and procurement.',
        autoClose: true,
        autoCloseDelay: 3000,
      });

      // Reload data
      loadActiveTrip();
      loadTrips();
      loadActiveTripTickets();
    } catch (error: any) {
      if (error.message === 'Trip completion cancelled') {
        // User cancelled, do nothing
        setIsSubmitting(false);
        return;
      }
      console.error('Failed to complete trip:', error);
      Alert.alert('Error', 'Failed to complete trip. Please try again.');
      // Reload active trip in case of error
      loadActiveTrip();
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTripLogModal = async (tripTicket: TripTicket) => {
    // Always use the most current vehicle data
    let currentVehicles = vehicles;
    
    // Check if we need to reload vehicles - either no vehicles or missing the trip's vehicle
    const needsReload = vehicles.length === 0 || 
                        (tripTicket.vehicle_id && !vehicles.find(v => v.id === tripTicket.vehicle_id));
    
    if (needsReload) {
      const reason = vehicles.length === 0 ? 'No vehicles in state' : `Vehicle ${tripTicket.vehicle_id} not found in current list`;
      console.log(`⚠️ ${reason}, reloading fresh data...`);
      try {
        // Fetch ALL vehicles (not just driver's vehicles) since trips can be assigned any vehicle
        const freshVehicles = await ApiService.getDriverVehicles();
        
        console.log('🔍 Fresh vehicles loaded:', freshVehicles.map((v: any) => ({ id: v.id, plate: v.plate_number })));
        
        // Update state and local variable with fresh data
        setVehicles(freshVehicles);
        currentVehicles = freshVehicles;
        
        // Check again after fresh load
        if (freshVehicles.length === 0) {
          Alert.alert(
            'No Vehicle',
            'No vehicles available in the system. Please contact your administrator.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        console.log('✅ Fresh vehicle data loaded:', freshVehicles.length, 'vehicle(s)');
      } catch (error) {
        console.error('Failed to reload vehicles:', error);
        Alert.alert('Error', 'Failed to load vehicle data. Please try again.');
        return;
      }
    }

    setSelectedTripTicket(tripTicket);
    setShowTripLogModal(true);
    
    console.log('🎫 Opening trip log for ticket:', {
      ticket_number: tripTicket.ticket_number,
      ticket_vehicle_id: tripTicket.vehicle_id,
      available_vehicles: currentVehicles.map((v: any) => ({
        id: v.id,
        plate: v.plate_number,
        model: v.model,
        fuel: v.current_fuel_level
      }))
    });
    
    // Pre-fill form with trip ticket data
    const destination = tripTicket.travelRequest?.destinations && 
      (Array.isArray(tripTicket.travelRequest.destinations)
        ? tripTicket.travelRequest.destinations.join(', ')
        : tripTicket.travelRequest.destinations) || 
      `Trip Ticket #${tripTicket.ticket_number}`;
    
    // Get the specific vehicle assigned to this trip ticket - USE CURRENT VEHICLES
    const assignedVehicleId = tripTicket.vehicle_id || (currentVehicles.length > 0 ? currentVehicles[0].id : 0);
    const assignedVehicle = currentVehicles.find((v: any) => v.id === assignedVehicleId);
    
    if (!assignedVehicle && tripTicket.vehicle_id) {
      console.error('❌ Vehicle not found!', {
        looking_for: tripTicket.vehicle_id,
        available_vehicles: currentVehicles.map((v: any) => v.id)
      });
    }
    
    const vehicleFuelLevel = assignedVehicle?.current_fuel_level !== null && assignedVehicle?.current_fuel_level !== undefined
      ? parseFloat(assignedVehicle.current_fuel_level.toString())
      : 0; // Use 0 if vehicle not found or has no fuel data
    
    console.log('🚗 Trip ticket vehicle assignment:', {
      ticket_number: tripTicket.ticket_number,
      assigned_vehicle_id: assignedVehicleId,
      vehicle_plate: assignedVehicle?.plate_number || 'NOT FOUND',
      vehicle_model: assignedVehicle?.model || 'NOT FOUND',
      vehicle_fuel_level: vehicleFuelLevel,
      using_fallback: !assignedVehicle,
    });
      
    const initialForm = {
      trip_ticket_id: tripTicket.id,
      vehicle_id: assignedVehicleId,
      date: new Date().toISOString().split('T')[0],
      departure_time_office: '',
      arrival_time_destination: '',
      departure_time_destination: '',
      arrival_time_office: '',
      destination: destination,
      purpose: tripTicket.travelRequest?.purpose || `Trip for ticket #${tripTicket.ticket_number}`,
      distance: 0,
      fuel_balance_start: vehicleFuelLevel, // Set from assigned vehicle's fuel level
      fuel_issued_office: 0,
      fuel_purchased_trip: 0,
      fuel_total: vehicleFuelLevel, // Initialize with vehicle's current fuel level
      fuel_used: 0,
      fuel_balance_end: vehicleFuelLevel, // Initialize with vehicle's current fuel level
      gear_oil: 0,
      lubrication_oil: 0,
      brake_fluid: 0,
      grease: 0,
      speedometer_start: 0,
      speedometer_end: 0,
      speedometer_distance: 0,
      odometer_start: 0,
      odometer_end: 0,
      notes: `Trip to: ${destination}`,
    };

    // Load saved form data specific to this trip ticket
    try {
      const savedDataKey = `${TRIP_LOG_FORM_STORAGE_KEY}_${tripTicket.id}`;
      const savedData = await AsyncStorage.getItem(savedDataKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        console.log('📂 Loading saved trip log data for trip ticket:', tripTicket.id);
        console.log('💾 Saved fuel data:', {
          saved_fuel_balance_start: parsedData.fuel_balance_start,
          current_vehicle_fuel: vehicleFuelLevel,
        });
        
        // Merge saved data with initial form, preserving saved values
        setTripLogForm({
          ...initialForm,
          ...parsedData,
          // Always keep trip_ticket_id and vehicle_id from trip ticket
          trip_ticket_id: tripTicket.id,
          vehicle_id: parsedData.vehicle_id || initialForm.vehicle_id,
          // ALWAYS use current vehicle's fuel level (don't trust saved value)
          fuel_balance_start: vehicleFuelLevel,
          // Recalculate totals with current fuel level
          fuel_total: vehicleFuelLevel + (parsedData.fuel_issued_office || 0) + (parsedData.fuel_purchased_trip || 0),
          fuel_balance_end: Math.max(0, vehicleFuelLevel + (parsedData.fuel_issued_office || 0) + (parsedData.fuel_purchased_trip || 0) - (parsedData.fuel_used || 0)),
        });
      } else {
        console.log('📄 No saved data found, using initial form');
        setTripLogForm(initialForm);
      }
    } catch (error) {
      console.error('Failed to load saved trip log form data:', error);
      setTripLogForm(initialForm);
    }
  };

  const closeTripLogModal = () => {
    setShowTripLogModal(false);
    setSelectedTripTicket(null);
    // Reset form
    setTripLogForm({
      trip_ticket_id: 0,
      vehicle_id: 0,
      date: new Date().toISOString().split('T')[0],
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
  };

  const handleTripLogSubmit = async () => {
    if (!selectedTripTicket) return;

    // Validate only required fields (marked with *)
    if (!tripLogForm.date) {
      Alert.alert('Validation Error', 'Date is required.');
      return;
    }
    if (!tripLogForm.departure_time_office) {
      Alert.alert('Validation Error', 'Departure from Office time is required.');
      return;
    }
    if (!tripLogForm.arrival_time_destination) {
      Alert.alert('Validation Error', 'Arrival at Destination time is required.');
      return;
    }
    if (!tripLogForm.fuel_used || tripLogForm.fuel_used === 0) {
      Alert.alert('Validation Error', 'Fuel Used is required.');
      return;
    }

    // Improved time validation for same-day trips
    const departureTime = tripLogForm.departure_time_office;
    const arrivalTime = tripLogForm.arrival_time_office;

    // Only validate if both times are present and non-empty
    if (departureTime && arrivalTime && arrivalTime.trim() !== '' && departureTime.trim() !== '') {
      // Convert 12-hour format to 24-hour for comparison
      const depTime24 = convertTo24Hour(departureTime);
      const arrTime24 = convertTo24Hour(arrivalTime);
      
      const [depHours, depMinutes] = depTime24.split(':').map(Number);
      const [arrHours, arrMinutes] = arrTime24.split(':').map(Number);

      // Handle invalid time formats
      if (isNaN(depHours) || isNaN(depMinutes) || isNaN(arrHours) || isNaN(arrMinutes)) {
        Alert.alert('Validation Error', 'Please enter valid times.');
        return;
      }

      const depTotalMinutes = depHours * 60 + depMinutes;
      const arrTotalMinutes = arrHours * 60 + arrMinutes;

      // For same-day trips, arrival should be after departure
      if (arrTotalMinutes <= depTotalMinutes) {
        Alert.alert(
          'Time Warning',
          `Arrival time (${arrivalTime}) appears to be before or equal to departure time (${departureTime}). For same-day trips, arrival should be later than departure. Do you want to continue anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: async () => {
                // Continue with submission despite time warning
                try {
                  // Convert 12-hour format times to 24-hour format for backend
                  const departure24 = convertTo24Hour(tripLogForm.departure_time_office);
                  const arrivalDest24 = convertTo24Hour(tripLogForm.arrival_time_destination || '');
                  const departureDest24 = convertTo24Hour(tripLogForm.departure_time_destination || '');
                  const arrivalOffice24 = convertTo24Hour(tripLogForm.arrival_time_office || '');
                  
                  const tripData = {
                    trip_ticket_id: selectedTripTicket.id,
                    vehicle_id: tripLogForm.vehicle_id || undefined,
                    date: tripLogForm.date,
                    // Backend expects 24-hour format
                    departure_time: departure24,
                    arrival_time: arrivalOffice24 || departure24, // Use departure time if arrival not set
                    // Additional detailed time fields
                    departure_time_office: departure24,
                    arrival_time_destination: arrivalDest24 || undefined,
                    departure_time_destination: departureDest24 || undefined,
                    arrival_time_office: arrivalOffice24 || undefined,
                    destination: tripLogForm.destination || '',
                    purpose: tripLogForm.purpose || undefined,
                    distance: tripLogForm.distance || 0,
                    fuel_balance_start: tripLogForm.fuel_balance_start || 0,
                    fuel_issued_office: tripLogForm.fuel_issued_office,
                    fuel_purchased_trip: tripLogForm.fuel_purchased_trip || 0,
                    fuel_total: tripLogForm.fuel_total || 0,
                    fuel_used: tripLogForm.fuel_used,
                    fuel_balance_end: tripLogForm.fuel_balance_end || 0,
                    gear_oil: tripLogForm.gear_oil || 0,
                    lubrication_oil: tripLogForm.lubrication_oil || 0,
                    brake_fluid: tripLogForm.brake_fluid || 0,
                    grease: tripLogForm.grease || 0,
                    speedometer_start: tripLogForm.speedometer_start || 0,
                    speedometer_end: tripLogForm.speedometer_end || 0,
                    speedometer_distance: tripLogForm.speedometer_distance || 0,
                    odometer_start: tripLogForm.odometer_start || 0,
                    odometer_end: tripLogForm.odometer_end || 0,
                    notes: tripLogForm.notes || '',
                  };

                  try {
                    await ApiService.createTripLog(tripData);
                    console.log('✅ Trip log created successfully');
                  } catch (createError: any) {
                    if (createError.response?.status === 409 && createError.response?.data?.trip_log) {
                      // Trip log already exists, update it instead
                      const existingLog = createError.response.data.trip_log;
                      console.log('⚠️ Trip log exists, updating ID:', existingLog.id);
                      await ApiService.updateTripLog(existingLog.id, tripData);
                      console.log('✅ Trip log updated successfully');
                    } else {
                      throw createError;
                    }
                  }

                  showSuccess({
                    title: 'Trip Log Saved',
                    message: 'Your trip log has been successfully saved.',
                    autoClose: true,
                    autoCloseDelay: 3000,
                  });

                  closeTripLogModal();
                  loadTrips();
                } catch (error: any) {
                  console.error('Failed to save trip log:', error);
                  Alert.alert('Error', error.response?.data?.message || 'Failed to save trip log');
                }
              }
            }
          ]
        );
        return;
      }
    }

    // If validation passes, submit the trip log
    try {
      // Convert 12-hour format times to 24-hour format for backend
      const departure24 = convertTo24Hour(tripLogForm.departure_time_office);
      const arrivalDest24 = convertTo24Hour(tripLogForm.arrival_time_destination || '');
      const departureDest24 = convertTo24Hour(tripLogForm.departure_time_destination || '');
      const arrivalOffice24 = convertTo24Hour(tripLogForm.arrival_time_office || '');
      
      const tripData = {
        trip_ticket_id: selectedTripTicket.id,
        vehicle_id: tripLogForm.vehicle_id,
        date: tripLogForm.date,
        // Backend expects 24-hour format
        departure_time: departure24,
        arrival_time: arrivalOffice24 || departure24, // Use departure time if arrival not set
        // Additional detailed time fields
        departure_time_office: departure24,
        arrival_time_destination: arrivalDest24 || undefined,
        departure_time_destination: departureDest24 || undefined,
        arrival_time_office: arrivalOffice24 || undefined,
        destination: tripLogForm.destination || '',
        purpose: tripLogForm.purpose || undefined,
        distance: tripLogForm.distance || 0,
        fuel_balance_start: tripLogForm.fuel_balance_start || 0,
        fuel_issued_office: tripLogForm.fuel_issued_office,
        fuel_purchased_trip: tripLogForm.fuel_purchased_trip || 0,
        fuel_total: tripLogForm.fuel_total || 0,
        fuel_used: tripLogForm.fuel_used,
        fuel_balance_end: tripLogForm.fuel_balance_end || 0,
        gear_oil: tripLogForm.gear_oil || 0,
        lubrication_oil: tripLogForm.lubrication_oil || 0,
        brake_fluid: tripLogForm.brake_fluid || 0,
        grease: tripLogForm.grease || 0,
        speedometer_start: tripLogForm.speedometer_start || 0,
        speedometer_end: tripLogForm.speedometer_end || 0,
        speedometer_distance: tripLogForm.speedometer_distance || 0,
        odometer_start: tripLogForm.odometer_start || 0,
        odometer_end: tripLogForm.odometer_end || 0,
        notes: tripLogForm.notes || '',
      };

      try {
        await ApiService.createTripLog(tripData);
        console.log('✅ Trip log created successfully');
      } catch (createError: any) {
        if (createError.response?.status === 409 && createError.response?.data?.trip_log) {
          // Trip log already exists, update it instead
          const existingLog = createError.response.data.trip_log;
          console.log('⚠️ Trip log exists, updating ID:', existingLog.id);
          await ApiService.updateTripLog(existingLog.id, tripData);
          console.log('✅ Trip log updated successfully');
        } else {
          throw createError;
        }
      }

      showSuccess({
        title: 'Trip Log Saved',
        message: 'Your trip log has been successfully saved.',
        autoClose: true,
        autoCloseDelay: 3000,
      });

      // Keep the form data saved for future use and keep modal open
      // so user can see what they submitted
      // closeTripLogModal();
      loadTrips();
    } catch (error: any) {
      console.error('Failed to save trip log:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save trip log');
    }
  };

  const handleRefresh = () => {
    loadTrips(true);
    loadActiveTrip();
    loadActiveTripTickets();
  };

  // Helper functions for formatting
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A';
    // Handle both 12-hour and 24-hour formats
    return timeString.slice(0, 5); // Show HH:MM or H:MM
  };

  // Removed Edit and Delete functionality as per requirements
  // Trip logs are view-only in history
  
  const oldHandleDeleteTrip = async (tripId: number) => {
    // This function is no longer used
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteTripLog(tripId);
              Alert.alert('Success', 'Trip log deleted successfully');
              loadTrips();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete trip log');
            }
          },
        },
      ]
    );
  };

  const getGpsStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return { color: '#10b981' }; // green
      case 'searching':
        return { color: '#f59e0b' }; // yellow/amber
      case 'error':
        return { color: '#ef4444' }; // red
      case 'stopped':
      default:
        return { color: '#65676B' }; // gray
    }
  };

  const updateTripLogForm = (field: string, value: string | number) => {
    setTripLogForm(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate fuel total
      if (['fuel_balance_start', 'fuel_issued_office', 'fuel_purchased_trip'].includes(field)) {
        const balance = Number(updated.fuel_balance_start || 0);
        const issued = Number(updated.fuel_issued_office || 0);
        const purchased = Number(updated.fuel_purchased_trip || 0);
        const total = balance + issued + purchased;
        updated.fuel_total = total;
        
        // Also recalculate fuel_balance_end when fuel_total changes
        const used = Number(updated.fuel_used || 0);
        const endBalance = total - used;
        updated.fuel_balance_end = endBalance >= 0 ? endBalance : 0;
      }

      // Auto-calculate fuel balance end when fuel_used changes
      if (field === 'fuel_used') {
        const total = Number(updated.fuel_total || 0);
        const used = Number(updated.fuel_used || 0);
        const endBalance = total - used;
        updated.fuel_balance_end = endBalance >= 0 ? endBalance : 0;
      }

      // Auto-calculate speedometer distance and fuel used based on odometer
      if (['speedometer_start', 'speedometer_end', 'odometer_start', 'odometer_end'].includes(field)) {
        // If odometer is being updated, sync it to speedometer
        if (field === 'odometer_start') {
          updated.speedometer_start = Number(value);
        } else if (field === 'odometer_end') {
          updated.speedometer_end = Number(value);
        }
        
        const start = Number(updated.speedometer_start || 0);
        const end = Number(updated.speedometer_end || 0);
        const distance = end - start;
        updated.speedometer_distance = distance > 0 ? distance : 0;
        
        // Always update distance field with speedometer distance
        updated.distance = distance > 0 ? distance : 0;
        
        // Auto-calculate fuel used based on odometer distance
        // Using average fuel consumption rate: 1 liter per 10 km (10 km/L)
        const odometerStart = Number(updated.odometer_start || 0);
        const odometerEnd = Number(updated.odometer_end || 0);
        const odometerDistance = odometerEnd - odometerStart;
        
        if (odometerDistance > 0) {
          // Average fuel consumption: 10 km per liter (adjust based on vehicle type)
          const AVG_FUEL_EFFICIENCY = 10; // km per liter
          const calculatedFuelUsed = odometerDistance / AVG_FUEL_EFFICIENCY;
          updated.fuel_used = parseFloat(calculatedFuelUsed.toFixed(2));
          
          console.log(`⛽ Auto-calculated from odometer: Distance=${odometerDistance} km, Fuel=${updated.fuel_used} L (${AVG_FUEL_EFFICIENCY} km/L)`);
          
          // Recalculate fuel_balance_end with new fuel_used
          const total = Number(updated.fuel_total || 0);
          const endBalance = total - updated.fuel_used;
          updated.fuel_balance_end = endBalance >= 0 ? endBalance : 0;
        }
      }

      return updated;
    });

    // Debounced save to persistent storage for better performance
    setTripLogForm(currentForm => {
      if (selectedTripTicket?.id) {
        debouncedSave(currentForm, selectedTripTicket.id);
      }
      return currentForm;
    });
  };

  if (isLoading && trips.length === 0) {
    return (
      <LoadingComponent 
        message="Loading your trips..." 
        color="#3E0703"
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Icon name="document-text-outline" size={24} color="#3E0703" />
            <Text style={styles.title}>Trip Logs</Text>
          </View>
          <NotificationBellButton color="#3E0703" size={26} />
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollableContent}
        contentContainerStyle={styles.scrollableContentContainer}
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

      {/* Monthly Stats - Minimal Version at Top */}
      {stats && (
        <View style={styles.statsContainerMinimal}>
          <Text style={styles.statsMonthLabel}>This Month</Text>
          <View style={styles.statsRowMinimal}>
            <View style={styles.statItemMinimal}>
              <Icon name="car-outline" size={16} color="#3E0703" />
              <Text style={styles.statNumberMinimal}>{stats.total_trips}</Text>
              <Text style={styles.statLabelMinimal}>Trips</Text>
            </View>
            <View style={styles.statItemMinimal}>
              <Icon name="map-outline" size={16} color="#10b981" />
              <Text style={styles.statNumberMinimal}>{stats.total_distance}</Text>
              <Text style={styles.statLabelMinimal}>km</Text>
            </View>
            <View style={styles.statItemMinimal}>
              <Icon name="water-outline" size={16} color="#f39c12" />
              <Text style={styles.statNumberMinimal}>{stats.total_fuel}</Text>
              <Text style={styles.statLabelMinimal}>L</Text>
            </View>
          </View>
        </View>
      )}

      {/* Active Trip Tickets for Logging */}
      {activeTripTickets.length > 0 && (
        <View style={styles.activeTicketsContainer}>
          <View style={styles.activeTicketsHeader}>
            <View style={styles.activeTicketsTitleRow}>
              <View style={styles.activeTicketsIndicator}>
                <View style={styles.pulseDot} />
              </View>
              <Text style={styles.activeTicketsTitle}>Log Trip</Text>
            </View>
            <Text style={styles.activeTicketsSubtitle}>
              Record trips activity for your active trip tickets below.
            </Text>
          </View>
          
          <View style={styles.activeTicketsList}>
            {activeTripTickets.map((ticket) => (
              <View key={ticket.id} style={styles.ticketCard}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketId}>#{ticket.ticket_number}</Text>
                  <Text style={styles.ticketStatus}>In Progress</Text>
                </View>
                
                <View style={styles.ticketDetails}>
                  <Text style={styles.ticketDestination}>
                    {(() => {
                      const dest = ticket.travelRequest?.destinations;
                      console.log('Rendering destination for ticket', ticket.id, ':', dest);
                      return dest && 
                       (Array.isArray(dest) 
                         ? dest.join(', ')
                         : dest) || 
                       `Ticket #${ticket.ticket_number}`;
                    })()}
                  </Text>
                  <Text style={styles.ticketPurpose}>
                    {(() => {
                      const purpose = ticket.travelRequest?.purpose;
                      console.log('Rendering purpose for ticket', ticket.id, ':', purpose);
                      return purpose || 'Trip logging required';
                    })()}
                  </Text>
                  <Text style={styles.ticketPassenger}>
                    {(() => {
                      const passenger = ticket.passenger_name ?? ticket.travelRequest?.user?.name ?? 'Not specified';
                      console.log('Rendering passenger for ticket', ticket.id, ':', passenger);
                      return `Passenger: ${passenger}`;
                    })()}
                  </Text>
                  <Text style={styles.ticketDate}>
                    {ticket.started_at ? new Date(ticket.started_at).toLocaleDateString() : 'Not started'}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.logTripButton}
                  onPress={() => openTripLogModal(ticket)}
                >
                  <Text style={styles.logTripButtonText}>Log Trip</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Active Trip Tracking */}
      {activeTrip && (
        <View style={styles.activeTripContainer}>
          <View style={styles.activeTripHeader}>
            <View style={styles.activeTripTitleRow}>
              <Animated.View style={[
                styles.activeTripIndicator,
                {
                  transform: [{ scale: pulseAnim }],
                }
              ]}>
                <View style={styles.pulseDot} />
              </Animated.View>
              <Text style={styles.activeTripTitle}>GPS Tracking</Text>
              {isTracking && gpsStatus === 'active' && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <View style={styles.gpsStatus}>
              <View style={styles.gpsStatusContent}>
                <Icon 
                  name={gpsStatus === 'active' ? 'locate' : gpsStatus === 'searching' ? 'refresh' : gpsStatus === 'error' ? 'warning' : 'radio-button-off'} 
                  size={14} 
                  color={getGpsStatusStyle(gpsStatus).color} 
                />
                <Text style={[styles.gpsStatusText, getGpsStatusStyle(gpsStatus)]}>
                  GPS: {gpsStatus.charAt(0).toUpperCase() + gpsStatus.slice(1)}
                  {currentLocation && ` (±${Math.round(currentLocation.accuracy || 0)}m)`}
                </Text>
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      console.log('🔄 Manual location refresh requested');
                      const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                      });
                      const newLocation = {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        accuracy: location.coords.accuracy || undefined,
                      };
                      console.log('📍 Manual location:', newLocation);
                      setCurrentLocation(newLocation);
                      setLastUpdate(new Date());
                      await reverseGeocodeLocation(newLocation);
                      if (activeTrip) {
                        sendLocationUpdate(activeTrip.id, newLocation);
                      }
                    } catch (error) {
                      console.error('❌ Manual location refresh failed:', error);
                      Alert.alert('Location Error', 'Failed to get current location. Check GPS settings.');
                    }
                  }}
                  style={styles.refreshButton}
                >
                  <Icon name="refresh" size={14} color={getGpsStatusStyle(gpsStatus).color} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { loadActiveTrip(); loadActiveTripTickets(); }} style={{ marginLeft: 4 }}>
                  <Icon name="sync" size={14} color={getGpsStatusStyle(gpsStatus).color} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.activeTripContent}>
            <View style={styles.tripInfo}>
              <Text style={styles.tripId}>#{activeTrip.id}</Text>
              <Text style={styles.activeTripDestination}>
                {(() => {
                  const dest = activeTrip.travelRequest?.destinations;
                  console.log('Active trip destination:', dest);
                  return dest && 
                   (Array.isArray(dest) 
                     ? dest.join(', ')
                     : dest) || 
                   `Active Trip #${activeTrip.id}`;
                })()}
              </Text>
              <Text style={styles.activeTripPurpose}>
                {(() => {
                  const purpose = activeTrip.travelRequest?.purpose;
                  console.log('Active trip purpose:', purpose);
                  return purpose || 'No purpose specified';
                })()}
              </Text>
              <Text style={styles.activeTripPassenger}>
                {(() => {
                  const passenger = activeTrip.passenger_name ?? activeTrip.travelRequest?.user?.name ?? 'Not specified';
                  console.log('Active trip passenger:', passenger);
                  return `Passenger: ${passenger}`;
                })()}
              </Text>
              <Text style={styles.tripStarted}>
                Started: {activeTrip.started_at ? new Date(activeTrip.started_at).toLocaleString() : 'Not started'}
              </Text>
            </View>

            {currentLocation && mapRegion && (
              <View style={styles.locationContainer}>
                {/* Map View */}
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.map}
                    region={mapRegion}
                    showsUserLocation={true}
                    followsUserLocation={true}
                    showsMyLocationButton={false}
                    zoomEnabled={true}
                    scrollEnabled={true}
                    rotateEnabled={true}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                    loadingEnabled={true}
                  >
                    {/* GPS Trail Route Polyline */}
                    {routeCoordinates.length > 1 && (
                      <Polyline
                        coordinates={routeCoordinates}
                        strokeColor="#3E0703"
                        strokeWidth={4}
                        lineJoin="round"
                        lineCap="round"
                      />
                    )}

                    {/* Starting point marker */}
                    {routeCoordinates.length > 0 && (
                      <Marker
                        coordinate={routeCoordinates[0]}
                        title="Start Point"
                        pinColor="#10b981"
                      />
                    )}

                    {/* Current location marker */}
                    {currentLocation && (
                      <Marker
                        coordinate={{
                          latitude: currentLocation.latitude,
                          longitude: currentLocation.longitude,
                        }}
                        title="Current Location"
                        description={currentAddress}
                        pinColor="#3E0703"
                      />
                    )}
                  </MapView>
                </View>

                {/* Location Info */}
                <Animated.View style={[
                  styles.locationInfo,
                  {
                    backgroundColor: updateFlashAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#F0F2F5', '#dcfce7'],
                    }),
                  }
                ]}>
                  <View style={styles.locationRow}>
                    <Icon name="location" size={16} color="#3E0703" />
                    <Text style={styles.locationAddress}>{currentAddress}</Text>
                    {isTracking && gpsStatus === 'active' && (
                      <View style={styles.updatingBadge}>
                        <Text style={styles.updatingText}>●</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.locationRow}>
                    <Icon name="navigate-circle" size={16} color="#666" />
                    <Text style={styles.locationCoords}>
                      {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Icon name="radio" size={16} color="#666" />
                    <Text style={styles.locationAccuracy}>
                      ±{Math.round(currentLocation.accuracy || 0)}m accuracy
                    </Text>
                  </View>
                  {routeCoordinates.length > 1 && (
                    <View style={styles.locationRow}>
                      <Icon name="trail-sign" size={16} color="#3E0703" />
                      <Text style={styles.routeDistance}>
                        Distance traveled: {calculateTotalDistance().toFixed(2)} km ({routeCoordinates.length} points)
                      </Text>
                    </View>
                  )}
                  {lastUpdate && (
                    <View style={styles.locationRow}>
                      <Icon name="time" size={16} color="#666" />
                      <Text style={styles.lastUpdate}>
                        Updated: {lastUpdate.toLocaleTimeString()}
                      </Text>
                      {isTracking && (
                        <Text style={styles.autoUpdateText}> (auto-updating)</Text>
                      )}
                    </View>
                  )}
                </Animated.View>
              </View>
            )}

            {/* POS Receipt Upload - Only show if POS was generated */}
            {activeTrip.pos_generated_at && (
              <POSReceiptUpload
                ticketId={activeTrip.id}
                ticketNumber={activeTrip.ticket_number}
                existingReceiptUrl={activeTrip.pos_receipt_image}
                existingUploadedAt={activeTrip.pos_receipt_uploaded_at}
                onUploadSuccess={(receiptUrl, uploadedAt) => {
                  console.log('✅ POS Receipt uploaded successfully:', { receiptUrl, uploadedAt });
                  // Refresh active trip data to update UI
                  loadActiveTrip();
                }}
              />
            )}

            <View style={styles.activeTripActions}>
              <TouchableOpacity
                style={[styles.gpsButton, isTracking ? styles.stopGpsButton : styles.startGpsButton]}
                onPress={() => {
                  console.log('🔘 GPS button pressed - Current state: isTracking =', isTracking, ', gpsStatus =', gpsStatus);
                  if (isTracking) {
                    stopGPSTracking();
                  } else {
                    startGPSTracking();
                  }
                }}
              >
                <View style={styles.buttonContent}>
                  <Icon 
                    name={isTracking ? 'stop-circle' : 'play-circle'} 
                    size={20} 
                    color="#fff" 
                  />
                  <Text style={styles.gpsButtonText}>
                    {isTracking ? 'Stop GPS' : 'Start GPS'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.completeButton}
                onPress={handleCompleteTrip}
              >
                <View style={styles.buttonContent}>
                  <Icon name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.completeButtonText}>Complete Trip</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

        {/* Trip Log History */}
        {trips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="clipboard-outline" size={64} color="#CCD0D5" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>No trip logs yet</Text>
            <Text style={styles.emptySubtext}>
              Trip logs from in-progress trips will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.tripsListContainer}>
            <View style={styles.historyHeader}>
              <Icon name="document-text" size={22} color="#3E0703" />
              <Text style={styles.tripsListTitle}>Trip Log History</Text>
              <View style={styles.tripCountBadge}>
                <Text style={styles.tripCountText}>{trips.length}</Text>
              </View>
            </View>
            {trips.map((trip, index) => {
              // Check if this ticket ID appears more than once (should never happen now)
              const duplicateCount = trips.filter(t => 
                t.trip_ticket_id && t.trip_ticket_id === trip.trip_ticket_id
              ).length;
              const isDuplicate = duplicateCount > 1;
              
              return (
              <View 
                key={`trip-${trip.id}-ticket-${trip.trip_ticket_id || 'none'}-index-${index}`} 
                style={[
                  styles.tripCard,
                  isDuplicate && __DEV__ && { borderLeftColor: '#ef4444', borderLeftWidth: 6 }
                ]}
              >
                {/* Warning banner for duplicates in dev mode */}
                {isDuplicate && __DEV__ && (
                  <View style={{ backgroundColor: '#fee2e2', padding: 8, borderRadius: 8, marginBottom: 8 }}>
                    <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: 'bold' }}>
                      ⚠️ DUPLICATE DETECTED - Ticket #{trip.trip_ticket_id} appears {duplicateCount} times
                    </Text>
                  </View>
                )}
                
                {/* Trip Header with Date and Status */}
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripDateContainer}>
                    <Icon name="calendar" size={16} color="#3E0703" />
                    <Text style={styles.tripDate}>
                      {new Date(trip.created_at).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </Text>
                    {/* Debug info */}
                    {__DEV__ && (
                      <Text style={{ fontSize: 9, color: '#9ca3af', marginLeft: 4 }}>
                        (Trip #{trip.id}{trip.trip_ticket_id ? `, Ticket #${trip.trip_ticket_id}` : ''})
                      </Text>
                    )}
                  </View>
                  <View style={styles.tripStatusBadge}>
                    <Icon name="checkmark-circle" size={14} color="#10b981" />
                    <Text style={styles.tripStatusText}>Completed</Text>
                  </View>
                </View>

                {/* Main Trip Information */}
                <View style={styles.tripMainInfo}>
                  <View style={styles.tripDestinationRow}>
                    <Icon name="location" size={18} color="#3E0703" />
                    <Text style={styles.tripDestination} numberOfLines={2}>
                      {trip.route || 'No destination specified'}
                    </Text>
                  </View>
                  
                  {trip.purpose && (
                    <View style={styles.tripPurposeRow}>
                      <Icon name="information-circle-outline" size={16} color="#65676B" />
                      <Text style={styles.tripPurpose} numberOfLines={2}>
                        {trip.purpose}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Trip Metrics Grid */}
                <View style={styles.tripMetricsGrid}>
                  {/* Distance */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Icon name="speedometer-outline" size={20} color="#3E0703" />
                    </View>
                    <Text style={styles.metricValue}>{trip.distance || 0} km</Text>
                    <Text style={styles.metricLabel}>Distance</Text>
                  </View>

                  {/* Fuel Used */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Icon name="water-outline" size={20} color="#f59e0b" />
                    </View>
                    <Text style={styles.metricValue}>{trip.fuel_used || 0} L</Text>
                    <Text style={styles.metricLabel}>Fuel Used</Text>
                  </View>

                  {/* Duration */}
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconContainer}>
                      <Icon name="time-outline" size={20} color="#10b981" />
                    </View>
                    <Text style={[styles.metricValue, { fontSize: 11}]} numberOfLines={1}>
                      {trip.departure_time_office && trip.arrival_time_office 
                        ? `${trip.departure_time_office.slice(0,5)} - ${trip.arrival_time_office.slice(0,5)}`
                        : 'N/A'}
                    </Text>
                    <Text style={styles.metricLabel}>Time</Text>
                  </View>
                </View>

                {/* Vehicle Information */}
                {trip.vehicle && (
                  <View style={styles.tripVehicleInfo}>
                    <Icon name="car-sport-outline" size={16} color="#65676B" />
                    <Text style={styles.tripVehicle}>
                      {trip.vehicle.type} {trip.vehicle.model} • {trip.vehicle.plate_number || 'N/A'}
                    </Text>
                  </View>
                )}

                {/* Notes Section (if exists) */}
                {trip.notes && trip.notes.trim() !== '' && (
                  <View style={styles.tripNotesContainer}>
                    <View style={styles.notesHeader}>
                      <Icon name="document-text-outline" size={14} color="#65676B" />
                      <Text style={styles.notesHeaderText}>Notes</Text>
                    </View>
                    <Text style={styles.tripNotes} numberOfLines={3}>
                      {trip.notes}
                    </Text>
                  </View>
                )}
              </View>
              );
            })}
          </View>
        )}

      {/* Trip Logging Modal */}
      <Modal
        visible={showTripLogModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeTripLogModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Log Trip Details</Text>
                {selectedTripTicket && (
                  <Text style={styles.modalSubtitle}>
                    {selectedTripTicket.travelRequest?.destinations && 
                     (Array.isArray(selectedTripTicket.travelRequest.destinations)
                       ? selectedTripTicket.travelRequest.destinations.join(', ')
                       : selectedTripTicket.travelRequest.destinations) || 
                     `Trip Ticket #${selectedTripTicket.ticket_number}`}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={closeTripLogModal}>
                <Icon name="close" size={24} color="#65676B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedTripTicket && (
                <View style={styles.tripTicketInfo}>
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
                        <Text style={styles.ticketDetailValue}>{selectedTripTicket.ticket_number}</Text>
                      </View>
                      
                      <View style={styles.ticketDetailItem}>
                        <Text style={styles.ticketDetailLabel}>Passenger:</Text>
                        <Text style={styles.ticketDetailValue}>
                          {selectedTripTicket.passenger_name ?? selectedTripTicket.travelRequest?.user?.name ?? 'N/A'}
                        </Text>
                      </View>
                      
                      <View style={styles.ticketDetailItem}>
                        <Text style={styles.ticketDetailLabel}>Travel Date:</Text>
                        <Text style={styles.ticketDetailValue}>
                          {formatDate(selectedTripTicket.travelRequest?.start_date ?? 'N/A')}
                        </Text>
                      </View>
                      
                      <View style={styles.ticketDetailItem}>
                        <Text style={styles.ticketDetailLabel}>Purpose:</Text>
                        <Text style={styles.ticketDetailValue}>
                          {selectedTripTicket.travelRequest?.purpose || 'N/A'}
                        </Text>
                      </View>
                      
                      <View style={[styles.ticketDetailItem, styles.ticketDetailFullWidth]}>
                        <Text style={styles.ticketDetailLabel}>Destinations:</Text>
                        <Text style={styles.ticketDetailValue}>
                          {selectedTripTicket.travelRequest?.destinations ? 
                            (Array.isArray(selectedTripTicket.travelRequest.destinations) 
                              ? selectedTripTicket.travelRequest.destinations.join(', ')
                              : selectedTripTicket.travelRequest.destinations)
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
                    style={styles.input}
                    value={tripLogForm.date}
                    onChangeText={(text) => updateTripLogForm('date', text)}
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Driver Name</Text>
                  <TextInput
                    style={[styles.input, styles.readOnly]}
                    value={selectedTripTicket?.driver_name || selectedTripTicket?.passenger_name || selectedTripTicket?.travelRequest?.user?.name || 'Current User'}
                    editable={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Vehicle</Text>
                  <TextInput
                    style={[styles.input, styles.readOnly]}
                    value={
                      selectedTripTicket?.vehicle &&
                      typeof selectedTripTicket.vehicle.plate_number === 'string' &&
                      typeof selectedTripTicket.vehicle.type === 'string' &&
                      typeof selectedTripTicket.vehicle.model === 'string' &&
                      selectedTripTicket.vehicle.plate_number.trim() &&
                      selectedTripTicket.vehicle.type.trim() &&
                      selectedTripTicket.vehicle.model.trim()
                        ? `${selectedTripTicket.vehicle.type.trim()} ${selectedTripTicket.vehicle.model.trim()} (${selectedTripTicket.vehicle.plate_number.trim()})`
                        : vehicles.length > 0 &&
                          typeof vehicles[0].plate_number === 'string' &&
                          typeof vehicles[0].type === 'string' &&
                          typeof vehicles[0].model === 'string' &&
                          vehicles[0].plate_number.trim() &&
                          vehicles[0].type.trim() &&
                          vehicles[0].model.trim()
                        ? `${vehicles[0].type.trim()} ${vehicles[0].model.trim()} (${vehicles[0].plate_number.trim()})`
                        : 'No vehicle assigned'
                    }
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
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => openTimePicker('departure_time_office', tripLogForm.departure_time_office)}
                    >
                      <Text style={tripLogForm.departure_time_office ? styles.inputText : styles.placeholderText}>
                        {tripLogForm.departure_time_office || '9:00 AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Arrival at Destination *</Text>
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => openTimePicker('arrival_time_destination', tripLogForm.arrival_time_destination)}
                    >
                      <Text style={tripLogForm.arrival_time_destination ? styles.inputText : styles.placeholderText}>
                        {tripLogForm.arrival_time_destination || '12:00 PM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Departure from Destination</Text>
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => openTimePicker('departure_time_destination', tripLogForm.departure_time_destination)}
                    >
                      <Text style={tripLogForm.departure_time_destination ? styles.inputText : styles.placeholderText}>
                        {tripLogForm.departure_time_destination || '1:00 PM'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Arrival at Office</Text>
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => openTimePicker('arrival_time_office', tripLogForm.arrival_time_office)}
                    >
                      <Text style={tripLogForm.arrival_time_office ? styles.inputText : styles.placeholderText}>
                        {tripLogForm.arrival_time_office || '5:00 PM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Fuel Information Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Fuel Information</Text>
                
                {/* Information banner explaining official fuel tracking */}
                <View style={styles.fuelInfoBanner}>
                  <Icon name="information-circle" size={20} color="#3b82f6" />
                  <View style={styles.fuelInfoBannerText}>
                    <Text style={styles.fuelInfoBannerTitle}>Trip Fuel Tracking</Text>
                    <Text style={styles.fuelInfoBannerDescription}>
                      The tank balance is auto-filled from vehicle. Enter office fuel only if issued for this trip (0 if using existing fuel).
                    </Text>
                  </View>
                </View>
                
                {/* Balance of fuel in tank - Full Width with Info */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Balance of fuel in tank (Liters)</Text>
                  <TextInput
                    style={[styles.input, styles.readOnly]}
                    value={tripLogForm.fuel_balance_start?.toFixed(2) || '0.00'}
                    editable={false}
                    placeholder="0.00"
                    keyboardType="numeric"
                  />
                  <View style={styles.helperTextContainer}>
                    <Icon name="information-circle" size={14} color="#65676B" />
                    <Text style={styles.helperText}>
                      Auto-calculated from vehicle fuel records
                    </Text>
                  </View>
                </View>
                
                {/* Fuel Issued at Office - Full Width */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Fuel Issued at Office (L)</Text>
                  <TextInput
                    style={styles.input}
                    value={fuelIssuedText || tripLogForm.fuel_issued_office?.toString() || ''}
                    onChangeText={(text) => {
                      // Allow empty, numbers, and decimal point
                      if (text === '' || /^\d*\.?\d*$/.test(text)) {
                        setFuelIssuedText(text);
                        updateTripLogForm('fuel_issued_office', text === '' ? 0 : parseFloat(text) || 0);
                      }
                    }}
                    onBlur={() => {
                      // Clean up text state on blur
                      if (fuelIssuedText && !fuelIssuedText.endsWith('.')) {
                        setFuelIssuedText('');
                      }
                    }}
                    placeholder="0"
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.helperTextContainer}>
                    <Icon name="information-circle-outline" size={14} color="#3b82f6" />
                    <Text style={styles.helperText}>
                      Enter 0 if using existing fuel, or amount if office issued fuel
                    </Text>
                  </View>
                </View>

                {/* Fuel Purchased and Fuel Total Row */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={[styles.label, { fontSize: 12 }]}>Fuel Purchased on Trip (L)</Text>
                    <TextInput
                      style={styles.input}
                      value={fuelPurchasedText || tripLogForm.fuel_purchased_trip?.toString() || ''}
                      onChangeText={(text) => {
                        // Allow empty, numbers, and decimal point
                        if (text === '' || /^\d*\.?\d*$/.test(text)) {
                          setFuelPurchasedText(text);
                          updateTripLogForm('fuel_purchased_trip', text === '' ? 0 : parseFloat(text) || 0);
                        }
                      }}
                      onBlur={() => {
                        // Clean up text state on blur
                        if (fuelPurchasedText && !fuelPurchasedText.endsWith('.')) {
                          setFuelPurchasedText('');
                        }
                      }}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.helperTextContainer}>
                      <Icon name="add-circle-outline" size={14} color="#10b981" />
                      <Text style={[styles.helperText, { color: '#10b981' }]}>Added to fuel balance</Text>
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Fuel Total (L)</Text>
                    <TextInput
                      style={[styles.input, styles.readOnly]}
                      value={tripLogForm.fuel_total?.toFixed(2) || '0.00'}
                      editable={false}
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Fuel Used and Fuel Balance End Row */}
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Fuel Used (L) *</Text>
                    <TextInput
                      style={styles.input}
                      value={fuelUsedText || tripLogForm.fuel_used?.toString() || ''}
                      onChangeText={(text) => {
                        // Allow empty, numbers, and decimal point
                        if (text === '' || /^\d*\.?\d*$/.test(text)) {
                          setFuelUsedText(text);
                          updateTripLogForm('fuel_used', text === '' ? 0 : parseFloat(text) || 0);
                        }
                      }}
                      onBlur={() => {
                        // Clean up text state on blur
                        if (fuelUsedText && !fuelUsedText.endsWith('.')) {
                          setFuelUsedText('');
                        }
                      }}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.helperTextContainer}>
                      <Icon name="remove-circle-outline" size={14} color="#ef4444" />
                      <Text style={[styles.helperText, { color: '#ef4444' }]}>Deducted from fuel balance</Text>
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Fuel Balance End (L)</Text>
                    <TextInput
                      style={[styles.input, styles.readOnly]}
                      value={tripLogForm.fuel_balance_end?.toFixed(2) || '0.00'}
                      editable={false}
                      placeholder="0.00"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Lubricants Information Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lubricants Information (if any)</Text>
                
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Gear Oil (L)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.gear_oil?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('gear_oil', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Lubrication Oil (L)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.lubrication_oil?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('lubrication_oil', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Brake Fluid (L)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.brake_fluid?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('brake_fluid', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Grease (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.grease?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('grease', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Speedometer & Odometer Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Speedometer & Odometer (if any)</Text>
                
                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={[styles.label, { fontSize: 12 }]}>Speedometer Start (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.speedometer_start?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('speedometer_start', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Speedometer End (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.speedometer_end?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('speedometer_end', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={[styles.label, { fontSize: 12 }]}>Speedometer Distance (km)</Text>
                    <TextInput
                      style={[styles.input, styles.readOnly]}
                      value={tripLogForm.speedometer_distance?.toString() || '0'}
                      editable={false}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Distance (km) *</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.distance?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('distance', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Odometer Start (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.odometer_start?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('odometer_start', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, styles.halfWidth]}>
                    <Text style={styles.label}>Odometer End (km)</Text>
                    <TextInput
                      style={styles.input}
                      value={tripLogForm.odometer_end?.toString() || ''}
                      onChangeText={(text) => updateTripLogForm('odometer_end', parseFloat(text) || 0)}
                      placeholder="0"
                      keyboardType="numeric"
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
                    value={tripLogForm.notes}
                    onChangeText={(text) => updateTripLogForm('notes', text)}
                    placeholder="Additional notes or comments..."
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeTripLogModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleTripLogSubmit}>
                <Text style={styles.submitButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={showTimePicker !== null}
        mode="time"
        is24Hour={false}
        date={tempTime}
        onConfirm={handleTimeChange}
        onCancel={() => setShowTimePicker(null)}
      />

      </ScrollView>

      {/* Modals */}
      <ConfirmationModal
        visible={confirmationState.visible}
        title={confirmationState.title}
        message={confirmationState.message}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        onConfirm={confirmationState.onConfirm}
        onCancel={confirmationState.onCancel}
        type={confirmationState.type}
      />

      <SuccessModal
        visible={successState.visible}
        title={successState.title}
        message={successState.message}
        onClose={successState.onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5', // Match other screens
  },
  scrollableContent: {
    flex: 1,
  },
  scrollableContentContainer: {
    paddingBottom: 20,
  },

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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  addButton: {
    backgroundColor: '#C28F22', // TripManager secondary brand color
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  statsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 10,
    padding: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#050505',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: '#CCD0D5',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 50,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 13,
    color: '#65676B',
    textAlign: 'center',
  },
  // Minimal Stats Styles (Top Section)
  statsContainerMinimal: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statsMonthLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statsRowMinimal: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItemMinimal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statNumberMinimal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statLabelMinimal: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#65676B',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#65676B',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#FFFFFF', // TripManager primary brand color
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  tripsList: {
    padding: 16, // Consistent with other screens
    paddingTop: 10,
  },
  tripsListContainer: {
    padding: 16,
    paddingTop: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  tripsListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  tripCountBadge: {
    backgroundColor: '#3E0703',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tripCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  tripDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
  },
  tripStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
  },
  tripStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  tripMainInfo: {
    marginBottom: 14,
  },
  tripDestinationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  tripDestination: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#050505',
    lineHeight: 20,
  },
  tripPurposeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  tripPurpose: {
    flex: 1,
    fontSize: 13,
    color: '#65676B',
    lineHeight: 18,
  },
  tripMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#050505',
    textAlign: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#65676B',
    textAlign: 'center',
    fontWeight: '500',
  },
  tripVehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  tripVehicle: {
    flex: 1,
    fontSize: 12,
    color: '#65676B',
    fontWeight: '500',
  },
  tripNotesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  notesHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#65676B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tripNotes: {
    fontSize: 12,
    color: '#65676B',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  // Active Trip Styles
  activeTripContainer: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    // borderLeftWidth: 4,
    // borderLeftColor: '#10b981', // Green indicator
  },
  activeTripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activeTripTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTripIndicator: {
    width: 12,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  activeTripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#050505',
  },
  gpsStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gpsStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gpsStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeTripContent: {
    padding: 16,
  },
  tripInfo: {
    marginBottom: 16,
  },
  tripId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E0703',
    marginBottom: 4,
  },
  activeTripDestination: {
    fontSize: 14,
    color: '#050505',
    marginBottom: 4,
  },
  activeTripPurpose: {
    fontSize: 14,
    color: '#65676B',
    marginBottom: 4,
    fontWeight: '500',
  },
  activeTripPassenger: {
    fontSize: 14,
    color: '#65676B',
    marginBottom: 4,
    fontWeight: '500',
  },
  tripStarted: {
    fontSize: 12,
    color: '#65676B',
  },
  activeTripActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  gpsButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startGpsButton: {
    backgroundColor: '#10b981',
  },
  stopGpsButton: {
    backgroundColor: '#ef4444',
  },
  gpsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#3E0703',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#050505',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#65676B',
    marginTop: 4,
  },
  modalBody: {
    padding: 20,
    flex: 1,
  },
  tripTicketInfo: {
    backgroundColor: '#F0F2F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
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
    color: '#050505',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
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
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  halfWidth: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  readOnly: {
    backgroundColor: '#F0F2F5',
    color: '#6c757d',
  },
  helperTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: -8,
    paddingHorizontal: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#65676B',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  fuelInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  fuelInfoBannerText: {
    flex: 1,
  },
  fuelInfoBannerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  fuelInfoBannerDescription: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  textArea: {
    height: 80,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 15,
    gap: 12,
    marginBottom: 35,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#65676B',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#3E0703',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Active Trip Tickets Styles
  activeTicketsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activeTicketsHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activeTicketsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeTicketsIndicator: {
    width: 12,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTicketsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#050505',
  },
  activeTicketsSubtitle: {
    fontSize: 14,
    color: '#65676B',
  },
  activeTicketsList: {
    padding: 16,
  },
  ticketCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065f46',
  },
  ticketStatus: {
    fontSize: 12,
    color: '#059669',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '600',
  },
  ticketDetails: {
    marginBottom: 16,
  },
  ticketDestination: {
    fontSize: 16,
    fontWeight: '600',
    color: '#050505',
    marginBottom: 4,
  },
  ticketPurpose: {
    fontSize: 14,
    color: '#65676B',
    marginBottom: 4,
  },
  ticketPassenger: {
    fontSize: 14,
    color: '#050505',
    marginBottom: 4,
    fontWeight: '500',
  },
  ticketDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  logTripButton: {
    backgroundColor: '#3E0703',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  logTripButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Map and Location Styles
  locationContainer: {
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  mapContainer: {
    height: 200,
    borderRadius: 8,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  locationInfo: {
    backgroundColor: '#F0F2F5',
    padding: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationAddress: {
    fontSize: 14,
    color: '#3E0703',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  updatingBadge: {
    marginLeft: 8,
    backgroundColor: '#10b981',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updatingText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  locationCoords: {
    fontSize: 12,
    color: '#65676B',
    fontFamily: 'monospace',
    marginLeft: 8,
  },
  locationAccuracy: {
    fontSize: 12,
    color: '#65676B',
    marginLeft: 8,
  },
  routeDistance: {
    fontSize: 12,
    color: '#3E0703',
    marginLeft: 8,
    fontWeight: '600',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#65676B',
    marginLeft: 8,
  },
  autoUpdateText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  refreshButton: {
    marginLeft: 8,
    padding: 4,
  },
  // Enhanced Button Styles
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inputText: {
    fontSize: 16,
    color: '#050505',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
