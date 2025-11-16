/**
 * Storage utilities for AsyncStorage operations
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';

export class StorageUtils {
  /**
   * Safely get item from AsyncStorage with error handling
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  }

  /**
   * Safely set item in AsyncStorage with error handling
   */
  static async setItem(key: string, value: string): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Error setting item in storage:', error);
      return false;
    }
  }

  /**
   * Safely remove item from AsyncStorage
   */
  static async removeItem(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing item from storage:', error);
      return false;
    }
  }

  /**
   * Get and parse JSON object from storage
   */
  static async getObject<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error('Error parsing JSON from storage:', error);
      return null;
    }
  }

  /**
   * Store object as JSON string
   */
  static async setObject(key: string, object: any): Promise<boolean> {
    try {
      const value = JSON.stringify(object);
      return await this.setItem(key, value);
    } catch (error) {
      console.error('Error storing object in storage:', error);
      return false;
    }
  }

  /**
   * Clear all storage (useful for logout)
   */
  static async clearAll(): Promise<boolean> {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Clear auth-related data
   */
  static async clearAuthData(): Promise<boolean> {
    try {
      await Promise.all([
        this.removeItem(STORAGE_KEYS.AUTH_TOKEN),
        this.removeItem(STORAGE_KEYS.USER_DATA),
      ]);
      return true;
    } catch (error) {
      console.error('Error clearing auth data:', error);
      return false;
    }
  }

  /**
   * Get all keys in storage (useful for debugging)
   */
  static async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('Error getting storage keys:', error);
      return [];
    }
  }

  /**
   * Get storage size info (for debugging)
   */
  static async getStorageInfo(): Promise<{ keys: number; size: string }> {
    try {
      const keys = await this.getAllKeys();
      let totalSize = 0;
      
      for (const key of keys) {
        const value = await this.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
      
      const sizeInKB = (totalSize / 1024).toFixed(2);
      
      return {
        keys: keys.length,
        size: `${sizeInKB} KB`
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return { keys: 0, size: '0 KB' };
    }
  }
}