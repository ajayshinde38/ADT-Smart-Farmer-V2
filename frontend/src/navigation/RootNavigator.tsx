import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { AppText as Text, Icon } from '../components/ui';
import { MotionIcon } from '../components/MotionIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertsScreen } from '../screens/AlertsScreen';
import { FarmerProfile } from '../types';
import { DashboardScreen } from '../screens/DashboardScreen';
import { GISScreen } from '../screens/GISScreen';
import { WeatherScreen } from '../screens/WeatherScreen';
import { AdvisoryScreen } from '../screens/AdvisoryScreen';
import { PestDetectionScreen } from '../screens/PestDetectionScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../theme/colors';

interface RootNavigatorProps {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onToggleLanguage: (lang: 'en' | 'mr') => void;
  onLogout: () => void;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({ farmer, language, onToggleLanguage, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gis' | 'weather' | 'advisory' | 'pest' | 'settings' | 'alerts'>('dashboard');
  const insets = useSafeAreaInsets();
  const mr = language === 'mr';

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen farmer={farmer} language={language} onNavigate={(tab) => setActiveTab(tab as any)} />;
      case 'gis':
        return <GISScreen farmer={farmer} language={language} />;
      case 'weather':
        return <WeatherScreen farmer={farmer} language={language} onScan={() => setActiveTab('pest')} />;
      case 'advisory':
        return <AdvisoryScreen farmer={farmer} language={language} />;
      case 'pest':
        return <PestDetectionScreen farmer={farmer} language={language} onWeather={() => setActiveTab('weather')} />;
      case 'alerts':
        return <AlertsScreen farmer={farmer} language={language} onNavigate={(page) => setActiveTab(page as any)} />;
      case 'settings':
        return <SettingsScreen farmer={farmer} language={language} onToggleLanguage={onToggleLanguage} onLogout={onLogout} />;
      default:
        return <DashboardScreen farmer={farmer} language={language} onNavigate={(tab) => setActiveTab(tab as any)} />;
    }
  };

  const tabs = [
    ['dashboard', 'home', mr ? 'मुख्यपृष्ठ' : 'Dashboard'],
    ['advisory', 'psychology', mr ? 'सल्ला' : 'Advisory'],
    ['pest', 'qr-code-scanner', mr ? 'पीक तपासणी' : 'AI Scan'],
    ['weather', 'wb-sunny', mr ? 'हवामान' : 'Weather'],
    ['gis', 'satellite', mr ? 'शेत नकाशा' : 'GIS Maps'],
  ] as const;

  return (
    <View style={styles.safeArea}>
      {/* Stitch Agri-Tech Top App Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={mr ? 'शेताची माहिती' : 'Farm details'}
          onPress={() => setActiveTab('settings')}
          style={styles.profile}
          activeOpacity={0.8}
        >
          <View style={styles.avatarWrap}>
            <Image
              source={require('../assets/farmer-illustration.png')}
              style={styles.avatarImg}
              resizeMode="cover"
            />
          </View>
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{farmer.name}</Text>
            </View>
            <View style={styles.locationRow}>
              <Icon name="location-on" size={13} color={colors.primary} />
              <Text style={styles.location} numberOfLines={1}>
                {farmer.village || farmer.address || (mr ? 'महाराष्ट्र' : 'Maharashtra')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.topActions}>
          {/* Language Selector Pill */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={mr ? 'इंग्रजी निवडा' : 'Switch to Marathi'}
            style={styles.languagePill}
            onPress={() => onToggleLanguage(language === 'en' ? 'mr' : 'en')}
            activeOpacity={0.8}
          >
            <Icon name="translate" size={16} color={colors.secondary} />
            <Text style={styles.languageText}>{language === 'en' ? 'मराठी' : 'English'}</Text>
          </TouchableOpacity>

          {/* Notification Bell with Badge */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={mr ? 'शेत सूचना' : 'Field alerts'}
            style={styles.bellBtn}
            onPress={() => setActiveTab('alerts')}
            activeOpacity={0.8}
          >
            <Icon name="notifications" size={23} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Screen Body */}
      <View style={styles.body}>{renderActiveScreen()}</View>

      {/* Stitch 5-Tab Modern Bottom Navigation */}
      <View style={[styles.nav, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {tabs.map(([id, icon, label]) => {
          const isActive = activeTab === id;
          if (id === 'pest') {
            return (
              <TouchableOpacity
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={id}
                onPress={() => setActiveTab(id)}
                style={styles.scanTab}
                activeOpacity={0.85}
              >
                <MotionIcon active={isActive} style={styles.scanBtn}>
                  <Icon name="qr-code-scanner" color="#ffffff" size={26} />
                </MotionIcon>
                <Text style={[styles.tabLabel, styles.scanLabel]}>{label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              key={id}
              onPress={() => setActiveTab(id)}
              style={styles.tab}
              activeOpacity={0.8}
            >
              <MotionIcon active={isActive} style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Icon
                  name={icon as any}
                  color={isActive ? colors.primary : '#64748b'}
                  size={21}
                />
              </MotionIcon>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f2',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    zIndex: 50,
  },
  profile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  avatarWrap: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nameBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: 160,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  location: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    flex: 1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8e2',
  },
  languageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  bellBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f8faf8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: '#f7faf7',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#eef2ee',
    paddingTop: 6,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    gap: 3,
  },
  iconWrap: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#dcfce7',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#00450d',
    fontWeight: '700',
  },
  scanTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    gap: 3,
  },
  scanBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#00450d',
    borderWidth: 3,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00450d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
  scanLabel: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
