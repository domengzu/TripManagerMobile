import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import Icon from 'react-native-vector-icons/Ionicons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ApiService from '@/services/api';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SuccessModal } from '@/components/SuccessModal';
import { useModals } from '@/hooks/useModals';
import { NotificationBellButton } from '@/components/NotificationBellButton';

const { width } = Dimensions.get('window');

type ProfileSection = 'profile' | 'password' | 'preferences';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(user?.profile_picture || null);
  const {
    confirmationState,
    successState,
    showConfirmation,
    hideConfirmation,
    showSuccess,
    hideSuccess
  } = useModals();
  
  // Profile form data
  const [profileFormData, setProfileFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    license_number: user?.license_number || '',
  });

  // Password form data
  const [passwordFormData, setPasswordFormData] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });

  // Validation states
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form data with user data when user changes
  useEffect(() => {
    if (user) {
      setProfileFormData({
        name: user.name || '',
        email: user.email || '',
        license_number: user.license_number || '',
      });
      setProfileImage(user.profile_picture || null);
    }
  }, [user]);

  const handleLogout = () => {
    showConfirmation({
      title: 'Logout Confirmation',
      message: 'Are you sure you want to logout? You will need to log in again to access your account.',
      type: 'danger',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          // Hide confirmation dialog immediately
          hideConfirmation();
          
          // Perform logout
          await logout();
          
          // No need to show success message - user will be redirected to login
          // The redirect happens automatically via AuthContext
        } catch (error) {
          console.error('Logout error:', error);
          // Show error only if logout truly fails
          showConfirmation({
            title: 'Logout Error',
            message: 'Could not logout properly, but local data has been cleared.',
            type: 'danger',
            confirmText: 'OK',
            onConfirm: () => hideConfirmation()
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      
      // Refresh user data from the server
      await refreshUser();
      
      // Reset any form errors
      setErrors({});
      
      // Sync the updated user data with form data
      if (user) {
        setProfileFormData({
          name: user.name || '',
          email: user.email || '',
          license_number: user.license_number || '',
        });
        setProfileImage(user.profile_picture || null);
      }
    } catch (error: any) {
      console.error('Failed to refresh profile:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to refresh profile data';
      Alert.alert('Refresh Error', errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleImagePicker = async () => {
    try {
      // Show action sheet to choose between camera and library
      Alert.alert(
        'Select Profile Picture',
        'Choose how you want to select your profile picture',
        [
          {
            text: 'Take Photo',
            onPress: () => openCamera(),
          },
          {
            text: 'Choose from Library',
            onPress: () => openImageLibrary(),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      console.error('Error in image picker:', error);
      Alert.alert('Error', 'Failed to open image picker');
    }
  };

  const openCamera = async () => {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permissions to take a profile picture.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => console.log('Open settings') }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
        Alert.alert('Photo Captured', 'Profile picture will be updated when you save changes.');
      }
    } catch (error) {
      console.error('Error opening camera:', error);
      Alert.alert('Error', 'Failed to open camera. Please try again.');
    }
  };

  const openImageLibrary = async () => {
    try {
      // Request media library permissions
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (mediaPermission.status !== 'granted') {
        Alert.alert(
          'Media Library Permission Required',
          'Please grant media library permissions to select a profile picture.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => console.log('Open settings') }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileImage(result.assets[0].uri);
        Alert.alert('Image Selected', 'Profile picture will be updated when you save changes.');
      }
    } catch (error) {
      console.error('Error opening image library:', error);
      Alert.alert('Error', 'Failed to open image library. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsLoading(true);
      setErrors({});

      // Driver-specific validation
      const newErrors: Record<string, string> = {};
      
      // Required fields for all users
      if (!profileFormData.name.trim()) {
        newErrors.name = 'Full name is required';
      }
      if (!profileFormData.email.trim()) {
        newErrors.email = 'Email is required';
      }
      if (profileFormData.email && !/\S+@\S+\.\S+/.test(profileFormData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      // License number for drivers is read-only from database, no validation needed

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        Alert.alert('Validation Error', 'Please fix the errors below and try again.');
        return;
      }

      // Update profile information
      await ApiService.updateProfile({
        name: profileFormData.name,
      });

      // Upload profile picture if it was changed
      if (profileImage && profileImage !== user?.profile_picture) {
        try {
          await ApiService.uploadProfilePicture(profileImage);
        } catch (uploadError: any) {
          console.warn('Profile picture upload failed:', uploadError);
          // Don't fail the entire update if only picture upload fails
          Alert.alert(
            'Partial Success', 
            'Profile updated successfully, but profile picture upload failed. Please try uploading the picture again.'
          );
        }
      }

      showSuccess({
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      await refreshUser(); // Refresh user data from server
    } catch (error: any) {
      console.error('Profile update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update profile';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    try {
      setIsLoading(true);
      setErrors({});

      // Basic validation
      const newErrors: Record<string, string> = {};
      if (!passwordFormData.current_password) {
        newErrors.current_password = 'Current password is required';
      }
      if (!passwordFormData.password) {
        newErrors.password = 'New password is required';
      }
      if (passwordFormData.password && passwordFormData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
      if (passwordFormData.password !== passwordFormData.password_confirmation) {
        newErrors.password_confirmation = 'Passwords do not match';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Update password
      await ApiService.updatePassword(passwordFormData);
      
      showSuccess({
        title: 'Password Updated',
        message: 'Your password has been updated successfully!',
        autoClose: true,
        autoCloseDelay: 3000
      });
      setPasswordFormData({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
    } catch (error: any) {
      console.error('Password update error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update password';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderSectionTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tab, activeSection === 'profile' && styles.activeTab]}
        onPress={() => setActiveSection('profile')}
      >
        <Icon
          name="person-outline"
          size={20}
          color={activeSection === 'profile' ? '#fff' : '#3E0703'}
        />
        <Text style={[styles.tabText, activeSection === 'profile' && styles.activeTabText]}>
          Profile
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeSection === 'password' && styles.activeTab]}
        onPress={() => setActiveSection('password')}
      >
        <Icon
          name="lock-closed-outline"
          size={20}
          color={activeSection === 'password' ? '#fff' : '#3E0703'}
        />
        <Text style={[styles.tabText, activeSection === 'password' && styles.activeTabText]}>
          Security
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeSection === 'preferences' && styles.activeTab]}
        onPress={() => setActiveSection('preferences')}
      >
        <Icon
          name="settings-outline"
          size={20}
          color={activeSection === 'preferences' ? '#fff' : '#3E0703'}
        />
        <Text style={[styles.tabText, activeSection === 'preferences' && styles.activeTabText]}>
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderProfileSection = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderContent}>
          <Icon name="person" size={24} color="#C28F22" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Profile Information</Text>
            {/* <Text style={styles.cardSubtitle}>Update your account details and profile picture</Text> */}
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <View style={styles.profilePictureContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profilePicture} />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Text style={styles.profilePictureText}>{getInitials(user?.name || 'U')}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraButton} onPress={handleImagePicker}>
              <Icon name="camera-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.profilePictureActions}>
            <TouchableOpacity style={styles.uploadButton} onPress={handleImagePicker}>
              <Icon name="images-outline" size={18} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {profileImage ? 'Change Picture' : 'Upload Picture'}
              </Text>
            </TouchableOpacity>
            {profileImage && (
              <TouchableOpacity 
                style={styles.removeButton} 
                onPress={() => setProfileImage(null)}
              >
                <Icon name="trash-outline" size={18} color="#fff" />
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* <Text style={styles.uploadHint}>📷 JPG, PNG up to 10MB</Text> */}
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Icon name="person-outline" size={16} color="#C28F22" /> Full Name
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={profileFormData.name}
              onChangeText={(text) => {
                setProfileFormData({ ...profileFormData, name: text });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="Enter your full name"
              placeholderTextColor="#9ca3af"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Icon name="mail-outline" size={16} color="#C28F22" /> Email Address
            </Text>
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={profileFormData.email}
              editable={false}
              placeholder="Email address"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.inputHint}>Email cannot be changed for security reasons</Text>
          </View>

          {/* License Number Field - Show for drivers (Read-only from database) */}
          {user?.role === 'driver' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                <Icon name="card-outline" size={16} color="#C28F22" /> Driver License Number
              </Text>
              <TextInput
                style={[styles.input, styles.inputReadonly]}
                value={profileFormData.license_number || 'Not provided'}
                editable={false}
                placeholder="License number from database"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.inputHint}>License number from database - contact admin to update</Text>
            </View>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPasswordSection = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderContent}>
          <Icon name="lock-closed" size={24} color="#C28F22" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Password & Security</Text>
            {/* <Text style={styles.cardSubtitle}>Keep your account secure with a strong password</Text> */}
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        {/* Current Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            <Icon name="eye-outline" size={16} color="#C28F22" /> Current Password
          </Text>
          <TextInput
            style={[styles.input, errors.current_password && styles.inputError]}
            value={passwordFormData.current_password}
            onChangeText={(text) => {
              setPasswordFormData({ ...passwordFormData, current_password: text });
              if (errors.current_password) setErrors({ ...errors, current_password: '' });
            }}
            placeholder="Enter your current password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />
          {errors.current_password && <Text style={styles.errorText}>{errors.current_password}</Text>}
        </View>

        {/* New Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            <Icon name="lock-closed-outline" size={16} color="#C28F22" /> New Password
          </Text>
          <TextInput
            style={[styles.input, errors.password && styles.inputError]}
            value={passwordFormData.password}
            onChangeText={(text) => {
              setPasswordFormData({ ...passwordFormData, password: text });
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            placeholder="Choose a strong password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          <Text style={styles.inputHint}>💡 Use at least 8 characters with a mix of letters, numbers, and symbols</Text>
        </View>

        {/* Confirm Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            <Icon name="checkmark-circle-outline" size={16} color="#C28F22" /> Confirm New Password
          </Text>
          <TextInput
            style={[styles.input, errors.password_confirmation && styles.inputError]}
            value={passwordFormData.password_confirmation}
            onChangeText={(text) => {
              setPasswordFormData({ ...passwordFormData, password_confirmation: text });
              if (errors.password_confirmation) setErrors({ ...errors, password_confirmation: '' });
            }}
            placeholder="Confirm your new password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
          />
          {errors.password_confirmation && <Text style={styles.errorText}>{errors.password_confirmation}</Text>}
        </View>

        {/* Update Password Button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.buttonDisabled]}
          onPress={handleUpdatePassword}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="shield-checkmark-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Update Password</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPreferencesSection = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderContent}>
          <Icon name="settings" size={24} color="#C28F22" />
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>App Settings</Text>
            {/* <Text style={styles.cardSubtitle}>Customize your app experience</Text> */}
          </View>
        </View>
      </View>

      <View style={styles.cardContent}>
        {/* Account Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsCardTitle}>Account Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Role</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusContainer}>
              <Ionicons 
                name={user?.is_active ? 'checkmark-circle' : 'close-circle'} 
                size={16} 
                color={user?.is_active ? '#10b981' : '#ef4444'} 
              />
              <Text style={[styles.detailValue, { color: user?.is_active ? '#10b981' : '#ef4444', marginLeft: 4 }]}>
                {user?.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Member Since</Text>
            <Text style={styles.detailValue}>
              {user?.created_at ? formatDate(user.created_at) : 'Unknown'}
            </Text>
          </View>

          {/* Show additional database fields if available */}
          {user?.provider && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Type</Text>
              <Text style={styles.detailValue}>
                {user.provider === 'google' ? 'Google Account' : 'Local Account'}
              </Text>
            </View>
          )}

          {user?.role === 'driver' && user?.can_approve_travel && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Special Permission</Text>
              <View style={styles.statusContainer}>
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                <Text style={[styles.detailValue, { color: '#10b981', marginLeft: 4 }]}>Can Approve Travel</Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          
          {/* Trip Log History - Only for drivers */}
          {user?.role === 'driver' && (
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/trip-log-history')}
            >
              <View style={styles.quickActionContent}>
                <Icon name="receipt" size={20} color="#3b82f6" />
                <Text style={styles.quickActionText}>History Reports</Text>
              </View>
              <Icon name="chevron-forward" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
          
          {/* Help & Support - Available for everyone */}
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => router.push('/help-support')}
          >
            <View style={styles.quickActionContent}>
              <Icon name="help-circle-outline" size={20} color="#3b82f6" />
              <Text style={styles.quickActionText}>Help & Support</Text>
            </View>
            <Icon name="chevron-forward" size={16} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* App Information */}
        <View style={styles.appInfoSection}>
          <Text style={styles.appInfoTitle}>App Information</Text>
          <View style={styles.appInfoCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Version</Text>
              <Text style={styles.detailValue}>1.0.0</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Updated</Text>
              <Text style={styles.detailValue}>October 2025</Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerZone}>
          {/* <Text style={styles.dangerZoneTitle}>
            <Icon name="warning-outline" size={16} color="#dc2626" /> Danger Zone
          </Text> */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="log-out-outline" size={20} color="#fff" />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with User Info */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <View style={styles.headerAvatar}>
              {profileImage || user?.profile_picture ? (
                <Image 
                  source={{ uri: profileImage || user?.profile_picture || '' }} 
                  style={styles.headerAvatarImage} 
                />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>{getInitials(user?.name || 'U')}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{user?.name || 'User'}</Text>
              <Text style={styles.headerEmail}>{user?.email}</Text>
              <Text style={styles.headerRole}>
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'TripManager User'}
              </Text>
            </View>
          </View>
          <NotificationBellButton color="#3E0703" size={26} />
        </View>
      </View>

      {/* Section Tabs */}
      {renderSectionTabs()}

      {/* Content */}
      <ScrollView 
        style={styles.content} 
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
        {activeSection === 'profile' && renderProfileSection()}
        {activeSection === 'password' && renderPasswordSection()}
        {activeSection === 'preferences' && renderPreferencesSection()}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  
  // Header Styles
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#C28F22', // TripManager secondary brand color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerAvatarImage: {
    width: 45,
    height: 45,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#C28F22',
  },
  headerAvatarPlaceholder: {
    width: 45,
    height: 45,
    borderRadius: 50,
    backgroundColor: '#C28F22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#C28F22',
  },
  headerAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3E0703',
    // marginBottom: 2,
  },
  headerRole: {
    fontSize: 14,
    color: '#C28F22',
    fontWeight: '600',
    // marginBottom: 2,
  },
  headerEmail: {
    fontSize: 12,
    color: '#a6a9acff',
  },

  // Tabs Styles
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#3E0703',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E0703',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  // Content Styles
  content: {
    flex: 1,
    padding: 16,
  },
  
  // Card Styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  cardHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E0703',
    // marginBottom: 0,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#d1d5db',
  },
  cardContent: {
    padding: 20,
  },

  // Profile Picture Section
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 2,
    // backgroundColor: '#3E0703',
    borderRadius: 8,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#C28F22',
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C28F22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#C28F22',
  },
  profilePictureText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#3E0703',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  profilePictureActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3E0703',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  uploadButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  uploadHint: {
    fontSize: 12,
    color: '#65676B',
    textAlign: 'center',
  },

  // Form Styles
  formSection: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#050505',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#CCD0D5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#000000',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  inputReadonly: {
    backgroundColor: '#F0F2F5',
    color: '#65676B',
  },
  inputHint: {
    fontSize: 12,
    color: '#65676B',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },

  // Button Styles
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3E0703',
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Details Styles
  detailsCard: {
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  detailsCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CCD0D5',
  },
  detailLabel: {
    fontSize: 14,
    color: '#65676B',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#050505',
    fontWeight: '500',
    textAlign: 'right',
  },
  roleBadge: {
    backgroundColor: '#3E0703',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#10b981',
  },
  inactiveBadge: {
    backgroundColor: '#dc2626',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Quick Actions
  quickActionsSection: {
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 16,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#CCD0D5',
  },
  quickActionText: {
    fontSize: 14,
    color: '#050505',
    flex: 1,
    marginLeft: 12,
  },

  // App Info
  appInfoSection: {
    marginBottom: 20,
  },
  appInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 16,
  },
  appInfoCard: {
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    padding: 16,
  },

  // Danger Zone
  dangerZone: {
    borderTopWidth: 1,
    borderTopColor: '#CCD0D5',
    paddingTop: 20,
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },

  // Bottom Spacing
  bottomSpacing: {
    height: 40,
  },
  // Status Container
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
