import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { VRAPrescriptionData, VRAZone, VRAProductPrescription } from '../types';

interface VRAPrescriptionCardsProps {
  prescription: VRAPrescriptionData | null;
  language: 'en' | 'mr';
  selectedZone: string;
  onSelectZone: (zoneId: string) => void;
  loading?: boolean;
}

export const VRAPrescriptionCards: React.FC<VRAPrescriptionCardsProps> = ({
  prescription,
  language,
  selectedZone,
  onSelectZone,
  loading = false,
}) => {
  const { width } = useWindowDimensions();
  const mr = language === 'mr';
  const isWide = width >= 768;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#059669" />
        <Text style={styles.loadingText}>
          {mr ? 'VRA प्रिस्क्रिप्शन लोड होत आहे…' : 'Loading VRA Precision Prescription…'}
        </Text>
      </View>
    );
  }

  if (!prescription || !prescription.zones || prescription.zones.length === 0) {
    return null;
  }

  const { total_acres, period, stage, zones, impact_summary } = prescription;

  return (
    <View style={styles.container}>
      {/* ── HEADER BANNER ── */}
      <View style={styles.headerBanner}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.targetIcon}>🎯</Text>
            <Text style={styles.headerTitle}>
              {mr
                ? 'व्हेरिएबल रेट ॲप्लिकेशन (VRA) खत सल्ला'
                : 'Variable Rate Application (VRA) Prescription'}
            </Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>
                {mr ? 'AI अचूक झोनिंग' : 'AI Precision Zoning'}
              </Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            {mr
              ? `सेंटिनेल-२ कॅनॉपी जोम व STCR नुसार ${total_acres} एकरासाठी आंतर-शेत खत नियोजन (${period} • ${stage})`
              : `Intra-field spatial dosing based on Sentinel-2 canopy vigor and STCR recommendations for ${total_acres} acres (${period} • ${stage})`}
          </Text>
        </View>

        {selectedZone !== 'all' && (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => onSelectZone('all')}
            accessibilityRole="button"
          >
            <Text style={styles.resetBtnText}>
              {mr ? 'सर्व विभाग दाखवा' : 'Show All Zones'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── UPCOMING DOSE NOTICE BANNER ── */}
      <View style={styles.noticeBanner}>
        <Text style={styles.noticeText}>
          <Text style={styles.noticeBold}>
            {mr ? `पुढील खत मात्रा (${period}): ` : `Upcoming Dose (${period}): `}
          </Text>
          {mr
            ? 'केवळ आपल्या नियोजित खतांची मात्रा उपग्रह कॅनॉपीच्या जोमानुसार विभागांमध्ये बदलली आहे. कोणतेही नवीन बाहेरील खत समाविष्ट केलेले नाही.'
            : 'Only the dosages of your scheduled fertilizers are modulated across zones based on satellite canopy vigor. No new or foreign fertilizers are introduced.'}
        </Text>
      </View>

      {/* ── IMPACT SUMMARY BAR ── */}
      {impact_summary && (
        <View style={styles.impactBar}>
          <View style={styles.impactCol}>
            <Text style={styles.impactLabel}>{mr ? 'खताची बचत' : 'Fertilizer Saved'}</Text>
            <Text style={styles.impactValue}>
              ⚖️ {impact_summary.fertilizer_saved_kg} kg{' '}
              <Text style={styles.impactHighlight}>{mr ? 'बचत' : 'saved'}</Text>
            </Text>
            <Text style={styles.impactSub}>
              {mr
                ? `${impact_summary.reallocated_to_recovery_kg} kg कमी वाढ भागाकडे वळवले`
                : `Reallocated ${impact_summary.reallocated_to_recovery_kg} kg to deficit areas`}
            </Text>
          </View>

          <View style={styles.impactCol}>
            <Text style={styles.impactLabel}>{mr ? 'नायट्रोजन कार्यक्षमता' : 'Nitrogen Efficiency'}</Text>
            <Text style={[styles.impactValue, { color: '#4338ca' }]}>
              ⚡ +{impact_summary.nitrogen_use_efficiency_gain_pct}% NUE
            </Text>
            <Text style={styles.impactSub}>
              {mr ? 'मुळे जवळ अचूक शोषण' : 'Targeted uptake at root zone'}
            </Text>
          </View>

          <View style={styles.impactCol}>
            <Text style={styles.impactLabel}>{mr ? 'लीचिंग धोका घट' : 'Leaching Reduction'}</Text>
            <Text style={[styles.impactValue, { color: '#0f766e' }]}>
              🌱 -{impact_summary.nitrate_leaching_reduction_pct}% Loss
            </Text>
            <Text style={styles.impactSub}>
              {mr ? 'भूजल प्रदूषण रोखते' : 'Prevents groundwater leaching'}
            </Text>
          </View>
        </View>
      )}

      {/* ── THREE PRECISION MANAGEMENT ZONES (MATCHING UPLOADED REFERENCE) ── */}
      <View style={[styles.cardsContainer, isWide && styles.cardsContainerWide]}>
        {zones.map((zone: VRAZone) => {
          const isZ1 = zone.id === 'zone_1';
          const isZ2 = zone.id === 'zone_2';
          const isSelected = selectedZone === zone.id;

          const cardBorderColor = isZ1 ? '#fca5a5' : isZ2 ? '#a7f3d0' : '#99f6e4';
          const cardBgColor = isZ1 ? '#fffcfc' : isZ2 ? '#fcfdfd' : '#fcfffe';
          const badgeBg = isZ1 ? '#fee2e2' : isZ2 ? '#d1fae5' : '#ccfbf1';
          const badgeBorder = isZ1 ? '#fca5a5' : isZ2 ? '#6ee7b7' : '#5eead4';
          const badgeText = isZ1 ? '#b91c1c' : isZ2 ? '#065f46' : '#115e59';
          const qtyTextColor = isZ1 ? '#b91c1c' : isZ2 ? '#047857' : '#0f766e';

          return (
            <View
              key={zone.id}
              style={[
                styles.zoneCard,
                isWide && styles.zoneCardWide,
                { borderColor: cardBorderColor, backgroundColor: cardBgColor },
                isSelected && styles.zoneCardSelected,
              ]}
            >
              {/* Card Header */}
              <View style={styles.zoneHeader}>
                <View style={styles.zoneHeaderLeft}>
                  <View style={styles.titleWithDot}>
                    <View style={[styles.dot, { backgroundColor: zone.color }]} />
                    <Text style={styles.zoneTitle}>
                      {mr ? zone.name_mr || zone.name : zone.name}
                    </Text>
                  </View>
                  <Text style={styles.zoneAcresSubtitle}>
                    {zone.acres} {mr ? 'एकर' : 'Acres'} •{' '}
                    <Text style={styles.zonePercentageBold}>{zone.percentage}% of plot</Text>
                  </Text>
                </View>

                <View
                  style={[
                    styles.multiplierBadge,
                    { backgroundColor: badgeBg, borderColor: badgeBorder },
                  ]}
                >
                  <Text style={[styles.multiplierBadgeText, { color: badgeText }]}>
                    {mr ? zone.multiplier_label_mr || zone.multiplier_label : zone.multiplier_label}
                  </Text>
                </View>
              </View>

              {/* Canopy & Irrigation Status Box */}
              <View style={styles.statusBox}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>{mr ? 'कॅनॉपी जोम:' : 'Canopy Vigor:'}</Text>
                  <Text style={styles.statusValue}>
                    {mr ? zone.canopy_status_mr || zone.canopy_status : zone.canopy_status}
                  </Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>{mr ? 'ठिबक वेळ:' : 'Drip Run-Time:'}</Text>
                  <Text style={[styles.statusValue, styles.dripRunHours]}>
                    {zone.irrigation_run_hours} {mr ? 'तास' : 'Hours'}
                  </Text>
                </View>
              </View>

              {/* AI Root Cause Diagnosis Box */}
              {zone.ai_diagnosis && (
                <View style={styles.diagnosisBox}>
                  <View style={styles.diagnosisHeader}>
                    <Text style={styles.diagnosisTitle}>
                      ⚠️ {mr ? 'AI मुळाशी कारण विश्लेषण:' : 'AI ROOT CAUSE DIAGNOSIS:'}
                    </Text>
                  </View>
                  <Text style={styles.diagnosisText}>
                    {mr ? zone.ai_diagnosis_mr || zone.ai_diagnosis : zone.ai_diagnosis}
                  </Text>
                </View>
              )}

              {/* Targeted Product Prescription */}
              <View style={styles.prescriptionSection}>
                <Text style={styles.prescriptionSectionTitle}>
                  {mr ? 'विहित खत मात्रा (प्रिस्क्रिप्शन):' : 'TARGETED PRODUCT PRESCRIPTION:'}
                </Text>

                {zone.fertilizers.map((fert: VRAProductPrescription, fIdx: number) => {
                  return (
                    <View key={fIdx} style={styles.productCard}>
                      <View style={styles.productTopRow}>
                        <View style={styles.productNameCol}>
                          <Text style={styles.productName}>{fert.name}</Text>
                          {fert.note && (
                            <View
                              style={[
                                styles.productNoteBadge,
                                { backgroundColor: badgeBg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.productNoteText,
                                  { color: badgeText },
                                ]}
                              >
                                {mr ? fert.note_mr || fert.note : fert.note}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.productQtyCol}>
                          <Text style={[styles.productQtyTotal, { color: qtyTextColor }]}>
                            {fert.total_quantity} {fert.unit}
                          </Text>
                          <Text style={styles.zoneTotalLabel}>
                            {mr ? 'विभाग एकूण' : 'Zone Total'}
                          </Text>
                        </View>
                      </View>

                      {/* Scheduled -> Zone Rate comparison bar */}
                      <View style={styles.rateBar}>
                        <View style={styles.rateSegment}>
                          <Text style={styles.rateLabel}>{mr ? 'वेळापत्रक: ' : 'Scheduled: '}</Text>
                          <Text style={styles.rateValue}>
                            {fert.base_rate_per_acre} {fert.unit}/ac
                          </Text>
                        </View>

                        <Text style={styles.arrowText}>→</Text>

                        <View style={styles.rateSegment}>
                          <Text style={styles.rateLabel}>{mr ? 'विभाग प्रमाण: ' : 'Zone Rate: '}</Text>
                          <Text style={styles.rateValueBold}>
                            {fert.rate_per_acre} {fert.unit}/ac
                          </Text>
                        </View>

                        <View style={[styles.pctBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.pctBadgeText, { color: badgeText }]}>
                            {isZ1 ? '+25%' : isZ2 ? '100%' : '-25%'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Field Advice */}
              <View style={styles.adviceBlock}>
                <Text style={styles.adviceText}>
                  <Text style={styles.adviceBold}>{mr ? 'शेत सल्ला: ' : 'Field Advice: '}</Text>
                  {mr ? zone.agronomic_action_mr || zone.agronomic_action : zone.agronomic_action}
                </Text>
              </View>

              {/* Map Isolation Action Button */}
              <TouchableOpacity
                style={[
                  styles.isolateBtn,
                  {
                    backgroundColor: isSelected ? '#111827' : badgeBg,
                    borderColor: isSelected ? '#10b981' : badgeBorder,
                  },
                ]}
                onPress={() => onSelectZone(isSelected ? 'all' : zone.id)}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.isolateBtnText,
                    { color: isSelected ? '#ffffff' : badgeText },
                  ]}
                >
                  {isSelected
                    ? mr
                      ? '✓ नकाशावर वेगळा दाखवला आहे (पूर्ववत करा)'
                      : '✓ Isolated on Map (Click to Reset)'
                    : mr
                    ? `🔍 ${zone.short_name_mr || zone.short_name} नकाशावर दाखवा`
                    : `🔍 Isolate ${zone.short_name} on Map`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 14,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  headerBanner: {
    backgroundColor: '#0f172a',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
    minWidth: 260,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  targetIcon: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  aiBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 16,
  },
  resetBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  noticeBanner: {
    backgroundColor: '#f0fdf4',
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  noticeText: {
    fontSize: 11.5,
    color: '#14532d',
    lineHeight: 16,
  },
  noticeBold: {
    fontWeight: '800',
    color: '#166534',
  },
  impactBar: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  impactCol: {
    minWidth: 100,
    flex: 1,
  },
  impactLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  impactValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    marginVertical: 2,
  },
  impactHighlight: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },
  impactSub: {
    fontSize: 9.5,
    color: '#64748b',
  },
  cardsContainer: {
    padding: 12,
    gap: 14,
    flexDirection: 'column',
  },
  cardsContainerWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  zoneCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    justifyContent: 'space-between',
  },
  zoneCardWide: {
    maxWidth: '33.33%',
  },
  zoneCardSelected: {
    borderColor: '#059669',
    borderWidth: 2,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  zoneHeaderLeft: {
    flex: 1,
  },
  titleWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  zoneTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  zoneAcresSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  zonePercentageBold: {
    fontWeight: '800',
    color: '#1f2937',
  },
  multiplierBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  multiplierBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  statusBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  statusLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1f2937',
  },
  dripRunHours: {
    color: '#4338ca',
    fontWeight: '900',
  },
  diagnosisBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
    marginBottom: 10,
  },
  diagnosisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  diagnosisTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#312e81',
    letterSpacing: 0.3,
  },
  diagnosisText: {
    fontSize: 10.5,
    color: '#334155',
    lineHeight: 15,
    fontWeight: '500',
  },
  prescriptionSection: {
    marginBottom: 6,
  },
  prescriptionSectionTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  productCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
    marginBottom: 7,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  productNameCol: {
    flex: 1,
  },
  productName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#111827',
  },
  productNoteBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginTop: 2,
  },
  productNoteText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  productQtyCol: {
    alignItems: 'flex-end',
  },
  productQtyTotal: {
    fontSize: 15,
    fontWeight: '900',
  },
  zoneTotalLabel: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '600',
  },
  rateBar: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rateSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 9.5,
    color: '#64748b',
  },
  rateValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  rateValueBold: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  arrowText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  pctBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pctBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  adviceBlock: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  adviceText: {
    fontSize: 10.5,
    color: '#475569',
    lineHeight: 15,
  },
  adviceBold: {
    fontWeight: '800',
    color: '#1e293b',
  },
  isolateBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  isolateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

