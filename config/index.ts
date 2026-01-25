// Configuration for the TripManager Mobile App

// API Configuration
export const API_CONFIG = {
  // Update this URL to match your Laravel server
  // For local development:
  // BASE_URL: 'http://192.168.1.6:8000/api', // Replace with your actual IP
  
  // Alternative URLs to try if the above doesn't work:
  // BASE_URL: 'http://localhost:8000/api', // If testing on same machine
  // BASE_URL: 'http://127.0.0.1:8000/api', // Alternative localhost
  
  // For production:
  BASE_URL: 'https://tripmanager.site/api',
  
  // Request timeout in milliseconds
  TIMEOUT: 30000,

  // Retry configuration
  MAX_RETRIES: 3,
};

// App Configuration
export const APP_CONFIG = {
  NAME: 'TripManager Driver',
  VERSION: '1.0.0',
  BUILD_NUMBER: '1',
  
  // Feature flags
  FEATURES: {
    GPS_TRACKING: true,
    OFFLINE_MODE: false,
    PUSH_NOTIFICATIONS: true,
  },
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
  SETTINGS: 'app_settings',
  OFFLINE_DATA: 'offline_data',
};

// API Endpoints
export const ENDPOINTS = {
  // Authentication
  LOGIN: '/login',
  REGISTER: '/register',
  LOGOUT: '/logout',
  PROFILE: '/profile',
  
  // Driver specific endpoints
  DRIVER: {
    DASHBOARD: '/driver/dashboard',
    VEHICLES: '/driver/vehicles',
    TRIPS: '/driver/trips',
    TRIP_LOGS: '/driver/trip-logs',
    TRIP_TICKETS: '/driver/trip-tickets',
    UPDATE_LOCATION: '/driver/update-location',
  },
  
  // Notifications
  NOTIFICATIONS: '/notifications',
};

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  LICENSE_PLATE_MAX_LENGTH: 20,
  
  // Regex patterns
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  TIME_PATTERN: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  LICENSE_PLATE_PATTERN: /^[A-Z0-9-]+$/,
};

// UI Configuration
export const UI_CONFIG = {
  COLORS: {
    PRIMARY: '#3498db',
    SUCCESS: '#27ae60',
    WARNING: '#f39c12',
    DANGER: '#e74c3c',
    INFO: '#3498db',
    LIGHT: '#f8f9fa',
    DARK: '#343a40',
  },
  
  FONTS: {
    REGULAR: 'System',
    BOLD: 'System',
  },
  
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
  },
};

// Location Configuration
export const LOCATION_CONFIG = {
  // GPS accuracy in meters
  DESIRED_ACCURACY: 10,
  
  // Update interval in milliseconds
  UPDATE_INTERVAL: 30000, // 30 seconds
  
  // Distance filter in meters
  DISTANCE_FILTER: 10,
  
  // Location timeout in milliseconds
  TIMEOUT: 15000,
};

// Development Configuration
export const DEV_CONFIG = {
  // Enable/disable console logging
  ENABLE_LOGGING: __DEV__,
  
  // Enable/disable debug features
  ENABLE_DEBUG: __DEV__,
  
  // Mock data for development
  USE_MOCK_DATA: false,
  
  // API debugging
  LOG_API_CALLS: __DEV__,
};

// Push Notification Configuration
export const PUSH_CONFIG = {
  // Expo project ID from app.json
  // This is needed for push notifications to work
  EXPO_PROJECT_ID: 'e1b00319-5b81-40c9-8d01-065a0313572d',
};

export default {
  API_CONFIG,
  APP_CONFIG,
  STORAGE_KEYS,
  ENDPOINTS,
  VALIDATION,
  UI_CONFIG,
  LOCATION_CONFIG,
  DEV_CONFIG,
  PUSH_CONFIG,
};