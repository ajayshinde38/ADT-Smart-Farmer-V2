import { FarmPage } from '../components/FarmPage';
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Switch,
  Linking,
  Alert,
} from 'react-native';
import { AppText as Text, Icon, Button, ui } from '../components/ui';
import { FarmerProfile, FieldContext } from '../types';
import { ApiClient } from '../services/apiClient';
import { shortDate, stageLabel } from '../utils/farmPresentation';
import { colors } from '../theme/colors';

interface Props {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onToggleLanguage: (value: 'en' | 'mr') => void;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<Props> = ({
  farmer,
  language,
  onToggleLanguage,
  onLogout,
}) => {
  const mr = language === 'mr';
  const [context, setContext] = useState<FieldContext | null>(null);
  const [revealContact, setRevealContact] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    setContext(null);
    if (farmer.farm_id) {
      ApiClient.getDashboard(farmer.farm_id)
        .then((value) => {
          if (active) setContext(value.field_context);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [farmer.farm_id]);

  const village = farmer.village || farmer.address || (mr ? 'सांगली, महाराष्ट्र' : 'Sangli, Maharashtra');
  const cropName = farmer.crop_name || (mr ? 'ऊस' : 'Sugarcane');
  const cropVariety = farmer.crop_variety || 'Co 86032';
  const farmArea = farmer.farm_area_acres != null ? `${farmer.farm_area_acres} ${mr ? 'एकर' : 'Acres'}` : (mr ? '१.८६ एकर' : '1.86 Acres');
  const soilType = context?.soil?.available ? (mr ? 'काळी सुपीक माती (चिकणमाती)' : 'Black Soil (Clay Loam)') : (mr ? 'मध्यम काळी माती' : 'Medium Black Soil');

  return (
    <FarmPage page="profile" style={styles.page} contentContainerStyle={styles.content}>
      {/* 1. Farmer Profile Header Card */}
      <View style={styles.profileHeaderCard}>
        <View style={styles.portraitWrap}>
          <Image
            source={require('../assets/farmer-illustration.png')}
            style={styles.portraitImg}
            resizeMode="cover"
          />
          <View style={styles.verifiedCheck}>
            <Icon name="check" size={13} color="#ffffff" />
          </View>
        </View>

        <Text style={styles.farmerName}>{farmer.name}</Text>
        <Text style={styles.memberSince}>
          {mr ? 'नोंदणीकृत सदस्य • ' : 'Registered Member • '}
          {village}
        </Text>
      </View>

      {/* 2. Personal Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Icon name="person" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {mr ? 'वैयक्तिक माहिती' : 'Personal Details'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setRevealContact((x) => !x)}
            activeOpacity={0.8}
          >
            <Text style={styles.editText}>
              {revealContact ? (mr ? 'लपवा' : 'Hide') : (mr ? 'पहा' : 'View')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{mr ? 'पूर्ण नाव' : 'Full Name'}</Text>
          <Text style={styles.fieldValue}>{farmer.name}</Text>
        </View>

        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>{mr ? 'मोबाईल क्रमांक' : 'Mobile Number'}</Text>
          <Text style={styles.fieldValue}>
            {revealContact
              ? `+91 ${farmer.mobile}`
              : `+91 ••••• •${farmer.mobile.slice(-4)}`}
          </Text>
        </View>

        {farmer.prn && (
          <View style={styles.fieldBox}>
            <Text style={styles.fieldLabel}>{mr ? 'नोंदणी क्रमांक (PRN)' : 'Registration PRN'}</Text>
            <Text style={styles.fieldValue}>{farmer.prn}</Text>
          </View>
        )}
      </View>

      {/* 3. Farm Details Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Icon name="agriculture" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>{mr ? 'शेताची माहिती' : 'Farm Details'}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{mr ? 'एकूण क्षेत्रफळ' : 'Total Land Area'}</Text>
          <Text style={styles.detailValueGreen}>{farmArea}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{mr ? 'मुख्य माती प्रकार' : 'Primary Soil'}</Text>
          <Text style={styles.detailValue}>{soilType}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{mr ? 'सिंचन पद्धत' : 'Irrigation Type'}</Text>
          <View style={styles.inlineValue}>
            <Icon name="water-drop" size={14} color="#059669" />
            <Text style={styles.detailValue}>
              {mr ? 'ठिबक सिंचन (स्वयंचलित)' : 'Drip System (Automated)'}
            </Text>
          </View>
        </View>

        <View style={styles.detailRowLast}>
          <Text style={styles.detailLabel}>{mr ? 'पाण्याचा स्रोत' : 'Water Source'}</Text>
          <Text style={styles.detailValue}>
            {mr ? 'बोअरवेल व कालवा जोडणी' : 'Borewell & Canal Connection'}
          </Text>
        </View>
      </View>

      {/* 4. Active Crops Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Icon name="eco" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>{mr ? 'सध्याची पिके' : 'Active Crops'}</Text>
          </View>
          <Text style={styles.seasonText}>
            {mr ? 'हंगाम: खरीप / रब्बी' : 'Season: Kharif / Rabi'}
          </Text>
        </View>

        <View style={styles.cropsList}>
          {/* Main Crop Pill */}
          <View style={styles.cropPill}>
            <View style={styles.cropPillIcon}>
              <Icon name="grass" size={18} color="#047857" />
            </View>
            <View>
              <Text style={styles.cropNameText}>{cropName}</Text>
              <Text style={styles.cropSubText}>{cropVariety} • {farmArea}</Text>
            </View>
          </View>

          {/* Secondary Rotation Crop Pill */}
          <View style={styles.cropPillSecondary}>
            <View style={styles.cropPillIconSec}>
              <Icon name="spa" size={18} color="#059669" />
            </View>
            <View>
              <Text style={styles.cropNameText}>{mr ? 'सोयाबीन' : 'Soybeans'}</Text>
              <Text style={styles.cropSubText}>JS 335 • 1.5 {mr ? 'एकर' : 'Acres'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 5. Settings & Preferences Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardHeaderLeft}>
            <Icon name="tune" size={20} color={colors.primary} />
            <Text style={styles.cardTitle}>
              {mr ? 'सेटिंग्ज व प्राधान्ये' : 'Settings & Preferences'}
            </Text>
          </View>
        </View>

        {/* Notifications Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleIconWrap}>
            <Icon name="notifications" size={19} color="#334155" />
          </View>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleTitle}>{mr ? 'सूचना (Notifications)' : 'Notifications'}</Text>
            <Text style={styles.toggleSub}>
              {mr ? 'हवामान इशारे व पीक तपासणी' : 'Weather alerts & pest diagnostics'}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={notificationsEnabled ? '#059669' : '#f8fafc'}
          />
        </View>

        {/* Dark Mode Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleIconWrap}>
            <Icon name="brightness-2" size={19} color="#334155" />
          </View>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleTitle}>{mr ? 'डार्क मोड (Dark Mode)' : 'Dark Mode'}</Text>
            <Text style={styles.toggleSub}>
              {mr ? 'तीव्र सूर्यप्रकाशात बॅटरी बचत' : 'Optimize battery in bright field sunlight'}
            </Text>
          </View>
          <Switch
            value={darkModeEnabled}
            onValueChange={setDarkModeEnabled}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={darkModeEnabled ? '#059669' : '#f8fafc'}
          />
        </View>

        {/* Language Selection Row */}
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.toggleRowLast}
          onPress={() => onToggleLanguage(language === 'en' ? 'mr' : 'en')}
          activeOpacity={0.8}
        >
          <View style={styles.toggleIconWrap}>
            <Icon name="language" size={19} color="#334155" />
          </View>
          <View style={styles.toggleTextWrap}>
            <Text style={styles.toggleTitle}>{mr ? 'अॅप भाषा' : 'Language Selection'}</Text>
            <Text style={styles.toggleSub}>
              {mr ? 'मराठी व इंग्रजी भाषांतर' : 'App & advisory language'}
            </Text>
          </View>
          <View style={styles.langPillBadge}>
            <Text style={styles.langPillText}>
              {language === 'mr' ? 'मराठी (Marathi)' : 'English'}
            </Text>
            <Icon name="chevron-right" size={16} color="#059669" />
          </View>
        </TouchableOpacity>
      </View>

      {/* 6. Help & Support Links */}
      <View style={styles.card}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.linkRow}
          onPress={() => Alert.alert('Kisan Support', 'Toll-Free Kisan Call Center: 1800-180-1551\nADT Field Officer: +91 2112 255518')}
          activeOpacity={0.8}
        >
          <Icon name="contact-support" size={20} color="#475569" />
          <Text style={styles.linkRowText}>
            {mr ? 'मदत केंद्र व किसान हेल्पलाइन' : 'Help Center & Kisan Toll-Free Support'}
          </Text>
          <Icon name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.linkRow}
          onPress={() => Alert.alert('Privacy & Data Rights', 'All farmer data is strictly stored in accordance with agricultural data governance standards.')}
          activeOpacity={0.8}
        >
          <Icon name="security" size={20} color="#475569" />
          <Text style={styles.linkRowText}>
            {mr ? 'गोपनीयता धोरण व डेटा हक्क' : 'Privacy Policy & Data Rights'}
          </Text>
          <Icon name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.linkRowLast}
          onPress={() => Alert.alert('Terms of Service', 'AI-ADT Smart Farmer V2 Platform Services Agreement.')}
          activeOpacity={0.8}
        >
          <Icon name="description" size={20} color="#475569" />
          <Text style={styles.linkRowText}>
            {mr ? 'सेवा अटी व नियम' : 'Terms of Service & Governance'}
          </Text>
          <Icon name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* 7. Sign Out Button */}
      <Button
        title={mr ? 'बाहेर पडा' : 'Sign Out'}
        secondary
        icon="logout"
        onPress={onLogout}
      />
    </FarmPage>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f7faf7',
  },
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  profileHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 6,
  },
  portraitWrap: {
    position: 'relative',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  portraitImg: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  verifiedCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  farmerName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  memberSince: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondary,
  },
  fieldBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 9,
  },
  detailLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailValueGreen: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  inlineValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seasonText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  cropsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  cropPill: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#bbf7d0',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  cropPillSecondary: {
    flex: 1,
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  cropPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropPillIconSec: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064e3b',
  },
  cropSubText: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
    marginTop: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  toggleRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  toggleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  toggleSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  langPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: '#bbf7d0',
  },
  langPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  linkRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  linkRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 10,
  },
});
