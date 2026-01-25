import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, STORAGE_KEYS } from '../config';

const API_URL = API_CONFIG.BASE_URL;

interface POSReceiptUploadProps {
  ticketId: number;
  ticketNumber: string;
  existingReceiptUrl?: string;
  existingUploadedAt?: string;
  onUploadSuccess?: (receiptUrl: string, uploadedAt: string) => void;
}

export default function POSReceiptUpload({
  ticketId,
  ticketNumber,
  existingReceiptUrl,
  existingUploadedAt,
  onUploadSuccess,
}: POSReceiptUploadProps) {
  const [receiptImage, setReceiptImage] = useState<string | null>(existingReceiptUrl || null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(existingUploadedAt || null);
  const [uploading, setUploading] = useState(false);

  // Helper function to convert relative URL to absolute URL
  const getFullImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    
    // If URL already starts with http:// or https://, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If URL starts with /storage, prepend the base URL
    if (url.startsWith('/storage')) {
      const baseUrl = API_CONFIG.BASE_URL.replace('/api', ''); // Remove /api from base URL
      return `${baseUrl}${url}`;
    }
    
    // Otherwise, assume it's a relative path and prepend full storage URL
    const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');
    return `${baseUrl}/storage/${url}`;
  };

  useEffect(() => {
    if (existingReceiptUrl) {
      const fullUrl = getFullImageUrl(existingReceiptUrl);
      console.log('📸 Receipt URL conversion:', {
        original: existingReceiptUrl,
        converted: fullUrl
      });
      setReceiptImage(fullUrl);
    }
    if (existingUploadedAt) {
      setUploadedAt(existingUploadedAt);
    }
  }, [existingReceiptUrl, existingUploadedAt]);

  // Request permissions
  const requestPermissions = async (type: 'camera' | 'library') => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Camera permission is required to take photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Gallery permission is required to select photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  // Pick image from gallery
  const pickImage = async () => {
    const hasPermission = await requestPermissions('library');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestPermissions('camera');
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Upload image to backend
  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) {
        Alert.alert('Error', 'Authentication required. Please log in again.');
        return;
      }

      // Create form data
      const formData = new FormData();
      
      // Get file extension
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      
      formData.append('receipt_image', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: `pos_receipt_${ticketNumber}_${Date.now()}.${fileType}`,
        type: `image/${fileType}`,
      } as any);

      const response = await fetch(`${API_URL}/driver/trip-tickets/${ticketId}/receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      // Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('Non-JSON response:', textResponse.substring(0, 500));
        throw new Error(`Server error: Expected JSON but received ${contentType || 'unknown content type'}`);
      }

      const data = await response.json();

      if (response.ok) {
        const fullUrl = getFullImageUrl(data.receipt_url);
        console.log('✅ Upload successful, URL:', {
          received: data.receipt_url,
          converted: fullUrl
        });
        setReceiptImage(fullUrl);
        setUploadedAt(data.uploaded_at);
        
        if (onUploadSuccess) {
          onUploadSuccess(fullUrl || data.receipt_url, data.uploaded_at);
        }

        Alert.alert(
          'Success',
          'POS receipt uploaded successfully!',
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Failed to upload receipt. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Delete receipt
  const deleteReceipt = async () => {
    Alert.alert(
      'Delete Receipt',
      'Are you sure you want to delete this receipt photo? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
              if (!token) {
                Alert.alert('Error', 'Authentication required. Please log in again.');
                return;
              }

              const response = await fetch(`${API_URL}/driver/trip-tickets/${ticketId}/receipt`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (response.ok) {
                setReceiptImage(null);
                setUploadedAt(null);
                Alert.alert('Success', 'Receipt deleted successfully.');
              } else {
                const data = await response.json();
                throw new Error(data.message || 'Delete failed');
              }
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert(
                'Delete Failed',
                error instanceof Error ? error.message : 'Failed to delete receipt.'
              );
            }
          },
        },
      ]
    );
  };

  // Show image picker options
  const showImageOptions = () => {
    Alert.alert(
      'Upload POS Receipt',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: pickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="receipt" size={20} color="#059669" />
        <Text style={styles.headerText}>POS Receipt Proof</Text>
      </View>

      {uploading ? (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.uploadingText}>Uploading receipt...</Text>
        </View>
      ) : receiptImage ? (
        <View style={styles.receiptContainer}>
          <Image 
            source={{ uri: receiptImage }} 
            style={styles.receiptImage}
            onLoad={() => console.log('✅ Image loaded successfully:', receiptImage)}
            onError={(error) => {
              console.error('❌ Image load error:', error.nativeEvent.error);
              console.error('Image URI:', receiptImage);
              Alert.alert('Image Error', 'Failed to load receipt image. Please try uploading again.');
            }}
            resizeMode="contain"
          />
          
          {uploadedAt && (
            <View style={styles.uploadInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.uploadedText}>
                Uploaded {new Date(uploadedAt).toLocaleDateString()} at{' '}
                {new Date(uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.replaceButton}
              onPress={showImageOptions}
            >
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Replace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={deleteReceipt}
            >
              <Ionicons name="trash" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.uploadPrompt}
          onPress={showImageOptions}
        >
          <View style={styles.uploadIconContainer}>
            <Ionicons name="cloud-upload-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.uploadPromptTitle}>Upload POS Receipt</Text>
          <Text style={styles.uploadPromptText}>
            Take a photo of the filled POS receipt from the fuel station
          </Text>
          <View style={styles.uploadButton}>
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.uploadButtonText}>Upload Photo</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={16} color="#3B82F6" />
        <Text style={styles.infoText}>
          Upload a clear photo of the completed POS receipt as proof of fuel purchase.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  uploadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  receiptContainer: {
    alignItems: 'center',
  },
  receiptImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: '#F3F4F6',
  },
  uploadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
  },
  uploadedText: {
    fontSize: 12,
    color: '#059669',
    marginLeft: 6,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  replaceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadPrompt: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  uploadIconContainer: {
    marginBottom: 16,
  },
  uploadPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  uploadPromptText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    marginLeft: 8,
    lineHeight: 18,
  },
});
