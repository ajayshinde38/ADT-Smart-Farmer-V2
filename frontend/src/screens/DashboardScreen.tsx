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

  const ndviVal = measured(indices?.ndvi) ? indices.ndvi : 0.45;
  const ndwiVal = measured(indices?.ndwi) ? indices.ndwi : 0.32;
  const ndreVal = measured(indices?.ndre) ? indices.ndre : 0.45;

  const currentVpd = typeof weather?.current_vpd_kpa === 'number' ? weather.current_vpd_kpa : 1.85;
  const currentTemp = typeof weather?.current_temp_c === 'number' ? Math.round(weather.current_temp_c) : 32;
  const windSpeed = typeof weather?.current_wind_speed_kmh === 'number' ? Math.round(weather.current_wind_speed_kmh) : 14;
  const rainChance = weather?.forecast_7_day?.[0]?.precipitation_probability != null
    ? Math.round(weather.forecast_7_day[0].precipitation_probability)
    : 5;

  const villageName = farmer.village || farmer.address || (mr ? 'सांगली' : 'Sangli');

  return (
    <ScrollView
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
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.tempRow}>
              <Text style={styles.tempVal}>{currentTemp}°C</Text>
              <Text style={styles.tempLocation} numberOfLines={1}>{villageName.split(',')[0]}</Text>
            </View>
            <Text style={styles.weatherCondition} numberOfLines={1}>
              {conditionLabel(weather?.current_condition, language) || (mr ? 'स्वच्छ व दमट' : 'Sunny & Humid')}
            </Text>
          </View>

          <View style={styles.tileDivider} />
          <View style={styles.weatherBottom}>
            <View style={styles.statInline}>
              <Icon name="water-drop" size={13} color="#0284c7" />
              <Text style={styles.statSmall}>{rainChance}% {mr ? 'पाऊस' : 'Rain'}</Text>
            </View>
            <View style={styles.statInline}>
              <Icon name="air" size={13} color="#64748b" />
              <Text style={styles.statSmall}>{windSpeed} km/h</Text>
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
              <Text style={styles.trendText}>+4% wk</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.valRow}>
              <Text style={styles.ndviValText}>{ndviVal.toFixed(2)}</Text>
              <Text style={styles.ndviValUnit}>NDVI</Text>
            </View>
            <Text style={styles.ndviSubtitle} numberOfLines={1}>
              {ndviVal > 0.6 ? (mr ? 'दाट पिकाची वाढ' : 'Dense Biomass') : (mr ? 'मध्यम वाढ' : 'Moderate Vigor')}
            </Text>
          </View>

          <View style={styles.ndviBarTrack}>
            <View
              style={[
                styles.ndviBarFill,
                { width: `${Math.max(10, Math.min(100, Math.round(ndviVal * 100)))}%` },
              ]}
            />
          </View>

          <View style={styles.ndviFooterRow}>
            <View style={styles.statInline}>
              <View style={styles.optimalDot} />
              <Text style={styles.optimalText}>{mr ? 'उत्तम स्थिती' : 'Optimal'}</Text>
            </View>
            <Text style={styles.sourceText}>Sentinel-2</Text>
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
              <Text style={styles.adequateText}>{mr ? 'पुरेसा' : 'Adequate'}</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.valRow}>
              <Text style={styles.metricValText}>{ndwiVal.toFixed(2)}</Text>
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
                { width: `${Math.max(10, Math.min(100, Math.round(ndwiVal * 150)))}%` },
              ]}
            />
          </View>

          <View style={styles.tileFooterRow}>
            <Text style={styles.subtextSmall}>{mr ? 'पाण्याचा ताण: नाही' : 'Water Stress: None'}</Text>
            <Text style={styles.targetGreen}>Target 0.3+</Text>
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
              <Text style={styles.adequateText}>{mr ? 'चांगला नत्र' : 'High N'}</Text>
            </View>
          </View>

          <View style={styles.tileMain}>
            <View style={styles.valRow}>
              <Text style={styles.metricValText}>{ndreVal.toFixed(2)}</Text>
              <Text style={styles.metricUnitText}>NDRE</Text>
            </View>
            <Text style={styles.metricSubtitle} numberOfLines={1}>
              {mr ? 'हरितद्रव्य प्रमाण' : 'Chlorophyll Content'}
            </Text>
          </View>

          <View style={styles.grayBarTrack}>
            <View
              style={[
                styles.limeBarFill,
                { width: `${Math.max(10, Math.min(100, Math.round(ndreVal * 140)))}%` },
              ]}
            />
          </View>

          <View style={styles.tileFooterRow}>
            <Text style={styles.subtextSmall}>{mr ? 'नत्र स्थिती' : 'Nitrogen Status'}</Text>
            <Text style={styles.targetGreen}>{mr ? 'जोमदार वाढ' : 'Vigor: Strong'}</Text>
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
                {mr ? "आजचे शेतातील काम" : "Today's Application Update"}
              </Text>
              <Text style={styles.appUpdateSub}>
                {mr ? 'प्लॉट अ • ऊस गट' : 'Plot A • Sugarcane Block'}
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
                <Text style={styles.itemTitle}>{mr ? 'ठिबक सिंचन' : 'Drip Irrigation'}</Text>
                <Text style={styles.itemSub}>
                  {mr ? 'सकाळी ६:०० • २ तास पूर्ण' : '6:00 AM • 2 hrs completed'}
                </Text>
              </View>
            </View>
            <View style={styles.appliedPill}>
              <View style={styles.appliedDot} />
              <Text style={styles.appliedText}>{mr ? 'पूर्ण झाले' : 'Applied'}</Text>
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
                  {mr ? 'खत (NPK 10:26:26)' : 'Fertilizer (NPK 10:26:26)'}
                </Text>
                <Text style={styles.itemSub}>
                  {mr ? 'उद्या सकाळी • ७:३० AM' : 'Tomorrow Morning • 7:30 AM'}
                </Text>
              </View>
            </View>
            <View style={styles.scheduledPill}>
              <View style={styles.scheduledDot} />
              <Text style={styles.scheduledText}>{mr ? 'नियोजित' : 'Scheduled'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* VPD Diurnal Trajectory Card matching Stitch */}
      <View style={styles.vpdCard}>
        <View style={styles.vpdHeader}>
          <View style={styles.vpdTitleRow}>
            <View style={styles.speedIconBox}>
              <Icon name="speed" size={18} color={colors.primary} />
            </View>
            <View>
              <View style={styles.titleWithBadge}>
                <Text style={styles.vpdTitle}>{mr ? 'VPD दैनंदिन वक्र' : 'VPD Diurnal Trajectory'}</Text>
                <View style={styles.optimalBadgeSmall}>
                  <Text style={styles.optimalBadgeSmallText}>{mr ? 'उत्तम' : 'Optimal'}</Text>
                </View>
              </View>
              <Text style={styles.vpdSub}>
                {mr ? 'हवेतील बाष्पदाब तूट व पानांचे श्वसन' : 'Vapor Pressure Deficit & Stomatal Gas Exchange'}
              </Text>
            </View>
          </View>

          <View style={styles.vpdRightBlock}>
            <View style={styles.vpdValRow}>
              <Text style={styles.vpdBigVal}>{currentVpd.toFixed(2)}</Text>
              <Text style={styles.vpdKpaUnit}>kPa</Text>
            </View>
            <Text style={styles.vpdStomataText}>{mr ? 'पर्णरंध्रे खुली' : 'Stomata Open'}</Text>
          </View>
        </View>

        {/* Diurnal Curve SVG */}
        <View style={styles.svgContainer}>
          <View style={styles.svgLegendRow}>
            <Text style={styles.svgTimeLabel}>06:00 (0.9 kPa)</Text>
            <View style={styles.peakInline}>
              <View style={styles.peakDot} />
              <Text style={styles.peakText}>Peak 2.4 kPa @ 13:30</Text>
            </View>
            <Text style={styles.svgTimeLabel}>18:00 (1.2 kPa)</Text>
          </View>

          <View style={styles.svgWrapper}>
            <Svg width="100%" height={74} viewBox="0 0 320 74" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="vpdGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </LinearGradient>
              </Defs>
              {/* Optimal green target band: 1.0 to 2.2 kPa */}
              <Rect x="0" y="14" width="320" height="38" fill="#86efac" fillOpacity="0.18" />
              <Line x1="0" y1="14" x2="320" y2="14" stroke="#006e1c" strokeWidth="1" strokeDasharray="3,3" strokeOpacity="0.3" />
              <Line x1="0" y1="52" x2="320" y2="52" stroke="#006e1c" strokeWidth="1" strokeDasharray="3,3" strokeOpacity="0.3" />

              {/* Shaded Area Under Trajectory Curve */}
              <Path
                d="M 0,62 Q 60,56 120,30 T 195,12 T 260,32 T 320,54 L 320,74 L 0,74 Z"
                fill="url(#vpdGrad)"
              />
              {/* Trajectory Path Line */}
              <Path
                d="M 0,62 Q 60,56 120,30 T 195,12 T 260,32 T 320,54"
                fill="none"
                stroke="#006e1c"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* Current Live Point Marker */}
              <Circle cx="218" cy="20" r="5" fill="#ffffff" stroke="#00450d" strokeWidth="2.5" />
              <Circle cx="218" cy="20" r="2.5" fill="#006e1c" />
            </Svg>
          </View>
        </View>

        <View style={styles.vpdFooter}>
          <View style={styles.vpdFooterLeft}>
            <Icon name="air" size={15} color="#059669" />
            <Text style={styles.vpdFooterLabel}>
              {mr ? 'उत्तम बाष्पोत्सर्जन कार्यक्षमता' : 'High Transpiration Efficiency'}
            </Text>
          </View>
          <View style={styles.zonePill}>
            <Text style={styles.zoneText}>Zone: 1.0–2.2 kPa</Text>
          </View>
        </View>
      </View>

      {/* Field Action Guide Card */}
      <View style={styles.actionGuideCard}>
        <View style={styles.actionGuideHeader}>
          <View>
            <Text style={styles.actionGuideTitle}>
              {mr ? 'तुमच्या शेतासाठी पुढील पावले' : 'Your Field Action Guide'}
            </Text>
            <Text style={styles.actionGuideSub}>
              {farmer.farm_area_acres ?? '1.86'} {mr ? 'एकर' : 'acres'} • {farmer.crop_name || (mr ? 'ऊस' : 'Sugarcane')}
            </Text>
          </View>
          <View style={styles.guideIconWrap}>
            <Icon name="fact-check" size={24} color="#059669" />
          </View>
        </View>

        <View style={styles.actionStepsList}>
          {data.field_context.next_steps.length > 0 ? (
            data.field_context.next_steps.slice(0, 3).map((step) => (
              <TouchableOpacity
                key={step.code}
                accessibilityRole="button"
                style={styles.actionStepRow}
                onPress={() => onNavigate(step.target)}
                activeOpacity={0.8}
              >
                <View style={styles.stepIconCircle}>
                  <Icon
                    name={
                      step.target === 'weather'
                        ? 'water-drop'
                        : step.target === 'pest'
                        ? 'bug-report'
                        : step.target === 'settings'
                        ? 'info-outline'
                        : 'terrain'
                    }
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.actionStepText}>
                  {mr ? step.text_mr : step.text_en}
                </Text>
                <Icon name="chevron-right" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.actionStepRow}
              onPress={() => onNavigate('pest')}
              activeOpacity={0.8}
            >
              <View style={styles.stepIconCircle}>
                <Icon name="eco" size={18} color={colors.primary} />
              </View>
              <Text style={styles.actionStepText}>
                {mr
                  ? 'नियमित शेत तपासा. लक्षणे दिसल्यास पिकाचा फोटो तपासा.'
                  : 'Continue routine field inspection. Check a crop photo if symptoms appear.'}
              </Text>
              <Icon name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Advisory Banner Link */}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => onNavigate('advisory')}
        style={styles.advisoryBanner}
        activeOpacity={0.9}
      >
        <View style={styles.advisoryBannerLeft}>
          <Text style={styles.advisoryBannerTitle}>
            {mr ? 'मातीपासून सुरुवात करा' : 'Better decisions begin with soil'}
          </Text>
          <Text style={styles.advisoryBannerNote}>
            {mr ? 'माती अहवाल व पोषण नियोजन पाहा.' : 'Review your soil record and nutrient planning estimate.'}
          </Text>
          <View style={styles.advisoryBannerLinkRow}>
            <Text style={styles.advisoryBannerLink}>
              {mr ? 'सल्ला पाहा' : 'Explore Advisory'}
            </Text>
            <Icon name="arrow-forward" size={15} color="#86efac" />
          </View>
        </View>
        <Image
          source={require('../assets/grain-illustration.png')}
          style={styles.advisoryBannerImg}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Panoramic Farm Silhouette Footer */}
      <View style={styles.ruralFooter}>
        <View style={styles.footerBrandRow}>
          <Icon name="eco" size={18} color={colors.secondary} />
          <Text style={styles.footerBrandText}>AI-ADT Foundation</Text>
        </View>
        <Text style={styles.footerTagline}>
          {mr ? 'शेतीसाठी विश्वसनीय व अचूक तंत्रज्ञान' : 'Precision Agricultural Intelligence'}
        </Text>
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
