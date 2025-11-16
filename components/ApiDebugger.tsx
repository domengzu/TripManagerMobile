import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import ApiService from '../services/api';
import { API_CONFIG } from '../config';

const ApiDebugger: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<string>('Not tested');
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Testing connection to:', API_CONFIG.BASE_URL);
      const result = await ApiService.testConnection();
      
      if (result.success) {
        setConnectionStatus('✅ Connected');
        setLastResponse(result.data);
      } else {
        setConnectionStatus('❌ Failed');
        setLastResponse(result.message);
      }
    } catch (error: any) {
      setConnectionStatus('❌ Error');
      setLastResponse(error.message);
    }
    setIsLoading(false);
  };

  const testDriverEndpoints = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Testing driver endpoints...');
      
      // Test multiple endpoints
      const tests = [
        { name: 'Dashboard', call: () => ApiService.getDriverDashboard() },
        { name: 'Vehicles', call: () => ApiService.getVehicles() },
        { name: 'Trips', call: () => ApiService.getTrips() },
        { name: 'Trip Tickets', call: () => ApiService.getTripTickets() },
      ];

      const results = [];
      
      for (const test of tests) {
        try {
          const result = await test.call();
          results.push({ name: test.name, status: '✅', data: result });
          console.log(`✅ ${test.name} endpoint working`);
        } catch (error: any) {
          results.push({ 
            name: test.name, 
            status: '❌', 
            error: error.response?.data || error.message 
          });
          console.error(`❌ ${test.name} endpoint failed:`, error);
        }
      }

      setLastResponse(results);
      setConnectionStatus(`Tested ${tests.length} endpoints`);
    } catch (error: any) {
      setConnectionStatus('❌ Test Error');
      setLastResponse(error.message);
    }
    setIsLoading(false);
  };

  const showApiInfo = () => {
    Alert.alert(
      'API Configuration',
      `Base URL: ${API_CONFIG.BASE_URL}\nTimeout: ${API_CONFIG.TIMEOUT}ms`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>API Debugger</Text>
      
      <View style={styles.infoRow}>
        <Text style={styles.label}>Base URL:</Text>
        <Text style={styles.value}>{API_CONFIG.BASE_URL}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.label}>Status:</Text>
        <Text style={styles.value}>{connectionStatus}</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={testConnection}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Testing...' : 'Test Connection'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={testDriverEndpoints}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Testing...' : 'Test Driver APIs'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.infoButton]} 
          onPress={showApiInfo}
        >
          <Text style={styles.buttonText}>API Info</Text>
        </TouchableOpacity>
      </View>

      {lastResponse && (
        <ScrollView style={styles.responseContainer}>
          <Text style={styles.responseTitle}>Last Response:</Text>
          <Text style={styles.responseText}>
            {typeof lastResponse === 'string' 
              ? lastResponse 
              : JSON.stringify(lastResponse, null, 2)
            }
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  label: {
    fontWeight: 'bold',
    width: 80,
    color: '#666',
  },
  value: {
    flex: 1,
    color: '#333',
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 10,
    minWidth: '30%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007bff',
  },
  secondaryButton: {
    backgroundColor: '#28a745',
  },
  infoButton: {
    backgroundColor: '#6c757d',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  responseContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  responseTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  responseText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#666',
  },
});

export default ApiDebugger;