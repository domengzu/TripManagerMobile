import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { LoginCredentials } from '../types';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    try {
      setErrors({});
      
      // Basic validation
      const newErrors: { [key: string]: string } = {};
      if (!credentials.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
        newErrors.email = 'Email format is invalid';
      }
      if (!credentials.password) {
        newErrors.password = 'Password is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      await login(credentials);
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        Alert.alert(
          'Login Failed',
          error.response?.data?.message || error.message || 'An error occurred during login'
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
          {/* Logo/Header */}
          <View style={styles.header}>
            <Image
              source={require('../assets/images/EVSU.png')}
              style={styles.logoIcon}
              contentFit="contain"
            />
            {/* <View style={styles.logoIcon}>
              <Icon name="car" size={50} color="#ffffff" />
            </View> */}
            <Text style={styles.title}>TripManager</Text>
            {/* <Text style={styles.subtitle}>Sign in to continue</Text> */}
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <View style={[
                styles.inputContainer,
                emailFocused && styles.inputContainerFocused,
                errors.email && styles.inputContainerError
              ]}>
                <Icon 
                  name="mail-outline" 
                  size={20} 
                  color={emailFocused ? '#C28F22' : '#65676B'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  ref={emailInputRef}
                  style={styles.input}
                  value={credentials.email}
                  onChangeText={(text) => setCredentials({ ...credentials, email: text })}
                  placeholder="Email address"
                  placeholderTextColor="rgba(107, 114, 128, 0.7)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!isLoading}
                  onFocus={() => {
                    // Use requestAnimationFrame to prevent immediate re-render conflicts
                    requestAnimationFrame(() => {
                      setEmailFocused(true);
                    });
                  }}
                  onBlur={() => {
                    // Use requestAnimationFrame to prevent immediate re-render conflicts
                    requestAnimationFrame(() => {
                      setEmailFocused(false);
                    });
                  }}
                  onSubmitEditing={() => {
                    passwordInputRef.current?.focus();
                  }}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <View style={[
                styles.inputContainer,
                passwordFocused && styles.inputContainerFocused,
                errors.password && styles.inputContainerError
              ]}>
                <Icon 
                  name="lock-closed-outline" 
                  size={20} 
                  color={passwordFocused ? '#C28F22' : '#65676B'} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  value={credentials.password}
                  onChangeText={(text) => setCredentials({ ...credentials, password: text })}
                  placeholder="Password"
                  placeholderTextColor="rgba(107, 114, 128, 0.7)"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  editable={!isLoading}
                  onFocus={() => {
                    // Use requestAnimationFrame to prevent immediate re-render conflicts
                    requestAnimationFrame(() => {
                      setPasswordFocused(true);
                    });
                  }}
                  onBlur={() => {
                    // Use requestAnimationFrame to prevent immediate re-render conflicts
                    requestAnimationFrame(() => {
                      setPasswordFocused(false);
                    });
                  }}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Icon 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={20} 
                    color={passwordFocused ? '#C28F22' : '#65676B'} 
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Additional Info */}
          <View style={styles.additionalInfo}>
            <View style={styles.infoItem}>
              <Icon name="shield-checkmark" size={16} color="#C28F22" />
              <Text style={styles.infoText}>Secure & encrypted login</Text>
            </View>
            <View style={styles.infoItem}>
              <Icon name="people" size={16} color="#C28F22" />
              <Text style={styles.infoText}>For drivers and directors</Text>
            </View>            
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Need an account? Contact the administrator</Text>
            <Text style={styles.footerSubtext}>© 2025 TripManager</Text>
          </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#3E0703', // TripManager primary brand color
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoIcon: {
    width: 68,
    height: 68,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 6,
  },
  form: {
    marginBottom: 10,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    minHeight: 52,
    marginBottom: 4,
  },
  inputContainerFocused: {
    borderColor: '#C28F22',
  },
  inputContainerError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputIcon: {
    marginRight: 12,
    opacity: 0.8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 0,
    minHeight: 20,
  },
  eyeButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  loginButton: {
    backgroundColor: '#C28F22', // TripManager secondary brand color
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  additionalInfo: {
    marginTop: 16,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#d1d5db',
    marginLeft: 8,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  footerText: {
    fontSize: 13,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontWeight: '300',
  },
});
