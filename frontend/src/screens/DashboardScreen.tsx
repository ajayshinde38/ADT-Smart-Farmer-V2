import { FarmPage } from '../components/FarmPage';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Svg, { Path, Rect, Line, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AppText as Text, Icon, Card, Badge, Empty, Loading, ui, amount } from '../components/ui';
import { ApiClient } from '../services/apiClient';
import { DashboardData, FarmerProfile } from '../types';
import { freshWeather, conditionLabel, shortDate } from '../utils/farmPresentation';
import { colors } from '../theme/colors';


interface Props {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onNavigate: (tab: string) => void;
}

export const DashboardScreen: React.FC<Props> = ({ farmer, language, onNavigate }) => {
  const mr = language === 'mr';
  const generation = useRef(0);
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    if (!farmer.farm_id) {
      setBusy(false);
      return;
    }
    const request = ++generation.current;
    try {
      const result = await ApiClient.getDashboard(farmer.farm_id);
      if (request === generation.current) {
        setData(result);
        setNow(Date.now());
        setError('');
      }
    } catch (reason) {
      if (request === generation.current) {
        setError(reason instanceof Error ? reason.message : 'Unable to load your farm');
      }
    } finally {
      if (request === generation.current) {
        setBusy(false);
        setRefreshing(false);
      }
    }
  };

useEffect(() => {
    setData(null);
    setBusy(true);
    void load();
    return () => {
      generation.current++;
    };
  }, [farmer.farm_id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (busy) return <Loading />;
  if (!data)
    return (
      <Empty
        title={mr ? 'माहिती मिळाली नाही' : 'Farm information unavailable'}
        note={error}
        onRetry={() => void load()}
      />
    );

  const weather = data.weather;
  const indices = data.gis?.indices;
  const hasObservation = !!indices?.capture_date;
  const measured = (value: unknown): value is number =>
    hasObservation && typeof value === 'number' && Number.isFinite(value);

  const ndviVal = measured(indices?.ndvi) ? indices.ndvi : null;
  const ndwiVal = measured(indices?.ndwi) ? indices.ndwi : null;
  const ndreVal = measured(indices?.ndre) ? indices.ndre : null;

  const currentVpd = typeof weather?.current_vpd_kpa === 'number' ? weather.current_vpd_kpa : null;
  const currentTemp = typeof weather?.current_temp_c === 'number' ? Math.round(weather.current_temp_c) : null;
  const windSpeed = typeof weather?.current_wind_speed_kmh === 'number' ? Math.round(weather.current_wind_speed_kmh) : null;
  const rainChance = weather?.forecast_7_day?.[0]?.precipitation_probability != null
    ? Math.round(weather.forecast_7_day[0].precipitation_probability)
    : null;

  const villageName = farmer.village || farmer.address || (mr ? 'ठिकाण नोंदलेले नाही' : 'Location not recorded');

  return (
    <FarmPage page="home"
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      {!!error && (
        <View style={styles.errorBox}>
          <Icon name="error-outline" size={18} color="#b91c1c" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Bento 2x2 Grid matching Stitch Home Dashboard */}
      <View style={styles.bentoGrid}>
        {/* Box 1: Weather Telemetry */}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.88}
          onPress={() => onNavigate('weather')}
          style={[styles.bentoTile, styles.weatherTile]}
        >
          <View style={styles.tileHeader}>
            <View style={styles.sunBox}>
              <Icon name="wb-sunny" color="#d97706" size={20} />
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{freshWeather(weather, now) ? (mr ? 'अद्ययावत' : 'Updated') : (mr ? 'तपासा' : 'Check')}</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.tempRow}>
              <Text style={styles.tempVal}>{currentTemp == null ? '—' : `${currentTemp}°C`}</Text>
              <Text style={styles.tempLocation} numberOfLines={1}>{villageName.split(',')[0]}</Text>
            </View>
            <Text style={styles.weatherCondition} numberOfLines={1}>
              {weather ? conditionLabel(weather.current_condition, language) : (mr ? 'हवामान उपलब्ध नाही' : 'Weather unavailable')}
            </Text>
          </View>

          <View style={styles.tileDivider} />
          <View style={styles.weatherBottom}>
            <View style={styles.statInline}>
              <Icon name="water-drop" size={13} color="#0284c7" />
              <Text style={styles.statSmall}>{rainChance == null ? '—' : `${rainChance}%`} {mr ? 'पाऊस' : 'Rain'}</Text>
            </View>
            <View style={styles.statInline}>
              <Icon name="air" size={13} color="#64748b" />
              <Text style={styles.statSmall}>{windSpeed == null ? '—' : `${windSpeed} km/h`}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Box 2: NDVI (Vegetation Index) — Signature Dark Green Gradient Card */}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.88}
          onPress={() => onNavigate('gis')}
          style={[styles.bentoTile, styles.ndviTile]}
        >
          <View style={styles.tileHeader}>
            <View style={styles.ndviIconBox}>
              <Icon name="eco" color="#6ee7b7" size={18} />
            </View>
            <View style={styles.trendPill}>
              <Text style={styles.trendText}>{shortDate(indices?.capture_date, language)}</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.valRow}>
              <Text style={styles.ndviValText}>{amount(ndviVal, 2)}</Text>
              <Text style={styles.ndviValUnit}>NDVI</Text>
            </View>
            <Text style={styles.ndviSubtitle} numberOfLines={1}>
              {ndviVal == null ? (mr ? 'उपग्रह नोंद नाही' : 'No observation yet') : (mr ? 'पिकाचा हिरवेपणा' : 'Crop greenness')}
            </Text>
          </View>

          <View style={styles.ndviBarTrack}>
            <View
              style={[
                styles.ndviBarFill,
                { width: `${Math.max(0, Math.min(100, (ndviVal ?? 0) * 100))}%` },
              ]}
            />
          </View>

          <View style={styles.ndviFooterRow}>
            <View style={styles.statInline}>
              <View style={styles.optimalDot} />
              <Text style={styles.optimalText}>{mr ? 'नोंदवलेले सरासरी मूल्य' : 'Recorded average'}</Text>
            </View>
            <Text style={styles.sourceText}>{shortDate(indices?.capture_date, language)}</Text>
          </View>
        </TouchableOpacity>

        {/* Box 3: NDWI (Canopy Moisture) */}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.88}
          onPress={() => onNavigate('gis')}
          style={[styles.bentoTile, styles.whiteTile]}
        >
          <View style={styles.tileHeader}>
            <View style={styles.softMintBox}>
              <Icon name="water-drop" color="#059669" size={18} />
            </View>
            <View style={styles.adequatePill}>
              <View style={styles.adequateDot} />
              <Text style={styles.adequateText}>{shortDate(indices?.capture_date, language)}</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.valRow}>
              <Text style={styles.metricValText}>{amount(ndwiVal, 2)}</Text>
              <Text style={styles.metricUnitText}>NDWI</Text>
            </View>
            <Text style={styles.metricSubtitle} numberOfLines={1}>
              {mr ? 'पिकातील ओलावा' : 'Canopy Moisture'}
            </Text>
          </View>

          <View style={styles.grayBarTrack}>
            <View
              style={[
                styles.tealBarFill,
                { width: `${Math.max(0, Math.min(100, (ndwiVal ?? 0) * 100))}%` },
              ]}
            />
          </View>

          <View style={styles.tileFooterRow}>
            <Text style={styles.subtextSmall}>{mr ? 'मातीचे मोजमाप नाही' : 'Not soil moisture'}</Text>
            <Text style={styles.targetGreen}>{ndwiVal == null ? '—' : 'NDWI'}</Text>
          </View>
        </TouchableOpacity>

        {/* Box 4: NDRE (Chlorophyll & Nitrogen) */}
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.88}
          onPress={() => onNavigate('gis')}
          style={[styles.bentoTile, styles.whiteTile]}
        >
          <View style={styles.tileHeader}>
            <View style={styles.softMintBox}>
              <Icon name="spa" color={colors.primary} size={18} />
            </View>
            <View style={styles.adequatePill}>
              <View style={styles.adequateDot} />
              <Text style={styles.adequateText}>{shortDate(indices?.capture_date, language)}</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.valRow}>
              <Text style={styles.metricValText}>{amount(ndreVal, 2)}</Text>
              <Text style={styles.metricUnitText}>NDRE</Text>
            </View>
            <Text style={styles.metricSubtitle} numberOfLines={1}>
              {mr ? 'पानांचा हिरवेपणा' : 'Leaf greenness'}
            </Text>
          </View>

          <View style={styles.grayBarTrack}>
            <View
              style={[
                styles.limeBarFill,
                { width: `${Math.max(0, Math.min(100, (ndreVal ?? 0) * 100))}%` },
              ]}
            />
          </View>

          <View style={styles.tileFooterRow}>
            <Text style={styles.subtextSmall}>{mr ? 'नत्राची थेट चाचणी नाही' : 'Not a nitrogen test'}</Text>
            <Text style={styles.targetGreen}>{ndreVal == null ? '—' : 'NDRE'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Today's Application Update Card */}
      <View style={styles.appUpdateCard}>
        <View style={styles.appUpdateHeader}>
          <View style={styles.appUpdateTitleRow}>
            <View style={styles.checkIconBox}>
              <Icon name="check" size={17} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.appUpdateTitle}>
                {mr ? 'आजचे शेत नियोजन' : 'Today’s Field Planning'}
              </Text>
              <Text style={styles.appUpdateSub}>
                {mr ? 'नोंदवलेल्या शेत माहितीनुसार' : 'Based on available farm records'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => onNavigate('advisory')}
            style={styles.detailsBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.detailsBtnText}>{mr ? 'तपशील' : 'Details'}</Text>
            <Icon name="chevron-right" size={16} color={colors.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.appUpdateList}>
          {/* Item 1: Drip Irrigation */}
          <View style={styles.appUpdateItem}>
            <View style={styles.appUpdateItemLeft}>
              <View style={styles.itemIconCircle}>
                <Icon name="water-drop" size={18} color="#059669" />
              </View>
              <View>
                <Text style={styles.itemTitle}>{mr ? 'सिंचनाचा अंदाज' : 'Irrigation estimate'}</Text>
                <Text style={styles.itemSub}>
                  {weather?.irrigation ? `${amount(weather.irrigation.net_irrigation_mm_day)} mm/${mr ? 'दिवस' : 'day'}` : (mr ? 'हवामान तपासा' : 'Check weather')}
                </Text>
              </View>
            </View>
            <View style={styles.appliedPill}>
              <View style={styles.appliedDot} />
              <Text style={styles.appliedText}>{mr ? 'अंदाज' : 'Estimate'}</Text>
            </View>
          </View>

          {/* Item 2: Fertilizer */}
          <View style={styles.appUpdateItem}>
            <View style={styles.appUpdateItemLeft}>
              <View style={styles.itemIconCircleAmber}>
                <Icon name="science" size={18} color="#d97706" />
              </View>
              <View>
                <Text style={styles.itemTitle}>
                  {mr ? 'माती व पोषण नियोजन' : 'Soil & nutrient planning'}
                </Text>
                <Text style={styles.itemSub}>
                  {mr ? 'माती अहवाल व गृहीतके तपासा' : 'Review soil records and assumptions'}
                </Text>
              </View>
            </View>
            <View style={styles.scheduledPill}>
              <View style={styles.scheduledDot} />
              <Text style={styles.scheduledText}>{mr ? 'पुनरावलोकन' : 'Review'}</Text>
            </View>
          </View>
        </View>
      </View>

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
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  errorText: {
    color: '#991b1b',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  bentoTile: {
    minHeight: 174,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 145,
    borderRadius: 18,
    padding: 12,
    justifyContent: 'space-between',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  weatherTile: {
    backgroundColor: '#fffdf6',
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  ndviTile: {
    backgroundColor: '#00380b',
    borderWidth: 1,
    borderColor: '#064e3b',
  },
  whiteTile: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sunBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 0.8,
    borderColor: '#fde68a',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
  },
  tileMain: {
    marginTop: 8,
    gap: 2,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  tempVal: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  tempLocation: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
    maxWidth: 70,
  },
  weatherCondition: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tileDivider: {
    height: 1,
    backgroundColor: '#fef08a',
    marginVertical: 6,
  },
  weatherBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statSmall: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  ndviIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendPill: {
    backgroundColor: 'rgba(2, 44, 14, 0.6)',
    borderWidth: 0.8,
    borderColor: '#047857',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6ee7b7',
  },
  valRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  ndviValText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  ndviValUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6ee7b7',
    letterSpacing: 0.5,
  },
  ndviSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a7f3d0',
  },
  ndviBarTrack: {
    height: 5,
    backgroundColor: 'rgba(2, 44, 14, 0.8)',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#047857',
    marginTop: 6,
  },
  ndviBarFill: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 3,
  },
  ndviFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  optimalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  optimalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6ee7b7',
  },
  sourceText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#a7f3d0',
  },
  softMintBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adequatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderWidth: 0.8,
    borderColor: '#86efac',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  adequateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  adequateText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  metricValText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  metricUnitText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    letterSpacing: 0.5,
  },
  metricSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  grayBarTrack: {
    height: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  tealBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  limeBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  tileFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  subtextSmall: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  targetGreen: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '700',
  },
  appUpdateCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 18,
    padding: 14,
    gap: 10,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  appUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  appUpdateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appUpdateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  appUpdateSub: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '600',
    marginTop: 1,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  appUpdateList: {
    gap: 8,
  },
  appUpdateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.85)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  appUpdateItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  itemIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconCircleAmber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  itemSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  appliedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderWidth: 0.8,
    borderColor: '#86efac',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  appliedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10b981',
  },
  appliedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  scheduledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 0.8,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  scheduledDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#f59e0b',
  },
  scheduledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  vpdCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  vpdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  vpdTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  speedIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vpdTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  optimalBadgeSmall: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  optimalBadgeSmallText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803d',
  },
  vpdSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  vpdRightBlock: {
    alignItems: 'flex-end',
  },
  vpdValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  vpdBigVal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  vpdKpaUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  vpdStomataText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  svgContainer: {
    marginTop: 4,
  },
  svgLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  svgTimeLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  peakInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  peakDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  peakText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  svgWrapper: {
    height: 74,
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    overflow: 'hidden',
  },
  vpdFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  vpdFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  vpdFooterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  zonePill: {
    backgroundColor: '#ecfdf5',
    borderWidth: 0.8,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  zoneText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  actionGuideCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 10,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  actionGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionGuideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionGuideSub: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
    marginTop: 2,
  },
  guideIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionStepsList: {
    gap: 8,
  },
  actionStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dcfce7',
    minHeight: 52,
  },
  stepIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionStepText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 18,
  },
  advisoryBanner: {
    padding: 16,
    backgroundColor: '#00450d',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#00450d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  advisoryBannerLeft: {
    flex: 1,
    gap: 4,
  },
  advisoryBannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 22,
  },
  advisoryBannerNote: {
    fontSize: 11,
    color: '#a7f3d0',
    lineHeight: 16,
  },
  advisoryBannerLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  advisoryBannerLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#86efac',
  },
  advisoryBannerImg: {
    width: 75,
    height: 90,
    opacity: 0.85,
  },
  ruralFooter: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBrandText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00450d',
  },
  footerTagline: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
});
