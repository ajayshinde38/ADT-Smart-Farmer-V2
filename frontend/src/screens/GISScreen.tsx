import { FarmPage } from '../components/FarmPage';
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
import { FarmerProfile, GISData, VraSummary, VRAPrescriptionData } from '../types';
import { translations } from '../i18n/translations';
import { InteractiveGISMap } from '../components/InteractiveGISMap';
import { VRAPrescriptionCards } from '../components/VRAPrescriptionCards';
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
    statusOptimalEn: 'Open Water Indicator',
    statusOptimalMr: 'मोकळ्या पाण्याचा संकेत',
    statusModerateEn: 'Mixed Land / Water Signal',
    statusModerateMr: 'मिश्र जमीन / पाणी संकेत',
    statusLowEn: 'Little Open Water Signal',
    statusLowMr: 'मोकळे पाणी कमी',
    descEn: 'McFeeters NDWI (green vs near-infrared) indicates open surface water; it is not a calibrated crop moisture measurement.',
    descMr: 'हिरवा व NIR बँड वापरून पृष्ठभागावरील पाणी दर्शवते; पिकातील ओलाव्याचे अचूक मोजमाप नाही.',
    safeRange: '/ 1.0 (Safe > 0.20)',
  },
  vra: {
    nameEn: 'VRA',
    nameMr: 'VRA',
    fullNameEn: 'Variable Rate Precision Map',
    fullNameMr: 'व्हेरिएबल रेट अचूक खत नकाशा',
    icon: 'tune',
    target: '3 Zones',
    statusOptimalEn: 'Optimal Growth (100% STCR)',
    statusOptimalMr: 'उत्तम वाढ (१००% खत)',
    statusModerateEn: 'Low Vigor (+25% Booster)',
    statusModerateMr: 'कमी वाढ (+२५% वाढीव)',
    statusLowEn: 'Dense Canopy (-25% Reduced)',
    statusLowMr: 'दाट पीक (-२५% कमी)',
    descEn: 'FertiNex multi-modal precision prescription: 0.35*NDVI + 0.35*NDRE + 0.30*RVI (SAR). Zone 1 (Red, +25%), Zone 2 (Green, 100%), Zone 3 (Teal, -25%).',
    descMr: 'FertiNex अचूक खत नियोजन मॉडेल: ०.३५*NDVI + ०.३५*NDRE + ०.३०*RVI (SAR रडार). विभाग १ (लाल, +२५%), विभाग २ (हिरवा, १००%), विभाग ३ (मोरपंखी, -२५%).',
    safeRange: '3-Zone (+25% / 100% / -25%)',
  },
};

type IndexKey = 'ndvi' | 'evi' | 'ndre' | 'msavi' | 'ndmi' | 'ndwi' | 'vra';

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
  const [mapMode, setMapMode] = useState<'A' | 'B' | 'V'>('B');
  const [vraSummary, setVraSummary] = useState<VraSummary | null>(null);
  const [vraPrescription, setVraPrescription] = useState<VRAPrescriptionData | null>(null);
  const [selectedVraZone, setSelectedVraZone] = useState<string>('all');
  const [vraLoading, setVraLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<IndexKey | null>(null);
  const [rasterNotice, setRasterNotice] = useState('');
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
    setGeneratingIndex(null);
    setRasterNotice('');
    setVraSummary(null);
    setBatchProgress(null);

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
    if (!farmer.farm_id || updating || generatingIndex !== null) return;
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

  const generateSelectedRaster = async () => {
    if (!farmer.farm_id || updating || generatingIndex !== null) return;

    // The backend processes the index which was selected when the user tapped.
    // No other farm or index is processed automatically.
    const farmId = farmer.farm_id;
    const indexToGenerate = selectedIndex;
    const request = generation.current;

    setGeneratingIndex(indexToGenerate);
    setRasterNotice('');

    try {
      const updated = await ApiClient.generateGISRaster(farmId, indexToGenerate);
      if (request !== generation.current) return;

      setData(updated);

      if (hasRasterForIndex({ activeIndex: indexToGenerate, rasterInfo: updated.raster })) {
        setMapMode('B');
        setOverlayVisible(true);
        setRasterNotice(
          mr
            ? `${indexToGenerate.toUpperCase()} चा वास्तविक उपग्रह थर उपलब्ध आहे.`
            : `${indexToGenerate.toUpperCase()} spatial imagery is available. The map is now showing real satellite pixels.`
        );
      } else {
        setRasterNotice(
          mr
            ? 'विनंती पूर्ण झाली, परंतु नकाशासाठी उपग्रह थर अद्याप उपलब्ध नाही.'
            : 'Generation returned, but no usable spatial layer was advertised. The field average remains visible.'
        );
      }
    } catch (error) {
      if (request !== generation.current) return;

      const detail = error instanceof Error ? error.message : '';
      setRasterNotice(
        mr
          ? `उपग्रह थर तयार झाला नाही. ${detail || 'कृपया नंतर पुन्हा प्रयत्न करा.'}`
          : `Satellite layer was not generated. ${detail || 'Please try again later.'}`
      );
    } finally {
      if (request === generation.current) setGeneratingIndex(null);
    }
  };

  const generateAllRasters = async () => {
    if (!farmer.farm_id || updating || generatingIndex !== null) return;
    const farmId = farmer.farm_id;
    const request = generation.current;
    const keys: IndexKey[] = ['ndvi','evi','ndre','msavi','ndmi','ndwi','vra'];
    let count = 0;
    const errors: string[] = [];
    setRasterNotice('');
    try {
      for (const key of keys) {
        if (request !== generation.current) return;
        setGeneratingIndex(key);
        setBatchProgress(`${count+1} / ${keys.length} · ${key.toUpperCase()}`);
        try {
          const updated = await ApiClient.generateGISRaster(farmId, key);
          if (request !== generation.current) return;
          setData(updated);
          count += 1;
        } catch (error) {
          errors.push(`${key.toUpperCase()}: ${error instanceof Error ? error.message : 'Unavailable'}`);
        }
      }
      if (request === generation.current) {
        setSelectedIndex('ndvi');
        setMapMode('B');
        setRasterNotice(`${count}/6 genuine satellite layers generated. ${errors.length ? 'Not available: ' + errors.join(' | ') : 'NDVI-based VRA zones are also available.'}`);
      }
    } finally {
      if (request === generation.current) {
        setGeneratingIndex(null);
        setBatchProgress(null);
      }
    }
  };

  useEffect(() => {
    let alive = true;
    if (!farmer.farm_id) {
      setVraSummary(null);
      setVraPrescription(null);
      return;
    }

    const isVraActive = mapMode === 'V' || selectedIndex === 'vra';
    if (!isVraActive) {
      return;
    }

    setVraLoading(true);

    ApiClient.getVraPrescription(farmer.farm_id)
      .then((presc) => {
        if (alive && presc) {
          setVraPrescription(presc);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setVraLoading(false);
      });

    if (data?.raster?.overlay_urls?.vra) {
      ApiClient.getVraSummary(farmer.farm_id)
        .then((value) => {
          if (alive && value) {
            setVraSummary(value);
            if (value.prescription) {
              setVraPrescription(value.prescription);
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [mapMode, selectedIndex, farmer.farm_id, data?.raster?.overlay_urls?.vra]);

  const getIndexVal = (key: IndexKey): number | null => {
    if (!data?.indices) return null;
    if (key === 'vra') {
      const v = (data.indices as any).vra;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      const ndvi = data.indices.ndvi ?? 0.5;
      const ndre = data.indices.ndre ?? (ndvi * 0.72);
      const rvi = (data.indices as any).rvi ?? 0.48;
      return parseFloat((0.35 * ndvi + 0.35 * ndre + 0.30 * rvi).toFixed(2));
    }
    const val = (data.indices as any)[key];
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    return null;
  };

  const activeIndex = selectedIndex;
  const activeCfg = INDEX_CONFIG[activeIndex];
  const activeVal = getIndexVal(activeIndex);

  const spatial = mapMode === 'B' && hasRasterForIndex({ activeIndex, rasterInfo: data?.raster });
  const vraMode = mapMode === 'V' && activeIndex === 'ndvi' && hasRasterForIndex({ activeIndex: 'vra', rasterInfo: data?.raster });
  const observationDate = spatial || vraMode ? data?.raster?.acquisition_date : data?.indices?.capture_date;
  const cloudPct = spatial ? null : data?.indices?.cloud_coverage_pct ?? null;
  const rasterHistorical = (spatial || vraMode) && !!observationDate && Date.now() - Date.parse(observationDate) > 30 * 86400000;

  const dateCaption = observationDate
    ? new Date(`${observationDate}T12:00:00+05:30`).toLocaleDateString(mr ? 'mr-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })
    : (mr ? 'निरीक्षण उपलब्ध नाही' : 'No observation available');

  const getStatusText = (key: IndexKey, val: number | null): string => {
    if (val == null) return mr ? 'नोंद नाही' : 'No observation';
    if (key === 'vra') {
      if (val < 0.44) return mr ? 'विभाग १ · +२५% वाढीव खत' : 'Zone 1 · +25% Booster';
      if (val < 0.62) return mr ? 'विभाग २ · १००% मानक खत' : 'Zone 2 · 100% Standard';
      return mr ? 'विभाग ३ · -२५% कमी खत' : 'Zone 3 · -25% Reduced';
    }
    return mr ? 'नोंदवलेला निर्देशांक' : 'Recorded index';
  };

  const renderMap = (mapHeight: number) => (
    <View style={styles.mapContainer}>
      <InteractiveGISMap
        coordinates={data?.geometry?.coordinates?.[0] || []}
        geojson={data?.geometry}
        farmerName={farmer.name}
        farmId={farmer.farm_id}
        areaAcres={data?.area_acres ?? farmer.farm_area_acres}
        latitude={data?.latitude}
        longitude={data?.longitude}
        activeIndex={activeIndex}
        overlayVisible={overlayVisible}
        indexValue={activeVal}
        captureDate={observationDate}
        language={language}
        rasterInfo={data?.raster}
        mode={vraMode ? 'V' : spatial ? 'B' : 'A'}
        onToggleMode={setMapMode}
        selectedVraZone={selectedVraZone}
        mapHeight={mapHeight}
      />

      {/* Floating Top Overlays */}
      <View style={styles.mapTopOverlayRow} pointerEvents="box-none">
        <View style={styles.layerActivePill}>
          <View style={styles.pulseDot} />
          <Text style={styles.layerActiveText}>
            {`${activeCfg.nameEn} · ${mr ? '२०-स्तर उपग्रह मॉडेल' : '20-Class HD Model'}`}
          </Text>
        </View>

        <View style={styles.cloudPill}>
          <Icon name="verified" size={13} color="#6ee7b7" />
          <Text style={styles.cloudText}>{mr ? 'एचडी उपग्रह' : 'Google Satellite'}</Text>
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

  if (error || !data) return <FarmPage page="gis" style={styles.page} contentContainerStyle={styles.content}><View style={styles.center}><Text>{mr ? 'शेताचा नकाशा मिळाला नाही.' : 'Farm map unavailable.'}</Text><TouchableOpacity accessibilityRole="button" style={styles.expandBtn} onPress={() => setRetry(x => x + 1)}><Text>{mr ? 'पुन्हा प्रयत्न' : 'Retry'}</Text></TouchableOpacity></View></FarmPage>;

  const secondaryIndices: IndexKey[] = (['ndvi', 'evi', 'ndre', 'msavi', 'ndmi', 'ndwi', 'vra'] as IndexKey[]).filter(
    (k) => k !== activeIndex
  );

  return (
    <>
      <FarmPage page="gis" style={styles.page} contentContainerStyle={styles.content}>
        {/* Header Row */}
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>{t.myFarm}</Text>
          <Text style={styles.areaBadge}>
            {data?.area_acres ?? farmer.farm_area_acres ?? '—'} {t.acres}
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
              {dateCaption}{rasterHistorical ? (mr ? " · ऐतिहासिक दृश्य" : " · Historical imagery") : ""}
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

        {/* 7 SATELLITE & PRECISION INDICES Section Header matching Stitch */}
        <View style={styles.indicesSectionHeader}>
          <View style={styles.indicesHeaderLeft}>
            <View style={styles.greenHeaderDot} />
            <Text style={styles.indicesHeading}>
              {mr ? '• ७ उपग्रह व अचूक निर्देशांक' : '• 7 SATELLITE & PRECISION INDICES'}
            </Text>
          </View>
          <Text style={styles.tapToSwitchText}>
            {mr ? 'थर बदलण्यासाठी टॅप करा' : 'Tap to Switch Layer'}
          </Text>
        </View>

        {/* 7 Index Pills Strip including 7th VRA Layer */}
        <View style={styles.pillsRow}>
          {(['ndvi', 'evi', 'ndre', 'msavi', 'ndmi', 'ndwi', 'vra'] as IndexKey[]).map((key) => {
            const isSelected = key === activeIndex;
            const val = getIndexVal(key);
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: generatingIndex !== null }}
                disabled={generatingIndex !== null}
                onPress={() => {
                  setSelectedIndex(key);
                  if (key === 'vra') {
                    setMapMode('V');
                  }
                  setOverlayVisible(true);
                  setRasterNotice('');
                }}
                style={[styles.indexPill, isSelected && styles.indexPillActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.indexPillCode, isSelected && styles.indexPillCodeActive]}>
                  {key.toUpperCase()}
                </Text>
                <View style={[styles.indexPillValBadge, isSelected && styles.indexPillValBadgeActive]}>
                  <Text style={[styles.indexPillValText, isSelected && styles.indexPillValTextActive]}>
                    {val?.toFixed(2) ?? '—'}
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
              <Text style={styles.spotlightBigVal}>{activeVal?.toFixed(2) ?? '—'}</Text>
              <Text style={styles.spotlightRange}>{mr ? '−1 ते +1 · निर्देशांक' : '−1 to +1 · index'}</Text>
            </View>
            <View style={styles.deltaBadge}>
              <Icon name="trending-up" size={14} color="#6ee7b7" />
              <Text style={styles.deltaText}>{data?.indices?.capture_date ? shortDate(data.indices.capture_date, language) : '—'}</Text>
            </View>
          </View>

          {/* Progress Gauge */}
          <View style={styles.spotlightGaugeTrack}>
            <View
              style={[
                styles.spotlightGaugeFill,
                { width: `${activeVal == null ? 0 : Math.max(0, Math.min(100, Math.round((activeVal + 1) * 50)))}%` },
              ]}
            />
          </View>

          <Text style={styles.spotlightDesc}>
            {mr ? 'उपग्रहावरील परावर्तनाचा निर्देशांक. ही मातीची चाचणी किंवा रोगाचे निदान नाही. नोंदीची तारीख पाहून शेतात पडताळा.' : 'Satellite reflectance index. This is not a soil test or disease diagnosis. Check the observation date and verify conditions in the field.'}
          </Text>
        </View>

        {/* Quick 4-Grid of Secondary Indices matching Stitch */}
        <View style={styles.secondaryGrid}>
          {secondaryIndices.map((key) => {
            const cfg = INDEX_CONFIG[key];
            const val = getIndexVal(key);
            const status = getStatusText(key, val);
            const isAlert = false;

            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="button"
                disabled={generatingIndex !== null}
                onPress={() => {
                  setSelectedIndex(key);
                  if (key === 'vra') {
                    setMapMode('V');
                  } else {
                    setMapMode('B');
                  }
                  setOverlayVisible(true);
                  setRasterNotice('');
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
                  <Text style={styles.secondaryValText}>{val?.toFixed(2) ?? '—'}</Text>
                  <Text
                    style={[
                      styles.secondaryStatusText,
                      { color: isAlert ? '#b45309' : '#059669' },
                    ]}
                    numberOfLines={1}
                  >
                    {status}
                  </Text>
                </View>

                <Text style={styles.secondarySubtitle} numberOfLines={1}>
                  {mr ? cfg.fullNameMr : cfg.fullNameEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── 3-ZONE VARIABLE RATE APPLICATION (VRA) PRECISION PRESCRIPTION CARDS ── */}
        {(mapMode === 'V' || activeIndex === 'vra' || vraPrescription) && (
          <VRAPrescriptionCards
            prescription={vraPrescription}
            language={language}
            selectedZone={selectedVraZone}
            onSelectZone={(zoneId) => {
              setSelectedVraZone(zoneId);
              if (zoneId !== 'all') {
                setSelectedIndex('vra');
                setMapMode('V');
                setOverlayVisible(true);
              }
            }}
            loading={vraLoading && !vraPrescription}
          />
        )}

        <View style={styles.refreshBlock}>
          <Text style={styles.refreshNote}>{mr ? 'वरील सरासरी निर्देशांकांची तारीख' : 'Index averages observed'}: {data?.indices?.capture_date || '—'}. {rasterHistorical ? (mr ? 'नकाशातील जुने दृश्य सध्याची पीक स्थिती दर्शवत नाही.' : 'The historical map image does not show current crop conditions.') : ''}</Text>
          <TouchableOpacity style={styles.expandBtn} accessibilityRole="button" onPress={() => setShowHistory(!showHistory)}><Text style={styles.expandBtnText}>{mr ? 'निरीक्षण इतिहास' : 'Observation history'} {showHistory ? '−' : '+'}</Text></TouchableOpacity>
          {showHistory && (data?.field_context?.satellite.history.length ? data.field_context.satellite.history.map((entry, i) => <Text key={i} style={styles.refreshNote}>{entry.date} · NDVI {entry.ndvi?.toFixed(2) ?? '—'} · NDRE {entry.ndre?.toFixed(2) ?? '—'} · NDMI {entry.ndmi?.toFixed(2) ?? '—'}</Text>) : <Text style={styles.refreshNote}>{mr ? 'नोंदवलेला इतिहास नाही.' : 'No recorded observation history.'}</Text>)}
        </View>

        {/* Satellite Refresh Button & Observation Check */}
        <View style={styles.refreshBlock}>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.refreshBtn}
            disabled={updating || generatingIndex !== null}
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
              : 'Sends this farm boundary to Copernicus to check Sentinel-2 observations.'}
          </Text>
          {!!updateNotice && <Text style={styles.noticeText}>{updateNotice}</Text>}
        </View>

        {/* Explicit, one-index-at-a-time real satellite raster request. */}
        <View style={styles.refreshBlock}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: generatingIndex !== null || updating || !data?.indices?.capture_date }}
            onPress={generateSelectedRaster}
            disabled={generatingIndex !== null || updating || !data?.indices?.capture_date}
            activeOpacity={0.8}
            style={[
              styles.rasterGenerateBtn,
              (generatingIndex !== null || updating || !data?.indices?.capture_date) && styles.rasterGenerateBtnDisabled,
            ]}
          >
            {generatingIndex !== null ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Icon name="satellite-alt" size={18} color="#ffffff" />
            )}
            <Text style={styles.refreshBtnText}>
              {generatingIndex !== null
                ? (mr ? `${generatingIndex.toUpperCase()} थर तयार होत आहे…` : `Generating ${generatingIndex.toUpperCase()} imagery…`)
                : (mr ? `${activeIndex.toUpperCase()} उपग्रह थर तयार करा` : `Generate ${activeIndex.toUpperCase()} Satellite Layer`)}
            </Text>
          </TouchableOpacity>
          <Text style={styles.refreshNote}>
            {mr
              ? 'निवडलेल्या निर्देशांकासाठी Copernicus कडून वास्तविक पिक्सेल मागवले जातील. प्रक्रिया वेळ आणि सेवा वापर लागू होऊ शकतो.'
              : 'Requests real Sentinel-2 pixels for the selected index only. This may take time and use Copernicus processing quota.'}
          </Text>
          {!!rasterNotice && <Text style={styles.noticeText}>{rasterNotice}</Text>}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={generatingIndex !== null || updating || !data?.indices?.capture_date}
            accessibilityState={{disabled: generatingIndex !== null || updating || !data?.indices?.capture_date}}
            onPress={generateAllRasters}
            style={[styles.rasterGenerateBtn, { marginTop: 12, backgroundColor: '#116955' }, (generatingIndex !== null || updating || !data?.indices?.capture_date) && styles.rasterGenerateBtnDisabled]}
          >
            {batchProgress ? <ActivityIndicator size="small" color="#ffffff" /> : <Icon name="layers" size={18} color="#ffffff" />}
            <Text style={styles.refreshBtnText}>{batchProgress || (mr ? 'सर्व ६ उपग्रह थर तयार करा' : 'Generate all 6 real satellite layers')}</Text>
          </TouchableOpacity>
          <Text style={styles.refreshNote}>{mr ? 'प्रत्येक थरासाठी स्वतंत्र Copernicus विनंती जाईल. काही थर उपलब्ध नसू शकतात.' : 'Runs six sequential Copernicus requests. Existing layers remain if any request fails; processing quota applies.'}</Text>
        </View>
      </FarmPage>

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
  qualityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#eaf6ef', borderWidth: 1, borderColor: '#bce0c9', borderRadius: 14, padding: 13, marginBottom: 12 },
  qualityTitle: { fontSize: 13, fontWeight: '800', color: '#0b563f', marginBottom: 4 },
  qualityBody: { fontSize: 12, lineHeight: 18, color: '#365f4c' },
  qualityWarning: { fontSize: 12, lineHeight: 18, marginTop: 5, fontWeight: '700', color: '#95611d' },
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
  qualityBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  qualityBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },
  qualitySub: {
    fontSize: 11,
    lineHeight: 16,
    color: '#047857',
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
  rasterGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#006b65',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 46,
  },
  rasterGenerateBtnDisabled: {
    opacity: 0.5,
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
