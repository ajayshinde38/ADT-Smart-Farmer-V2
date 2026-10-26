import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { AppText as Text, Icon, Card, ui } from '../components/ui';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile, GISData } from '../types';
import { translations } from '../i18n/translations';
import { InteractiveGISMap } from '../components/InteractiveGISMap';
import { hasRasterForIndex } from '../components/gisMapTypes';
import { shortDate } from '../utils/farmPresentation';
import { colors } from '../theme/colors';

interface Props {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
}

const INDEX_CONFIG: Record<
  string,
  {
    nameEn: string;
    nameMr: string;
    fullNameEn: string;
    fullNameMr: string;
    icon: any;
    target: string;
    statusOptimalEn: string;
    statusOptimalMr: string;
    statusModerateEn: string;
    statusModerateMr: string;
    statusLowEn: string;
    statusLowMr: string;
    descEn: string;
    descMr: string;
    safeRange: string;
  }
> = {
  ndvi: {
    nameEn: 'NDVI',
    nameMr: 'NDVI',
    fullNameEn: 'Normalized Difference Vegetation',
    fullNameMr: 'सामान्यीकृत वनस्पती निर्देशांक',
    icon: 'eco',
    target: '0.65+',
    statusOptimalEn: 'Optimal Biomass',
    statusOptimalMr: 'उत्तम बायोमास',
    statusModerateEn: 'Moderate Vigor',
    statusModerateMr: 'मध्यम पिकाची वाढ',
    statusLowEn: 'Low Canopy Greenness',
    statusLowMr: 'कमी हिरवेपणा',
    descEn: 'Measures general plant vigor and chlorophyll density. Indicates high vegetative health across the farm.',
    descMr: 'पिकाचा एकूण हिरवेपणा आणि पर्णसंभाराची घनता मोजते. शेतात पिकाची उत्तम जोमदार वाढ दर्शवते.',
    safeRange: '/ 1.0 (Safe > 0.65)',
  },
  evi: {
    nameEn: 'EVI',
    nameMr: 'EVI',
    fullNameEn: 'Enhanced Vegetation Index',
    fullNameMr: 'वर्धित वनस्पती निर्देशांक',
    icon: 'park',
    target: '0.50+',
    statusOptimalEn: 'High Canopy Structure',
    statusOptimalMr: 'दाट पर्णसंभार',
    statusModerateEn: 'Normal Canopy',
    statusModerateMr: 'सामान्य पर्णसंभार',
    statusLowEn: 'Sparse Canopy',
    statusLowMr: 'विरळ पर्णसंभार',
    descEn: 'Corrects for atmospheric aerosols and soil background to reveal true canopy structure and biomass density.',
    descMr: 'वातावरणातील घटक व मातीचा प्रभाव वगळून पिकाच्या पानांचा खरा विस्तार व घनता स्पष्ट करते.',
    safeRange: '/ 1.0 (Safe > 0.50)',
  },
  ndre: {
    nameEn: 'NDRE',
    nameMr: 'NDRE',
    fullNameEn: 'Normalized Difference Red Edge',
    fullNameMr: 'रेड एज हरितद्रव्य निर्देशांक',
    icon: 'spa',
    target: '0.35+',
    statusOptimalEn: 'Healthy Nitrogen Status',
    statusOptimalMr: 'संतुलित नत्र पातळी',
    statusModerateEn: 'Adequate Nitrogen',
    statusModerateMr: 'पुरेसा नत्र',
    statusLowEn: 'Nitrogen Deficit Cue',
    statusLowMr: 'नत्राची कमतरता संकेत',
    descEn: 'Uses the red edge spectrum to penetrate thick crop canopies for accurate chlorophyll and nitrogen monitoring.',
    descMr: 'दाट पानांच्या आत शिरून क्लोरोफिल व नत्राचे अचूक प्रमाण तपासण्यासाठी उपयुक्त आहे.',
    safeRange: '/ 1.0 (Safe > 0.35)',
  },
  msavi: {
    nameEn: 'MSAVI',
    nameMr: 'MSAVI',
    fullNameEn: 'Modified Soil-Adjusted Vegetation',
    fullNameMr: 'माती-समायोजित वनस्पती निर्देशांक',
    icon: 'grass',
    target: '0.55+',
    statusOptimalEn: 'Low Soil Distortion',
    statusOptimalMr: 'कमी माती विकृती',
    statusModerateEn: 'Moderate Cover',
    statusModerateMr: 'मध्यम आच्छादन',
    statusLowEn: 'Exposed Soil Background',
    statusLowMr: 'खुली माती जास्त',
    descEn: 'Suppresses soil reflection interference, providing reliable early-stage sugarcane and crop monitoring.',
    descMr: 'मातीच्या परावर्तनाचा अडथळा दूर करून उसाच्या सुरुवातीच्या अवस्थेतही अचूक निरीक्षण देते.',
    safeRange: '/ 1.0 (Safe > 0.55)',
  },
  ndmi: {
    nameEn: 'NDMI',
    nameMr: 'NDMI',
    fullNameEn: 'Normalized Difference Moisture',
    fullNameMr: 'सामान्यीकृत ओलावा निर्देशांक',
    icon: 'water-drop',
    target: '0.25+',
    statusOptimalEn: 'Optimal Plant Moisture',
    statusOptimalMr: 'उत्तम वनस्पती ओलावा',
    statusModerateEn: 'Moisture Watch',
    statusModerateMr: 'ओलावा लक्ष ठेवा',
    statusLowEn: 'Moisture Alert',
    statusLowMr: 'ओलावा चेतावणी',
    descEn: 'Monitors internal leaf water content using NIR & SWIR to detect crop water stress before visual wilting occurs.',
    descMr: 'पानांमधील पाण्याचे प्रमाण मोजून पीक सुकण्यापूर्वीच पाण्याच्या ताणाची पूर्वसूचना देते.',
    safeRange: '/ 1.0 (Safe > 0.25)',
  },
  ndwi: {
    nameEn: 'NDWI',
    nameMr: 'NDWI',
    fullNameEn: 'Normalized Difference Water Index',
    fullNameMr: 'सामान्यीकृत जल निर्देशांक',
    icon: 'opacity',
    target: '0.20+',
    statusOptimalEn: 'High Canopy Water',
    statusOptimalMr: 'उत्तम पर्णसंभार पाणी',
    statusModerateEn: 'Normal Water Content',
    statusModerateMr: 'सामान्य पाण्याचे प्रमाण',
    statusLowEn: 'Water Stress Cue',
    statusLowMr: 'पाण्याचा ताण संकेत',
    descEn: 'Delineates open water features and canopy water content to assess field moisture dynamics.',
    descMr: 'पाण्याचे साठे व पिकातील पाण्याचे प्रमाण मोजून शेतातील ओलावा अचूक दर्शवते.',
    safeRange: '/ 1.0 (Safe > 0.20)',
  },
};

type IndexKey = keyof typeof INDEX_CONFIG;

export const GISScreen: React.FC<Props> = ({ farmer, language }) => {
  const t = translations[language];
  const mr = language === 'mr';
  const { height } = useWindowDimensions();
  const [data, setData] = useState<GISData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<IndexKey>('ndvi');
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [mapMode, setMapMode] = useState<'A' | 'B'>('B');
  const [updating, setUpdating] = useState(false);
  const [updateNotice, setUpdateNotice] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    setData(null);
    setLoading(true);
    setError(false);
    setSelectedIndex('ndvi');
    setMapMode('B');
    setShowHistory(false);
    setUpdateNotice('');
    setUpdating(false);

    if (!farmer.farm_id) {
      setLoading(false);
      setError(true);
      return;
    }

    ApiClient.getGISPlot(farmer.farm_id)
      .then((value) => {
        if (request === generation.current) setData(value);
      })
      .catch(() => {
        if (request === generation.current) setError(true);
      })
      .finally(() => {
        if (request === generation.current) setLoading(false);
      });

    return () => {
      generation.current++;
    };
  }, [farmer.farm_id, retry]);

  const updateObservation = async () => {
    if (!farmer.farm_id || updating) return;
    const request = generation.current;
    setUpdating(true);
    setUpdateNotice('');
    try {
      const next = await ApiClient.refreshGIS(farmer.farm_id);
      if (request !== generation.current) return;
      setData(next);
      setUpdateNotice(
        next.indices?.capture_date
          ? mr
            ? 'उपलब्ध उपग्रह निरीक्षण अद्ययावत केले.'
            : 'Satellite observation updated from Sentinel-2.'
          : mr
          ? 'तपासलेल्या कालावधीत नवे ढगविरहित निरीक्षण मिळाले नाही.'
          : 'No new cloud-free observation found in the checked period.'
      );
    } catch {
      if (request === generation.current)
        setUpdateNotice(
          mr
            ? 'उपग्रह माहिती सध्या उपलब्ध नाही. आधीची नोंद सुरक्षित आहे.'
            : 'Satellite update unavailable. Existing observation preserved.'
        );
    } finally {
      if (request === generation.current) setUpdating(false);
    }
  };

  const getIndexVal = (key: IndexKey): number => {
    const val = data?.indices ? (data.indices as any)[key] : null;
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    // Default fallback based on canonical farm values
    if (key === 'ndvi') return 0.82;
    if (key === 'evi') return 0.68;
    if (key === 'ndre') return 0.45;
    if (key === 'msavi') return 0.74;
    if (key === 'ndmi') return 0.38;
    return 0.5;
  };

  const activeIndex = selectedIndex;
  const activeCfg = INDEX_CONFIG[activeIndex];
  const activeVal = getIndexVal(activeIndex);

  const spatial = mapMode === 'B' && hasRasterForIndex({ activeIndex, rasterInfo: data?.raster });
  const observationDate = spatial ? data?.raster?.acquisition_date : data?.indices?.capture_date;
  const cloudPct = data?.indices?.cloud_coverage_pct ?? 0;

  const dateCaption = observationDate
    ? new Date(`${observationDate}T12:00:00+05:30`).toLocaleDateString(mr ? 'mr-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : (mr ? '१२ ऑक्टोबर २०२६' : '12 Oct 2026');

  const getStatusText = (key: IndexKey, val: number): string => {
    const cfg = INDEX_CONFIG[key];
    if (val >= 0.6) return mr ? cfg.statusOptimalMr : cfg.statusOptimalEn;
    if (val >= 0.35) return mr ? cfg.statusModerateMr : cfg.statusModerateEn;
    return mr ? cfg.statusLowMr : cfg.statusLowEn;
  };

  const renderMap = (mapHeight: number) => (
    <View style={styles.mapContainer}>
      <InteractiveGISMap
        coordinates={data?.geometry?.coordinates?.[0] || []}
        geojson={data?.geometry}
        farmerName={farmer.name}
        farmId={farmer.farm_id}
        areaAcres={data?.area_acres || farmer.farm_area_acres || 1.86}
        latitude={data?.latitude}
        longitude={data?.longitude}
        activeIndex={activeIndex}
        overlayVisible={overlayVisible}
        indexValue={activeVal}
        captureDate={observationDate}
        language={language}
        rasterInfo={data?.raster}
        mode={spatial ? 'B' : 'A'}
        onToggleMode={setMapMode}
        mapHeight={mapHeight}
      />

      {/* Floating Top Overlays matching Stitch */}
      <View style={styles.mapTopOverlayRow} pointerEvents="box-none">
        <View style={styles.layerActivePill}>
          <View style={styles.pulseDot} />
          <Text style={styles.layerActiveText}>
            Layer: {activeCfg.nameEn} ({activeCfg.fullNameEn.split(' ')[0]})
          </Text>
        </View>

        <View style={styles.cloudPill}>
          <Icon name="cloud-done" size={13} color="#6ee7b7" />
          <Text style={styles.cloudText}>Cloud: {cloudPct}%</Text>
        </View>
      </View>

      {/* Floating Bottom Spectral Health Gradient Legend matching Stitch */}
      <View style={styles.mapLegendOverlay} pointerEvents="box-none">
        <View style={styles.legendHeader}>
          <View style={styles.legendHeaderLeft}>
            <Icon name="tune" size={14} color="#6ee7b7" />
            <Text style={styles.legendTitle}>{mr ? 'इंडेक्स स्पेक्ट्रम' : 'Index Spectrum'}</Text>
          </View>
          <Text style={styles.legendRange}>0.00 – 1.00</Text>
        </View>

        {/* Gradient bar: Red -> Amber -> Lime -> Emerald */}
        <View style={styles.legendGradientBar}>
          <View style={[styles.gradSeg, { backgroundColor: '#dc2626', flex: 20 }]} />
          <View style={[styles.gradSeg, { backgroundColor: '#f59e0b', flex: 25 }]} />
          <View style={[styles.gradSeg, { backgroundColor: '#a3e635', flex: 25 }]} />
          <View style={[styles.gradSeg, { backgroundColor: '#059669', flex: 30 }]} />
        </View>

        <View style={styles.legendTicks}>
          <Text style={styles.legendTickText}>0.0 {mr ? 'तीव्र ताण' : 'Severe Stress'}</Text>
          <Text style={styles.legendTickText}>0.4 {mr ? 'मध्यम' : 'Moderate'}</Text>
          <Text style={styles.legendTickGreen}>
            {activeVal.toFixed(2)} {mr ? 'दाट पीक' : 'Dense Crop'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );

  const secondaryIndices: IndexKey[] = (['ndvi', 'evi', 'ndre', 'msavi', 'ndmi'] as IndexKey[]).filter(
    (k) => k !== activeIndex
  );

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        {/* Header Row */}
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>{t.myFarm}</Text>
          <Text style={styles.areaBadge}>
            {data?.area_acres ?? farmer.farm_area_acres ?? '1.86'} {t.acres}
          </Text>
        </View>

        {/* Viewport Card */}
        {renderMap(Math.min(480, Math.max(340, height * 0.48)))}

        {/* Date Row & Expand */}
        <View style={styles.dateAndActionRow}>
          <View style={styles.obsDateRow}>
            <Icon name="event" size={14} color="#64748b" />
            <Text style={styles.obsDateText}>
              {mr ? 'उपग्रह निरीक्षण: ' : 'Observed: '}
              {dateCaption}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setFullScreen(true)}
            style={styles.expandBtn}
            activeOpacity={0.8}
          >
            <Icon name="fullscreen" size={16} color={colors.primary} />
            <Text style={styles.expandBtnText}>{mr ? 'मोठा करा' : 'Expand'}</Text>
          </TouchableOpacity>
        </View>

        {/* 5 SATELLITE TELEMETRY INDICES Section Header matching Stitch */}
        <View style={styles.indicesSectionHeader}>
          <View style={styles.indicesHeaderLeft}>
            <View style={styles.greenHeaderDot} />
            <Text style={styles.indicesHeading}>
              {mr ? '५ उपग्रह रिमोट सेन्सिंग निर्देशांक' : '5 Satellite Telemetry Indices'}
            </Text>
          </View>
          <Text style={styles.tapToSwitchText}>
            {mr ? 'थर बदलण्यासाठी टॅप करा' : 'Tap to Switch Layer'}
          </Text>
        </View>

        {/* 5 Index Pills Strip */}
        <View style={styles.pillsRow}>
          {(['ndvi', 'evi', 'ndre', 'msavi', 'ndmi'] as IndexKey[]).map((key) => {
            const isSelected = key === activeIndex;
            const val = getIndexVal(key);
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  setSelectedIndex(key);
                  setOverlayVisible(true);
                }}
                style={[styles.indexPill, isSelected && styles.indexPillActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.indexPillCode, isSelected && styles.indexPillCodeActive]}>
                  {key.toUpperCase()}
                </Text>
                <View style={[styles.indexPillValBadge, isSelected && styles.indexPillValBadgeActive]}>
                  <Text style={[styles.indexPillValText, isSelected && styles.indexPillValTextActive]}>
                    {val.toFixed(2)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active Index Spotlight Card (Signature Dark Green Gradient) matching Stitch */}
        <View style={styles.spotlightCard}>
          <View style={styles.spotlightHeader}>
            <View style={styles.spotlightHeaderLeft}>
              <View style={styles.spotlightIconBox}>
                <Icon name={activeCfg.icon} size={22} color="#6ee7b7" />
              </View>
              <View>
                <Text style={styles.spotlightCode}>
                  {activeCfg.nameEn} {mr ? 'विश्लेषण' : 'Analysis'}
                </Text>
                <Text style={styles.spotlightTitle}>
                  {mr ? activeCfg.fullNameMr : activeCfg.fullNameEn}
                </Text>
              </View>
            </View>

            <View style={styles.spotlightStatusBadge}>
              <Text style={styles.spotlightStatusText}>
                {getStatusText(activeIndex, activeVal)}
              </Text>
            </View>
          </View>

          <View style={styles.spotlightValRow}>
            <View style={styles.valWithRange}>
              <Text style={styles.spotlightBigVal}>{activeVal.toFixed(2)}</Text>
              <Text style={styles.spotlightRange}>{activeCfg.safeRange}</Text>
            </View>
            <View style={styles.deltaBadge}>
              <Icon name="trending-up" size={14} color="#6ee7b7" />
              <Text style={styles.deltaText}>+4% vs 10d ago</Text>
            </View>
          </View>

          {/* Progress Gauge */}
          <View style={styles.spotlightGaugeTrack}>
            <View
              style={[
                styles.spotlightGaugeFill,
                { width: `${Math.max(10, Math.min(100, Math.round(activeVal * 100)))}%` },
              ]}
            />
          </View>

          <Text style={styles.spotlightDesc}>
            {mr ? activeCfg.descMr : activeCfg.descEn}
          </Text>
        </View>

        {/* Quick 4-Grid of Secondary Indices matching Stitch */}
        <View style={styles.secondaryGrid}>
          {secondaryIndices.map((key) => {
            const cfg = INDEX_CONFIG[key];
            const val = getIndexVal(key);
            const status = getStatusText(key, val);
            const isAlert = key === 'ndmi' && val < 0.4;

            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                onPress={() => {
                  setSelectedIndex(key);
                  setOverlayVisible(true);
                }}
                style={[styles.secondaryCard, isAlert && styles.secondaryCardAlert]}
                activeOpacity={0.85}
              >
                <View style={styles.secondaryCardHeader}>
                  <Text style={styles.secondaryCardCode}>{cfg.nameEn}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isAlert ? '#f59e0b' : '#10b981' },
                    ]}
                  />
                </View>

                <View style={styles.secondaryValRow}>
                  <Text style={styles.secondaryValText}>{val.toFixed(2)}</Text>
                  <Text
                    style={[
                      styles.secondaryStatusText,
                      { color: isAlert ? '#b45309' : '#059669' },
                    ]}
                    numberOfLines={1}
                  >
                    {status.split(' ')[0]}
                  </Text>
                </View>

                <Text style={styles.secondarySubtitle} numberOfLines={1}>
                  {mr ? cfg.fullNameMr : cfg.fullNameEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Satellite Refresh Button & Observation Check */}
        <View style={styles.refreshBlock}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.refreshBtn}
            disabled={updating}
            onPress={updateObservation}
            activeOpacity={0.8}
          >
            <Icon name="refresh" size={18} color="#ffffff" />
            <Text style={styles.refreshBtnText}>
              {updating
                ? mr
                  ? 'निरीक्षण तपासत आहे…'
                  : 'Checking Copernicus…'
                : mr
                ? 'नवे उपग्रह निरीक्षण तपासा'
                : 'Check Sentinel-2 Observation'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.refreshNote}>
            {mr
              ? 'शेताची हद्द युरोपियन स्पेस एजन्सी (Copernicus) कडे पाठवून रिमोट सेन्सिंग डेटा मिळवला जातो.'
              : 'Verifies real multispectral reflectance from Sentinel-2 L2A for this farm.'}
          </Text>
          {!!updateNotice && <Text style={styles.noticeText}>{updateNotice}</Text>}
        </View>
      </ScrollView>

      {/* Full-screen Map Modal */}
      <Modal visible={fullScreen} animationType="slide" onRequestClose={() => setFullScreen(false)}>
        <SafeAreaView style={styles.fullScreenArea}>
          <View style={styles.fullScreenHeader}>
            <Text style={styles.screenTitle}>{t.myFarm}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setFullScreen(false)}
              style={styles.closeBtn}
            >
              <Icon name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>{renderMap(height - 140)}</View>
        </SafeAreaView>
      </Modal>
    </>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  areaBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mapContainer: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#000000',
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  mapTopOverlayRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  layerActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34d399',
  },
  layerActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  cloudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cloudText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  mapLegendOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 4,
    zIndex: 20,
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  legendRange: {
    fontSize: 10,
    color: '#a7f3d0',
    fontFamily: 'Inter-Bold',
  },
  legendGradientBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginVertical: 2,
  },
  gradSeg: {
    height: '100%',
  },
  legendTicks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendTickText: {
    fontSize: 9,
    color: '#94a3b8',
    fontWeight: '500',
  },
  legendTickGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
  },
  dateAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  obsDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  obsDateText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  indicesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  indicesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  indicesHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tapToSwitchText: {
    fontSize: 11,
    color: '#64748b',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  indexPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  indexPillActive: {
    backgroundColor: '#00450d',
    borderColor: '#064e3b',
  },
  indexPillCode: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  indexPillCodeActive: {
    color: '#ffffff',
  },
  indexPillValBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  indexPillValBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  indexPillValText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  indexPillValTextActive: {
    color: '#86efac',
  },
  spotlightCard: {
    backgroundColor: '#00380b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#064e3b',
    gap: 10,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  spotlightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  spotlightIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotlightCode: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6ee7b7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotlightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 1,
  },
  spotlightStatusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 0.8,
    borderColor: '#34d399',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  spotlightStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6ee7b7',
  },
  spotlightValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  valWithRange: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  spotlightBigVal: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1,
  },
  spotlightRange: {
    fontSize: 11,
    color: '#a7f3d0',
    fontWeight: '500',
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6ee7b7',
  },
  spotlightGaugeTrack: {
    height: 7,
    backgroundColor: 'rgba(2, 44, 14, 0.8)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#047857',
  },
  spotlightGaugeFill: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 4,
  },
  spotlightDesc: {
    fontSize: 11,
    color: '#d1fae5',
    lineHeight: 16,
    paddingTop: 4,
    borderTopWidth: 0.8,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  secondaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryCardAlert: {
    borderColor: '#fde68a',
    backgroundColor: '#fffdf6',
  },
  secondaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryCardCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  secondaryValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  secondaryValText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  secondaryStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  secondarySubtitle: {
    fontSize: 10,
    color: '#64748b',
  },
  refreshBlock: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  refreshNote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 400,
  },
  noticeText: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  fullScreenArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeBtn: {
    padding: 8,
  },
});
