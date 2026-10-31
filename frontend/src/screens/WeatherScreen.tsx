import { FarmPage } from '../components/FarmPage';
import { WeatherMotionIcon } from '../components/WeatherMotionIcon';
import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { AppText as Text, Icon, Card, ui } from '../components/ui';
import { Sparkline } from '../components/Sparkline';
import { FieldConnections } from '../components/FieldConnections';
import { freshWeather, stageLabel } from '../utils/farmPresentation';
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
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
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
  const cumulativeGdd = data.cumulative_gdd_since_planting;
  const dailyGdd = data.forecast_7d_gdd != null ? (data.forecast_7d_gdd / Math.max(1, data.forecast_7_day.length)).toFixed(1) : '—';

  const dateLabel = (dateStr: string) =>
    new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString(locale, {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  const hourlyLabel = (label: string) => (mr ? label.replace('Now', 'आता') : label);

  return (
    <FarmPage page="weather" style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionSubHeading}>{freshWeather(data, now) ? (mr ? 'अद्ययावत' : 'Updated') : (mr ? 'वेळ तपासा' : 'Check timestamp')} · {data.last_updated_utc ? new Date(data.last_updated_utc).toLocaleString(locale, {timeZone: timezone}) : '—'} · {data.is_cached ? (mr ? 'साठवलेली नोंद' : 'Cached') : 'Open-Meteo'}</Text>
      {/* 1. Plot Micro-Atmosphere Hero Card matching Stitch */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroBadgeTitle}>
              {mr ? 'शेताचे सूक्ष्म हवामान' : 'PLOT MICRO-ATMOSPHERE'}
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

          {/* 5: Dew Point */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryCardHeader}>
              <Icon name="thermostat" size={15} color={colors.primary} />
              <Text style={styles.telemetryLabel}>{mr ? 'दव बिंदू' : 'Dew Point'}</Text>
            </View>
            <Text style={styles.telemetryValue}>{amount(dewPointC, '°C')}</Text>
            <Text style={styles.telemetrySubGreen}>{mr ? 'तापमान व आर्द्रतेवरून' : 'Derived from T / RH'}</Text>
          </View>

          {/* 6: Pressure */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryCardHeader}>
              <Icon name="compress" size={15} color={colors.primary} />
              <Text style={styles.telemetryLabel}>{mr ? 'वातावरण दाब' : 'Pressure'}</Text>
            </View>
            <Text style={styles.telemetryValue}>—</Text>
            <Text style={styles.telemetrySubSlate}>{mr ? 'माहिती दिलेली नाही' : 'Not supplied'}</Text>
          </View>
        </View>
      </View>

      {/* 2. Today's Hourly Forecast Strip matching Stitch */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleWithIcon}>
          <Icon name="schedule" size={18} color={colors.primary} />
          <Text style={styles.sectionHeading}>
            {mr ? 'तासागणिक जैविक अंदाज' : 'Hourly Bio-Forecast'}
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
                <Text style={[styles.hourlyRainText, isNow && styles.hourlyRainTextNow]}>
                  {Math.round(hour.precipitation_probability_pct)}% {mr ? 'पाऊस' : 'Rain'}
                </Text>

                <View style={[styles.hourlyMiniVpd, isNow && styles.hourlyMiniVpdNow]}>
                  <Text style={[styles.hourlyVpdText, isNow && styles.hourlyVpdTextNow]}>
                    {hour.vpd_kpa.toFixed(1)} kPa
                  </Text>
                  <Text style={[styles.hourlyWindText, isNow && styles.hourlyWindTextNow]}>
                    {Math.round(hour.wind_speed_kmh)} km/h
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* 3. Advanced Agricultural Microclimate Telemetry matching Stitch */}
      <View style={styles.sectionTitleBlock}>
        <Text style={styles.sectionHeading}>
          {mr ? 'शेताचे सूक्ष्म हवामान मापदंड' : 'Agricultural Microclimate Telemetry'}
        </Text>
        <Text style={styles.sectionSubHeading}>
          {mr
            ? 'उसाच्या बाष्पोत्सर्जन व वाढीसाठी वैज्ञानिक निर्देशांक'
            : 'Physiological indicators for sugarcane transpiration & thermal units'}
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
                {mr ? 'VPD (बाष्पदाब तूट)' : 'VPD (Vapor Pressure Deficit)'}
              </Text>
              <Text style={styles.bioCardSubGreen}>
                {mr ? 'पानांचे बाष्पोत्सर्जन प्रमाण' : 'Stomatal Transpiration Potential'}
              </Text>
            </View>
          </View>
          <View style={styles.bioCardHeaderRight}>
            <Text style={styles.bioValText}>{data.current_vpd_kpa.toFixed(2)} kPa</Text>
            <Text style={styles.bioDeltaText}>{mr ? 'सध्याचा अंदाज' : 'Current estimate'}</Text>
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

        {/* Mini VPD Sparkline */}
        <View style={styles.vpdMiniGraphWrap}>
          <View style={styles.vpdGraphHeader}>
            <Text style={styles.vpdGraphTitle}>VPD Daily Trajectory (kPa)</Text>
            <Text style={styles.vpdGraphPeak}>{mr ? 'तासागणिक अंदाज' : 'Hourly forecast'}</Text>
          </View>
          <Sparkline values={(data.hourly_forecast || []).map((h) => h.vpd_kpa)} />
        </View>

        <View style={styles.cropImpactBox}>
          <Text style={styles.cropImpactText}>
            <Text style={styles.cropImpactBold}>{mr ? 'पिकावरील परिणाम: ' : 'Crop Impact: '}</Text>
            {mr
              ? 'VPD हवेतील सुकण्याची मागणी दर्शवते. यावरून मातीचा ओलावा किंवा पानांची प्रत्यक्ष स्थिती ठरत नाही.'
              : 'VPD indicates atmospheric drying demand. It does not measure soil moisture or establish leaf condition; check the field before watering.'}
          </Text>
        </View>
      </View>

      {/* Card B: ET0 (Reference Evapotranspiration) */}
      <View style={styles.bioCard}>
        <View style={styles.bioCardHeader}>
          <View style={styles.bioCardHeaderLeft}>
            <View style={styles.bioIconCircle}>
              <Icon name="water-drop" size={20} color="#047857" />
            </View>
            <View>
              <Text style={styles.bioCardTitle}>
                {mr ? 'ET₀ (संदर्भ बाष्पोत्सर्जन)' : 'ET₀ (Reference Evapotranspiration)'}
              </Text>
              <Text style={styles.bioCardSubSlate}>
                {mr ? 'वातावरणातील पाण्याची मागणी' : 'Atmospheric Evaporative Demand'}
              </Text>
            </View>
          </View>
          <View style={styles.bioCardHeaderRight}>
            <Text style={styles.bioValTextAmber}>{data.current_et0_mm.toFixed(1)} mm/{mr ? 'दिवस' : 'day'}</Text>
            <Text style={styles.bioDeltaTextRed}>{mr ? 'संदर्भ मागणी' : 'Reference demand'}</Text>
          </View>
        </View>

        <View style={styles.driversGrid}>
          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>{mr ? 'थेट घटक' : 'Direct Drivers'}:</Text>
            <Text style={styles.driverVal}>
              {Math.round(data.current_temp_c)}°C • {Math.round(data.current_humidity_pct)}% RH
            </Text>
          </View>
          <View style={styles.driverBox}>
            <Text style={styles.driverLabel}>{mr ? 'पाण्याची मागणी' : 'Water Demand'}:</Text>
            <Text style={styles.driverValGreen}>
              {waterDemandLHa.toLocaleString()} L / {mr ? 'हेक्टर' : 'Hectare'}
            </Text>
          </View>
        </View>

        <View style={styles.prescriptionBox}>
          <Icon name="opacity" size={18} color={colors.primary} />
          <Text style={styles.prescriptionText}>
            <Text style={styles.cropImpactBold}>{mr ? 'कृषी शिफारस: ' : 'Agronomic Prescription: '}</Text>
            {mr
              ? `संदर्भ बाष्पोत्सर्जनाचे समतुल्य ${waterDemandLHa.toLocaleString()} L/ha आहे. हा प्रत्यक्ष सिंचन आदेश नाही. पीक गुणांक, पाऊस व मातीचा ओलावा तपासा.`
              : `Reference ET₀ is equivalent to ${waterDemandLHa.toLocaleString()} L/ha. This is not an irrigation dose. Account for crop coefficient, rainfall and soil moisture.`}
          </Text>
        </View>
      </View>

      {/* Card C: GDD (Growing Degree Days) */}
      <View style={styles.bioCard}>
        <View style={styles.bioCardHeader}>
          <View style={styles.bioCardHeaderLeft}>
            <View style={styles.bioIconCircle}>
              <Icon name="thermostat" size={20} color="#047857" />
            </View>
            <View>
              <Text style={styles.bioCardTitle}>
                {mr ? 'GDD (वाढीचे अंश दिवस)' : 'GDD (Growing Degree Days)'}
              </Text>
              <Text style={styles.bioCardSubSlate}>
                {mr ? 'संदर्भ पायाभूत आधार: १८°C' : 'Reference Base Threshold: 18°C'}
              </Text>
            </View>
          </View>
          <View style={styles.bioCardHeaderRight}>
            <Text style={styles.bioValTextGreen}>{amount(data.forecast_7d_gdd, ' GDD', 1)}</Text>
            <Text style={styles.bioDeltaTextGreen}>{mr ? 'पुढील सात दिवस' : 'Next seven days'}</Text>
          </View>
        </View>

        <View style={styles.gddStatsRow}>
          <View>
            <Text style={styles.gddLabel}>{mr ? 'अंदाजित दैनिक सरासरी' : 'Forecast daily mean'}</Text>
            <Text style={styles.gddBigVal}>{dailyGdd} GDD / {mr ? 'दिवस' : 'day'}</Text>
          </View>
          <View style={styles.gddRightBlock}>
            <Text style={styles.gddLabel}>{mr ? 'वाढीची स्थिती' : 'Development Status'}</Text>
            <Text style={styles.gddStatusVal}>
              {stageLabel(irrigation?.crop_stage, language)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bioCard}>
        <View style={styles.bioCardHeader}><View style={styles.bioCardHeaderLeft}><View style={styles.bioIconCircle}><Icon name="water-drop" size={20} color="#047857" /></View><View><Text style={styles.bioCardTitle}>{mr ? 'शेतासाठी सिंचन अंदाज' : 'Farm irrigation estimate'}</Text><Text style={styles.bioCardSubSlate}>{mr ? 'पाऊस व पीक गुणांक विचारात घेतले' : 'Includes rainfall and crop coefficient'}</Text></View></View></View>
        <View style={styles.driversGrid}><View style={styles.driverBox}><Text style={styles.driverLabel}>{mr ? 'निव्वळ पाण्याची गरज' : 'Net water estimate'}</Text><Text style={styles.driverValGreen}>{amount(irrigation?.net_irrigation_mm_day, ' mm/day')}</Text></View><View style={styles.driverBox}><Text style={styles.driverLabel}>{mr ? 'संपूर्ण शेत' : 'Whole farm'}</Text><Text style={styles.driverValGreen}>{amount(irrigation?.water_required_liters, ' L', 0)}</Text></View></View>
        <Text style={styles.cropImpactText}>{mr ? 'हा हवामानावर आधारित अंदाज आहे. मातीचा ओलावा व प्रत्यक्ष पंप प्रवाह तपासा. पंप व पीक गुणांकाच्या गृहीतकांसाठी सल्ला विभाग पाहा.' : (irrigation?.assumptions_note || 'Estimate unavailable. Check field soil moisture and actual pump flow.')}</Text>
        <Text style={styles.sectionSubHeading}>{mr ? 'लागवडीपासून GDD' : 'GDD since planting'}: {amount(cumulativeGdd, '', 0)} · {mr ? 'ऐतिहासिक हवामान नोंदी आवश्यक' : 'Verified historical weather required'}</Text>
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
      <FieldConnections context={data.field_context} language={language} />

      <Text
        accessibilityRole="link"
        onPress={() => Linking.openURL('https://open-meteo.com/')}
        style={styles.openMeteoFooter}
      >
        Weather data © Open-Meteo
      </Text>
    </FarmPage>
  );
};

const styles = StyleSheet.create({
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
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 95,
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
    fontSize: 17,
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
  },
  vpdGraphPeak: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
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
    gap: 3,
  },
  driverLabel: {
    fontSize: 10,
    color: '#64748b',
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
});
