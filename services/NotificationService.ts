import ApiService from './api';
import PushNotificationService from './PushNotificationService';

// Laravel notification types based on the backend
export type NotificationType = 
  | 'travel_request_created'
  | 'travel_request_approved' 
  | 'travel_request_rejected'
  | 'trip_ticket_assigned'
  | 'driver_assigned'
  | 'trip_completed'
  | 'trip_ticket_approved'
  | 'trip_ticket_rejected'
  | 'trip_ticket_created'
  | 'general';

// Laravel notification structure
export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    trip_ticket_id?: number;
    travel_request_id?: number;
    ticket_number?: string;
    passenger_name?: string;
    purpose?: string;
    start_date?: string;
    departure_time?: string;
    destinations?: string;
    approver_name?: string;
    driver_name?: string;
    procurement_status?: string;
    [key: string]: any;
  };
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

// Extended interface with computed read property for backward compatibility
export interface NotificationWithRead extends Notification {
  read: boolean;
}

export class NotificationService {
  private static instance: NotificationService;
  private notifications: NotificationWithRead[] = [];
  private listeners: ((notifications: NotificationWithRead[]) => void)[] = [];

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Transform Laravel notification to include read property
  private transformNotification(notification: Notification): NotificationWithRead {
    return {
      ...notification,
      read: notification.read_at !== null,
    };
  }

  // Subscribe to notification updates
  subscribe(listener: (notifications: NotificationWithRead[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.notifications));
  }

  // Load notifications from Laravel API
  async loadNotifications(): Promise<NotificationWithRead[]> {
    try {
      // Check if user is authenticated before making API call
      const isAuth = await ApiService.isAuthenticated();
      if (!isAuth) {
        console.log('⚠️ User not authenticated, skipping notification load');
        return this.notifications; // Return cached notifications
      }

      const response = await ApiService.getNotifications();
      
      // Handle different response formats from Laravel
      let notificationsData;
      if (response.notifications) {
        // Paginated response format: { notifications: [...], pagination: {...} }
        notificationsData = response.notifications;
      } else if (Array.isArray(response)) {
        // Direct array response
        notificationsData = response;
      } else if (response.data && Array.isArray(response.data)) {
        // Wrapped data response: { data: [...] }
        notificationsData = response.data;
      } else {
        console.warn('Unexpected notifications API response format:', response);
        notificationsData = [];
      }

      this.notifications = notificationsData.map((n: Notification) => this.transformNotification(n));
      this.notifyListeners();
      return this.notifications;
    } catch (error) {
      console.error('Failed to load notifications from API:', error);
      // Return cached notifications on error
      return this.notifications;
    }
  }

  // Get all notifications (returns cached data, call loadNotifications() to refresh)
  getNotifications(): NotificationWithRead[] {
    return this.notifications;
  }

  // Get unread count
  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  // Get unread count from API
  async getUnreadCountFromAPI(): Promise<number> {
    try {
      const response = await ApiService.getUnreadCount();
      return response.count || 0;
    } catch (error) {
      console.error('Failed to get unread count from API:', error);
      return this.getUnreadCount(); // Fallback to local count
    }
  }

  // Mark notification as read
  async markAsRead(notificationId: number): Promise<void> {
    try {
      await ApiService.markAsRead(notificationId);
      
      // Update local cache
      this.notifications = this.notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true, read_at: new Date().toISOString() }
          : notification
      );
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error; // Re-throw for UI error handling
    }
  }

  // Mark all as read
  async markAllAsRead(): Promise<void> {
    try {
      await ApiService.markAllAsRead();
      
      // Update local cache
      const now = new Date().toISOString();
      this.notifications = this.notifications.map(notification => ({
        ...notification,
        read: true,
        read_at: now
      }));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error; // Re-throw for UI error handling
    }
  }

  // Delete notification
  async deleteNotification(notificationId: number): Promise<void> {
    try {
      await ApiService.deleteNotification(notificationId);
      
      // Update local cache
      this.notifications = this.notifications.filter(n => n.id !== notificationId);
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to delete notification:', error);
      throw error; // Re-throw for UI error handling
    }
  }

  // Clear all notifications (local cache only - for development/testing)
  clearLocalCache() {
    this.notifications = [];
    this.notifyListeners();
  }

  // Helper method to get notification icon based on Laravel backend types
  getNotificationIcon(type: NotificationType): string {
    switch (type) {
      case 'travel_request_approved':
      case 'trip_ticket_approved':
        return 'checkmark-circle';
      case 'travel_request_rejected':
      case 'trip_ticket_rejected':
        return 'close-circle';
      case 'trip_ticket_assigned':
      case 'driver_assigned':
        return 'car';
      case 'trip_completed':
        return 'flag';
      case 'travel_request_created':
      case 'trip_ticket_created':
        return 'document-text';
      case 'general':
        return 'megaphone';
      default:
        return 'notifications';
    }
  }

  // Helper method to get notification color based on Laravel backend types
  getNotificationColor(type: NotificationType): string {
    switch (type) {
      case 'travel_request_approved':
      case 'trip_ticket_approved':
        return '#10b981'; // Green
      case 'travel_request_rejected':
      case 'trip_ticket_rejected':
        return '#dc2626'; // Red
      case 'trip_ticket_assigned':
      case 'driver_assigned':
        return '#3E0703'; // TripManager primary brand color
      case 'trip_completed':
        return '#3E0703'; // TripManager primary brand color
      case 'travel_request_created':
      case 'trip_ticket_created':
        return '#C28F22'; // TripManager secondary brand color
      case 'general':
        return '#6b7280'; // Gray
      default:
        return '#6b7280';
    }
  }

  // Legacy helper methods for backward compatibility
  // These create local notifications that will be sync'd with the backend
  createTripStartedNotification(tripTicketId: number, destination?: string) {
    // For now, just log since actual notifications should come from backend
    console.log(`Trip started notification for ticket ${tripTicketId}${destination ? ` to ${destination}` : ''}`);
    // In a real implementation, you might call a backend API to create the notification
    // or create a local one that gets sync'd later
    return Promise.resolve();
  }

  createTripCompletedNotification(tripTicketId: number, destination?: string) {
    // For now, just log since actual notifications should come from backend
    console.log(`Trip completed notification for ticket ${tripTicketId}${destination ? ` to ${destination}` : ''}`);
    // In a real implementation, you might call a backend API to create the notification
    // or create a local one that gets sync'd later
    return Promise.resolve();
  }

  createTripApprovedNotification(tripTicketId: number, destination?: string) {
    console.log(`Trip approved notification for ticket ${tripTicketId}${destination ? ` to ${destination}` : ''}`);
    return Promise.resolve();
  }

  createTripRejectedNotification(tripTicketId: number, reason?: string) {
    console.log(`Trip rejected notification for ticket ${tripTicketId}${reason ? `: ${reason}` : ''}`);
    return Promise.resolve();
  }

  createTripReadyNotification(tripTicketId: number, ticketNumber?: string) {
    console.log(`Trip ready notification for ticket ${ticketNumber || `#${tripTicketId}`}`);
    return Promise.resolve();
  }

  // Create notification for trip ready to start today
  createTripReadyForTodayNotification(tripTicketId: number, ticketNumber?: string, destination?: string) {
    // Check if we've already notified for this ticket today
    const storageKey = `trip_ready_notified_${tripTicketId}_${new Date().toDateString()}`;
    
    console.log(`🔔 createTripReadyForTodayNotification called for ticket ${ticketNumber || tripTicketId}`);
    
    // Use a simple flag to avoid duplicate notifications on the same day
    if (typeof window !== 'undefined' && window.localStorage) {
      const alreadyNotified = localStorage.getItem(storageKey);
      if (alreadyNotified) {
        console.log(`⏭️ Already notified for ticket ${ticketNumber || tripTicketId} today - skipping`);
        return Promise.resolve();
      }
      console.log(`✅ First notification for ticket ${ticketNumber || tripTicketId} today`);
    }

    console.log(`🚗 Creating Trip Ready Notification: Ticket ${ticketNumber || `#${tripTicketId}`}${destination ? ` to ${destination}` : ''}`);
    
    // Create a local notification in the notifications array
    const notification: NotificationWithRead = {
      id: Date.now(), // Temporary ID for local notification
      user_id: 0,
      type: 'trip_ticket_assigned',
      title: '🚗 Trip Ready to Start!',
      message: `Your trip${destination ? ` to ${destination}` : ''} (${ticketNumber || `#${tripTicketId}`}) is scheduled for today. Tap to view details and start your trip.`,
      data: {
        trip_ticket_id: tripTicketId,
        ticket_number: ticketNumber,
        destinations: destination,
        start_date: new Date().toISOString(),
      },
      read_at: null,
      read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log(`📝 Notification object created:`, notification);
    console.log(`📊 Current notifications count before add: ${this.notifications.length}`);

    // Add to beginning of notifications array
    this.notifications.unshift(notification);
    console.log(`📊 Current notifications count after add: ${this.notifications.length}`);
    console.log(`👂 Notifying ${this.listeners.length} listeners`);
    this.notifyListeners();

    // Send push notification to device
    PushNotificationService.scheduleLocalNotification(
      '🚗 Trip Ready to Start!',
      `Your trip${destination ? ` to ${destination}` : ''} (${ticketNumber || `#${tripTicketId}`}) is scheduled for today. Tap to view and start your trip.`,
      {
        trip_ticket_id: tripTicketId,
        ticket_number: ticketNumber,
        type: 'trip_ready_today',
      },
      0 // Send immediately
    );
    console.log(`📲 Push notification scheduled for device`);

    // Mark as notified for today
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(storageKey, 'true');
      console.log(`💾 Saved notification flag to localStorage: ${storageKey}`);
    }

    console.log(`✅ Notification successfully created and added to array`);
    return Promise.resolve();
  }

  createProcurementUpdateNotification(tripTicketId: number, status: string, ticketNumber?: string) {
    console.log(`Procurement update notification for ticket ${ticketNumber || `#${tripTicketId}`}: ${status}`);
    return Promise.resolve();
  }

  createGeneralNotification(title: string, message: string) {
    console.log(`General notification: ${title} - ${message}`);
    return Promise.resolve();
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();