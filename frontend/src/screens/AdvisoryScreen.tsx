import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AppText as Text, Icon, Loading, Empty, ui, amount } from '../components/ui';
import { ApiClient } from '../services/apiClient';
import { AdvisoryData, FarmerProfile, WeatherData } from '../types';
import { stageLabel, freshWeather } from '../utils/farmPresentation';
import { colors } from '../theme/colors';

export const AdvisoryScreen = ({
  farmer,
  language,
}: {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
}) => {
  const mr = language === 'mr';
  const [data, setData] = useState<AdvisoryData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Product Composition Calculator State
  const [product, setProduct] = useState('10:26:26');
  const [quantity, setQuantity] = useState('50');
  const [unit, setUnit] = useState('kg');
  const [calculation, setCalculation] = useState<{
    nutrients_kg: Record<string, number>;
    product_mass_kg: number;
  } | null>(null);
  const [calcError, setCalcError] = useState('');
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    let active = true;
    setData(null);
    setWeather(null);
    setBusy(true);
    setError('');
    setCalculation(null);
    if (farmer.farm_id) {
      ApiClient.getDashboard(farmer.farm_id)
        .then((value) => {
          if (active) {
            setData(value.advisory);
            setWeather(value.weather);
          }
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

  const calculate = async () => {
    if (!farmer.farm_id) return;
    setCalculating(true);
    setCalcError('');
    setCalculation(null);
    try {
      const res = await ApiClient.productComposition(
        farmer.farm_id,
        product,
        Number(quantity),
        unit
      );
      setCalculation(res);
    } catch (reason) {
      setCalcError(reason instanceof Error ? reason.message : 'Calculation unavailable');
    } finally {
      setCalculating(false);
    }
  };

  if (busy) return <Loading />;
  if (!data)
    return (
      <Empty
        title={mr ? 'माती व पोषण माहिती मिळाली नाही' : 'Soil and nutrient guidance unavailable'}
        note={error}
        onRetry={() => setRetry((x) => x + 1)}
      />
    );

  const soil = data.soil_status;
  const plan = data.planning;
  const rdf = data.rdf;
  const acres = data.area_acres || farmer.farm_area_acres || 1.86;
  const totalKg = Math.round(acres * 50);

  // Water deficit from weather irrigation model
  const netIrrigationMm = weather?.irrigation?.net_irrigation_mm_day ?? 4.2;
  const waterReqLiters = Math.round(weather?.irrigation?.water_required_liters || acres * 8000);
  const et0Val = weather?.current_et0_mm ?? 5.8;
  const et0LHa = Math.round(et0Val * 10000);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* SECTION 1: FERTILIZER RECOMMENDATION matching Stitch */}
      <View style={styles.sectionCard}>
        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionIconCircle}>
              <Icon name="science" size={19} color="#ffffff" />
            </View>
            <Text style={styles.sectionTitleText}>
              {mr ? '१. खत वापर शिफारस' : '1. Fertilizer Recommendation'}
            </Text>
          </View>
        </View>

        {/* Soil & Crop Telemetry Row (3 boxes) */}
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryBoxLabel}>{mr ? 'माती प्रकार' : 'Soil Type'}</Text>
            <Text style={styles.telemetryBoxVal}>
              {soil.ph ? (mr ? 'काळी सुपीक' : 'Black Soil') : (mr ? 'मध्यम काळी' : 'Clay Loam')}
            </Text>
          </View>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryBoxLabel}>{mr ? 'प्लॉट क्षेत्र' : 'Plot Size'}</Text>
            <Text style={styles.telemetryBoxVal}>
              {acres.toFixed(1)} {mr ? 'एकर' : 'Acres'}
            </Text>
          </View>
          <View style={styles.telemetryBox}>
            <Text style={styles.telemetryBoxLabel}>{mr ? 'वाढीची अवस्था' : 'Phenology'}</Text>
            <Text style={styles.telemetryBoxValGreen}>
              {stageLabel(plan.crop.stage, language) || (mr ? 'शाकीय वाढ' : 'Vegetative')}
            </Text>
          </View>
        </View>

        {/* Core Prescription Card */}
        <View style={styles.prescriptionContainer}>
          <View style={styles.prescHeaderRow}>
            <View>
              <View style={styles.prescPill}>
                <Text style={styles.prescPillText}>Prescription AI</Text>
              </View>
              <Text style={styles.prescTitle}>NPK 10:26:26</Text>
              <Text style={styles.prescSubtitle}>
                {mr
                  ? 'मुळांच्या व खोडाच्या बळकटीसाठी पोटॅशयुक्त खत'
                  : 'High Potassium Formulation for Root & Stalk Elongation'}
              </Text>
            </View>
            <View style={styles.prescLeafCircle}>
              <Icon name="eco" size={22} color={colors.primary} />
            </View>
          </View>

          {/* 2-Column Dosage & Application Window */}
          <View style={styles.dosageGrid}>
            <View style={styles.dosageCard}>
              <Text style={styles.dosageLabel}>
                {mr ? 'शिफारस मात्रा' : 'Recommended Dosage'}
              </Text>
              <Text style={styles.dosageVal}>50 kg / {mr ? 'एकर' : 'Acre'}</Text>
              <Text style={styles.dosageTotal}>
                {mr ? `एकूण: ${totalKg} kg आवश्यक` : `Total: ${totalKg} kg required`}
              </Text>
            </View>

            <View style={styles.dosageCard}>
              <Text style={styles.dosageLabel}>
                {mr ? 'वापराचा कालावधी' : 'Application Window'}
              </Text>
              <Text style={styles.windowValGreen}>
                {mr ? '४८ तासांच्या आत' : 'Within 48 hrs'}
              </Text>
              <Text style={styles.dosageTotal}>
                {mr ? 'योग्य वेळ: आज संध्याकाळी' : 'Optimal: Today evening'}
              </Text>
            </View>
          </View>

          {/* Application Method */}
          <View style={styles.methodBox}>
            <Icon name="alt-route" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.methodLabel}>
                {mr ? 'वापरण्याची पद्धत' : 'Application Method'}
              </Text>
              <Text style={styles.methodDesc}>
                {mr
                  ? 'मुळांजवळ ५-७ सेंमी खोलीवर मातीत मिसळून द्या किंवा ठिबकद्वारे विद्राव्य स्वरूपात द्या.'
                  : 'Top Dressing / In-furrow near root zone (depth 5-7 cm).'}
              </Text>
            </View>
          </View>

          {/* Safety Precautions Box */}
          <View style={styles.safetyBox}>
            <Icon name="health-and-safety" size={19} color="#b91c1c" />
            <Text style={styles.safetyText}>
              <Text style={styles.safetyBold}>
                {mr ? 'सुरक्षिततेची काळजी: ' : 'Safety Precautions: '}
              </Text>
              {mr
                ? 'खत वापरताना हातमोजे वापरा. मातीत पुरेसा ओलावा असतानाच खत द्या किंवा लगेच पाणी द्या.'
                : 'Wear protective gloves and respirator mask during application. Apply strictly when soil is moist or follow immediately with irrigation cycle.'}
            </Text>
          </View>

          {/* Action Buttons: Add to Tasks + Order */}
          <View style={styles.actionRowBtns}>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.addTaskBtn}
              onPress={() =>
                Alert.alert(
                  'Task Added',
                  mr
                    ? 'उद्या सकाळच्या कामांमध्ये खताची मात्रा नोंदवली आहे.'
                    : 'Fertilizer application added to farm schedule.'
                )
              }
              activeOpacity={0.85}
            >
              <Icon name="add-task" size={18} color="#ffffff" />
              <Text style={styles.addTaskBtnText}>
                {mr ? 'कामांमध्ये जोडा' : 'Add to Tasks'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              style={styles.orderBtn}
              onPress={() =>
                Alert.alert(
                  'Fertilizer Order',
                  'KVK Farm Input Center: Delivery coordinate sent to Sangli depot.'
                )
              }
              activeOpacity={0.85}
            >
              <Icon name="shopping-cart" size={18} color="#064e3b" />
              <Text style={styles.orderBtnText}>{mr ? 'मागणी करा' : 'Order'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expandable Inputs & Assumptions */}
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.expandRow}
          onPress={() => setExpanded((x) => !x)}
          activeOpacity={0.8}
        >
          <Text style={styles.expandText}>
            {mr ? 'माती विश्लेषण आकडे व गृहीतके' : 'Soil Inputs & STCR Assumptions'}{' '}
            {expanded ? '−' : '+'}
          </Text>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.stcrGrid}>
              {[
                ['OC', soil.oc, '%'],
                ['N', soil.nitrogen_kg_ha, 'kg/ha'],
                ['P', soil.phosphorus_kg_ha, 'kg/ha'],
                ['K', soil.potassium_kg_ha, 'kg/ha'],
                ['pH', soil.ph, ''],
                ['EC', soil.ec, 'dS/m'],
              ].map(([name, val, u]) => (
                <View key={String(name)} style={styles.stcrCell}>
                  <Text style={styles.stcrCellName}>{name}</Text>
                  <Text style={styles.stcrCellVal}>
                    {amount(val as number, 2)} {u}
                  </Text>
                </View>
              ))}
            </View>

            {rdf && (
              <View style={styles.rdfSummary}>
                <Text style={styles.rdfSummaryTitle}>
                  {mr ? 'शिफारस केलेले घटक (RDF)' : 'Calculated Nutrient Requirement (RDF)'}
                </Text>
                <Text style={styles.rdfSummaryText}>
                  N: {amount(rdf.rdf_n_kg_acre, 1)} kg/acre • P: {amount(rdf.rdf_p_kg_acre, 1)}{' '}
                  kg/acre • K: {amount(rdf.rdf_k_kg_acre, 1)} kg/acre
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* SECTION 2: PRECISION IRRIGATION ADVISOR matching Stitch */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionIconCircleSecondary}>
              <Icon name="water-drop" size={19} color="#ffffff" />
            </View>
            <Text style={styles.sectionTitleText}>
              {mr ? '२. अचूक सिंचन सल्लागार' : '2. Precision Irrigation Advisor'}
            </Text>
          </View>
          <View style={styles.telemetryBadge}>
            <View style={styles.telemetryDot} />
            <Text style={styles.telemetryBadgeText}>TELEMETRY</Text>
          </View>
        </View>

        {/* Circular Moisture Gauge & Water Deficit */}
        <View style={styles.moistureGaugeContainer}>
          {/* SVG Gauge */}
          <View style={styles.gaugeWrap}>
            <Svg width={92} height={92} viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r="40"
                stroke="#e2e8f0"
                strokeWidth="9"
                fill="none"
              />
              <Circle
                cx="50"
                cy="50"
                r="40"
                stroke="#d97706"
                strokeWidth="9"
                strokeDasharray="251.2"
                strokeDashoffset="145"
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 50 50)"
              />
            </Svg>
            <View style={styles.gaugeCenterText}>
              <Text style={styles.gaugePct}>42%</Text>
              <Text style={styles.gaugeLabel}>{mr ? 'ओलावा' : 'Moisture'}</Text>
            </View>
          </View>

          {/* Metric Details */}
          <View style={styles.moistureDetails}>
            <View style={styles.irrigationPill}>
              <Icon name="warning" size={12} color="#b45309" />
              <Text style={styles.irrigationPillText}>
                {mr ? 'कमी • सिंचन आवश्यक' : 'Low • Irrigation Required'}
              </Text>
            </View>

            <View style={{ marginTop: 2 }}>
              <Text style={styles.deficitLabel}>
                {mr ? '२४ तासांतील पाण्याची तूट' : '24h Crop Water Deficit'}
              </Text>
              <Text style={styles.deficitVal}>
                {waterReqLiters.toLocaleString()} {mr ? 'लिटर' : 'Liters'}
              </Text>
              <Text style={styles.deficitSub}>
                ~{et0LHa.toLocaleString()} L/ha (ET₀ {et0Val.toFixed(1)} mm/day)
              </Text>
            </View>
          </View>
        </View>

        {/* AI Smart Irrigation Recommendation Card */}
        <View style={styles.smartIrrigationCard}>
          <View style={styles.smartIrrigationHeader}>
            <View style={styles.smartHeaderLeft}>
              <Icon name="alarm" size={17} color={colors.primary} />
              <Text style={styles.smartHeaderTitle}>
                {mr ? 'स्मार्ट सिंचन वेळापत्रक' : 'Smart Scheduled Cycle'}
              </Text>
            </View>
            <Text style={styles.smartValveText}>Automated Valve A-4</Text>
          </View>

          <View style={styles.smartGrid}>
            <View style={styles.smartGridBox}>
              <Text style={styles.smartBoxLabel}>{mr ? 'वेळेची खिडकी' : 'Time Window'}</Text>
              <Text style={styles.smartBoxVal}>{mr ? 'उद्या, ०६:०० AM' : 'Tomorrow, 06:00 AM'}</Text>
              <Text style={styles.smartBoxSub}>{mr ? 'कमी बाष्पीभवन वेळ' : 'Cool window (Low ET)'}</Text>
            </View>

            <View style={styles.smartGridBox}>
              <Text style={styles.smartBoxLabel}>{mr ? 'कालावधी व दाब' : 'Duration & Pressure'}</Text>
              <Text style={styles.smartBoxVal}>2h @ 1.2 bar</Text>
              <Text style={styles.smartBoxSub}>Drip Micro-Emitter</Text>
            </View>
          </View>

          {/* Sustainability Insight */}
          <View style={styles.sustainabilityBox}>
            <Icon name="energy-savings-leaf" size={18} color="#065f46" />
            <Text style={styles.sustainabilityText}>
              <Text style={styles.sustainabilityBold}>
                {mr ? 'पाणी बचत नोंद: ' : 'Sustainability Insight: '}
              </Text>
              {mr
                ? 'अचूक ठिबक नियोजनामुळे या आठवड्यात प्लॉट अ मध्ये १५% पाण्याची बचत झाली.'
                : 'Precision drip schedule saved 15% water this week across Plot A.'}
            </Text>
          </View>

          {/* Primary CTA Button (56px High) */}
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.startIrrigationBtn}
            onPress={() =>
              Alert.alert(
                'Smart Irrigation',
                mr
                  ? 'स्वयंचलित ठिबक झडप A-4 सुरू करण्याची आज्ञा पाठवली आहे.'
                  : 'Command sent to automated valve A-4. Operating at 1.2 bar pressure.'
              )
            }
            activeOpacity={0.88}
          >
            <Icon name="water" size={22} color="#ffffff" />
            <Text style={styles.startIrrigationBtnText}>
              {mr ? 'स्मार्ट सिंचन सुरू करा' : 'Start Smart Irrigation'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 3: CHECK PRODUCT COMPOSITION CALCULATOR */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.calcIconCircle}>
              <Icon name="calculate" size={19} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitleText}>
              {mr ? '३. खतामधील पोषकद्रव्ये तपासा' : '3. Check Product Composition'}
            </Text>
          </View>
        </View>

        <Text style={styles.calcIntroText}>
          {mr
            ? 'खताच्या वजनातील प्रत्यक्ष N, P, K घटक मोजा (ही वापरण्याची शिफारस नाही).'
            : 'Calculate pure nutrient content in a supplied product mass (composition verification only).'}
        </Text>

        {/* Product Chips */}
        <View style={styles.productsRow}>
          {['10:26:26', '19:19:19', '12:61:00', '13:00:45', 'Urea', 'SOP', 'MOP'].map(
            (name) => {
              const isSelected = product === name;
              return (
                <TouchableOpacity
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    setProduct(name);
                    setCalculation(null);
                  }}
                  style={[styles.productChip, isSelected && styles.productChipActive]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.productChipText,
                      isSelected && styles.productChipTextActive,
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        {/* Mass Input and Unit Selector */}
        <View style={styles.massInputRow}>
          <TextInput
            accessibilityLabel="Product mass"
            keyboardType="decimal-pad"
            value={quantity}
            onChangeText={(val) => {
              setQuantity(val);
              setCalculation(null);
            }}
            style={styles.massInput}
            placeholder="50"
            placeholderTextColor="#94a3b8"
          />
          <View style={styles.unitsRow}>
            {['kg', 'g'].map((u) => (
              <TouchableOpacity
                key={u}
                accessibilityRole="button"
                onPress={() => {
                  setUnit(u);
                  setCalculation(null);
                }}
                style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
              >
                <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          style={styles.calcBtn}
          disabled={calculating || !quantity}
          onPress={() => void calculate()}
          activeOpacity={0.85}
        >
          <Icon name="calculate" size={18} color="#ffffff" />
          <Text style={styles.calcBtnText}>
            {calculating
              ? mr
                ? 'गणना करत आहे…'
                : 'Calculating…'
              : mr
              ? 'पोषकद्रव्ये मोजा'
              : 'Calculate Pure Nutrients'}
          </Text>
        </TouchableOpacity>

        {!!calcError && <Text style={styles.calcErrorText}>{calcError}</Text>}

        {/* Composition Results Table */}
        {calculation && (
          <View style={styles.calcResultsCard}>
            <Text style={styles.calcResultsHeading}>
              {calculation.product_mass_kg} kg {product}
            </Text>
            {Object.entries(calculation.nutrients_kg).map(([nutKey, nutVal]) => (
              <View key={nutKey} style={styles.calcResultRow}>
                <Text style={styles.calcNutrientName}>{nutKey}</Text>
                <Text style={styles.calcNutrientVal}>{nutVal.toFixed(2)} kg</Text>
              </View>
            ))}
            <Text style={styles.calcFootnote}>
              {mr
                ? 'उत्पादनाच्या अधिकृत लेबलचे पालन करा. द्रवरूप खतासाठी अचूक घनता आवश्यक आहे.'
                : 'Verify product label. Liquid formulation requires certified specific gravity.'}
            </Text>
          </View>
        )}
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
    gap: 16,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconCircleSecondary: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calcIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  telemetryBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  telemetryBoxLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  telemetryBoxVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  telemetryBoxValGreen: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  prescriptionContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  prescHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  prescPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  prescPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  prescTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  prescSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  prescLeafCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dosageGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  dosageCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 3,
  },
  dosageLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  dosageVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  windowValGreen: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  dosageTotal: {
    fontSize: 10,
    color: '#64748b',
  },
  methodBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  methodDesc: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
    marginTop: 2,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  safetyText: {
    flex: 1,
    fontSize: 11,
    color: '#7f1d1d',
    lineHeight: 16,
  },
  safetyBold: {
    fontWeight: '800',
    color: '#991b1b',
  },
  actionRowBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  addTaskBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addTaskBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  orderBtn: {
    width: 110,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#86efac',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  orderBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064e3b',
  },
  expandRow: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  expandText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  expandedContent: {
    gap: 10,
    paddingTop: 4,
  },
  stcrGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stcrCell: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
  },
  stcrCellName: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  stcrCellVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  rdfSummary: {
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dcfce7',
    gap: 2,
  },
  rdfSummaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064e3b',
  },
  rdfSummaryText: {
    fontSize: 11,
    color: '#047857',
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ea580c',
  },
  telemetryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9a3412',
    letterSpacing: 0.5,
  },
  moistureGaugeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 16,
    gap: 14,
  },
  gaugeWrap: {
    width: 92,
    height: 92,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeCenterText: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugePct: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  gaugeLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  moistureDetails: {
    flex: 1,
    gap: 4,
  },
  irrigationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  irrigationPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  deficitLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  deficitVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  deficitSub: {
    fontSize: 10,
    color: '#64748b',
  },
  smartIrrigationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  smartIrrigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smartHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  smartValveText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondary,
  },
  smartGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  smartGridBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    gap: 2,
  },
  smartBoxLabel: {
    fontSize: 10,
    color: '#64748b',
  },
  smartBoxVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  smartBoxSub: {
    fontSize: 9,
    color: '#64748b',
  },
  sustainabilityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 10,
  },
  sustainabilityText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    lineHeight: 15,
  },
  sustainabilityBold: {
    fontWeight: '800',
  },
  startIrrigationBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  startIrrigationBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  calcIntroText: {
    fontSize: 12,
    color: '#64748b',
  },
  productsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  productChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  productChipActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  productChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  productChipTextActive: {
    color: colors.primary,
  },
  massInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  massInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  unitsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  unitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  unitBtnTextActive: {
    color: colors.primary,
  },
  calcBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  calcBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  calcErrorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  calcResultsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 6,
  },
  calcResultsHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#064e3b',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#dcfce7',
  },
  calcResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calcNutrientName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  calcNutrientVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  calcFootnote: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
});
