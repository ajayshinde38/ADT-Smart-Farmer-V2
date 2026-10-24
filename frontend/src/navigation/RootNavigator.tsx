import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { FarmerProfile } from '../types';
import { DashboardScreen } from '../screens/DashboardScreen';
import { GISScreen } from '../screens/GISScreen';
import { WeatherScreen } from '../screens/WeatherScreen';
import { AdvisoryScreen } from '../screens/AdvisoryScreen';
import { PestDetectionScreen } from '../screens/PestDetectionScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

interface RootNavigatorProps {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onToggleLanguage: (lang: 'en' | 'mr') => void;
  onLogout: () => void;
}

export const RootNavigator: React.FC<RootNavigatorProps> = ({ farmer, language, onToggleLanguage, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gis' | 'weather' | 'advisory' | 'pest' | 'settings'>('dashboard');

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
      case 'settings':
        return <SettingsScreen farmer={farmer} language={language} onToggleLanguage={onToggleLanguage} onLogout={onLogout} />;
      default:
        return <DashboardScreen farmer={farmer} language={language} onNavigate={(tab) => setActiveTab(tab as any)} />;
    }
  };

  const tabs = [
    ['dashboard', '⌂', language === 'mr' ? 'मुख्यपृष्ठ' : 'Home'],
    ['gis', '▧', language === 'mr' ? 'शेत' : 'Farm'],
    ['weather', '☀', language === 'mr' ? 'हवामान' : 'Weather'],
    ['pest', '♧', language === 'mr' ? 'पीक काळजी' : 'Crop care'],
    ['advisory', '◉', language === 'mr' ? 'माती' : 'Soil'],
  ] as const;
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.topBar}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === 'mr' ? 'शेताची माहिती' : 'Farm details'} style={styles.profile} onPress={() => setActiveTab('settings')}>
        <View style={styles.avatar}><Text style={{fontSize:22}}>🌾</Text></View>
        <View style={{flex:1}}><Text style={styles.name} numberOfLines={1}>{farmer.name}</Text>
          <Text style={styles.location} numberOfLines={1}>{farmer.village || (language === 'mr' ? 'शेताची माहिती' : 'Farm details')} · {farmer.farm_area_acres ?? '—'} {language === 'mr' ? 'एकर' : 'acres'} ›</Text></View>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.language} onPress={() => onToggleLanguage(language === 'en' ? 'mr' : 'en')}>
        <Text style={styles.languageText}>{language === 'en' ? 'मराठी' : 'English'}</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.body}>{renderActiveScreen()}</View>
    <View style={styles.nav}>{tabs.map(([id, icon, label]) => <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{selected:activeTab===id}} onPress={() => setActiveTab(id)} style={[styles.tab,activeTab===id && styles.active]}>
      <Text style={[styles.icon,activeTab===id && styles.activeText]}>{icon}</Text><Text style={[styles.label,activeTab===id && styles.activeText]}>{label}</Text>
    </TouchableOpacity>)}</View>
  </SafeAreaView>;
};
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#fff'},topBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,gap:12,borderBottomWidth:1,borderColor:'#e5ece6'},profile:{flex:1,flexDirection:'row',gap:10,alignItems:'center',minHeight:44},avatar:{height:40,width:40,backgroundColor:'#eaf2e8',borderRadius:14,justifyContent:'center',alignItems:'center'},name:{fontSize:15,fontWeight:'700',color:'#213d2e'},location:{fontSize:11,color:'#687c6d',marginTop:3},language:{padding:10,borderRadius:12,backgroundColor:'#f1f5ee',minHeight:44,justifyContent:'center'},languageText:{fontSize:13,color:'#315c3e',fontWeight:'600'},body:{flex:1,backgroundColor:'#f7faf7'},nav:{flexDirection:'row',paddingHorizontal:6,paddingTop:6,paddingBottom:Platform.OS==='ios'?22:8,borderTopWidth:1,borderColor:'#e5ece6',backgroundColor:'#fff',gap:3},tab:{flex:1,alignItems:'center',justifyContent:'center',minHeight:52,borderRadius:12,gap:3},active:{backgroundColor:'#edf4ea'},icon:{fontSize:23,color:'#758277'},label:{fontSize:11,color:'#6b786d'},activeText:{color:'#205c38',fontWeight:'700'}});
