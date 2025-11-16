import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthResponse, LoginCredentials, RegisterData } from '../types';
import ApiService from '../services/api';
import { STORAGE_KEYS } from '../config';
import { notificationService } from '../services/NotificationService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!user && ['driver', 'regular', 'director'].includes(user.role);

  // Load notifications in background without blocking UI
  const loadNotificationsInBackground = async () => {
    try {
      console.log('🔔 Loading notifications in background...');
      await notificationService.loadNotifications();
      console.log('✅ Notifications loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load notifications in background:', error);
      // Don't throw error, just log it
    }
  };

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.USER_DATA),
      ]);

      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser);
        
        // Verify the user has a valid mobile role
        if (['driver', 'regular', 'director'].includes(userData.role)) {
          setToken(storedToken);
          setUser(userData);
          
          // Load notifications in background
          loadNotificationsInBackground();
          
          // Optionally refresh user data from server
          try {
            await refreshUser();
          } catch (error) {
            console.log('Failed to refresh user data:', error);
            // Keep the stored user data if refresh fails
          }
        } else {
          // Clear storage if user doesn't have a valid mobile role
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      setIsLoading(true);
      const response: AuthResponse = await ApiService.login(credentials.email, credentials.password);
      
      // Check if user has a valid mobile role
      if (!['driver', 'regular', 'director'].includes(response.user.role)) {
        throw new Error('Access denied. Only drivers, regular users, and directors can use the mobile app.');
      }

      // Store auth data
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user)),
      ]);

      setToken(response.token);
      setUser(response.user);
      
      // Load notifications in background after successful login
      loadNotificationsInBackground();
    } catch (error: any) {
      await clearAuthData();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      
      // Ensure role is set to driver
      const registrationData = { ...data, role: 'driver' };
      
      const response: AuthResponse = await ApiService.register(registrationData);
      
      // Store auth data
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.token),
        AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.user)),
      ]);

      setToken(response.token);
      setUser(response.user);
      
      // Load notifications in background after successful registration
      loadNotificationsInBackground();
    } catch (error: any) {
      await clearAuthData();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Don't set loading immediately - causes unnecessary re-renders
      console.log('Starting logout process...');
      
      // Call API logout endpoint with timeout protection
      if (token) {
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Logout timeout')), 5000)
          );
          
          await Promise.race([
            ApiService.logout(),
            timeoutPromise
          ]);
          
          console.log('Server logout successful');
        } catch (error) {
          console.log('Server logout failed or timed out, continuing with local logout:', error);
          // Continue with local logout even if server logout fails
        }
      }
      
      // Clear local data (this is the important part)
      await clearAuthData();
      console.log('Local auth data cleared successfully');
      
    } catch (error) {
      console.error('Logout error:', error);
      // Ensure we clear data even if there's an error
      try {
        await clearAuthData();
      } catch (clearError) {
        console.error('Failed to clear auth data:', clearError);
      }
    }
  };

  const refreshUser = async () => {
    try {
      if (!token) return;
      
      const response = await ApiService.getProfile();
      
      // Check if user has a valid mobile role
      if (!['driver', 'regular', 'director'].includes(response.role)) {
        throw new Error('Access denied. Invalid role for mobile app.');
      }
      
      await AsyncStorage.setItem('user_data', JSON.stringify(response));
      setUser(response);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  const clearAuthData = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN),
        AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA),
      ]);
      
      // Clear notification cache when logging out
      notificationService.clearLocalCache();
      
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};