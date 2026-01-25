import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { TripTicket } from '@/types';
import ApiService from '@/services/api';
import { notificationService } from '@/services/NotificationService';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SuccessModal } from '@/components/SuccessModal';
import { useModals } from '@/hooks/useModals';

export default function TripTicketDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [tripTicket, setTripTicket] = useState<TripTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Odometer and fuel tracking state
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [odometerStart, setOdometerStart] = useState('');
  const [odometerEnd, setOdometerEnd] = useState('');
  const [fuelUsed, setFuelUsed] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  const {
    confirmationState,
    successState,
    showConfirmation,
    hideConfirmation,
    showSuccess,
    hideSuccess
  } = useModals();

  useEffect(() => {
    console.log('TripTicketDetailsScreen mounted with ID:', id);
    if (id) {
      loadTripTicket();
    } else {
      setError('No trip ticket ID provided');
      setIsLoading(false);
    }
  }, [id]);

  // Helper function to check if trip can be started based on travel date
  const getTravelDateStatus = (startDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const travelDate = new Date(startDate);
    travelDate.setHours(0, 0, 0, 0);

    if (travelDate.getTime() === today.getTime()) {
      return { status: 'today', message: 'Today', color: '#10b981', canStart: true };
    } else if (travelDate < today) {
      const daysOverdue = Math.ceil((today.getTime() - travelDate.getTime()) / (1000 * 60 * 60 * 24));
      return { status: 'overdue', message: `${daysOverdue}d overdue`, color: '#f59e0b', canStart: true };
    } else {
      const daysUntil = Math.ceil((travelDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { status: 'upcoming', message: `in ${daysUntil}d`, color: '#6b7280', canStart: false };
    }
  };

  const loadTripTicket = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading trip ticket with ID:', id);
      const response = await ApiService.getTripTicket(Number(id));
      
      // Handle different response formats
      const ticketData = response.trip_ticket || response.data || response;
      console.log('🔍 API Response Full:', JSON.stringify(response, null, 2));
      console.log('🎫 Trip ticket data:', JSON.stringify(ticketData, null, 2));
      console.log('👤 Travel Request User:', ticketData?.travelRequest?.user);
      console.log('� Director/Approver:', ticketData?.travelRequest?.approver);
      console.log('📊 Travel Request Status:', ticketData?.travelRequest?.status);
      console.log('📝 Issued By:', ticketData?.issuedBy);
      // Procurement approval workflow removed
      console.log('🚗 Vehicle:', ticketData?.vehicle);
      console.log('👨‍✈️ Driver:', ticketData?.driver);
      console.log('🎯 Purpose:', ticketData?.travelRequest?.purpose);
      console.log('📅 Start Date:', ticketData?.travelRequest?.start_date);
      console.log('👥 Passengers:', ticketData?.travelRequest?.passengers);
      
      if (!ticketData) {
        throw new Error('No trip ticket data received');
      }
      
      setTripTicket(ticketData);
    } catch (error: any) {
      console.error('Failed to load trip ticket:', error);
      
      // Check if trip ticket was deleted (404 error)
      if (error.response?.status === 404) {
        setError('This trip ticket has been cancelled or removed. It may have been undone by the director.');
      } else {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to load trip ticket details';
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartTrip = async () => {
    if (!tripTicket) return;
    
    const destination = Array.isArray(tripTicket.travelRequest?.destinations) 
      ? tripTicket.travelRequest.destinations.join(', ')
      : tripTicket.travelRequest?.destinations;

    // Check if travel date exists
    if (!tripTicket.travelRequest?.start_date) {
      showConfirmation({
        title: 'Cannot Start Trip',
        message: 'This trip ticket does not have a travel date specified.',
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
      return;
    }

    // Get current date (today at midnight local time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get travel date (at midnight local time)
    const travelDate = new Date(tripTicket.travelRequest.start_date);
    travelDate.setHours(0, 0, 0, 0);

    // Check if travel date is in the future
    if (travelDate > today) {
      const daysUntilTravel = Math.ceil((travelDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const formattedDate = travelDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      showConfirmation({
        title: 'Trip Not Yet Ready',
        message: `This trip is scheduled for ${formattedDate} (${daysUntilTravel} day${daysUntilTravel > 1 ? 's' : ''} from now). You can only start trips on or after the scheduled travel date.`,
        type: 'warning',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
      return;
    }

    // Show odometer input modal
    setOdometerStart('');
    setShowStartModal(true);
  };

  const confirmStartTrip = async () => {
    if (!tripTicket) return;

    const destination = Array.isArray(tripTicket.travelRequest?.destinations) 
      ? tripTicket.travelRequest.destinations.join(', ')
      : tripTicket.travelRequest?.destinations;

    try {
      const data: any = {};
      
      // Add odometer reading if provided
      if (odometerStart && odometerStart.trim() !== '') {
        const odometerValue = parseFloat(odometerStart);
        if (isNaN(odometerValue) || odometerValue < 0) {
          Alert.alert('Invalid Input', 'Please enter a valid odometer reading');
          return;
        }
        data.odometer_start = odometerValue;
      }

      await ApiService.startTrip(tripTicket.id, data);
      
      // Create notification for trip started
      notificationService.createTripStartedNotification(
        tripTicket.id, 
        destination
      );
      
      setShowStartModal(false);
      
      showSuccess({
        title: 'Trip Started',
        message: 'Trip has been started successfully! GPS tracking is now active.',
        autoClose: true,
        autoCloseDelay: 2000
      });
      
      // Navigate to trips screen after a short delay to allow success message to show
      setTimeout(() => {
        router.push('/trips?startTracking=true');
      }, 2200);
      
    } catch (error) {
      setShowStartModal(false);
      showConfirmation({
        title: 'Error',
        message: 'Failed to start trip. Please try again.',
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
    }
  };

  const handleCompleteTrip = async () => {
    if (!tripTicket) return;
    
    // Show modal for odometer end and fuel used input
    setOdometerEnd('');
    setFuelUsed('');
    setCompletionNotes('');
    setShowCompleteModal(true);
  };

  const confirmCompleteTrip = async () => {
    if (!tripTicket) return;

    try {
      const data: any = {};

      // Add odometer end reading if provided
      if (odometerEnd && odometerEnd.trim() !== '') {
        const odometerValue = parseFloat(odometerEnd);
        if (isNaN(odometerValue) || odometerValue < 0) {
          Alert.alert('Invalid Input', 'Please enter a valid ending odometer reading');
          return;
        }
        
        // Validate that end odometer is greater than start if both exist
        if (tripTicket.odometer_start && odometerValue < tripTicket.odometer_start) {
          Alert.alert('Invalid Input', `Ending odometer (${odometerValue} km) must be greater than starting odometer (${tripTicket.odometer_start} km)`);
          return;
        }
        
        data.odometer_end = odometerValue;
      }

      // Add fuel used if provided
      if (fuelUsed && fuelUsed.trim() !== '') {
        const fuelValue = parseFloat(fuelUsed);
        if (isNaN(fuelValue) || fuelValue < 0) {
          Alert.alert('Invalid Input', 'Please enter a valid fuel amount');
          return;
        }
        data.fuel_used = fuelValue;
      }

      // Add completion notes if provided
      if (completionNotes && completionNotes.trim() !== '') {
        data.completion_notes = completionNotes;
      }

      await ApiService.completeTrip(tripTicket.id, data);
      
      // Create notification for trip completed
      const destination = Array.isArray(tripTicket.travelRequest?.destinations) 
        ? tripTicket.travelRequest.destinations.join(', ')
        : tripTicket.travelRequest?.destinations;
      
      notificationService.createTripCompletedNotification(
        tripTicket.id, 
        destination
      );
      
      setShowCompleteModal(false);
      
      showSuccess({
        title: 'Trip Completed',
        message: 'Trip has been completed successfully!',
        autoClose: true,
        autoCloseDelay: 2000
      });

      // Reload trip ticket after a short delay
      setTimeout(() => {
        loadTripTicket();
      }, 2200);
      
    } catch (error) {
      setShowCompleteModal(false);
      Alert.alert('Error', 'Failed to complete trip. Please try again.');
    }
  };

  const handleCancelTrip = () => {
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const confirmCancelTrip = async () => {
    if (!tripTicket) return;

    if (!cancellationReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      await ApiService.cancelTripEmergency(tripTicket.id, cancellationReason.trim());
      
      showSuccess({
        title: 'Trip Cancelled',
        message: 'Trip has been cancelled successfully. Director has been notified.',
        autoClose: true,
        autoCloseDelay: 3000
      });

      setShowCancelModal(false);
      setCancellationReason('');
      
      // Navigate back after a short delay
      setTimeout(() => {
        router.back();
      }, 3200);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to cancel trip. Please try again.'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#65676B';  // TripManager gray-500 - awaiting procurement
      case 'ready_for_trip':
        return '#10b981';  // Emerald-500 - ready to start
      case 'in_progress':
        return '#C28F22';  // TripManager secondary brand color - trip ongoing
      case 'completed':
        return '#3E0703';  // TripManager primary brand color - trip completed
      case 'cancelled':
      case 'canceled': // Handle alternative spelling
        return '#dc2626';  // Red-600 - cancelled
      default:
        return '#65676B';  // TripManager gray-500
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Awaiting Approval';
      case 'ready_for_trip':
        return 'Ready for Trip';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'canceled': // Handle alternative spelling
        return 'Cancelled';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
  };

  // Procurement status functions removed - procurement no longer reviews trips

  const getDirectorStatusColor = (status?: string) => {
    switch (status) {
      case 'approved':
        return '#10b981';  // Emerald-500 - approved
      case 'pending':
        return '#C28F22';  // TripManager secondary brand color - pending
      case 'rejected':
        return '#dc2626';  // Red-600 - rejected
      default:
        return '#65676B';  // TripManager gray-500
    }
  };

  const getDirectorStatusText = (status?: string) => {
    switch (status) {
      case 'approved':
        return '✓ Approved by Director';
      case 'pending':
        return '⏳ Awaiting Director Approval';
      case 'rejected':
        return '✗ Rejected by Director';
      default:
        return 'Not Available';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  if (error) {
    const isDeleted = error.includes('cancelled') || error.includes('removed') || error.includes('undone');
    return (
      <View style={styles.errorContainer}>
        <Ionicons name={isDeleted ? "close-circle-outline" : "alert-circle-outline"} size={64} color="#ef4444" style={{ marginBottom: 16 }} />
        <Text style={[styles.errorNotificationText, { textAlign: 'center', fontSize: 16, marginBottom: 20 }]}>{error}</Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={isDeleted ? () => router.back() : loadTripTicket}
          >
            <Text style={styles.retryButtonText}>{isDeleted ? 'Go Back' : 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!tripTicket) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Trip ticket not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>
            {tripTicket.ticket_number || `TT-${tripTicket.id}`}
          </Text>
          <Text style={styles.subtitle}>Trip Ticket Details</Text>
        </View>
        <View style={styles.headerStatusBadge}>
          <View style={[styles.miniStatusBadge, { backgroundColor: getStatusColor(tripTicket.status) }]}>
            <Text style={styles.miniStatusText}>{getStatusText(tripTicket.status).split(' ')[0]}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>

      {/* Trip Ready Today Banner */}
      {tripTicket.status === 'ready_for_trip' && tripTicket.travelRequest?.start_date && (() => {
        const dateStatus = getTravelDateStatus(tripTicket.travelRequest.start_date);
        if (dateStatus.status === 'today') {
          return (
            <View style={styles.tripReadyBanner}>
              <View style={styles.tripReadyIconContainer}>
                <Ionicons name="notifications" size={20} color="#10b981" />
              </View>
              <View style={styles.tripReadyContent}>
                <Text style={styles.tripReadyTitle}>🚀 Trip Scheduled for Today!</Text>
                <Text style={styles.tripReadyMessage}>You can start this trip now</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#10b981" />
            </View>
          );
        }
        return null;
      })()}

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusLabel}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(tripTicket.status) }]}>
            <Text style={styles.statusText}>{getStatusText(tripTicket.status)}</Text>
          </View>
        </View>
      </View>

      {/* Trip Ticket Card */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Trip Ticket Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Ticket Number</Text>
          <Text style={styles.detailValue}>{tripTicket.ticket_number || `#${tripTicket.id}`}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Passenger Name</Text>
          <Text style={styles.detailValue}>
            {tripTicket.travelRequest?.user?.name || tripTicket.passenger_name || 'N/A'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Department</Text>
          <Text style={styles.detailValue}>
            {tripTicket.travelRequest?.user?.department || 'N/A'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Driver Name</Text>
          <Text style={styles.detailValue}>{tripTicket.driver_name || tripTicket.driver?.name || 'N/A'}</Text>
        </View>
        
        {(tripTicket.driver_license || tripTicket.driver?.license_number) && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Driver License</Text>
            <Text style={styles.detailValue}>
              {tripTicket.driver_license || tripTicket.driver?.license_number}
            </Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Issued Date</Text>
          <Text style={styles.detailValue}>
            {tripTicket.issued_at ? formatDateTime(tripTicket.issued_at) : formatDateTime(tripTicket.created_at)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Issued By</Text>
          <Text style={styles.detailValue}>
            {tripTicket.issuedBy?.name || 'N/A'}
          </Text>
        </View>
      </View>

      {/* Procurement Status Card - Removed: Procurement no longer approves trips */}

      {/* Director Approval Status Card */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Director Approval Status</Text>
        
        <View style={styles.procurementStatusContainer}>
          <View style={[
            styles.procurementStatusBadge, 
            { backgroundColor: getDirectorStatusColor(tripTicket.travelRequest?.status) }
          ]}>
            <Text style={styles.procurementStatusText}>
              {getDirectorStatusText(tripTicket.travelRequest?.status)}
            </Text>
          </View>
        </View>
        
        {tripTicket.travelRequest?.approved_by && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Approved By</Text>
            <Text style={styles.detailValue}>
              {tripTicket.travelRequest?.approver?.name || 'N/A'}
            </Text>
          </View>
        )}
        
        {tripTicket.travelRequest?.approved_at && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Approved On</Text>
            <Text style={styles.detailValue}>{formatDateTime(tripTicket.travelRequest.approved_at)}</Text>
          </View>
        )}
        
        {tripTicket.travelRequest?.rejection_reason && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Rejection Reason:</Text>
            <Text style={styles.notesText}>{tripTicket.travelRequest.rejection_reason}</Text>
          </View>
        )}
      </View>

      {/* Travel Information Card */}
      <View style={styles.detailsCard}>
        <Text style={styles.cardTitle}>Travel Information</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Purpose</Text>
          <Text style={styles.detailValue}>
            {tripTicket.travelRequest?.purpose || 'No purpose specified'}
          </Text>
        </View>
        
        {/* Destinations Section */}
        {(tripTicket.travelRequest?.destinations || tripTicket.destination) && (
          <View style={styles.destinationsContainer}>
            <Text style={styles.destinationsLabel}>Destinations:</Text>
            {Array.isArray(tripTicket.travelRequest?.destinations) ? (
              tripTicket.travelRequest.destinations.map((destination, index) => (
                <View key={`destination-${index}`} style={styles.destinationBadge}>
                  <Text style={styles.destinationText}>{destination}</Text>
                </View>
              ))
            ) : (
              <View style={styles.destinationBadge}>
                <Text style={styles.destinationText}>
                  {tripTicket.travelRequest?.destinations || tripTicket.destination}
                </Text>
              </View>
            )}
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Travel Date</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 2, justifyContent: 'flex-end' }}>
            <Text style={styles.detailValue}>
              {tripTicket.travelRequest?.start_date 
                ? formatDate(tripTicket.travelRequest.start_date)
                : 'N/A'}
            </Text>
            {tripTicket.travelRequest?.start_date && tripTicket.status === 'ready_for_trip' && (() => {
              const dateStatus = getTravelDateStatus(tripTicket.travelRequest.start_date);
              return (
                <View style={[styles.dateStatusBadge, { backgroundColor: dateStatus.color + '20', borderColor: dateStatus.color }]}>
                  <Text style={[styles.dateStatusText, { color: dateStatus.color }]}>
                    {dateStatus.message}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
        
        {tripTicket.travelRequest?.end_date && 
         tripTicket.travelRequest.end_date !== tripTicket.travelRequest.start_date && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Return Date</Text>
            <Text style={styles.detailValue}>
              {formatDate(tripTicket.travelRequest.end_date)}
            </Text>
          </View>
        )}
        
        {/* Additional Passengers Section */}
        {tripTicket.travelRequest?.passengers && 
         Array.isArray(tripTicket.travelRequest.passengers) && 
         tripTicket.travelRequest.passengers.length > 0 && (
          <View style={styles.passengersContainer}>
            <Text style={styles.passengersLabel}>Additional Passengers:</Text>
            <View style={styles.passengersList}>
              {tripTicket.travelRequest.passengers.map((passenger, index) => (
                <View key={`passenger-${index}`} style={styles.passengerBadge}>
                  <Text style={styles.passengerText}>{passenger}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        
        {tripTicket.notes && (
          <View style={styles.specialInstructionsContainer}>
            <Text style={styles.specialInstructionsLabel}>Special Instructions:</Text>
            <Text style={styles.specialInstructionsText}>{tripTicket.notes}</Text>
          </View>
        )}
      </View>

      {/* Vehicle Information */}
      {tripTicket.vehicle && (
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Vehicle Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue}>
              {tripTicket.vehicle.type} {tripTicket.vehicle.model}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>License Plate</Text>
            <Text style={styles.detailValue}>{tripTicket.vehicle.plate_number}</Text>
          </View>
          
          {tripTicket.vehicle.year && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Year</Text>
              <Text style={styles.detailValue}>{tripTicket.vehicle.year}</Text>
            </View>
          )}
          
          {tripTicket.vehicle.fuel_type && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fuel Type</Text>
              <Text style={styles.detailValue}>{tripTicket.vehicle.fuel_type}</Text>
            </View>
          )}
          
          {tripTicket.vehicle.status && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>{tripTicket.vehicle.status}</Text>
            </View>
          )}
        </View>
      )}

      {/* Trip Status Information */}
      {(tripTicket.started_at || tripTicket.completed_at || tripTicket.end_mileage || tripTicket.fuel_consumed) && (
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Trip Status Information</Text>
          
          {tripTicket.started_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>{formatDateTime(tripTicket.started_at)}</Text>
            </View>
          )}
          
          {tripTicket.completed_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Completed</Text>
              <Text style={styles.detailValue}>{formatDateTime(tripTicket.completed_at)}</Text>
            </View>
          )}

          {tripTicket.end_mileage && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>End Mileage</Text>
              <Text style={styles.detailValue}>{tripTicket.end_mileage.toFixed(1)} km</Text>
            </View>
          )}

          {tripTicket.fuel_consumed && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fuel Consumed</Text>
              <Text style={styles.detailValue}>{tripTicket.fuel_consumed.toFixed(1)} L</Text>
            </View>
          )}

          {tripTicket.completion_notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Completion Notes:</Text>
              <Text style={styles.notesText}>{tripTicket.completion_notes}</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsCard}>
        {tripTicket.status === 'ready_for_trip' && 
         tripTicket.travelRequest?.status === 'approved' && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.startButton} onPress={handleStartTrip}>
              <View style={styles.buttonContent}>
                <Ionicons name="car" size={20} color="white" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.cancelTripButton} onPress={handleCancelTrip}>
              <View style={styles.buttonContent}>
                <Ionicons name="close-circle" size={20} color="white" />
                <Text style={styles.cancelTripButtonText}>Report Issue</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        
        {tripTicket.travelRequest?.status === 'rejected' && (
          <View style={styles.rejectedIndicator}>
            <View style={styles.rejectedContainer}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.rejectedText}>Trip Rejected by Director</Text>
            </View>
            <Text style={styles.rejectedSubtext}>This trip request has been rejected by the director.</Text>
            {tripTicket.travelRequest?.rejection_reason && (
              <Text style={styles.rejectedReason}>Reason: {tripTicket.travelRequest.rejection_reason}</Text>
            )}
          </View>
        )}
        
        {/* Procurement cancelled check removed - procurement no longer reviews trips */}
        
        {tripTicket.travelRequest?.status === 'pending' && (
          <View style={styles.waitingIndicator}>
            <Text style={styles.waitingText}>⏳ Awaiting Director Approval</Text>
            <Text style={styles.waitingSubtext}>Trip cannot proceed until director approves the travel request.</Text>
          </View>
        )}
        
        {/* Awaiting procurement approval check removed - procurement no longer reviews trips */}
        
        {tripTicket.status === 'in_progress' && (
          <TouchableOpacity style={styles.completeButton} onPress={handleCompleteTrip}>
            <View style={styles.buttonContent}>
              <Ionicons name="checkmark-circle" size={20} color="white" />
              <Text style={styles.completeButtonText}>Complete Trip</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {tripTicket.status === 'completed' && (
          <View style={styles.completedIndicator}>
            <View style={styles.completedContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text style={styles.completedText}>Trip Completed</Text>
            </View>
            <Text style={styles.completedSubtext}>This trip has been successfully completed.</Text>
          </View>
        )}
      </View>
      </ScrollView>

      {/* Custom Modals */}
      <ConfirmationModal
        visible={confirmationState.visible}
        title={confirmationState.title}
        message={confirmationState.message}
        type={confirmationState.type}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        onConfirm={confirmationState.onConfirm}
        onCancel={confirmationState.onCancel}
      />

      <SuccessModal
        visible={successState.visible}
        title={successState.title}
        message={successState.message}
        buttonText={successState.buttonText}
        autoClose={successState.autoClose}
        autoCloseDelay={successState.autoCloseDelay}
        onClose={hideSuccess}
      />

      {/* Cancellation Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color="#dc2626" />
              <Text style={styles.modalTitle}>Cancel Trip</Text>
            </View>

            <Text style={styles.modalMessage}>
              Please provide a reason for cancelling this trip. The director and procurement will be notified immediately.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason (e.g., vehicle breakdown, emergency, health issue)"
              placeholderTextColor="#9ca3af"
              value={cancellationReason}
              onChangeText={setCancellationReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                disabled={isCancelling}
              >
                <Text style={styles.modalCancelButtonText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, isCancelling && styles.buttonDisabled]}
                onPress={confirmCancelTrip}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#fff" />
                    <Text style={styles.modalConfirmButtonText}>Cancel Trip</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Trip Modal */}
      <Modal
        visible={showStartModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="play-circle" size={32} color="#10b981" />
              <Text style={styles.modalTitle}>Start Trip</Text>
            </View>

            <Text style={styles.modalMessage}>
              Please enter the current odometer reading to track fuel efficiency and distance traveled.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Odometer Reading (km)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., 12543.5"
                placeholderTextColor="#9ca3af"
                value={odometerStart}
                onChangeText={setOdometerStart}
                keyboardType="decimal-pad"
              />
              <Text style={styles.inputHint}>Optional: Leave blank if unavailable</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowStartModal(false);
                  setOdometerStart('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmStartTrip}
              >
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.modalConfirmButtonText}>Start Trip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Trip Modal */}
      <Modal
        visible={showCompleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Ionicons name="checkmark-circle" size={32} color="#3E0703" />
                <Text style={styles.modalTitle}>Complete Trip</Text>
              </View>

              <Text style={styles.modalMessage}>
                Please provide trip completion details to finalize the record.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ending Odometer Reading (km)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 12678.3"
                  placeholderTextColor="#9ca3af"
                  value={odometerEnd}
                  onChangeText={setOdometerEnd}
                  keyboardType="decimal-pad"
                />
                {tripTicket?.odometer_start && (
                  <Text style={styles.inputHint}>
                    Started at: {tripTicket.odometer_start} km
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fuel Used (liters)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., 25.5"
                  placeholderTextColor="#9ca3af"
                  value={fuelUsed}
                  onChangeText={setFuelUsed}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.inputHint}>Total fuel consumed during trip</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Completion Notes (Optional)</Text>
                <TextInput
                  style={styles.reasonInput}
                  placeholder="Any additional notes or observations..."
                  placeholderTextColor="#9ca3af"
                  value={completionNotes}
                  onChangeText={setCompletionNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowCompleteModal(false);
                    setOdometerEnd('');
                    setFuelUsed('');
                    setCompletionNotes('');
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmButton}
                  onPress={confirmCompleteTrip}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.modalConfirmButtonText}>Complete Trip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5', // Updated to match TripManager gray-50
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F5', // Updated to match TripManager gray-50
  },
  loadingText: {
    fontSize: 18,
    color: '#65676B', // Updated to match TripManager gray-500
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F5', // Updated to match TripManager gray-50
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginLeft: 8,
    flex: 1,
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    zIndex: 1000,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    // backgroundColor: '#f8f9fa',
  },
  backButtonText: {
    fontSize: 16,
    color: '#C28F22', // TripManager secondary brand color
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff', // White text on dark brand background
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#3E0703', // Light gray for subtitle on dark background
    textAlign: 'center',
    marginTop: 2,
  },
  headerStatusBadge: {
    alignItems: 'center',
  },
  miniStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
  },
  miniStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 8, // Reduced to match TripManager style
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3E0703', // TripManager primary brand color
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  procurementStatus: {
    fontSize: 14,
    color: '#666',
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    marginBottom: 12,
    padding: 20,
    borderRadius: 8, // Reduced to match TripManager style
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703', // TripManager primary brand color
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#C28F22', // TripManager secondary brand color
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
    minHeight: 44,
  },
  detailLabel: {
    fontSize: 15,
    color: '#65676B', // TripManager gray-500
    fontWeight: '500',
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    color: '#000000', // TripManager gray-900
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  vehicleInfo: {
    fontSize: 16,
    color: '#333',
  },
  actionsCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    marginBottom: 40,
    padding: 24,
    borderRadius: 8, // Reduced to match TripManager style
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  startButton: {
    backgroundColor: '#3E0703', // TripManager primary brand color
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 8, // More squared to match TripManager
    alignItems: 'center',
    shadowColor: '#3E0703',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  completeButton: {
    backgroundColor: '#C28F22', // TripManager secondary brand color
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 8, // More squared to match TripManager
    alignItems: 'center',
    shadowColor: '#C28F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  completedIndicator: {
    backgroundColor: '#f3f4f6', // TripManager gray-100
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C28F22', // TripManager secondary brand color
  },
  completedText: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Missing styles
  card: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  retryButton: {
    backgroundColor: '#3E0703', // TripManager primary brand color
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  procurementStatusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  procurementStatusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  procurementStatusText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  notesContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F0F2F5', // TripManager gray-50
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    borderLeftWidth: 4,
    borderLeftColor: '#C28F22', // TripManager secondary brand color
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#050505', // TripManager gray-700
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  notesText: {
    fontSize: 15,
    color: '#65676B', // TripManager gray-500
    lineHeight: 22,
  },
  specialInstructionsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fef3c7', // Light golden background
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C28F22', // TripManager secondary brand color
    borderLeftWidth: 4,
    borderLeftColor: '#3E0703', // TripManager primary brand color
  },
  specialInstructionsLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3E0703', // TripManager primary brand color
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  specialInstructionsText: {
    fontSize: 15,
    color: '#92400e', // Darker golden color for text
    lineHeight: 22,
    fontWeight: '500',
  },
  rejectedIndicator: {
    backgroundColor: '#f8d7da',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  rejectedText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  rejectedSubtext: {
    color: '#721c24',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  rejectedReason: {
    color: '#721c24',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  waitingIndicator: {
    backgroundColor: '#d4edda',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  waitingText: {
    color: '#155724',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  waitingSubtext: {
    color: '#155724',
    fontSize: 14,
    textAlign: 'center',
  },
  completedSubtext: {
    color: '#27ae60',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  destinationsContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  destinationsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  destinationBadge: {
    backgroundColor: '#3E0703', // TripManager primary brand color
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 10,
    marginBottom: 8,
    alignSelf: 'flex-start',
    shadowColor: '#3E0703',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  destinationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  passengersContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  passengersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  passengersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  passengerBadge: {
    backgroundColor: '#C28F22', // TripManager secondary brand color
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 10,
    marginBottom: 8,
    shadowColor: '#C28F22',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  passengerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  errorNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Date status badge styles
  dateStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // Trip Ready Today Banner styles
  tripReadyBanner: {
    backgroundColor: '#d1fae5', // Light green background
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tripReadyIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripReadyContent: {
    flex: 1,
  },
  tripReadyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 2,
  },
  tripReadyMessage: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '500',
  },
  // Action buttons row
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  // Cancel trip button
  cancelTripButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelTripButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // Cancellation modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1f2937',
    minHeight: 100,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalConfirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  modalConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

