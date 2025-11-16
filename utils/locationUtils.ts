/**
 * Location utilities for GPS tracking and location services
 */
import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface LocationError {
  code: string;
  message: string;
}

export class LocationUtils {
  private static watchId: Location.LocationSubscription | null = null;

  /**
   * Request location permissions
   */
  static async requestPermissions(): Promise<{ granted: boolean; error?: string }> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        return {
          granted: false,
          error: 'Location permission was denied'
        };
      }

      return { granted: true };
    } catch (error) {
      return {
        granted: false,
        error: 'Failed to request location permissions'
      };
    }
  }

  /**
   * Get current location (one-time)
   */
  static async getCurrentLocation(): Promise<LocationCoordinates | null> {
    try {
      const { granted } = await this.requestPermissions();
      if (!granted) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // 10 seconds
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Start watching location changes
   */
  static async startLocationTracking(
    callback: (location: LocationCoordinates) => void,
    errorCallback?: (error: LocationError) => void
  ): Promise<boolean> {
    try {
      const { granted } = await this.requestPermissions();
      if (!granted) {
        errorCallback?.({
          code: 'PERMISSION_DENIED',
          message: 'Location permission denied'
        });
        return false;
      }

      // Stop existing tracking
      this.stopLocationTracking();

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,        // Update every 5 seconds
          distanceInterval: 10,      // Update every 10 meters
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          });
        }
      );

      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      errorCallback?.({
        code: 'TRACKING_ERROR',
        message: 'Failed to start location tracking'
      });
      return false;
    }
  }

  /**
   * Stop location tracking
   */
  static stopLocationTracking(): void {
    if (this.watchId) {
      this.watchId.remove();
      this.watchId = null;
    }
  }

  /**
   * Calculate distance between two coordinates (in meters)
   */
  static calculateDistance(
    coord1: LocationCoordinates,
    coord2: LocationCoordinates
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a = 
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
  }

  /**
   * Format coordinates for display
   */
  static formatCoordinates(coords: LocationCoordinates, precision: number = 6): string {
    return `${coords.latitude.toFixed(precision)}, ${coords.longitude.toFixed(precision)}`;
  }

  /**
   * Check if location services are enabled
   */
  static async isLocationEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  }

  /**
   * Get location accuracy description
   */
  static getAccuracyDescription(accuracy?: number): string {
    if (!accuracy) return 'Unknown';
    
    if (accuracy <= 5) return 'Excellent';
    if (accuracy <= 10) return 'Good';
    if (accuracy <= 20) return 'Fair';
    if (accuracy <= 100) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Convert coordinates to Google Maps URL
   */
  static getGoogleMapsUrl(coords: LocationCoordinates): string {
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
  }

  /**
   * Convert coordinates to Apple Maps URL
   */
  static getAppleMapsUrl(coords: LocationCoordinates): string {
    return `http://maps.apple.com/?q=${coords.latitude},${coords.longitude}`;
  }
}