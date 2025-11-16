# TripManager Mobile Driver App - Setup Guide

This is a React Native mobile application for drivers in the TripManager system, built with Expo and TypeScript.

## Quick Start

### Prerequisites

- Node.js (v18 or later)
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (Mac) or Android Emulator
- Laravel backend server running

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API connection:**
   - Open `config/index.ts`
   - Update `API_CONFIG.BASE_URL` with your Laravel server URL
   - Example: `http://192.168.1.100:8000/api`

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Run on device:**
   - iOS: Press `i` or scan QR code with Camera app
   - Android: Press `a` or scan QR code with Expo Go app

## App Structure

```
app/
├── (auth)/           # Authentication screens
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/           # Main app tabs (driver dashboard)
│   ├── dashboard.tsx # Driver dashboard with stats
│   ├── trips.tsx     # Trip management
│   ├── vehicles.tsx  # Vehicle management
│   ├── tickets.tsx   # Trip tickets management
│   └── profile.tsx   # Driver profile
└── trip/             # Trip-related screens
    ├── create.tsx    # Create new trip
    └── edit.tsx      # Edit existing trip
```

## Key Features

### 🚗 Driver Dashboard
- Real-time statistics (total trips, active bookings, earnings)
- Quick access to recent trips
- Vehicle status overview

### 🎫 Trip Management
- Create and manage trips
- Set destinations, schedules, and pricing
- View booking status and passenger details

### 🚙 Vehicle Management
- Register and manage driver vehicles
- Track vehicle status and maintenance
- Link vehicles to trips

### 📋 Ticket Management
- View all trip bookings
- Manage ticket status (confirm/cancel)
- Track passenger information

### 👤 Profile Management
- Update driver information
- View account statistics
- Logout functionality

### 📍 Location Services
- GPS tracking for active trips
- Location-based features
- Real-time location updates

## Configuration

The app uses a centralized configuration system in `config/index.ts`:

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://192.168.1.100:8000/api', // Update this
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
};
```

### Environment-Specific Settings

**Development:**
- Set `DEV_CONFIG.LOG_API_CALLS = true` for detailed logging
- Use local IP address for API_CONFIG.BASE_URL

**Production:**
- Use HTTPS URLs
- Disable logging
- Update timeout settings for mobile networks

## Authentication

The app uses JWT token authentication with role-based access:

1. **Driver Registration/Login**
   - Email and password authentication
   - Role verification (driver-only access)
   - Automatic token refresh

2. **Secure Storage**
   - Tokens stored in AsyncStorage
   - Automatic logout on token expiry
   - Secure session management

## API Integration

The app communicates with Laravel backend through RESTful APIs:

- **Authentication:** Login, register, logout
- **Dashboard:** Driver statistics and overview
- **Trips:** CRUD operations for trip management
- **Vehicles:** Vehicle registration and management
- **Tickets:** Booking management and status updates
- **Location:** GPS tracking and updates

See `API_INTEGRATION_GUIDE.md` for detailed API documentation.

## State Management

### AuthContext
Handles user authentication and session management:
```typescript
const { user, login, logout, isLoading } = useAuth();
```

### API Service
Centralized HTTP client with interceptors:
```typescript
import { apiService } from '../services/api';
const trips = await apiService.getTrips();
```

## Utilities

The app includes comprehensive utility modules:

- **DateUtils:** Date formatting and manipulation
- **LocationUtils:** GPS tracking and location services
- **ValidationUtils:** Form validation and input sanitization
- **StorageUtils:** AsyncStorage operations
- **ErrorHandler:** Centralized error handling

## Styling

Built with modern React Native styling:

- **Responsive Design:** Adapts to different screen sizes
- **Native UI Components:** Platform-specific styling
- **Consistent Theme:** Centralized color and spacing system
- **Accessibility:** Screen reader support and accessibility features

## Testing

### Manual Testing

1. **Authentication Flow:**
   - Register new driver account
   - Login with credentials
   - Test role-based access

2. **Core Features:**
   - Create and manage trips
   - Add and edit vehicles
   - View and manage bookings
   - Update profile information

3. **Location Services:**
   - Test GPS permission requests
   - Verify location tracking accuracy
   - Check location updates during trips

### Debugging

Enable debug mode in `config/index.ts`:
```typescript
export const DEV_CONFIG = {
  LOG_API_CALLS: true,  // Log all API requests
  ENABLE_LOGGING: true, // Enable console logging
  MOCK_DATA: false,     // Use real API data
};
```

## Common Issues

### Connection Problems
1. **Check Laravel server status**
2. **Verify IP address and port**
3. **Check firewall/network settings**
4. **Confirm CORS configuration**

### Authentication Issues
1. **Verify driver role in database**
2. **Check Sanctum configuration**
3. **Confirm token format**
4. **Test with Postman first**

### Location Issues
1. **Grant location permissions**
2. **Test on physical device**
3. **Check GPS accuracy settings**
4. **Verify background location access**

## Deployment

### Development Build
```bash
expo build:android
expo build:ios
```

### Production Configuration
1. Update `API_CONFIG.BASE_URL` to production server
2. Disable debug logging
3. Configure proper SSL certificates
4. Test on physical devices
5. Submit to app stores

## Support

For technical support or questions:
1. Check the API Integration Guide
2. Review console logs and error messages
3. Test API endpoints with Postman
4. Verify Laravel backend configuration

## License

This project is part of the TripManager system and follows the same licensing terms.