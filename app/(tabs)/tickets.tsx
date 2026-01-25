import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  FlatList,
  Animated,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { TripTicket } from '@/types';
import ApiService from '@/services/api';
import { notificationService } from '@/services/NotificationService';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { LoadingComponent } from '@/components/LoadingComponent';
import { SkeletonTicketCard } from '@/components/SkeletonTicketCard';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SuccessModal } from '@/components/SuccessModal';
import { useModals } from '@/hooks/useModals';
import { NotificationBellButton } from '@/components/NotificationBellButton';

export default function TicketsScreen() {
  const [tripTickets, setTripTickets] = useState<TripTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedTicketForCancel, setSelectedTicketForCancel] = useState<TripTicket | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  
  const {
    confirmationState,
    successState,
    showConfirmation,
    hideConfirmation,
    showSuccess,
    hideSuccess
  } = useModals();

  useEffect(() => {
    // Reset to page 1 when filter changes
    setCurrentPage(1);
    setTripTickets([]);
    setHasMoreData(true);
    loadTripTickets(false, 1, true);
  }, [filterStatus]);

  // Auto-refresh when tab is focused
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Tickets tab focused - refreshing data');
      setCurrentPage(1);
      setTripTickets([]);
      setHasMoreData(true);
      loadTripTickets(false, 1, true);
    }, [filterStatus])
  );

  // Check for trip tickets ready to start and send notifications
  useEffect(() => {
    if (tripTickets.length > 0) {
      console.log(`🔔 Checking ${tripTickets.length} tickets for today's trips...`);
      checkAndNotifyReadyTrips();
    }
  }, [tripTickets]);

  // Also check on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tripTickets.length > 0) {
        console.log('🔔 Initial notification check on mount');
        checkAndNotifyReadyTrips();
      }
    }, 1000); // Delay to ensure tickets are loaded
    return () => clearTimeout(timer);
  }, []);

  const checkAndNotifyReadyTrips = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(`🔍 Checking notifications for date: ${today.toDateString()}`);

    let notificationCount = 0;
    tripTickets.forEach((ticket) => {
      // Only check tickets that are ready_for_trip status
      if (ticket.status === 'ready_for_trip' && ticket.travelRequest?.start_date) {
        const travelDate = new Date(ticket.travelRequest.start_date);
        travelDate.setHours(0, 0, 0, 0);

        console.log(`📋 Ticket ${ticket.ticket_number}: status=${ticket.status}, travel_date=${ticket.travelRequest.start_date}, isToday=${travelDate.getTime() === today.getTime()}`);

        // If travel date is today, create a notification
        if (travelDate.getTime() === today.getTime()) {
          const destination = Array.isArray(ticket.travelRequest.destinations)
            ? ticket.travelRequest.destinations.join(', ')
            : ticket.travelRequest.destinations;

          console.log(`✅ Creating notification for ticket ${ticket.ticket_number} - Trip to ${destination}`);
          
          // Create notification for trip ready to start
          notificationService.createTripReadyForTodayNotification(
            ticket.id,
            ticket.ticket_number,
            destination
          );
          notificationCount++;
        }
      }
    });
    
    if (notificationCount > 0) {
      console.log(`🔔 Created ${notificationCount} notification(s) for today's trips`);
    } else {
      console.log('ℹ️ No trips scheduled for today');
    }
  };

  const loadTripTickets = async (isRefresh = false, page = 1, isFilterChange = false) => {
    console.log(`🔵 loadTripTickets called - page: ${page}, isRefresh: ${isRefresh}, isFilterChange: ${isFilterChange}, currentState: ${tripTickets.length} tickets`);
    
    // Helper function to sort tickets with proper priority
    const sortTicketsByPriority = (tickets: TripTicket[]) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      return tickets.sort((a: TripTicket, b: TripTicket) => {
        // FIRST CHECK: Cancelled tickets ALWAYS go to the very bottom
        const isCancelledA = a.status === 'cancelled';
        const isCancelledB = b.status === 'cancelled';
        
        if (isCancelledA && !isCancelledB) return 1;
        if (!isCancelledA && isCancelledB) return -1;
        
        // If both are cancelled, sort by date (most recent first)
        if (isCancelledA && isCancelledB) {
          const dateA = a.travelRequest?.approved_at ? new Date(a.travelRequest.approved_at).getTime() : 0;
          const dateB = b.travelRequest?.approved_at ? new Date(b.travelRequest.approved_at).getTime() : 0;
          return dateB - dateA;
        }
        
        // SECOND CHECK: Completed tickets go near bottom (but above cancelled)
        const isCompletedA = a.status === 'completed';
        const isCompletedB = b.status === 'completed';
        
        if (isCompletedA && !isCompletedB) return 1;
        if (!isCompletedA && isCompletedB) return -1;
        
        // If both are completed, sort by completion date (most recent first)
        if (isCompletedA && isCompletedB) {
          const completedA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
          const completedB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
          return completedB - completedA;
        }
        
        // Now handle active tickets (not cancelled, not completed)
        const isInProgressA = a.status === 'in_progress';
        const isInProgressB = b.status === 'in_progress';
        
        // Check if trip is today
        const dateA = a.travelRequest?.start_date ? new Date(a.travelRequest.start_date) : null;
        const dateB = b.travelRequest?.start_date ? new Date(b.travelRequest.start_date) : null;
        if (dateA) dateA.setHours(0, 0, 0, 0);
        if (dateB) dateB.setHours(0, 0, 0, 0);
        const isTodayA = dateA?.getTime() === today.getTime() && a.status === 'ready_for_trip';
        const isTodayB = dateB?.getTime() === today.getTime() && b.status === 'ready_for_trip';
        
        // Priority 1: In Progress trips (highest priority)
        if (isInProgressA && !isInProgressB) return -1;
        if (!isInProgressA && isInProgressB) return 1;
        
        // Priority 2: Today's trips (ready_for_trip status with today's date)
        if (isTodayA && !isTodayB) return -1;
        if (!isTodayA && isTodayB) return 1;
        
        // Priority 3: Other ready_for_trip tickets (upcoming trips)
        const isReadyA = a.status === 'ready_for_trip';
        const isReadyB = b.status === 'ready_for_trip';
        
        if (isReadyA && !isReadyB) return -1;
        if (!isReadyA && isReadyB) return 1;
        
        // For remaining tickets (active, etc.), sort by approval date (newest first)
        const approvedA = a.travelRequest?.approved_at ? new Date(a.travelRequest.approved_at).getTime() : 0;
        const approvedB = b.travelRequest?.approved_at ? new Date(b.travelRequest.approved_at).getTime() : 0;
        return approvedB - approvedA;
      });
    };
    
    try {
      // Prevent loading if already loading more or no more data
      if (!isRefresh && !isFilterChange && (isLoadingMore || !hasMoreData)) {
        console.log('⏭️ Skipping load - already loading or no more data');
        return;
      }

      if (isRefresh) {
        setIsRefreshing(true);
        setCurrentPage(1);
        setHasMoreData(true);
        page = 1;
      } else if (page > 1) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const filters: any = {};
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }

      // Add pagination parameter - load 15 items per page for better performance
      const filtersWithPagination = {
        ...filters,
        page: page,
        per_page: 15, // Load 15 items at a time (Facebook-style)
        with_relations: true
      };

      console.log(`🔍 Loading page ${page} with filter: "${filterStatus}"`);

      const response = await ApiService.getTripTickets(filtersWithPagination);
      
      // Minimal logging for performance
      if (page === 1) {
        console.log(`📊 Loaded ${response.trip_tickets?.data?.length || response.trip_tickets?.length || 0} tickets for filter "${filterStatus}"`);
      }
      
      // Handle both paginated and direct array responses
      let ticketsData;
      let paginationMeta = null;
      
      if (response.trip_tickets?.data && Array.isArray(response.trip_tickets.data)) {
        // Paginated response
        ticketsData = response.trip_tickets.data;
        paginationMeta = response.trip_tickets;
        console.log(`📊 Using paginated data: ${ticketsData.length} tickets`);
      } else if (Array.isArray(response.trip_tickets)) {
        // Direct array response
        ticketsData = response.trip_tickets;
        console.log(`📊 Using direct trip_tickets array: ${ticketsData.length} tickets`);
      } else if (response.data && Array.isArray(response.data)) {
        // Response.data is array
        ticketsData = response.data;
        console.log(`📊 Using response.data array: ${ticketsData.length} tickets`);
      } else if (Array.isArray(response)) {
        // Response is direct array
        ticketsData = response;
        console.log(`📊 Using direct response array: ${ticketsData.length} tickets`);
      } else {
        console.log('❌ No valid tickets data found in response');
        ticketsData = [];
      }
      
      // Update pagination metadata if available
      if (paginationMeta) {
        setCurrentPage(paginationMeta.current_page || page);
        setLastPage(paginationMeta.last_page || 1);
        setHasMoreData((paginationMeta.current_page || page) < (paginationMeta.last_page || 1));
        console.log(`📄 Pagination: Page ${paginationMeta.current_page || page}/${paginationMeta.last_page || 1}, has more: ${(paginationMeta.current_page || page) < (paginationMeta.last_page || 1)}`);
      } else {
        // If no pagination metadata, assume we're on the requested page
        // and check if we got a full page of results to determine if there's more
        const gotFullPage = ticketsData.length >= 15;
        setCurrentPage(page);
        setHasMoreData(gotFullPage);
        console.log(`📄 No pagination meta - Page ${page}, got ${ticketsData.length} tickets, has more: ${gotFullPage}`);
      }
      
      console.log(`Setting trip tickets for filter "${filterStatus}":`, ticketsData.length, 'records');
      
      // Sort tickets using priority function
      sortTicketsByPriority(ticketsData);
      console.log(`✅ Sorted ${ticketsData.length} tickets by priority`);
      
      // If "All" filter returns no data, try without any filters as fallback
      if (filterStatus === 'all' && ticketsData.length === 0) {
        console.log('🔄 "All" filter returned no data, trying fallback request without filters...');
        try {
          const fallbackResponse = await ApiService.getTripTickets({ 
            per_page: 50,
            with_relations: true 
          });
          
          let fallbackData;
          if (fallbackResponse.trip_tickets?.data && Array.isArray(fallbackResponse.trip_tickets.data)) {
            fallbackData = fallbackResponse.trip_tickets.data;
          } else if (Array.isArray(fallbackResponse.trip_tickets)) {
            fallbackData = fallbackResponse.trip_tickets;
          } else if (Array.isArray(fallbackResponse.data)) {
            fallbackData = fallbackResponse.data;
          } else if (Array.isArray(fallbackResponse)) {
            fallbackData = fallbackResponse;
          } else {
            fallbackData = [];
          }
          
          console.log(`✅ Fallback request returned ${fallbackData.length} tickets`);
          ticketsData = fallbackData;
        } catch (fallbackError) {
          console.error('❌ Fallback request failed:', fallbackError);
        }
      }
      
      // PERFORMANCE: Skip heavy logging in production
      if (page === 1 && ticketsData.length > 0) {
        const missingCount = ticketsData.filter((t: any) => !t.travelRequest).length;
        if (missingCount > 0) {
          console.log(`⚠️ ${missingCount}/${ticketsData.length} tickets missing travelRequest data`);
        }
      }
      
      // Check if tickets are missing travelRequest data and fetch individual details
      const ticketsWithMissingData = ticketsData.filter((ticket: any) => !ticket.travelRequest);
      
      // Fetch missing data for any page that has incomplete tickets
      // Show data immediately, then enhance in background
      if (ticketsWithMissingData.length > 0) {
        console.log(`📝 Found ${ticketsWithMissingData.length} tickets missing travelRequest data on page ${page}, fetching details in background...`);
        
        // Show current data immediately - don't wait for enhancements
        setIsLoadingDetails(true);
        
        // Append or replace tickets based on whether we're loading more
        if (page > 1 && !isRefresh) {
          setTripTickets(prevTickets => [...prevTickets, ...ticketsData]);
          console.log(`➕ Appended ${ticketsData.length} tickets to existing list`);
        } else {
          setTripTickets(ticketsData);
          console.log(`✏️ Replaced list with ${ticketsData.length} tickets`);
        }
        
        // OPTIMIZATION: Only fetch first 15 missing tickets in background
        // User will see data immediately, enhanced data loads progressively
        const priorityMissingTickets = ticketsWithMissingData.slice(0, 15);
        const batchSize = 5; // Reduced batch size for faster initial response
        const enhancedTickets = [...ticketsData];
        
        // Process in smaller batches to avoid overwhelming the backend
        const batches: any[][] = [];
        for (let i = 0; i < priorityMissingTickets.length; i += batchSize) {
          batches.push(priorityMissingTickets.slice(i, i + batchSize));
        }
        
        // Process batches sequentially to avoid rate limiting
        (async () => {
          for (const batch of batches) {
            await Promise.all(
              batch.map(async (ticket: any) => {
                try {
                  const detailedTicketResponse = await ApiService.getTripTicket(ticket.id);
                  const detailedTicket = detailedTicketResponse.trip_ticket || detailedTicketResponse.data || detailedTicketResponse;
                  
                  // Replace the ticket in the enhancedTickets array
                  const index = enhancedTickets.findIndex(t => t.id === ticket.id);
                  if (index !== -1) {
                    enhancedTickets[index] = detailedTicket;
                    
                    // Update UI progressively as each batch completes
                    if (page > 1 && !isRefresh) {
                      setTripTickets(prevTickets => {
                        const updated = [...prevTickets];
                        const updateIndex = updated.findIndex(t => t.id === ticket.id);
                        if (updateIndex !== -1) {
                          updated[updateIndex] = detailedTicket;
                        }
                        // Re-sort after updating
                        sortTicketsByPriority(updated);
                        return updated;
                      });
                    } else {
                      // Re-sort enhanced tickets
                      sortTicketsByPriority(enhancedTickets);
                      setTripTickets([...enhancedTickets]);
                    }
                  }
                } catch (error) {
                  console.error(`❌ Failed to fetch details for ticket ${ticket.id}:`, error);
                }
              })
            );
          }
          
          console.log(`✅ Successfully enhanced ${priorityMissingTickets.length} priority tickets`);
          setIsLoadingDetails(false);
        })().catch((error) => {
          console.error('❌ Error enhancing tickets:', error);
          setIsLoadingDetails(false);
        });
      } else {
        console.log(`✅ ${ticketsWithMissingData.length > 0 ? `${ticketsWithMissingData.length} tickets missing data but` : 'All tickets have'} travelRequest data - showing immediately`);
        
        // Append or replace tickets based on whether we're loading more
        if (page > 1 && !isRefresh) {
          setTripTickets(prevTickets => {
            const newList = [...prevTickets, ...ticketsData];
            // Re-sort combined list
            sortTicketsByPriority(newList);
            console.log(`➕ Appended ${ticketsData.length} tickets. Total now: ${newList.length}`);
            return newList;
          });
        } else {
          setTripTickets(ticketsData);
          console.log(`✏️ Replaced list with ${ticketsData.length} tickets`);
        }
      }
    } catch (error: any) {
      console.error('Failed to load trip tickets:', error);
      showConfirmation({
        title: 'Error',
        message: 'Failed to load trip tickets. Please check your connection and try again.',
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    setHasMoreData(true);
    loadTripTickets(true, 1, false);
  };

  const loadMoreTickets = () => {
    if (!isLoadingMore && !isLoading && hasMoreData) {
      const nextPage = currentPage + 1;
      console.log(`📄 Loading more tickets - requesting page ${nextPage}. Current state: ${tripTickets.length} tickets, hasMore: ${hasMoreData}`);
      loadTripTickets(false, nextPage, false);
    } else {
      console.log(`⏭️ Skipping load more - isLoadingMore: ${isLoadingMore}, isLoading: ${isLoading}, hasMoreData: ${hasMoreData}, currentPage: ${currentPage}`);
    }
  };

  const handleViewTicket = (ticket: TripTicket) => {
    console.log('Navigating to trip-ticket-details with ID:', ticket.id);
    try {
      router.push(`/trip-ticket-details?id=${ticket.id}`);
    } catch (error) {
      console.error('Navigation error:', error);
      showConfirmation({
        title: 'Error',
        message: 'Failed to navigate to trip details. Please try again.',
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
    }
  };

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

  const handleStartTrip = async (ticket: TripTicket) => {
    const destination = Array.isArray(ticket.travelRequest?.destinations) 
      ? ticket.travelRequest.destinations.join(', ')
      : ticket.travelRequest?.destinations;

    // Check if driver has a vehicle and if it's available
    try {
      const vehicleResponse = await ApiService.getDriverVehicles();
      const vehiclesData = Array.isArray(vehicleResponse) ? vehicleResponse : (vehicleResponse.vehicles || []);
      
      if (vehiclesData.length === 0) {
        showConfirmation({
          title: 'No Vehicle',
          message: 'You need to add a vehicle before starting a trip. Please go to the Vehicles tab and add your vehicle first.',
          type: 'danger',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
        return;
      }

      const driverVehicle = vehiclesData[0];
      if (driverVehicle.status === 'Maintenance' || driverVehicle.status === 'Out of Service') {
        showConfirmation({
          title: 'Vehicle Not Available',
          message: `Your vehicle is currently marked as "${driverVehicle.status}". Please update your vehicle status to "Available" before starting a trip.`,
          type: 'warning',
          confirmText: 'OK',
          onConfirm: () => hideConfirmation()
        });
        return;
      }
    } catch (error) {
      console.error('Failed to check vehicle status:', error);
      showConfirmation({
        title: 'Error',
        message: 'Failed to verify vehicle status. Please try again.',
        type: 'danger',
        confirmText: 'OK',
        onConfirm: () => hideConfirmation()
      });
      return;
    }

    // Check if travel date exists
    if (!ticket.travelRequest?.start_date) {
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
    const travelDate = new Date(ticket.travelRequest.start_date);
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

    // If it's the travel date or past, show reminder/confirmation
    const isToday = travelDate.getTime() === today.getTime();
    const isPastDue = travelDate < today;
    
    let confirmationMessage = '';
    if (isToday) {
      confirmationMessage = `✅ Today is your scheduled travel date!\n\nAre you sure you want to start this trip to ${destination}? This will activate GPS tracking and trip logging.`;
    } else if (isPastDue) {
      const daysOverdue = Math.ceil((today.getTime() - travelDate.getTime()) / (1000 * 60 * 60 * 24));
      confirmationMessage = `⚠️ This trip was scheduled for ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago.\n\nAre you sure you want to start this trip to ${destination}? This will activate GPS tracking and trip logging.`;
    }

    showConfirmation({
      title: isToday ? 'Ready to Start Trip' : 'Start Trip',
      message: confirmationMessage,
      type: 'info',
      confirmText: 'Start Trip',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await ApiService.startTrip(ticket.id);
          
          // Create notification for trip started
          notificationService.createTripStartedNotification(
            ticket.id, 
            destination
          );
          
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
          
          // Don't refresh tickets here since we're navigating away
        } catch (error) {
          showConfirmation({
            title: 'Error',
            message: 'Failed to start trip. Please try again.',
            type: 'danger',
            confirmText: 'OK',
            onConfirm: () => hideConfirmation()
          });
        }
      }
    });
  };

  const handleCompleteTrip = async (ticket: TripTicket) => {
    showConfirmation({
      title: 'Complete Trip',
      message: 'Are you sure you want to mark this trip as completed?',
      type: 'info',
      confirmText: 'Complete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          await ApiService.completeTrip(ticket.id);
          
          // Create notification for trip completed
          const destination = Array.isArray(ticket.travelRequest?.destinations) 
            ? ticket.travelRequest.destinations.join(', ')
            : ticket.travelRequest?.destinations;
          
          notificationService.createTripCompletedNotification(
            ticket.id, 
            destination
          );
          
          showSuccess({
            title: 'Trip Completed',
            message: 'Trip has been completed successfully!',
            autoClose: true,
            autoCloseDelay: 3000
          });
          loadTripTickets();
        } catch (error) {
          showConfirmation({
            title: 'Error',
            message: 'Failed to complete trip. Please try again.',
            type: 'danger',
            confirmText: 'OK',
            onConfirm: () => hideConfirmation()
          });
        }
      }
    });
  };

  const handleCancelTrip = (ticket: TripTicket) => {
    setSelectedTicketForCancel(ticket);
    setCancellationReason('');
    setShowCancelModal(true);
  };

  const confirmCancelTrip = async () => {
    if (!selectedTicketForCancel) return;

    if (!cancellationReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      await ApiService.cancelTripEmergency(selectedTicketForCancel.id, cancellationReason.trim());
      
      showSuccess({
        title: 'Trip Cancelled',
        message: 'Trip has been cancelled successfully. Director has been notified.',
        autoClose: true,
        autoCloseDelay: 3000
      });

      setShowCancelModal(false);
      setCancellationReason('');
      setSelectedTicketForCancel(null);
      loadTripTickets();
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
        return '#65676B';
      case 'ready_for_trip':
        return '#10b981';
      case 'in_progress':
        return '#C28F22';
      case 'completed':
        return '#3E0703';
      case 'cancelled':
      case 'canceled': // Handle alternative spelling
        return '#dc2626';
      default:
        return '#65676B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Awaiting Approval';
      case 'ready_for_trip':
        return 'Ready for trip';
      case 'approved':
        return 'Ready to Start';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
      case 'canceled': // Handle alternative spelling
        return 'Cancelled';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Procurement status function removed - procurement no longer reviews trips

  const getFilterLabel = (status: string) => {
    const label = (() => {
      switch (status) {
        case 'all':
          return 'All';
        case 'active':
          return 'Active';
        case 'ready_for_trip':
          return 'Ready for trip';
        case 'in_progress':
          return 'In Progress';
        case 'completed':
          return 'Completed';
        case 'cancelled':
          return 'Cancelled';
        default:
          return status.replace('_', ' ').toUpperCase();
      }
    })();
    console.log(`Filter label for "${status}": "${label}"`);
    return label;
  };

  const renderTicketItem = useCallback(({ item: ticket }: { item: TripTicket }) => {
    // Show skeleton if ticket is missing travelRequest data and we're still loading
    if (!ticket.travelRequest && isLoadingDetails) {
      return <SkeletonTicketCard />;
    }

    return (
      <TouchableOpacity 
        style={styles.ticketCard}
        onPress={() => handleViewTicket(ticket)}
        activeOpacity={0.7}
      >
      {/* Header: Ticket Number & Status */}
      <View style={styles.ticketHeader}>
        <View style={styles.ticketTitleRow}>
          <Text style={styles.ticketNumber} numberOfLines={1}>
            {ticket.ticket_number || `TT-${ticket.id}`}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) }]}>
            <Text style={styles.statusText} numberOfLines={1}>{getStatusText(ticket.status)}</Text>
          </View>
        </View>
      </View>

      {/* Trip Ready Today Banner */}
      {ticket.status === 'ready_for_trip' && ticket.travelRequest?.start_date && (() => {
        const dateStatus = getTravelDateStatus(ticket.travelRequest.start_date);
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

      {/* Requestor Info */}
      <View style={styles.requestorRow}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {ticket.travelRequest?.user?.name?.charAt(0) || 
             ticket.passenger_name?.charAt(0) || 
             'U'}
          </Text>
        </View>
        <View style={styles.requestorDetails}>
          <Text style={styles.requestorName}>
            {ticket.travelRequest?.user?.name || 
             ticket.passenger_name || 'Unknown Requestor'}
          </Text>
          <Text style={styles.requestorDepartment}>
            {ticket.travelRequest?.user?.department || 'No Department'}
          </Text>
        </View>
        <Text style={styles.issuedDate}>
          {ticket.issued_at 
            ? new Date(ticket.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* Trip Details Grid */}
      <View style={styles.detailsGrid}>
        {/* Destination */}
        {ticket.travelRequest?.destinations && (
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="location" size={16} color="#3E0703" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Destination</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {Array.isArray(ticket.travelRequest.destinations) 
                  ? ticket.travelRequest.destinations.join(', ')
                  : ticket.travelRequest.destinations}
              </Text>
            </View>
          </View>
        )}

        {/* Purpose */}
        <View style={styles.detailRow}>
          <View style={styles.detailIconWrapper}>
            <Ionicons name="document-text-outline" size={16} color="#3E0703" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Purpose</Text>
            <Text style={styles.detailValue} numberOfLines={1}>
              {ticket.travelRequest?.purpose || 'No purpose specified'}
            </Text>
          </View>
        </View>

        {/* Travel Dates */}
        <View style={styles.detailRow}>
          <View style={styles.detailIconWrapper}>
            <Ionicons name="calendar-outline" size={16} color="#3E0703" />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Travel Date</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.detailValue}>
                {ticket.travelRequest?.start_date 
                  ? new Date(ticket.travelRequest.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'N/A'}
                {ticket.travelRequest?.end_date && 
                 ticket.travelRequest.end_date !== ticket.travelRequest.start_date && 
                 ` - ${new Date(ticket.travelRequest.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </Text>
              {ticket.travelRequest?.start_date && ticket.status === 'ready_for_trip' && (() => {
                const dateStatus = getTravelDateStatus(ticket.travelRequest.start_date);
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
        </View>

        {/* Vehicle Info */}
        {ticket.vehicle && (
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrapper}>
              <Ionicons name="car-sport-outline" size={16} color="#3E0703" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Vehicle</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {ticket.vehicle.type} {ticket.vehicle.model} • {ticket.vehicle.plate_number}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer: Driver & Passengers */}
      {(ticket.driver_name || (ticket.travelRequest?.passengers && ticket.travelRequest.passengers.length > 0)) && (
        <View style={styles.footerRow}>
          {ticket.driver_name && (
            <View style={styles.footerItem}>
              <Ionicons name="person-circle-outline" size={16} color="#65676B" />
              <Text style={styles.footerText}>{ticket.driver_name}</Text>
            </View>
          )}
          {ticket.travelRequest?.passengers && Array.isArray(ticket.travelRequest.passengers) && 
           ticket.travelRequest.passengers.length > 0 && (
            <View style={styles.footerItem}>
              <Ionicons name="people-outline" size={16} color="#65676B" />
              <Text style={styles.footerText}>
                {`+${ticket.travelRequest.passengers.length} passenger${ticket.travelRequest.passengers.length > 1 ? 's' : ''}`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      {(ticket.status === 'ready_for_trip' || ticket.status === 'in_progress') && (
        <View style={styles.actionButtons}>
          {ticket.status === 'ready_for_trip' && (
            <>
              <TouchableOpacity
                style={styles.startButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleStartTrip(ticket);
                }}
              >
                <Ionicons name="play-circle" size={18} color="#fff" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleCancelTrip(ticket);
                }}
              >
                <Ionicons name="close-circle" size={18} color="#fff" />
                <Text style={styles.cancelButtonText}>Report Issue</Text>
              </TouchableOpacity>
            </>
          )}
          
          {ticket.status === 'in_progress' && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={(e) => {
                e.stopPropagation();
                handleCompleteTrip(ticket);
              }}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.completeButtonText}>Complete Trip</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Timestamps for In Progress/Completed */}
      {(ticket.started_at || ticket.completed_at) && (
        <View style={styles.timestampsSection}>
          {ticket.started_at && (
            <View style={styles.timestampItem}>
              <Ionicons name="time-outline" size={12} color="#65676B" />
              <Text style={styles.timestampText}>
                Started: {new Date(ticket.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
          {ticket.completed_at && (
            <View style={styles.timestampItem}>
              <Ionicons name="checkmark-done-outline" size={12} color="#65676B" />
              <Text style={styles.timestampText}>
                Completed: {new Date(ticket.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
    );
  }, [isLoadingDetails]);

  if (isLoading && tripTickets.length === 0) {
    return (
      <LoadingComponent 
        message="Loading your trip tickets..." 
        color="#3E0703"
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <Ionicons name="ticket-outline" size={24} color="#3E0703" />
            <Text style={styles.title}>Trip Tickets</Text>
            {tripTickets.length > 0 && (
              <View style={styles.ticketCountBadge}>
                <Text style={styles.ticketCountText}>{tripTickets.length}</Text>
              </View>
            )}
          </View>
          <NotificationBellButton color="#3E0703" size={26} />
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {['all', 'active', 'ready_for_trip', 'in_progress', 'completed', 'cancelled'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filterStatus === status && styles.activeFilterButton
              ]}
              onPress={() => {
                console.log(`Filter clicked: ${status}`);
                setFilterStatus(status);
              }}
            >
              <Text style={[
                styles.filterButtonText,
                filterStatus === status && styles.activeFilterButtonText
              ]}>
                {getFilterLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trip Tickets List */}
      {tripTickets.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>🎫</Text>
          </View>
          <Text style={styles.emptyText}>No trip tickets found</Text>
          <Text style={styles.emptySubtext}>
            {filterStatus === 'all' 
              ? 'No trip tickets are assigned to you yet'
              : `No ${filterStatus.replace('_', ' ')} tickets found`
            }
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={handleRefresh}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <LoadingComponent 
          message="Loading your trip tickets..." 
          color="#3E0703"
        />
      ) : (
        <FlatList
          data={tripTickets}
          renderItem={renderTicketItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.ticketsList}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              colors={['#3E0703']}
              tintColor="#3E0703"
            />
          }
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreTickets}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#3E0703" />
                <Text style={styles.loadingMoreText}>Loading more tickets...</Text>
              </View>
            ) : null
          }
          // Performance optimizations for large lists
          removeClippedSubviews={true} // Unmount components outside viewport
          maxToRenderPerBatch={10} // Reduce number of items rendered per batch
          updateCellsBatchingPeriod={50} // Increase time between renders
          initialNumToRender={15} // Match our page size
          windowSize={10} // Reduce number of pages to keep in memory
          getItemLayout={(data, index) => ({
            length: 350, // Approximate height of each ticket card
            offset: 350 * index,
            index,
          })}
        />
      )}

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
              Please provide a reason for cancelling this trip. The director will be notified.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter reason (e.g., vehicle breakdown, emergency)"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5', // TripManager gray-50
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 10,
    minHeight: 60, // Ensure minimum height for content
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#C28F22',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#050505',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketsList: {
    padding: 20,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'column',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  ticketTitleContainer: {
    flex: 1,
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E0703',
    marginBottom: 4,
    flex: 1,
    flexShrink: 1,
    minWidth: 0, // Important for text truncation
  },
  issuedDate: {
    fontSize: 11,
    color: '#65676B',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
    flexShrink: 0,
    maxWidth: 150, // Prevent badge from being too wide
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  startButton: {
    backgroundColor: '#3E0703',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  completeButton: {
    backgroundColor: '#C28F22',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Filter styles
  filtersContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5', // TripManager gray-200
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    height: 55,
  },
  filtersContent: {
    alignItems: 'center',
    paddingRight: 16,
    height: 35,
  },
  filterButton: {
    backgroundColor: '#F0F2F5',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 50,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  activeFilterButton: {
    backgroundColor: '#3E0703',
    borderColor: '#3E0703',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#65676B',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
  },
  activeFilterButtonText: {
    color: '#ffffff',
  },
  // Professional ticket card styles
  ticketTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
    flexWrap: 'nowrap',
  },
  procurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  procurementDot: {
    width: 6,
    height: 6,
    borderRadius: 50,
  },
  procurementLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
  },
  requestorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    gap: 10,
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 50,
    backgroundColor: '#C28F22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  requestorDetails: {
    flex: 1,
  },
  requestorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#050505',
    marginBottom: 2,
  },
  requestorDepartment: {
    fontSize: 12,
    color: '#65676B',
  },
  detailsGrid: {
    paddingVertical: 12,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F2F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#65676B',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    color: '#050505',
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#65676B',
    fontWeight: '500',
  },
  // Keep essential old styles needed
  ticketContent: {
    paddingTop: 0,
  },
  requestorInfo: {
    flex: 1,
  },
  // Enhanced header styles
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
  ticketCountBadge: {
    backgroundColor: '#3E0703',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  vehicleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleText: {
    fontSize: 12,
    color: '#65676B',
    fontWeight: '500',
  },
  // Timestamps Section
  timestampsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    gap: 6,
  },
  timestampItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timestampText: {
    fontSize: 11,
    color: '#65676B',
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
    marginHorizontal: -16,
    marginTop: 12,
    marginBottom: 8,
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
  // Loading more indicator styles
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  // Cancel button styles
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Cancellation modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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

