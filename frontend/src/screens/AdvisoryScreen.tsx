import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { translations } from '../i18n/translations';
import { ApiClient } from '../services/apiClient';
import { FarmerProfile, AdvisoryData } from '../types';

interface AdvisoryScreenProps {
  farmer: FarmerProfile;
  language: 'en' | 'mr';
}

export const AdvisoryScreen: React.FC<AdvisoryScreenProps> = ({ farmer, language }) => {
  const t = translations[language];
  const [data, setData] = useState<AdvisoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmer.farm_id) return;
    ApiClient.getAdvisory(farmer.farm_id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [farmer]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Generating Precision Fertilizer Advisory...</Text>
      </View>
    );
  }

  const soil = data?.soil_status;
  const rdf = data?.rdf;
  const area = data?.area_acres || farmer.farm_area_acres || 4.2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Header Context & Plot Selector */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconBox}>
            <Text style={styles.headerIcon}>🧪</Text>
          </View>
          <View>
            <Text style={styles.screenTitle}>Advisory & Crop Care</Text>
            <Text style={styles.screenSubtitle}>Precision Agronomy • ICAR-STCR</Text>
          </View>
        </View>
        <View style={styles.activeBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.activeBadgeText}>Agronomy AI Active</Text>
        </View>
      </View>

      {/* 2. Plot Context Card */}
      <View style={styles.plotCard}>
        <View style={styles.plotCardLeft}>
          <View style={styles.plotIconBox}>
            <Text style={styles.plotIcon}>🌾</Text>
          </View>
          <View>
            <View style={styles.plotTitleRow}>
              <Text style={styles.plotTitle}>Plot A • {farmer.name}</Text>
              <View style={styles.varietyPill}>
                <Text style={styles.varietyText}>Co 86032</Text>
              </View>
            </View>
            <Text style={styles.plotMeta}>
              {area} Acres • Vertisol Black Soil • Grand Growth Stage
            </Text>
          </View>
        </View>
      </View>

      {/* 3. SECTION 1: Laboratory Soil Test Analysis */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.numBadge}>
              <Text style={styles.numBadgeText}>1</Text>
            </View>
            <Text style={styles.sectionTitleText}>Laboratory Soil Test Profile</Text>
          </View>
          <View style={styles.kvkPill}>
            <Text style={styles.kvkText}>KVK Baramati Lab</Text>
          </View>
        </View>

        {/* Nutrients 6-Grid */}
        <View style={styles.soilGrid}>
          <View style={styles.soilBox}>
            <Text style={styles.soilLabel}>pH (Reaction)</Text>
            <Text style={styles.soilVal}>{soil?.ph}</Text>
            <Text style={styles.soilStatusGreen}>Normal</Text>
          </View>

          <View style={styles.soilBox}>
            <Text style={styles.soilLabel}>EC (Salinity)</Text>
            <Text style={styles.soilVal}>{soil?.ec} dS/m</Text>
            <Text style={styles.soilStatusGreen}>Safe</Text>
          </View>

          <View style={styles.soilBox}>
            <Text style={styles.soilLabel}>OC (Carbon)</Text>
            <Text style={styles.soilVal}>{soil?.oc}%</Text>
            <Text style={styles.soilStatusAmber}>Moderate</Text>
          </View>

          <View style={styles.soilBox}>
            <Text style={styles.soilLabel}>Avail. Nitrogen (N)</Text>
            <Text style={styles.soilVal}>{soil?.nitrogen_kg_ha} kg/ha</Text>
            <Text style={styles.soilStatusRed}>Low Deficit</Text>
          </View>

          <View style={styles.soilBox}>
            <Text style={styles.soilLabel}>Avail. Phosphorus (P)</Text>
            <Text style={styles.soilVal}>{soil?.phosphorus_kg_ha} kg/ha</Text>
            <Text style={styles.soilStatusGreen}>Sufficient</Text>
          </View>

          <View style={styles.soilBox}>
            <Text style={styles.soilLabel}>Avail. Potassium (K)</Text>
            <Text style={styles.soilVal}>{soil?.potassium_kg_ha} kg/ha</Text>
            <Text style={styles.soilStatusGreen}>Very High</Text>
          </View>
        </View>

        {/* Organic Manure (FYM) Row */}
        <View style={styles.fymBox}>
          <Text style={styles.fymText}>
            🐄 Farm Yard Manure (FYM): <Text style={styles.fymBold}>{soil?.organic_manure_ton_acre} Ton/Acre</Text> ({soil?.organic_manure_ton_ha} Ton/Ha)
          </Text>
        </View>
      </View>

      {/* 4. SECTION 2: STCR RDF Fertilizer Prescription */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.numBadge}>
              <Text style={styles.numBadgeText}>2</Text>
            </View>
            <Text style={styles.sectionTitleText}>STCR RDF Fertilizer Recommendation</Text>
          </View>
          <View style={styles.targetPill}>
            <Text style={styles.targetText}>Target: {rdf?.expected_yield_ton_ha || 250} T/Ha</Text>
          </View>
        </View>

        {/* NPK Targets 3-Card Row */}
        <View style={styles.rdfRow}>
          {/* N */}
          <View style={styles.rdfCard}>
            <Text style={styles.rdfNutrient}>Nitrogen (N)</Text>
            <Text style={styles.rdfAmount}>{rdf?.rdf_n_kg_acre} kg/ac</Text>
            <Text style={styles.fertSplit}>Drip: {rdf?.final_fertigation_n_kg_acre} kg</Text>
          </View>

          {/* P */}
          <View style={styles.rdfCard}>
            <Text style={styles.rdfNutrient}>Phosphorus (P)</Text>
            <Text style={styles.rdfAmount}>{rdf?.rdf_p_kg_acre} kg/ac</Text>
            <Text style={styles.fertSplit}>Drip: {rdf?.final_fertigation_p_kg_acre} kg</Text>
          </View>

          {/* K */}
          <View style={styles.rdfCard}>
            <Text style={styles.rdfNutrient}>Potassium (K)</Text>
            <Text style={styles.rdfAmount}>{rdf?.rdf_k_kg_acre} kg/ac</Text>
            <Text style={styles.fertSplit}>Drip: {rdf?.final_fertigation_k_kg_acre} kg</Text>
          </View>
        </View>

        {/* Basal Dose Details Card */}
        <View style={styles.basalCard}>
          <View style={styles.basalHeader}>
            <Text style={styles.basalTitle}>🌱 Basal Dose (Applied at Sowing/Ratooning)</Text>
            <Text style={styles.basalSelected}>{rdf?.basal_dose?.fertilizer_selected}</Text>
          </View>
          <View style={styles.basalList}>
            <Text style={styles.basalItem}>• NPK Complex: {rdf?.basal_dose?.fertilizer_selected}</Text>
            <Text style={styles.basalItem}>• Nimboli Pend: 100 kg/acre (Soil conditioner & Nematode control)</Text>
            <Text style={styles.basalItem}>• Calcium Nitrate: 5.5 kg/acre (Quick establishment N)</Text>
            <Text style={styles.basalItem}>• Bio-fertilizers: Azotobacter (2kg), PSB (2kg), Borax (2kg)</Text>
          </View>
        </View>

        {/* Agronomic Review Warning */}
        <View style={styles.agronomyAlert}>
          <Text style={styles.agronomyAlertTitle}>⚠️ Agronomic Review & Safety Notice:</Text>
          <Text style={styles.agronomyAlertText}>
            The 250 T/Ha target is a mathematical calculation target, not a guaranteed yield. Vertisol drip fertigation schedules should be monitored against electrical conductivity (EC) to avoid salt crusting in the root zone.
          </Text>
        </View>
      </View>

      {/* 5. SECTION 3: 4-Stage Weekly Fertigation Split */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.numBadge}>
              <Text style={styles.numBadgeText}>3</Text>
            </View>
            <Text style={styles.sectionTitleText}>4-Stage Drip Fertigation Schedule</Text>
          </View>
          <Text style={styles.splitSubtitle}>Soluble Drip Formulation</Text>
        </View>

        {data?.weekly_schedules?.map((stage, idx) => (
          <View key={idx} style={styles.stageCard}>
            <View style={styles.stageTop}>
              <Text style={styles.stageName}>{stage.stage_name}</Text>
              <View style={styles.stageDaysBadge}>
                <Text style={styles.stageDaysText}>{stage.days_range}</Text>
              </View>
            </View>

            <Text style={styles.stageTargets}>
              Nutrient Targets: N: {stage.target_n_kg_acre} kg • P: {stage.target_p_kg_acre} kg • K: {stage.target_k_kg_acre} kg/acre
            </Text>

            <View style={styles.productsTable}>
              {stage.fertilizers_recommended?.map((p, pIdx) => (
                <View key={pIdx} style={styles.prodRow}>
                  <Text style={styles.prodTitle}>• {p.product}</Text>
                  <Text style={styles.prodDose}>
                    {p.total_kg_acre} kg/ac <Text style={styles.dailyDose}>({p.daily_dose_g} g/day)</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7faf7',
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7faf7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#00450d',
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 18,
  },
  screenTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  screenSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803d',
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  plotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  plotCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plotIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plotIcon: {
    fontSize: 20,
  },
  plotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plotTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  varietyPill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  varietyText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4b5563',
  },
  plotMeta: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  sectionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  numBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00450d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  sectionTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  kvkPill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  kvkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065f46',
  },
  targetPill: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  targetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
  },
  soilGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  soilBox: {
    width: '31.3%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  soilLabel: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  soilVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  soilStatusGreen: {
    fontSize: 8,
    color: '#15803d',
    fontWeight: '700',
    marginTop: 1,
  },
  soilStatusAmber: {
    fontSize: 8,
    color: '#d97706',
    fontWeight: '700',
    marginTop: 1,
  },
  soilStatusRed: {
    fontSize: 8,
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 1,
  },
  fymBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  fymText: {
    fontSize: 11,
    color: '#166534',
    textAlign: 'center',
  },
  fymBold: {
    fontWeight: '800',
  },
  rdfRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rdfCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  rdfNutrient: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00450d',
  },
  rdfAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginVertical: 2,
  },
  fertSplit: {
    fontSize: 9,
    color: '#0284c7',
    fontWeight: '600',
  },
  basalCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  basalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  basalTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  basalSelected: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00450d',
  },
  basalList: {
    gap: 3,
  },
  basalItem: {
    fontSize: 10,
    color: '#1f2937',
    lineHeight: 14,
  },
  agronomyAlert: {
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  agronomyAlertTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 2,
  },
  agronomyAlertText: {
    fontSize: 10,
    color: '#78350f',
    lineHeight: 14,
  },
  splitSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  stageCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 4,
  },
  stageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stageName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  stageDaysBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stageDaysText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284c7',
  },
  stageTargets: {
    fontSize: 10,
    color: '#64748b',
    marginVertical: 4,
  },
  productsTable: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  prodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prodTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  prodDose: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00450d',
  },
  dailyDose: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: 'normal',
  },
});
