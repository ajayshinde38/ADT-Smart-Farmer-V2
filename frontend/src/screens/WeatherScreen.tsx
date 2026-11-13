import { FarmPage } from '../components/FarmPage';
import { WeatherMotionIcon } from '../components/WeatherMotionIcon';
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { AppText as Text, Icon, Card, ui } from '../components/ui';
import { Sparkline } from '../components/Sparkline';
import { GddChart } from '../components/GddChart';
import { VpdChart } from '../components/VpdChart';
import { WaterDemandChart } from '../components/WaterDemandChart';
import { stageLabel } from '../utils/farmPresentation';
import { CropWatchCard } from '../components/CropWatchCard';
import { ForecastChart } from '../components/ForecastChart';
import { translations } from '../i18n/translations';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile, WeatherData } from '../types';
import { colors } from '../theme/colors';

interface WeatherScreenProps {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
  onScan?: () => void;
}

const amount = (value: number | null | undefined, unit = '', digits = 1) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(digits)}${unit}`
    : '—';

export const WeatherScreen: React.FC<WeatherScreenProps> = ({ farmer, language, onScan }) => {
  const t = translations[language];
  const mr = language === 'mr';
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;
    setData(null);
    setLoading(true);
    setExpanded(false);
    setSelectedDate(undefined);
    if (!farmer.farm_id) {
      setLoading(false);
      return;
    }
    ApiClient.getWeather(farmer.farm_id)
      .then((result) => {
        if (active) {
          setData(result);
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [farmer.farm_id, retry]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading)
    return (
      <FarmPage page="weather" style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRetry(x => x + 1)} />}>
        <View style={styles.loadingCard} accessibilityLiveRegion="polite">
          <WeatherMotionIcon name="wb-sunny" />
          <Text style={styles.loadingTitle}>{mr ? 'तुमच्या शेताचे हवामान मिळवत आहे…' : 'Loading your farm weather…'}</Text>
          <View style={{ width: '100%', gap: 12 }}>{[1, 2, 3].map(key => <View key={key} style={{ height: 22, borderRadius: 8, backgroundColor: '#dbe9df', width: key === 2 ? '70%' : '100%' }} />)}</View>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingNote}>{mr ? 'शेताची जागा आणि Open-Meteo अंदाज तपासत आहे' : 'Checking the farm location and Open-Meteo forecast'}</Text>
        </View>
      </FarmPage>
    );

  if (!data)
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{t.weatherLoadError}</Text>
        <TouchableOpacity style={styles.button} onPress={() => setRetry((x) => x + 1)}>
          <Text style={styles.link}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );

  const timezone = data.forecast_timezone || 'Asia/Kolkata';
  const locale = mr ? 'mr-IN' : 'en-IN';
  const todayDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const today = data.forecast_7_day?.find((day) => day.date === todayDate);
  const chosen = data.forecast_7_day?.find((day) => day.date === selectedDate) || today || data.forecast_7_day?.[0];
  const irrigation = data.irrigation;

  const conditionsMr: Record<string, string> = {
    'Clear Sky': 'निरभ्र आकाश',
    'Mainly Clear': 'बहुतांश निरभ्र',
    'Partly Cloudy': 'अंशतः ढगाळ',
    Overcast: 'ढगाळ',
    Foggy: 'धुके',
    'Light Drizzle': 'हलकी रिमझिम',
    'Moderate Drizzle': 'रिमझिम पाऊस',
    'Dense Drizzle': 'जोरदार रिमझिम',
    'Slight Rain': 'हलका पाऊस',
    'Moderate Rain': 'मध्यम पाऊस',
    'Heavy Rain': 'जोरदार पाऊस',
    'Rain Showers': 'पावसाच्या सरी',
    Thunderstorm: 'मेघगर्जनेसह पाऊस',
  };

  const conditionIcon = /rain|drizzle|shower/i.test(data.current_condition) ? 'grain' : /thunder/i.test(data.current_condition) ? 'flash-on' : /cloud|overcast|fog/i.test(data.current_condition) ? 'cloud' : 'wb-sunny';
  const currentConditionText = mr
    ? conditionsMr[data.current_condition] || data.current_condition
    : data.current_condition;

  const temp = data.current_temp_c;
  const rh = data.current_humidity_pct;
  const gamma = Number.isFinite(temp) && rh > 0 && rh <= 100 ? Math.log(rh / 100) + 17.625 * temp / (243.04 + temp) : null;
  const dewPointC = gamma == null ? null : 243.04 * gamma / (17.625 - gamma);
  const waterDemandLHa = Math.round(data.current_et0_mm * 10000);
  const dailyGdd = data.forecast_7d_gdd != null ? (data.forecast_7d_gdd / Math.max(1, data.forecast_7_day.length)).toFixed(1) : '—';

  const farmAreaAcres = data.farm_area_acres ?? farmer.farm_area_acres ?? 1.0;
  const farmAreaM2 = data.farm_area_m2 ?? Math.round(farmAreaAcres * 4046.8564);

  // Exact water requirement for today for the plot area in Liters/day (FAO-56 standard)
  const todayWaterLiters = data.irrigation?.water_required_liters ?? Math.round((today?.water_demand_liters ?? (data.current_et0_mm * (data.irrigation?.kc ?? 0.90) * farmAreaM2)));
  const todayEtcMm = data.irrigation?.etc_mm_day ?? (today?.etc_mm ?? Number((data.current_et0_mm * (data.irrigation?.kc ?? 0.90)).toFixed(1)));
  const effectiveRainToday = today?.rainfall_mm && today.rainfall_mm > 1.0 ? today.rainfall_mm * 0.80 : 0.0;
  const todayNetMm = data.irrigation?.net_irrigation_mm_day ?? Math.max(0, Number((todayEtcMm - effectiveRainToday).toFixed(1)));

  // Format pump duration safely without unit truncation
  const formatPumpDuration = (label?: string) => {
    if (!label) return '—';
    if (mr) {
      return label
        .replace(/\bhr\b/g, 'तास')
        .replace(/\bmin\b/g, 'मि.')
        .replace('(Rain Sufficed)', '(पाऊस पुरेसा)');
    }
    return label;
  };

  // Accumulated GDD since planting
  const accumulatedGdd = data.cumulative_gdd_since_planting;
  const plantingAgeDays = data.planting_age_days;
  const plantationDateStr = data.plantation_date;

  const dateLabel = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString(locale, {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  const hourlyLabel = (label: string) => (mr ? label.replace('Now', 'आता') : label);

  const hourlyVpdItems = (data.hourly_forecast || []).slice(0, 7).map((h) => ({
    label: hourlyLabel(h.time_label),
    value: h.vpd_kpa,
  }));
  const avgHourlyVpd = hourlyVpdItems.length > 0
    ? (hourlyVpdItems.reduce((acc, item) => acc + item.value, 0) / hourlyVpdItems.length).toFixed(2)
    : data.current_vpd_kpa.toFixed(2);

  return (
    <FarmPage page="weather" style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRetry(x => x + 1)} />}>
      {/* 1. Plot Microclimate Hero Card matching Stitch */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroBadgeTitle}>
              {mr ? 'शेताचे सूक्ष्म हवामान' : 'PLOT MICROCLIMATE'}
            </Text>
            <View style={styles.heroTempRow}>
              <Text style={styles.heroTemp}>{Math.round(data.current_temp_c)}°C</Text>
              {data.apparent_temp_c != null && (
                <Text style={styles.heroFeelsLike}>
                  {mr ? 'जाणवणारे ' : 'Feels like '}
                  {Math.round(data.apparent_temp_c)}°C
                </Text>
              )}
            </View>
            <View style={styles.conditionRow}>
              <Icon name={conditionIcon} size={16} color="#d97706" />
              <Text style={styles.conditionText}>
                {currentConditionText}
              </Text>
            </View>
          </View>

          <View style={styles.heroSunBox}>
            <WeatherMotionIcon name={conditionIcon} />
          </View>
        </View>

        {/* 6-Point Agronomic Telemetry Grid matching Stitch */}
        <View style={styles.telemetryGrid}>
          {/* 1: Humidity */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryCardHeader}>
              <Icon name="water-drop" size={15} color={colors.primary} />
              <Text style={styles.telemetryLabel}>{mr ? 'आर्द्रता' : 'Humidity'}</Text>
            </View>
            <Text style={styles.telemetryValue}>{Math.round(data.current_humidity_pct)}%</Text>
            <Text style={styles.telemetrySubGreen}>
              {rh >= 40 && rh <= 70 ? (mr ? 'संतुलित' : 'Balanced') : rh > 70 ? (mr ? 'उच्च' : 'High') : (mr ? 'कमी' : 'Low')}
            </Text>
          </View>

          {/* 2: Wind */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryCardHeader}>
              <Icon name="air" size={15} color={colors.primary} />
              <Text style={styles.telemetryLabel}>{mr ? 'वारा' : 'Wind'}</Text>
            </View>
            <Text style={styles.telemetryValue}>{amount(data.current_wind_speed_kmh, ' km/h', 0)}</Text>
            <Text style={styles.telemetrySubSlate}>{mr ? 'सध्याचा वेग' : 'Current speed'}</Text>
          </View>

          {/* 3: Solar Radiation */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryCardHeader}>
              <Icon name="wb-iridescent" size={15} color={colors.primary} />
              <Text style={styles.telemetryLabel}>{mr ? 'कमाल / किमान' : 'High / Low'}</Text>
            </View>
            <Text style={styles.telemetryValue}>{amount(today?.temp_max_c, '°', 0)} / {amount(today?.temp_min_c, '°', 0)}</Text>
            <Text style={styles.telemetrySubAmber}>{mr ? 'आजचा अंदाज' : 'Today’s forecast'}</Text>
          </View>

          {/* 4: Rainfall */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryCardHeader}>
              <Icon name="cloud" size={15} color={colors.primary} />
              <Text style={styles.telemetryLabel}>{mr ? 'पाऊस' : 'Rainfall'}</Text>
            </View>
            <Text style={styles.telemetryValue}>{amount(data.current_precipitation_mm, ' mm')}</Text>
            <Text style={styles.telemetrySubSlate}>{amount(today?.precipitation_probability, '%', 0)} {mr ? 'शक्यता' : 'chance'}</Text>
          </View>

        </View>
      </View>

      {/* 2. Today's Hourly Forecast Strip matching Stitch */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWithIcon}>
          <Icon name="schedule" size={18} color={colors.primary} />
          <Text style={styles.sectionHeading}>
            {mr ? 'तासागणिक तापमान अंदाज' : 'Hourly Temperature Forecast'}
          </Text>
        </View>
        <Text style={styles.sectionSubBadge}>
          {mr ? 'पुढील ९ तास' : 'Next 9 Hours'}
        </Text>
      </View>

      {data.hourly_forecast?.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourlyScroll}
        >
          {data.hourly_forecast.slice(0, 9).map((hour, idx) => {
            const isNow = idx === 0 || hour.time_label === 'Now';
            return (
              <View
                key={hour.time}
                style={[styles.hourlyCard, isNow && styles.hourlyCardNow]}
              >
                <Text style={[styles.hourlyTimeText, isNow && styles.hourlyTimeTextNow]}>
                  {isNow ? (mr ? 'आता' : 'NOW') : hourlyLabel(hour.time_label)}
                </Text>
                <Text style={styles.hourlyEmoji}>{hour.weather_icon || '☀️'}</Text>
                <Text style={[styles.hourlyTempText, isNow && styles.hourlyTempTextNow]}>
                  {Math.round(hour.temp_c)}°C
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* 3. Crop Growth & Water Intelligence */}
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionHeading}>
          {mr ? 'उसाच्या वाढीचे व पाण्याचे मुख्य निर्देशांक' : 'Crop Growth & Water Intelligence'}
        </Text>
        <Text style={styles.sectionSubHeading}>
          {mr
            ? 'पानांचे श्वसन (VPD), अचूक पाण्याची गरज (ET₀) आणि पिकाचे वाढ घड्याळ (GDD)'
            : 'Leaf breathing (VPD), daily irrigation demand (ET₀) & crop maturity clock (GDD)'}
        </Text>
      </View>

      {/* Card A: VPD Analysis */}
      <View style={styles.bioCard}>
        <View style={styles.bioCardHeader}>
          <View style={styles.bioCardHeaderLeft}>
            <View style={styles.bioIconCircle}>
              <Icon name="filter-drama" size={20} color="#047857" />
            </View>
            <View>
              <Text style={styles.bioCardTitle}>
                {mr ? 'VPD (हवेतील कोरडेपणा व पानांचे श्वसन)' : 'VPD (Vapor Pressure Deficit)'}
              </Text>
              <Text style={styles.bioCardSubGreen}>
                {mr ? 'पानांमधून पाण्याचे बाष्पीभवन व खत शोषण' : 'Leaf Transpiration & Nutrient Intake'}
              </Text>
            </View>
          </View>
          <View style={styles.bioCardHeaderRight}>
            <Text style={styles.bioValText}>{data.current_vpd_kpa.toFixed(2)} kPa</Text>
            <Text style={styles.bioDeltaText}>
              {data.current_vpd_kpa <= 1.6 && data.current_vpd_kpa >= 0.8
                ? (mr ? 'उत्तम वाढ' : 'Optimal Growth')
                : data.current_vpd_kpa > 2.0
                ? (mr ? 'कडक ऊन / ताण' : 'Heat Stress')
                : (mr ? 'दमट हवा' : 'Humid Air')}
            </Text>
          </View>
        </View>

        {/* 4-Color Gauge Bar */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeBar}>
            <View style={[styles.gaugeSegment, { flex: 25, backgroundColor: '#cbd5e1' }]} />
            <View style={[styles.gaugeSegment, { flex: 45, backgroundColor: '#10b981' }]} />
            <View style={[styles.gaugeSegment, { flex: 15, backgroundColor: '#f59e0b' }]} />
            <View style={[styles.gaugeSegment, { flex: 15, backgroundColor: '#ef4444' }]} />
          </View>
          <View style={styles.gaugeLabels}>
            <Text style={styles.gaugeLabelText}>{mr ? 'कमी (<०.८)' : 'Low (<0.8)'}</Text>
            <Text style={styles.gaugeLabelOptimal}>
              {mr ? `सध्या: ${data.current_vpd_kpa.toFixed(2)}` : `Current: ${data.current_vpd_kpa.toFixed(2)}`}
            </Text>
            <Text style={styles.gaugeLabelStress}>{mr ? 'ताण (>२.२)' : 'Stress (>2.2 kPa)'}</Text>
          </View>
        </View>

        {/* VPD Trajectory Chart */}
        <View style={styles.vpdMiniGraphWrap}>
          <View style={styles.vpdGraphHeader}>
            <Text style={styles.vpdGraphTitle}>
              {mr ? 'तासागणिक बाष्प दाब तूट कल' : 'Hourly VPD Trajectory (kPa)'}
            </Text>
            <Text style={styles.vpdGraphPeak}>
              {mr ? `तासागणिक अंदाज · सरासरी ${avgHourlyVpd}` : `Hourly forecast · Avg: ${avgHourlyVpd}`}
            </Text>
          </View>
          <VpdChart
            items={hourlyVpdItems}
            language={language}
            averageValue={Number(avgHourlyVpd)}
            height={95}
          />
        </View>

        {/* Farmer Insight: What VPD means & Why it matters */}
        <View style={styles.farmerInsightCard}>
          <View style={styles.farmerInsightHeader}>
            <View style={styles.farmerInsightIconBadge}>
              <Icon name="eco" size={15} color="#059669" />
            </View>
            <Text style={styles.farmerInsightTitle}>
              {mr ? 'शेतकरी सल्ला: VPD म्हणजे काय आणि का महत्त्वाचे?' : 'Farmer Guide: What is VPD & Why It Matters'}
            </Text>
          </View>
          <Text style={styles.farmerInsightBody}>
            {data.current_vpd_kpa > 2.0
              ? (mr
                  ? 'हवा कोरडी व कडक ऊन आहे. अशा वेळी उसाची पाने पाणी वाचवण्यासाठी आपली तोंडे (पर्णरंध्रे) बंद करतात, ज्यामुळे वाढ व खत शोषण थांबते. दुपारच्या उन्हात फवारणी करू नका आणि सायंकाळी सिंचन करा.'
                  : 'Air is hot and dry. Sugarcane closes leaf pores to prevent moisture loss, pausing growth and nutrient intake. Avoid midday foliar spraying; irrigate in early morning or evening.')
              : data.current_vpd_kpa < 0.8
              ? (mr
                  ? 'हवा अत्यंत दमट आहे. पानांतून पाणी हळूहळू उडते, ज्यामुळे बुरशीजन्य रोगांचा धोका वाढू शकतो. शेतात हवा खेळती राहू द्या आणि पानांवर तांबेरा/करपा तपासा.'
                  : 'Air is very humid with sluggish evaporation, which may favor fungal spores. Keep fields well-aerated and scout leaves for rust or spot diseases.')
              : (mr
                  ? 'सध्या हवामान उसाच्या वाढीसाठी अतिशय अनुकूल आहे! पानांची तोंडे पूर्ण उघडी असून ऊस जमिनीतून खते व पाणी वेगाने शोषून घेत आहे.'
                  : 'Ideal atmospheric conditions! Leaf pores are wide open, and sugarcane is actively drinking water and absorbing soil fertilizers.')}
          </Text>
          <View style={styles.farmerTipRow}>
            <Text style={styles.farmerTipBadge}>{mr ? 'थेट सल्ला' : 'Quick Tip'}</Text>
            <Text style={styles.farmerTipText}>
              {mr
                ? '०.८ ते १.६ kPa दरम्यान उसाची वाढ सर्वात जोमाने होते. २.० च्या वर खत किंवा कीटकनाशक फवारणी टाळावी.'
                : 'Optimal cane growth happens between 0.8–1.6 kPa. Avoid chemical or fertilizer spraying when VPD exceeds 2.0 kPa.'}
            </Text>
          </View>
        </View>
      </View>

      {/* Card B: ET0 & Plot Water Demand */}
      <View style={styles.bioCard}>
        <View style={styles.bioCardHeader}>
          <View style={styles.bioCardHeaderLeft}>
            <View style={styles.bioIconCircle}>
              <Icon name="water-drop" size={20} color="#047857" />
            </View>
            <View>
              <Text style={styles.bioCardTitle}>
                {mr ? 'ET₀ व पाण्याची गरज' : 'ET₀ & Water Demand'}
              </Text>
              <Text style={styles.bioCardSubGreen}>
                {mr ? 'वातावरणातील बाष्पीभवन मागणी' : 'Atmospheric Evaporative Demand'}
              </Text>
            </View>
          </View>
          <View style={styles.bioCardHeaderRight}>
            <Text style={styles.bioValTextAmber}>{data.current_et0_mm.toFixed(1)} mm/{mr ? 'दिवस' : 'day'}</Text>
            <Text style={styles.bioDeltaText}>{mr ? 'संदर्भ ET₀ दर' : 'Ref ET₀ rate'}</Text>
          </View>
        </View>

        {/* Hero Water Required Banner for the plot */}
        <View style={styles.waterHeroBanner}>
          <View style={styles.waterHeroLeft}>
            <Text style={styles.waterHeroLabel}>
              {mr ? 'आजची शेताची पाण्याची गरज (दैनिक)' : "Today's Plot Water Demand"}
            </Text>
            <Text style={styles.waterHeroValue}>
              {todayWaterLiters.toLocaleString()} <Text style={styles.waterHeroUnit}>{mr ? 'लिटर / दिवस' : 'L / day'}</Text>
            </Text>
            <Text style={styles.waterHeroArea}>
              {mr
                ? `तुमच्या ${farmAreaAcres.toFixed(2)} एकर शेतासाठी (~${Math.round(farmAreaM2).toLocaleString()} चौ.मी.)`
                : `For your ${farmAreaAcres.toFixed(2)} Acre plot (~${Math.round(farmAreaM2).toLocaleString()} m²)`}
            </Text>
          </View>
          <View style={styles.waterHeroRightBadge}>
            <Icon name="opacity" size={24} color="#0284c7" />
            <Text style={styles.waterHeroVolumeM3}>~{(todayWaterLiters / 1000).toFixed(1)} m³</Text>
          </View>
        </View>

        {/* 3-Point Driver Grid */}
        <View style={styles.driversGrid}>
          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>{mr ? 'पीक गुणांक (Kc)' : 'Crop Coeff (Kc)'}</Text>
            <Text style={styles.driverValGreen}>
              {data.irrigation?.kc ? `Kc ${data.irrigation.kc.toFixed(2)}` : 'Kc 0.90'}
            </Text>
            <Text style={styles.driverSubText}>{mr ? 'उसाचा टप्पा' : 'Growth factor'}</Text>
          </View>

          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>{mr ? 'निव्वळ सिंचन खोली' : 'Net Depth'}</Text>
            <Text style={styles.driverVal}>
              {todayNetMm.toFixed(1)} mm/{mr ? 'दि.' : 'day'}
            </Text>
            <Text style={styles.driverSubText}>{mr ? 'पावसाची वजावट' : 'Rain adjusted'}</Text>
          </View>

          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>{mr ? 'पंप कालावधी' : 'Pump Runtime'}</Text>
            <Text style={styles.driverValAmber}>
              {formatPumpDuration(data.irrigation?.irrigation_duration_label)}
            </Text>
            <Text style={styles.driverSubText}>{mr ? '५ HP मोटर' : '5 HP pump'}</Text>
          </View>
        </View>

        {/* 7-Day Water Demand & Intake Chart */}
        <WaterDemandChart
          forecastDays={data.forecast_7_day}
          pastDays={data.past_7_day}
          areaAcres={farmAreaAcres}
          areaM2={farmAreaM2}
          language={language}
        />

        {/* Farmer Insight: What ET0 means & Why exact water matters */}
        <View style={styles.farmerInsightCard}>
          <View style={styles.farmerInsightHeader}>
            <View style={[styles.farmerInsightIconBadge, { backgroundColor: '#e0f2fe' }]}>
              <Icon name="opacity" size={15} color="#0284c7" />
            </View>
            <Text style={[styles.farmerInsightTitle, { color: '#0369a1' }]}>
              {mr ? 'शेतकरी सल्ला: ET₀ म्हणजे काय आणि अचूक पाणी का द्यावे?' : 'Farmer Guide: What is ET₀ & Daily Water Demand?'}
            </Text>
          </View>
          <Text style={styles.farmerInsightBody}>
            {mr
              ? `ET₀ म्हणजे आजचे ऊन, वारा आणि हवेमुळे शेतातील पिकातून उडून गेलेले पाणी (${data.current_et0_mm.toFixed(1)} मिमी/दिवस). पिकाचा वाढीचा टप्पा लक्षात घेता तुमच्या ${farmAreaAcres.toFixed(2)} एकर उसाला आज नेमके ${todayWaterLiters.toLocaleString()} लिटर पाणी लागते. जास्त पाणी दिल्यास खते जमिनीत खोल वाहून जातात आणि कमी दिल्यास उसाची कांडी आखूड राहते.`
              : `ET₀ measures the moisture lost daily to sun, heat, and wind (${data.current_et0_mm.toFixed(1)} mm/day). Factoring in cane growth stage, your ${farmAreaAcres.toFixed(2)} acre plot requires exactly ${todayWaterLiters.toLocaleString()} Liters today. Exact dosing prevents root suffocation and fertilizer loss from over-watering while avoiding stunted cane height.`}
          </Text>
          <View style={styles.farmerTipRow}>
            <Text style={[styles.farmerTipBadge, { backgroundColor: '#e0f2fe', color: '#0369a1' }]}>{mr ? 'सिंचन सल्ला' : 'Irrigation Tip'}</Text>
            <Text style={styles.farmerTipText}>
              {mr
                ? `तुमच्या ५ HP ठिबक पंपाने आज सुमारे ${formatPumpDuration(data.irrigation?.irrigation_duration_label)} पाणी दिल्यास पिकाची आजची पाण्याची गरज १००% पूर्ण होईल.`
                : `Running your 5 HP drip pump for ${formatPumpDuration(data.irrigation?.irrigation_duration_label)} today fully satisfies the crop's daily hydration.`}
            </Text>
          </View>
        </View>
      </View>

      {/* Card C: GDD (Growing Degree Days - Accumulated) */}
      <View style={styles.bioCard}>
        <View style={styles.bioCardHeader}>
          <View style={styles.bioCardHeaderLeft}>
            <View style={styles.bioIconCircle}>
              <Icon name="thermostat" size={20} color="#047857" />
            </View>
            <View>
              <Text style={styles.bioCardTitle}>
                {mr ? 'GDD (वाढीचे उष्णता अंश दिवस)' : 'GDD (Growing Degree Days)'}
              </Text>
              <Text style={styles.bioCardSubGreen}>
                {mr ? 'पायाभूत आधार तापमान: १८°C (ऊस)' : 'Base Threshold: 18°C (Sugarcane)'}
              </Text>
            </View>
          </View>
          <View style={styles.bioCardHeaderRight}>
            <Text style={styles.bioValTextGreen}>
              {accumulatedGdd != null ? `${Math.round(accumulatedGdd).toLocaleString()} GDD` : `${amount(today?.gdd, ' GDD', 1)}`}
            </Text>
            <Text style={styles.bioDeltaTextGreen}>
              {accumulatedGdd != null ? (mr ? 'लागवडीपासून एकूण संचित' : 'Accumulated since planting') : (mr ? 'आजचा दैनिक अंदाज' : "Today's daily forecast")}
            </Text>
          </View>
        </View>

        {/* Hero GDD Milestone Card */}
        {accumulatedGdd != null ? (
          <View style={styles.gddHeroBox}>
            <View style={styles.gddHeroTop}>
              <View>
                <Text style={styles.gddHeroBadge}>
                  {mr ? 'पिकाचे संचित उष्णता एकक' : 'ACCUMULATED THERMAL UNITS'}
                </Text>
                <View style={styles.gddHeroMainRow}>
                  <Text style={styles.gddHeroNumber}>{Math.round(accumulatedGdd).toLocaleString()}</Text>
                  <Text style={styles.gddHeroUnit}>GDD</Text>
                </View>
              </View>
              <View style={styles.gddHeroRightPill}>
                <Text style={styles.gddHeroAge}>
                  {plantingAgeDays ? `${plantingAgeDays} ${mr ? 'दिवस' : 'Days'}` : (mr ? 'लागवड' : 'Planted')}
                </Text>
                {plantationDateStr && (
                  <Text style={styles.gddHeroPlantDate}>
                    {new Date(plantationDateStr).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
            </View>

            {/* Thermal Maturity Progress Bar */}
            <View style={styles.gddProgressWrap}>
              <View style={styles.gddProgressTrack}>
                <View
                  style={[
                    styles.gddProgressBar,
                    { width: `${Math.min(100, Math.max(8, Math.round((accumulatedGdd / 3000) * 100)))}%` },
                  ]}
                />
              </View>
              <View style={styles.gddMilestonesRow}>
                <Text style={styles.gddMilestoneText}>0 {mr ? 'लागवड' : 'Plant'}</Text>
                <Text style={styles.gddMilestoneText}>1100 {mr ? 'वाढ' : 'Growth'}</Text>
                <Text style={styles.gddMilestoneText}>2400 {mr ? 'पक्वता' : 'Maturity'}</Text>
                <Text style={styles.gddMilestoneHighlight}>3000 {mr ? 'कापणी' : 'Harvest'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Daily Stats Grid */}
        <View style={styles.gddStatsRow}>
          <View>
            <Text style={styles.gddLabel}>{mr ? 'आजचा उष्णता लाभ' : "Today's Thermal Gain"}</Text>
            <Text style={styles.gddBigVal}>+{amount(today?.gdd, ' GDD', 1)}</Text>
          </View>
          <View>
            <Text style={styles.gddLabel}>{mr ? '७ दिवसांची सरासरी' : '7-Day Forecast Mean'}</Text>
            <Text style={styles.gddBigVal}>{dailyGdd} GDD/{mr ? 'दि.' : 'd'}</Text>
          </View>
          <View style={styles.gddRightBlock}>
            <Text style={styles.gddLabel}>{mr ? 'सध्याची स्थिती' : 'Growth Stage'}</Text>
            <Text style={styles.gddStatusVal}>
              {stageLabel(irrigation?.crop_stage, language)}
            </Text>
          </View>
        </View>

        {/* 7-Day GDD Thermal Trajectory Chart */}
        <View style={styles.gddMiniGraphWrap}>
          <View style={styles.gddGraphHeader}>
            <Text style={styles.gddGraphTitle}>
              {mr ? 'दैनिक उष्णता संचयन कल' : '7-Day Heat Accumulation Trajectory'}
            </Text>
            <Text style={styles.gddGraphPeak}>
              {mr ? `दैनिक अंदाज · सरासरी ${dailyGdd}` : `Daily forecast · Avg: ${dailyGdd}`}
            </Text>
          </View>
          <GddChart
            days={data.forecast_7_day}
            language={language}
            averageGdd={Number(dailyGdd) || 8.3}
            height={95}
          />
        </View>

        {/* Farmer Insight: What GDD means & Why it matters */}
        <View style={styles.farmerInsightCard}>
          <View style={styles.farmerInsightHeader}>
            <View style={[styles.farmerInsightIconBadge, { backgroundColor: '#fef3c7' }]}>
              <Icon name="wb-sunny" size={15} color="#d97706" />
            </View>
            <Text style={[styles.farmerInsightTitle, { color: '#b45309' }]}>
              {mr ? 'शेतकरी सल्ला: GDD म्हणजे काय आणि हे पिकाचे घड्याळ कसे?' : 'Farmer Guide: What is GDD & Why Track It?'}
            </Text>
          </View>
          <Text style={styles.farmerInsightBody}>
            {mr
              ? `ऊस कॅलेंडरच्या दिवसांवर नव्हे, तर मिळालेल्या उष्णतेवर वाढतो (१८°C च्या वरील उष्णतेचे रोज मोजमाप म्हणजे GDD). लागवडीपासून आतापर्यंत तुमच्या उसाने ${accumulatedGdd ? Math.round(accumulatedGdd).toLocaleString() : '३,३००+'} GDD उष्णता साठवली आहे. ऊस आता पूर्ण पक्वतेच्या टप्प्यात असून कांड्यांमध्ये साखर भरण्याचे काम (Brix) जोमाने सुरू आहे.`
              : `Sugarcane does not grow by calendar days; it grows on accumulated heat units above 18°C (GDD). Since planting, your crop has absorbed ${accumulatedGdd ? Math.round(accumulatedGdd).toLocaleString() : '3,300+'} GDD. The crop is in prime maturity, actively packing sucrose (Brix) into the stalks.`}
          </Text>
          <View style={styles.farmerTipRow}>
            <Text style={[styles.farmerTipBadge, { backgroundColor: '#fef3c7', color: '#b45309' }]}>{mr ? 'साखर उतारा' : 'Sugar Tip'}</Text>
            <Text style={styles.farmerTipText}>
              {mr
                ? '३००० GDD नंतर ऊस पूर्ण पक्व होतो. तोडणीपूर्वी १० ते १५ दिवस पाणी हळूहळू कमी केल्यास कारखान्याचा साखर उतारा (Brix) १.५ ते २ टक्क्यांनी वाढतो.'
                : 'Cane matures fully after ~3,000 GDD. Tapering irrigation 10–15 days before harvest stresses the cane mildly, boosting sugar recovery (Brix) by 1.5–2%.'}
            </Text>
          </View>
        </View>
      </View>

      {/* 4. 7-Day Weather & Agronomic Forecast */}
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionHeading}>
          {mr ? 'सात दिवसांचा अंदाज व आलेख' : 'Seven-Day Outlook & Trends'}
        </Text>
      </View>

      <ForecastChart days={data.forecast_7_day} language={language} />

      <View style={styles.weekCard}>
        {data.forecast_7_day?.slice(0, 7).map((day) => {
          const isSelected = chosen?.date === day.date;
          return (
            <TouchableOpacity
              key={day.date}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedDate(day.date)}
              style={[styles.dayRow, isSelected && styles.dayRowSelected]}
              activeOpacity={0.8}
            >
              <Text style={styles.dayDate}>{dateLabel(day.date)}</Text>
              <Text style={styles.dayIcon}>{day.weather_icon}</Text>
              <Text style={styles.dayTemp}>
                {Math.round(day.temp_max_c)}° / {Math.round(day.temp_min_c)}°
              </Text>
              <Text style={styles.dayRain}>{day.rainfall_mm.toFixed(1)} mm</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Crop Watch & Field Context */}
      <CropWatchCard data={data} language={language} onScan={onScan} selectedDate={chosen?.date} />
    </FarmPage>
  );
};

const styles = StyleSheet.create({
  loadingCard: { backgroundColor: '#eaf7ee', borderWidth: 1, borderColor: '#c5e6ce', borderRadius: 22, minHeight: 260, alignItems: 'center', justifyContent: 'center', padding: 26, gap: 18, marginTop: 15 },
  loadingTitle: { fontSize: 18, fontWeight: '800', color: '#115a3e', textAlign: 'center' },
  loadingNote: { fontSize: 12, color: '#587666', textAlign: 'center' },
  weatherStatusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  weatherStatusLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  weatherStatusText: { fontSize: 12, fontWeight: '700', color: '#3d6150', flexShrink: 1 },
  weatherRefresh: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#d9f0e1', minHeight: 40 },
  weatherRefreshText: { fontSize: 12, color: '#0b7050', fontWeight: '800' },
  container: {
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
  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    fontSize: 15,
    color: '#334155',
  },
  button: {
    padding: 12,
  },
  link: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroBadgeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTempRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 2,
  },
  heroTemp: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -1,
  },
  heroFeelsLike: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  conditionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  heroSunBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  telemetryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  telemetryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  telemetryValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  telemetrySubGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  telemetrySubSlate: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  telemetrySubAmber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  sectionSubBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  hourlyScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  hourlyCard: {
    width: 96,
    borderRadius: 16,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  hourlyCardNow: {
    backgroundColor: '#00450d',
    borderColor: '#064e3b',
  },
  hourlyTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  hourlyTimeTextNow: {
    color: '#86efac',
    fontWeight: '800',
  },
  hourlyEmoji: {
    fontSize: 22,
    marginVertical: 2,
  },
  hourlyTempText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  hourlyTempTextNow: {
    color: '#ffffff',
  },
  hourlyRainText: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '600',
  },
  hourlyRainTextNow: {
    color: '#a7f3d0',
  },
  hourlyMiniVpd: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 4,
    alignItems: 'center',
    marginTop: 4,
    gap: 1,
  },
  hourlyMiniVpdNow: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  hourlyVpdText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#d97706',
  },
  hourlyVpdTextNow: {
    color: '#fef08a',
  },
  hourlyWindText: {
    fontSize: 9,
    color: '#64748b',
  },
  hourlyWindTextNow: {
    color: '#d1fae5',
  },
  sectionTitleBlock: {
    gap: 2,
    marginTop: 6,
  },
  sectionSubHeading: {
    fontSize: 11,
    color: '#64748b',
  },
  bioCard: {
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
  bioCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  bioCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bioIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bioCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  bioCardSubGreen: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
    marginTop: 1,
  },
  bioCardSubSlate: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  bioCardHeaderRight: {
    alignItems: 'flex-end',
  },
  bioValText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#059669',
  },
  bioValTextAmber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
  },
  bioValTextGreen: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
  },
  bioDeltaText: {
    fontSize: 10,
    color: '#d97706',
    fontWeight: '600',
  },
  bioDeltaTextRed: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  bioDeltaTextGreen: {
    fontSize: 10,
    color: '#059669',
    fontWeight: '600',
  },
  gaugeContainer: {
    gap: 4,
  },
  gaugeBar: {
    height: 7,
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  gaugeSegment: {
    height: '100%',
  },
  gaugeLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gaugeLabelText: {
    fontSize: 10,
    color: '#64748b',
  },
  gaugeLabelOptimal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  gaugeLabelStress: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '600',
  },
  vpdMiniGraphWrap: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  vpdGraphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vpdGraphTitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  vpdGraphPeak: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  gddMiniGraphWrap: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  gddGraphHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gddGraphTitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  gddGraphPeak: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  cropImpactBox: {
    backgroundColor: 'rgba(240, 253, 244, 0.7)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 0.8,
    borderColor: '#dcfce7',
  },
  cropImpactText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  cropImpactBold: {
    fontWeight: '700',
    color: '#064e3b',
  },
  driversGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  driverBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  driverLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  driverVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  driverValGreen: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  driverValAmber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#d97706',
  },
  driverSubText: {
    fontSize: 9.5,
    color: '#64748b',
    marginTop: 1,
  },
  waterHeroBanner: {
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waterHeroLeft: {
    flex: 1,
    gap: 2,
  },
  waterHeroLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0369a1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  waterHeroValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0284c7',
  },
  waterHeroUnit: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
  },
  waterHeroArea: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  waterHeroRightBadge: {
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  waterHeroVolumeM3: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
    marginTop: 2,
  },
  gddHeroBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    gap: 8,
  },
  gddHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gddHeroBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  gddHeroMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  gddHeroNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#064e3b',
    letterSpacing: -0.5,
  },
  gddHeroUnit: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  gddHeroRightPill: {
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  gddHeroAge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
  },
  gddHeroPlantDate: {
    fontSize: 10,
    color: '#047857',
    marginTop: 1,
  },
  gddProgressWrap: {
    gap: 4,
    marginTop: 2,
  },
  gddProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dcfce7',
    overflow: 'hidden',
  },
  gddProgressBar: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  gddMilestonesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gddMilestoneText: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '500',
  },
  gddMilestoneHighlight: {
    fontSize: 9.5,
    color: '#047857',
    fontWeight: '700',
  },
  prescriptionBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 0.8,
    borderColor: '#bbf7d0',
  },
  prescriptionText: {
    flex: 1,
    fontSize: 11,
    color: '#1e293b',
    lineHeight: 16,
  },
  gddStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
  },
  gddLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  gddBigVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  gddRightBlock: {
    alignItems: 'flex-end',
  },
  gddStatusVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  weekCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dayRowSelected: {
    backgroundColor: '#f0fdf4',
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  dayDate: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  dayIcon: {
    fontSize: 18,
    width: 32,
    textAlign: 'center',
  },
  dayTemp: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    width: 80,
    textAlign: 'center',
  },
  dayRain: {
    fontSize: 11,
    color: '#0284c7',
    fontWeight: '600',
    width: 55,
    textAlign: 'right',
  },
  openMeteoFooter: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 10,
  },
  farmerInsightCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dcfce7',
    padding: 12,
    gap: 7,
    marginTop: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  farmerInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  farmerInsightIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerInsightTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#064e3b',
    flex: 1,
  },
  farmerInsightBody: {
    fontSize: 11.5,
    color: '#334155',
    lineHeight: 17,
  },
  farmerTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 7,
    borderWidth: 0.8,
    borderColor: '#f1f5f9',
    marginTop: 1,
  },
  farmerTipBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  farmerTipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
});
