import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { colors } from '../theme/colors';
import { translations } from '../i18n/translations';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile } from '../types';

interface LoginScreenProps {
  language: 'en' | 'mr';
  onLoginSuccess: (farmer: FarmerProfile, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ language, onLoginSuccess }) => {
  const t = translations[language];
  const [phone, setPhone] = useState('9158429165'); // Dhondiba Dakhore (Single Profile)
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<FarmerProfile[]>([]);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter a valid mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await ApiClient.login(phone.trim());
      if (res.is_multi_profile) {
        setProfiles(res.profiles);
        setTempToken(res.access_token);
        setShowProfileModal(true);
      } else if (res.selected_farmer && res.access_token) {
        ApiClient.setToken(res.access_token);
        onLoginSuccess(res.selected_farmer, res.access_token);
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Mobile number not found in registry');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfile = async (farmer: FarmerProfile) => {
    setShowProfileModal(false);
    setLoading(true);
    try {
      const res = await ApiClient.selectProfile(phone, farmer.farmer_id, tempToken || undefined);
      if (res.selected_farmer && res.access_token) {
        ApiClient.setToken(res.access_token);
        onLoginSuccess(res.selected_farmer, res.access_token);
      }
    } catch (err: any) {
      Alert.alert('Error', 'Failed to activate selected profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Background ambient decorative shapes */}
      <View style={styles.bgGlowTop} />
      <View style={styles.bgGlowBottom} />

      <View style={styles.loginCard}>
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🌾</Text>
          </View>
          <View>
            <Text style={styles.foundationTitle}>{t.foundation}</Text>
            <Text style={styles.appTitle}>{t.appName}</Text>
          </View>
        </View>

        <Text style={styles.tagline}>{t.tagline}</Text>

        {/* Security / Dev Mode Pill */}
        <View style={styles.authBadge}>
          <View style={styles.authDot} />
          <Text style={styles.authBadgeText}>Supabase Cloud Database & Storage</Text>
        </View>

        {/* Mobile Input with +91 Prefix */}
        <View style={styles.inputContainer}>
          <View style={styles.countryPrefix}>
            <Text style={styles.countryFlag}>🇮🇳</Text>
            <Text style={styles.prefixText}>+91</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder={t.phonePlaceholder}
            placeholderTextColor="#9ca3af"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>{t.loginButton} ›</Text>
          )}
        </TouchableOpacity>

        {/* Fast Account Selection Presets */}
        <View style={styles.presetsBox}>
          <Text style={styles.presetsHeader}>Select Evaluation Farmer Profile:</Text>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setPhone('9158429165')}
          >
            <Text style={styles.presetName}>👤 Dhondiba Dakhore (9158429165)</Text>
            <Text style={styles.presetMeta}>Single Account • 4.2 Acres • Baramati</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setPhone('9422870990')}
          >
            <Text style={styles.presetName}>👥 Amol & Asawari Kadam (9422870990)</Text>
            <Text style={styles.presetMeta}>Shared Household • Multi-Profile Selection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => setPhone('9822453555')}
          >
            <Text style={styles.presetName}>👥 Ashokrao & Sharayu (9822453555)</Text>
            <Text style={styles.presetMeta}>Shared Household • Multi-Profile Selection</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Multi-Account Profile Selection Modal */}
      <Modal visible={showProfileModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIconBox}>
                <Text style={styles.modalHeaderIcon}>👥</Text>
              </View>
              <View>
                <Text style={styles.modalTitle}>{t.selectProfileTitle}</Text>
                <Text style={styles.modalSubtitle}>{t.selectProfileSubtitle}</Text>
              </View>
            </View>

            <FlatList
              data={profiles}
              keyExtractor={(item) => item.farmer_id}
              contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.profileCard}
                  onPress={() => handleSelectProfile(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.profileCardHeader}>
                    <Text style={styles.profileCardName}>{item.name}</Text>
                    <View style={styles.profileCardAcresBadge}>
                      <Text style={styles.profileCardAcresText}>{item.farm_area_acres} Ac</Text>
                    </View>
                  </View>
                  <Text style={styles.profileCardMeta}>
                    PRN: {item.prn || 'N/A'} • Village: {item.village || 'Sangli'}
                  </Text>
                  <Text style={styles.profileSelectPrompt}>Select this profile ›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#00380b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  bgGlowTop: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  loginCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#00450d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 26,
  },
  foundationTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00450d',
    letterSpacing: 1.5,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  tagline: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 8,
    lineHeight: 16,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  authDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  authBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  inputContainer: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginBottom: 14,
    height: 54,
  },
  countryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  countryFlag: {
    fontSize: 16,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  loginButton: {
    backgroundColor: '#00450d',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00450d',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  presetsBox: {
    marginTop: 18,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  presetsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  presetChip: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  presetMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 12,
    marginBottom: 4,
  },
  modalHeaderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderIcon: {
    fontSize: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
  },
  profileCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  profileCardAcresBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  profileCardAcresText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  profileCardMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  profileSelectPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00450d',
    marginTop: 6,
  },
});
