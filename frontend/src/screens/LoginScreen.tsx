import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text, Icon, Button, Card, ui } from '../components/ui';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile } from '../types';
import { colors } from '../theme/colors';

interface Props {
  language: 'en' | 'mr';
  onLoginSuccess: (farmer: FarmerProfile, token: string) => void;
  onToggleLanguage?: (language: 'en' | 'mr') => void;
  onAdmin?: () => void;
}

export const LoginScreen: React.FC<Props> = ({
  language,
  onLoginSuccess,
  onToggleLanguage,
  onAdmin,
}) => {
  const mr = language === 'mr';
  const [phone, setPhone] = useState('');
  const [otp, setOTP] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'profiles'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [profiles, setProfiles] = useState<FarmerProfile[]>([]);
  const [selectionToken, setSelectionToken] = useState('');

  const accept = (result: any) => {
    if (result.is_multi_profile) {
      setProfiles(result.profiles);
      setSelectionToken(result.access_token);
      setStep('profiles');
    } else if (result.selected_farmer && result.access_token) {
      ApiClient.setToken(result.access_token);
      onLoginSuccess(result.selected_farmer, result.access_token);
    } else {
      throw new Error(mr ? 'प्रवेश झाला नाही. पुन्हा प्रयत्न करा.' : 'Unable to sign in. Please try again.');
    }
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (step === 'phone') {
        const response = await ApiClient.sendOTP(phone);
        setHint(response.dev_hint || '');
        setStep('otp');
      } else {
        accept(await ApiClient.verifyOTP(phone, otp));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  const select = async (profile: FarmerProfile) => {
    setBusy(true);
    setError('');
    try {
      accept(await ApiClient.selectProfile(phone, profile.farmer_id, selectionToken));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to select profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Header */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandIconBox}>
            <Icon name="eco" size={22} color="#ffffff" />
          </View>
          <View>
            <Text style={styles.brandTitle}>AI-ADT</Text>
            <Text style={styles.brandSub}>Smart Farmer V2</Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onToggleLanguage?.(mr ? 'en' : 'mr')}
          style={styles.langPill}
          activeOpacity={0.8}
        >
          <Icon name="translate" size={16} color={colors.secondary} />
          <Text style={styles.langText}>{mr ? 'English' : 'मराठी'}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Graphic Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroHeading}>
            {mr ? 'तुमच्या शेताचा हुशार साथीदार' : 'Your Farm. A Smarter Tomorrow.'}
          </Text>
          <Text style={styles.heroBody}>
            {mr
              ? 'हवामान, उपग्रह निरीक्षण आणि पीक काळजी एकाच ठिकाणी.'
              : 'Precision microclimate, satellite indices, and crop advisory in one place.'}
          </Text>
        </View>
        <Image
          source={require('../assets/farmer-illustration.png')}
          style={styles.farmerImg}
          resizeMode="contain"
        />
      </View>

      {/* Login Interaction Card */}
      <View style={styles.authCard}>
        <Text style={styles.authTitle}>
          {step === 'profiles'
            ? mr
              ? 'तुमची ओळख निवडा'
              : 'Choose Your Profile'
            : mr
            ? 'नमस्कार, शेतकरी मित्रा'
            : 'Welcome, Farmer'}
        </Text>
        <Text style={styles.authSubtitle}>
          {step === 'profiles'
            ? mr
              ? 'एकाच मोबाईल क्रमांकावरील कुटुंबातील स्वतंत्र नोंदी.'
              : 'Separate records for each member of your household.'
            : mr
            ? 'तुमच्या नोंदणीकृत मोबाईल क्रमांकाने सुरक्षित प्रवेश करा.'
            : 'Sign in securely with your registered 10-digit mobile number.'}
        </Text>

        {step === 'profiles' ? (
          <View style={styles.profilesList}>
            {profiles.map((profile) => (
              <TouchableOpacity
                accessibilityRole="button"
                key={profile.farmer_id}
                disabled={busy}
                onPress={() => void select(profile)}
                style={styles.profileRow}
                activeOpacity={0.8}
              >
                <View style={styles.profileAvatar}>
                  <Icon name="person" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileName}>{profile.name}</Text>
                  <Text style={styles.profileMeta}>
                    {profile.farm_area_acres ?? '—'} {mr ? 'एकर' : 'acres'} • {profile.village || '—'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.formWrap}>
            <Text style={styles.inputLabel}>{mr ? 'मोबाईल क्रमांक' : 'Mobile Number'}</Text>
            <View style={styles.phoneInputWrap}>
              <View style={styles.phonePrefixBox}>
                <Text style={styles.phonePrefixText}>+91</Text>
              </View>
              <TextInput
                accessibilityLabel={mr ? 'मोबाईल क्रमांक' : 'Mobile number'}
                value={phone}
                onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
                maxLength={10}
                keyboardType="phone-pad"
                editable={step === 'phone'}
                placeholder="98765 43210"
                placeholderTextColor="#94a3b8"
                style={styles.phoneTextInput}
              />
            </View>

            {step === 'otp' && (
              <View style={styles.otpSection}>
                <Text style={styles.inputLabel}>
                  {mr ? '६-अंकी पडताळणी कोड' : '6-digit Verification Code'}
                </Text>
                <TextInput
                  accessibilityLabel="Verification code"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={setOTP}
                  style={styles.otpInput}
                  placeholder="123456"
                  placeholderTextColor="#94a3b8"
                />
                {!!hint && (
                  <View style={styles.hintBox}>
                    <Icon name="info-outline" size={16} color="#b45309" />
                    <Text style={styles.hintText}>{hint}</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.submitBtn,
                (busy || phone.length !== 10 || (step === 'otp' && otp.length !== 6)) &&
                  styles.submitBtnDisabled,
              ]}
              disabled={busy || phone.length !== 10 || (step === 'otp' && otp.length !== 6)}
              onPress={() => void submit()}
              activeOpacity={0.88}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>
                    {step === 'phone'
                      ? mr
                        ? 'पडताळणी कोड मिळवा'
                        : 'Get Verification Code'
                      : mr
                      ? 'प्रवेश करा'
                      : 'Verify & Sign In'}
                  </Text>
                  <Icon name="arrow-forward" size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBanner}>
            <Icon name="error-outline" size={17} color="#b91c1c" />
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        {step !== 'phone' && (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.backBtn}
            onPress={() => {
              setStep('phone');
              setOTP('');
              setProfiles([]);
              setSelectionToken('');
              setError('');
            }}
          >
            <Text style={styles.backBtnText}>
              {mr ? 'वेगळा मोबाईल क्रमांक वापरा' : 'Use a different phone number'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer Branding */}
      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>
          {mr
            ? 'AI-ADT फाउंडेशन • कृषी अचूकता आणि समृद्धी'
            : 'AI-ADT Foundation • Precision Agricultural Intelligence'}
        </Text>
        {onAdmin && (
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.adminLink}
            onPress={onAdmin}
          >
            <Text style={styles.adminLinkText}>
              {mr ? 'प्रशासक लॉगिन (Admin Portal) →' : 'Administrator Sign In →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f7faf7',
  },
  content: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroTextWrap: {
    flex: 1,
    gap: 6,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 28,
  },
  heroBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  farmerImg: {
    width: 90,
    height: 110,
    opacity: 0.9,
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  authSubtitle: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  formWrap: {
    gap: 12,
    marginTop: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
  },
  phonePrefixBox: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  phonePrefixText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  phoneTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  otpSection: {
    gap: 6,
  },
  otpInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#0f172a',
    textAlign: 'center',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  hintText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 10,
  },
  errorMsg: {
    fontSize: 12,
    color: '#b91c1c',
    flex: 1,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  profilesList: {
    gap: 8,
    marginTop: 6,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  profileMeta: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  footerWrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  adminLink: {
    paddingVertical: 4,
  },
  adminLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
});
