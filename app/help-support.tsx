import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

const faqs: FAQItem[] = [
  {
    id: '1',
    question: 'How do I request a trip?',
    answer: 'To request a trip, go to the Home screen, tap "Request Trip", fill in your travel details including destination, date, time, and purpose, then submit your request. You will receive a notification once your request is reviewed.',
  },
  {
    id: '2',
    question: 'How do I track my trip status?',
    answer: 'You can track your trip status on the Home screen under "Recent Trips" or in the Trips tab. Each trip will show its current status: pending, approved, ongoing, or completed.',
  },
  {
    id: '3',
    question: 'What should I do if my trip is delayed?',
    answer: 'If your trip is delayed, contact your assigned driver directly through the app or notify the admin. You can also update your trip details if needed before the trip starts.',
  },
  {
    id: '4',
    question: 'How do I view my trip history?',
    answer: 'For drivers, you can access trip history and reports through the "History Reports" button in the Profile tab. Passengers can view their past trips in the Trips tab by filtering for completed trips.',
  },
  {
    id: '5',
    question: 'How do I update my profile?',
    answer: 'Go to the Profile tab, tap on "Edit Profile", update your information, and save changes. You can also update your profile picture by tapping on your avatar.',
  },
  {
    id: '6',
    question: 'What if I forgot my password?',
    answer: 'On the login screen, tap "Forgot Password", enter your registered email address, and follow the instructions sent to your email to reset your password.',
  },
  {
    id: '7',
    question: 'How do notifications work?',
    answer: 'You will receive push notifications for important updates like trip approvals, assignments, status changes, and messages. Make sure to allow notifications when prompted.',
  },
  {
    id: '8',
    question: 'Who can I contact for technical issues?',
    answer: 'For technical issues, you can contact support through the "Contact Support" section below or reach out to your organization\'s administrator.',
  },
];

export default function HelpSupportScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you would like to contact us:',
      [
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@tripmanager.com'),
        },
        {
          text: 'Phone',
          onPress: () => Linking.openURL('tel:+1234567890'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleReportBug = () => {
    Alert.alert(
      'Report a Bug',
      'Please describe the issue you encountered:',
      [
        {
          text: 'Send Email',
          onPress: () => Linking.openURL('mailto:bugs@tripmanager.com?subject=Bug Report'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Help & Support',
          headerStyle: {
            backgroundColor: '#3E0703',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          
          <TouchableOpacity style={styles.contactCard} onPress={handleContactSupport}>
            <View style={styles.contactIconContainer}>
              <Icon name="call-outline" size={24} color="#3b82f6" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Contact Support</Text>
              <Text style={styles.contactSubtitle}>Get help from our support team</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleReportBug}>
            <View style={styles.contactIconContainer}>
              <Icon name="bug-outline" size={24} color="#ef4444" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Report a Bug</Text>
              <Text style={styles.contactSubtitle}>Help us improve the app</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactCard} 
            onPress={() => Linking.openURL('mailto:feedback@tripmanager.com')}
          >
            <View style={styles.contactIconContainer}>
              <Icon name="chatbubble-outline" size={24} color="#10b981" />
            </View>
            <View style={styles.contactContent}>
              <Text style={styles.contactTitle}>Send Feedback</Text>
              <Text style={styles.contactSubtitle}>Share your thoughts with us</Text>
            </View>
            <Icon name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {faqs.map((faq) => (
            <TouchableOpacity
              key={faq.id}
              style={styles.faqCard}
              onPress={() => toggleFAQ(faq.id)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Icon
                  name={expandedId === faq.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6b7280"
                />
              </View>
              {expandedId === faq.id && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Tips</Text>
          <View style={styles.tipCard}>
            <Icon name="bulb-outline" size={20} color="#f59e0b" />
            <Text style={styles.tipText}>
              Keep your app updated to get the latest features and bug fixes.
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Icon name="bulb-outline" size={20} color="#f59e0b" />
            <Text style={styles.tipText}>
              Enable notifications to stay updated on your trip status.
            </Text>
          </View>
          <View style={styles.tipCard}>
            <Icon name="bulb-outline" size={20} color="#f59e0b" />
            <Text style={styles.tipText}>
              Complete your profile for a better experience.
            </Text>
          </View>
        </View>

        {/* App Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>November 2025</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Developer</Text>
              <Text style={styles.infoValue}>TripManager Team</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  contactSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  faqCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
    lineHeight: 20,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    marginLeft: 12,
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});
