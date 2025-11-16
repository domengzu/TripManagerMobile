import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS, DEV_CONFIG } from '../config';
import { ErrorHandler } from '../utils/errorHandler';

class ApiService {
  private static instance: ApiService;
  private client;

  private constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          if (DEV_CONFIG.LOG_API_CALLS) {
            console.log(`🔑 Using auth token: ${token.substring(0, 20)}...`);
          }
        } else {
          if (DEV_CONFIG.LOG_API_CALLS) {
            console.log('⚠️ No auth token found for request');
          }
        }
        
        // Log API calls in development
        if (DEV_CONFIG.LOG_API_CALLS) {
          const fullUrl = `${config.baseURL}${config.url}`;
          console.log(`🚀 API Call: ${config.method?.toUpperCase()} ${fullUrl}`);
          if (config.data) {
            console.log('📤 Request Data:', config.data);
          }
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => {
        if (DEV_CONFIG.LOG_API_CALLS) {
          console.log(`✅ API Response: ${response.status} ${response.config.url}`);
          console.log('📥 Response Data:', response.data);
        }
        return response;
      },
      async (error) => {
        if (DEV_CONFIG.LOG_API_CALLS) {
          console.error(`❌ API Error: ${error.response?.status || 'Network'} ${error.config?.url || 'Unknown URL'}`);
          console.error('Error Details:', error.response?.data || error.message);
          console.error('Full Error:', error);
        }
        
        if (error.response?.status === 401) {
          // Token expired or invalid
          console.log('🔐 Token expired or invalid, clearing auth data...');
          await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
          
          // Notify that user needs to login again
          console.log('🚪 User needs to login again');
          
          // Don't retry the request, let the calling component handle the 401
          return Promise.reject(error);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      return !!token;
    } catch (error) {
      return false;
    }
  }

  // Get current auth token
  async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      return null;
    }
  }

  // Clear authentication data
  async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      console.log('🗑️ Auth data cleared');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }

  // Test API connection
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log('🔍 Testing API connection...');
      const response = await this.client.get('/user'); // Simple endpoint to test
      return {
        success: true,
        message: 'API connection successful',
        data: response.data
      };
    } catch (error: any) {
      console.error('🔴 API Connection failed:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Connection failed'
      };
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    try {
      console.log('🔐 Attempting login...');
      const response = await this.client.post('/login', { email, password });
      const data = response.data.data || response.data;
      
      // Store the token if present
      if (data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.token);
        console.log('✅ Auth token stored successfully');
      } else {
        console.warn('⚠️ No token received from login response');
      }
      
      // Store user data if present
      if (data.user) {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
        console.log('✅ User data stored successfully');
      }
      
      return data;
    } catch (error) {
      console.error('❌ Login failed:', error);
      throw error;
    }
  }

  async register(userData: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: string;
    department?: string;
    license_number?: string;
  }) {
    const response = await this.client.post('/register', userData);
    // Handle Laravel's wrapped response format
    return response.data.data || response.data;
  }

  async logout() {
    try {
      // Use a shorter timeout for logout to prevent hanging
      const response = await this.client.post('/logout', {}, {
        timeout: 5000 // 5 second timeout for logout
      });
      return response.data;
    } catch (error) {
      // Don't throw error on logout - we clear local data anyway
      console.log('Logout API call failed, but will clear local data:', error);
      return null;
    }
  }

  async getProfile() {
    const response = await this.client.get('/profile');
    // Handle Laravel's wrapped response format
    return response.data.data || response.data;
  }

  async updateProfile(profileData: {
    name: string;
    department?: string;
  }) {
    const response = await this.client.put('/profile', profileData);
    return response.data.data || response.data;
  }

  async updatePassword(passwordData: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) {
    const response = await this.client.put('/profile/password', passwordData);
    return response.data.data || response.data;
  }

  async uploadProfilePicture(imageUri: string) {
    const formData = new FormData();
    
    // Create file object from URI
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const fileName = `profile_${Date.now()}.${fileExtension}`;
    
    formData.append('profile_picture', {
      uri: imageUri,
      type: `image/${fileExtension}`,
      name: fileName,
    } as any);

    const response = await this.client.post('/profile/upload-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data || response.data;
  }

  // Driver Dashboard
  async getDriverDashboard() {
    const response = await this.client.get('/driver/dashboard');
    return response.data.data || response.data;
  }

  async getDriverStatistics() {
    const response = await this.client.get('/driver/statistics');
    return response.data.data || response.data;
  }

  // Vehicle Management
  async getVehicles() {
    const response = await this.client.get('/driver/vehicles');
    return response.data.data || response.data;
  }

  async getVehicle(id: number) {
    const response = await this.client.get(`/driver/vehicles/${id}`);
    return response.data.data || response.data;
  }

  async createVehicle(vehicleData: {
    plate_number: string;
    type: string;
    model: string;
    year: number;
    capacity: number;
    fuel_type?: string;
    color?: string;
    status: string;
  }) {
    const response = await this.client.post('/driver/vehicles', vehicleData);
    return response.data.data || response.data;
  }

  async updateVehicle(id: number, vehicleData: {
    plate_number: string;
    type: string;
    model: string;
    year: number;
    capacity: number;
    fuel_type?: string;
    color?: string;
    status: string;
  }) {
    const response = await this.client.put(`/driver/vehicles/${id}`, vehicleData);
    return response.data.data || response.data;
  }

  async deleteVehicle(id: number) {
    const response = await this.client.delete(`/driver/vehicles/${id}`);
    return response.data.data || response.data;
  }

  // Trip Management
  async getTrips(filters?: {
    date_from?: string;
    date_to?: string;
    vehicle_id?: number;
    page?: number;
  }) {
    const response = await this.client.get('/driver/trips', { params: filters });
    return response.data.data || response.data;
  }

  async createTripLog(tripData: {
    trip_ticket_id?: number;
    vehicle_id?: number;
    date: string;
    departure_time_office: string;
    arrival_time_destination?: string;
    departure_time_destination?: string;
    arrival_time_office?: string;
    destination: string;
    distance: number;
    fuel_balance_start?: number;
    fuel_issued_office?: number;
    fuel_purchased_trip?: number;
    fuel_total?: number;
    fuel_used?: number;
    fuel_balance_end?: number;
    speedometer_start?: number;
    speedometer_end?: number;
    speedometer_distance?: number;
    purpose?: string;
    notes?: string;
  }) {
    const response = await this.client.post('/driver/trip-logs', tripData);
    return response.data.data || response.data;
  }

  async updateTripLog(id: number, tripData: {
    vehicle_id: number;
    date: string;
    departure_time_office: string;
    arrival_time_office: string;
    destination: string;
    purpose: string;
    distance: number;
    fuel_used: number;
    notes?: string;
  }) {
    const response = await this.client.put(`/driver/trip-logs/${id}`, tripData);
    return response.data.data || response.data;
  }

  async deleteTripLog(id: number) {
    const response = await this.client.delete(`/driver/trip-logs/${id}`);
    return response.data.data || response.data;
  }

  // Trip Tickets
  async getTripTickets(filters?: {
    status?: string;
    procurement_status?: string;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    with_relations?: boolean;
  }) {
    const response = await this.client.get('/driver/trip-tickets', { params: filters });
    return response.data.data || response.data;
  }

  async getTripTicketsHistory(filters?: {
    status?: string | string[];
    month_year?: string;
    search?: string;
    per_page?: number;
  }) {
    const response = await this.client.get('/driver/trip-tickets/history', { params: filters });
    return response.data.data || response.data;
  }

  async getTripTicket(id: number) {
    const response = await this.client.get(`/driver/trip-tickets/${id}`);
    return response.data.data || response.data;
  }

  async downloadTripLogPDF(tripTicketId: number) {
    const response = await this.client.post(`/driver/trip-tickets/${tripTicketId}/download-pdf`);
    return response.data;
  }

  async startTrip(id: number, data?: {
    start_location?: string;
    start_coordinates?: string;
  }) {
    const response = await this.client.post(`/driver/trip-tickets/${id}/start`, data || {});
    return response.data.data || response.data;
  }

  async completeTrip(id: number, data?: {
    end_location?: string;
    end_coordinates?: string;
    end_mileage?: number;
    fuel_consumed?: number;
    completion_notes?: string;
  }) {
    const response = await this.client.post(`/driver/trip-tickets/${id}/complete`, data || {});
    return response.data.data || response.data;
  }

  async sendTripCompletionReport(data: any) {
    const response = await this.client.post('/driver/trip-completion-report', data);
    return response.data.data || response.data;
  }

  async updateTripProgress(id: number, data: {
    current_mileage?: number;
    fuel_consumed?: number;
    progress_notes?: string;
  }) {
    const response = await this.client.put(`/driver/trip-tickets/${id}/progress`, data);
    return response.data.data || response.data;
  }

  async getActiveTrip() {
    const response = await this.client.get('/driver/active-trip');
    return response.data.data || response.data;
  }

  async updateLocation(data: {
    trip_ticket_id: number;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  }) {
    const response = await this.client.post('/driver/update-location', data);
    return response.data.data || response.data;
  }

  async sendEmergencyAlert() {
    const response = await this.client.post('/driver/emergency-alert');
    return response.data.data || response.data;
  }

  // Notifications
  async getNotifications() {
    const response = await this.client.get('/notifications');
    return response.data.data || response.data;
  }

  async getUnreadCount() {
    const response = await this.client.get('/notifications/unread-count');
    return response.data.data || response.data;
  }

  async markAsRead(notificationId: number) {
    const response = await this.client.post(`/notifications/${notificationId}/read`);
    return response.data.data || response.data;
  }

  async markAllAsRead() {
    const response = await this.client.post('/notifications/mark-all-read');
    return response.data.data || response.data;
  }

  async deleteNotification(notificationId: number) {
    const response = await this.client.delete(`/notifications/${notificationId}`);
    return response.data.data || response.data;
  }

  // Push Notifications
  async registerPushToken(token: string, platform: string) {
    const response = await this.client.post('/push-tokens', { 
      token, 
      platform,
      device_type: platform 
    });
    return response.data.data || response.data;
  }

  async unregisterPushToken(token: string) {
    const response = await this.client.delete(`/push-tokens/${token}`);
    return response.data.data || response.data;
  }

  // Driver Vehicle Management
  async getDriverVehicles() {
    const response = await this.client.get('/driver/vehicles');
    return response.data.vehicles || response.data;
  }

  async createDriverVehicle(data: {
    plate_number: string;
    type: string;
    model: string;
    year: number;
    capacity: number;
    fuel_type?: string | null;
    color?: string | null;
    status?: string;
  }) {
    const response = await this.client.post('/driver/vehicles', data);
    return response.data.vehicle || response.data;
  }

  async updateDriverVehicle(id: number, data: {
    plate_number?: string;
    type?: string;
    model?: string;
    year?: number;
    capacity?: number;
    fuel_type?: string | null;
    color?: string | null;
    status?: string;
  }) {
    const response = await this.client.put(`/driver/vehicles/${id}`, data);
    return response.data.vehicle || response.data;
  }

  async deleteDriverVehicle(id: number) {
    const response = await this.client.delete(`/driver/vehicles/${id}`);
    return response.data.message || response.data;
  }

  // Alternative methods using web routes with correct field names
  async createDriverVehicleWeb(data: {
    plate_number: string;
    type: string;
    model: string;
    year: number;
    capacity: number;
    fuel_type?: string | null;
    color?: string | null;
    status?: string;
  }) {
    const response = await this.client.post('/driver/vehicles', data, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    return response.data;
  }

  async updateDriverVehicleWeb(id: number, data: {
    plate_number?: string;
    type?: string;
    model?: string;
    year?: number;
    capacity?: number;
    fuel_type?: string | null;
    color?: string | null;
    status?: string;
  }) {
    // Set headers to accept JSON response
    const response = await this.client.put(`/driver/vehicles/${id}`, data, {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    return response.data;
  }

  // Fuel Records Methods
  async getFuelRecords() {
    const response = await this.client.get('/driver/fuel-records');
    return response.data.fuel_records || [];
  }

  async createFuelRecord(data: {
    vehicle_id: number;
    date: string;
    amount: number;
    fuel_type: string;
  }) {
    const response = await this.client.post('/driver/fuel-records', data);
    return response.data;
  }

  // ============================================
  // REGULAR USER ENDPOINTS (GPS Tracking Only)
  // ============================================

  async getRegularDashboard() {
    const response = await this.client.get('/regular/dashboard');
    return response.data;
  }

  async trackDrivers() {
    const response = await this.client.get('/regular/track-drivers');
    return response.data;
  }

  async getTripLocation(tripTicketId: string) {
    const response = await this.client.get(`/regular/trip-location/${tripTicketId}`);
    return response.data;
  }

  async getRegularTrips(page: number = 1) {
    const response = await this.client.get('/regular/trips', {
      params: { page }
    });
    return response.data;
  }

  // ============================================
  // DIRECTOR ENDPOINTS (Travel Request Management)
  // ============================================

  async getDirectorDashboard() {
    const response = await this.client.get('/director/dashboard');
    return response.data;
  }

  // ============================================
  // REGULAR USER ENDPOINTS (GPS Tracking)
  // ============================================

  async getRegularUserDashboard() {
    const response = await this.client.get('/regular/dashboard');
    return response.data;
  }

  async getTravelRequests(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all', page: number = 1) {
    const response = await this.client.get('/director/travel-requests', {
      params: { status, page }
    });
    return response.data;
  }

  async getMyTravelRequests(status: 'all' | 'pending' | 'approved' | 'rejected' = 'all', page: number = 1) {
    const response = await this.client.get('/director/my-travel-requests', {
      params: { status, page }
    });
    return response.data;
  }

  async createTravelRequest(data: {
    purpose: string;
    destinations: string[];
    start_date: string;
    passengers: string[];
    details?: string;
  }) {
    const response = await this.client.post('/director/travel-requests', data);
    return response.data;
  }

  async approveTravelRequest(id: number) {
    const response = await this.client.post(`/director/travel-requests/${id}/approve`);
    return response.data;
  }

  async rejectTravelRequest(id: number, rejection_reason: string) {
    const response = await this.client.post(`/director/travel-requests/${id}/reject`, {
      rejection_reason
    });
    return response.data;
  }

  async getBookedDates() {
    const response = await this.client.get('/director/booked-dates');
    return response.data;
  }

  async getVehicleAvailability() {
    const response = await this.client.get('/director/vehicle-availability');
    return response.data;
  }
}

export default ApiService.getInstance();