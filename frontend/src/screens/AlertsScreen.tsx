import { FarmPage } from '../components/FarmPage';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  TouchableOpacity,
  View,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { AppText as Text, Icon, Loading, Empty, ui } from '../components/ui';
import { FarmerProfile, DashboardData } from '../types';
import { ApiClient } from '../services/apiClient';
import { colors } from '../theme/colors';

interface Props {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onNavigate: (page: string) => void;
}

export const AlertsScreen: React.FC<Props> = ({ farmer, language, onNavigate }) => {
  const mr = language === 'mr';
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'advisory' | 'tasks'>('all');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setBusy(true);
    if (farmer.farm_id) {
      ApiClient.getDashboard(farmer.farm_id)
        .then((value) => {
          if (active) setData(value);
        })
        .catch((reason) => {
          if (active) setError(reason.message);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    } else {
      setBusy(false);
    }
    return () => {
      active = false;
    };
  }, [farmer.farm_id, retry]);

  if (busy) return <Loading />;
  if (!data)
    return (
      <Empty
        title={mr ? 'सूचना उपलब्ध नाहीत' : 'Alerts unavailable'}
        note={error}
        onRetry={() => setRetry((x) => x + 1)}
      />
    );

  const filterTabs = [
    { key: 'all', label: mr ? 'सर्व' : 'All' },
    { key: 'critical', label: mr ? 'महत्त्वाचे' : 'Critical' },
    { key: 'advisory', label: mr ? 'सल्ला' : 'Advisory' },
    { key: 'tasks', label: mr ? 'कामे' : 'Tasks' },
  ] as const;

  return (
    <FarmPage page="alerts" style={styles.page} contentContainerStyle={styles.content}>
      {/* Category Pills Row */}
      <View style={styles.filterRow}>
        {filterTabs.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setFilter(tab.key)}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 1. Critical / Heat Wave Alert Card */}
      {(filter === 'all' || filter === 'critical') && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onNavigate('weather')}
          style={[styles.alertCard, styles.alertCardCritical]}
          activeOpacity={0.88}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircleRed}>
              <Icon name="warning" size={20} color="#b91c1c" />
            </View>
            <View style={styles.cardTitleWrap}>
              <View style={styles.titleTimestampRow}>
                <Text style={styles.alertTitle}>
                  {mr ? 'उष्णतेच्या लाटेचा इशारा' : 'Heat Wave Warning'}
                </Text>
                <Text style={styles.timestampText}>
                  {mr ? '२ तासांपूर्वी' : '2h ago'}
                </Text>
              </View>
              <Text style={styles.alertDesc}>
                {mr
                  ? 'तापमान ४०°C पेक्षा जास्त राहण्याची शक्यता. पिकाला वेळेवर पाणी द्या आणि ओलावा टिकवून ठेवा.'
                  : 'Temperatures expected to reach 40°C+. Ensure high frequency irrigation cycles.'}
              </Text>
              <View style={styles.urgencyPillRed}>
                <Text style={styles.urgencyTextRed}>
                  {mr ? 'अत्यंत महत्त्वाचे' : 'High Urgency'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* 2. Pest Alert Card */}
      {(filter === 'all' || filter === 'critical' || filter === 'advisory') && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onNavigate('pest')}
          style={[styles.alertCard, styles.alertCardAmber]}
          activeOpacity={0.88}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircleAmber}>
              <Icon name="bug-report" size={20} color="#d97706" />
            </View>
            <View style={styles.cardTitleWrap}>
              <View style={styles.titleTimestampRow}>
                <Text style={styles.alertTitle}>
                  {mr ? 'किडीचा इशारा (Pest Alert)' : 'Pest Alert'}
                </Text>
                <Text style={styles.timestampText}>
                  {mr ? '५ तासांपूर्वी' : '5h ago'}
                </Text>
              </View>
              <Text style={styles.alertDesc}>
                {mr
                  ? 'परिसरातील शेतांमध्ये खोडकीड / तांबेरा लक्षणे आढळली. पिकाची तपासणी करा.'
                  : 'Fall Armyworm / Borer activity reported in nearby plots. Preventive inspection recommended.'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* 3. Fertilizer Timing Card */}
      {(filter === 'all' || filter === 'advisory' || filter === 'tasks') && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onNavigate('advisory')}
          style={[styles.alertCard, styles.alertCardGreen]}
          activeOpacity={0.88}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircleGreen}>
              <Icon name="agriculture" size={20} color="#059669" />
            </View>
            <View style={styles.cardTitleWrap}>
              <View style={styles.titleTimestampRow}>
                <Text style={styles.alertTitle}>
                  {mr ? 'खत देण्याची योग्य वेळ' : 'Ideal time for Fertilizer'}
                </Text>
                <Text style={styles.timestampText}>
                  {mr ? 'काल' : 'Yesterday'}
                </Text>
              </View>
              <Text style={styles.alertDesc}>
                {mr
                  ? 'पिकाच्या वाढीच्या अवस्थेनुसार NPK 10:26:26 खताची मात्रा देण्याची शिफारस आहे.'
                  : 'Based on your crop cycle for Sugarcane, apply NPK mix today for optimal yield.'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* 4. Farm Insights Banner */}
      {filter === 'all' && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onNavigate('gis')}
          style={styles.insightsBanner}
          activeOpacity={0.9}
        >
          <View style={styles.insightsContent}>
            <Text style={styles.insightsTitle}>
              {mr ? 'शेताचे साप्ताहिक विश्लेषण' : 'Farm Insights'}
            </Text>
            <Text style={styles.insightsSub}>
              {mr ? 'साप्ताहिक उपग्रह वाढ अहवाल पाहा' : 'View weekly growth report & NDVI'}
            </Text>
          </View>
          <Icon name="arrow-forward" size={20} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* 5. Irrigation Completed Card */}
      {(filter === 'all' || filter === 'tasks') && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => onNavigate('advisory')}
          style={[styles.alertCard, styles.alertCardGreen]}
          activeOpacity={0.88}
        >
          <View style={styles.cardHeader}>
            <View style={styles.iconCircleEmerald}>
              <Icon name="check-circle" size={20} color="#059669" />
            </View>
            <View style={styles.cardTitleWrap}>
              <View style={styles.titleTimestampRow}>
                <Text style={styles.alertTitle}>
                  {mr ? 'सिंचन पूर्ण झाले' : 'Irrigation Completed'}
                </Text>
                <Text style={styles.timestampText}>
                  {mr ? '३ दिवसांपूर्वी' : '3 days ago'}
                </Text>
              </View>
              <Text style={styles.alertDesc}>
                {mr
                  ? 'प्लॉट अ मध्ये १५,००० लिटर पाणी दिले. ओलावा पातळी समाधानकारक आहे.'
                  : '15,000 Liters applied to Plot A. Canopy moisture index indicates optimal levels.'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
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
    gap: 12,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: '#4ade80',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  filterTextActive: {
    color: '#064e3b',
    fontWeight: '800',
  },
  alertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  alertCardCritical: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  alertCardAmber: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  alertCardGreen: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconCircleRed: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleAmber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleGreen: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleEmerald: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  titleTimestampRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  timestampText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginLeft: 6,
  },
  alertDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  urgencyPillRed: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginTop: 4,
  },
  urgencyTextRed: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b91c1c',
  },
  insightsBanner: {
    backgroundColor: '#15803d',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  insightsContent: {
    gap: 2,
  },
  insightsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  insightsSub: {
    fontSize: 12,
    color: '#bbf7d0',
    fontWeight: '500',
  },
});
