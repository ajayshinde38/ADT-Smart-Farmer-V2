import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { AppText as Text, Icon, ui } from './ui';
import { DiseaseDetectionResult } from '../types';
import { colors } from '../theme/colors';

type Detail = NonNullable<DiseaseDetectionResult['disease_details']>;

interface Props {
  details?: Detail | null;
  models?: DiseaseDetectionResult['model_results'];
  status?: string;
  language: 'en' | 'mr';
  detectedDisease?: string;
  confidenceScore?: number;
}

const PRACTICE_ICONS: Record<string, { icon: React.ComponentProps<typeof Icon>['name']; bg: string }> = {
  cultural: { icon: 'eco', bg: '#234938' },
  mechanical: { icon: 'build', bg: '#4d6558' },
  biological: { icon: 'pest-control', bg: '#607d6d' },
  chemical: { icon: 'science', bg: '#984d43' },
  timing: { icon: 'schedule', bg: '#8a582e' },
};

export const DiseaseGuidance: React.FC<Props> = ({
  details,
  models,
  status,
  language,
  detectedDisease,
  confidenceScore,
}) => {
  const mr = language === 'mr';
  const word = (en: string, ma: string) => (mr ? ma : en);

  // Accordions open by default as in the design reference
  const [open, setOpen] = useState<Record<string, boolean>>({
    cultural: true,
    mechanical: true,
    biological: true,
    chemical: true,
    timing: true,
  });

  const detected = status === 'disease_detected' && !!details;

  return (
    <View style={styles.container}>
      {/* 1. TREATMENT: Recommended Immediate Intervention Banner */}
      {detected && (
        <View style={styles.treatmentBanner}>
          <View style={styles.treatmentHeader}>
            <View style={styles.pillIconWrap}>
              <Icon name="healing" size={20} color="#58d68d" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.treatmentSub}>
                {word('TREATMENT', 'उपचार व व्यवस्थापन')}
              </Text>
              <Text style={styles.treatmentTitle}>
                {word('Recommended Immediate Intervention', 'तातडीचे शिफारस केलेले व्यवस्थापन')}
              </Text>
            </View>
          </View>
          <Text style={styles.treatmentText}>
            {(mr ? details.treatment_mr : details.treatment) ||
              (mr ? details.prevention_mr : details.prevention) ||
              word(
                'No chemical cure; remove and destroy infected plants, control vector insects',
                'विषाणूवर थेट रासायनिक उपचार नाही; बाधित बेटे मुळासकट उपटून नष्ट करा व किडींचे नियंत्रण करा'
              )}
          </Text>
        </View>
      )}

      {/* 2. SYMPTOMS, CAUSES, PREVENTION Grid */}
      {detected && (
        <View style={styles.detailsGrid}>
          {/* 1: Symptoms Card (Full width on top) */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#fdeeed' }]}>
                <Icon name="bug-report" size={16} color="#e05344" />
              </View>
              <Text style={styles.infoCardTag}>{word('SYMPTOMS', 'लक्षणे')}</Text>
            </View>
            <Text style={styles.infoCardBody}>
              {(mr ? details.symptoms_mr : details.symptoms) ||
                word('Yellow-green mottling on leaves, stunted growth, reduced yield, irregular chlorotic patches', 'पानांवर पिवळसर-हिरवे चट्टे, वाढ खुंटणे व उत्पादनात घट')}
            </Text>
          </View>

          {/* 2: Causes Card (Full width below Symptoms) */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
                <Icon name="warning" size={16} color="#d97706" />
              </View>
              <Text style={styles.infoCardTag}>{word('CAUSES', 'कारणे')}</Text>
            </View>
            <Text style={styles.infoCardBody}>
              {(mr ? details.causes_mr : details.causes) ||
                word('Viral infection (Sugarcane Mosaic Virus) transmitted by aphid vectors', 'मावा किडींद्वारे पसरणारा विषाणूजन्य संसर्ग')}
            </Text>
          </View>

          {/* 3: Prevention Card (Full width below Causes) */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: '#eef2ef' }]}>
                <Icon name="shield" size={16} color="#4d6558" />
              </View>
              <Text style={styles.infoCardTag}>{word('PREVENTION', 'प्रतिबंध')}</Text>
            </View>
            <Text style={styles.infoCardBody}>
              {(mr ? details.prevention_mr : details.prevention) ||
                word('Use virus-free planting material, control aphid populations, remove infected plants', 'प्रमाणित निरोगी बेणे वापरा, मावा किडींचे वेळेवर नियंत्रण करा व बाधित बेटे नष्ट करा')}
            </Text>
          </View>
        </View>
      )}

      {!detected && (
        <View style={styles.card}>
          <Text style={styles.unconfirmedText}>
            {status === 'uncertain'
              ? word('Field verification recommended. Check symptoms with an agronomist.', 'प्रत्यक्ष शेतात जाऊन कृषितज्ज्ञांकडून खात्री करा.')
              : word('No supported disease detected above diagnostic thresholds.', 'कोणताही समर्थित रोग आढळला नाही.')}
          </Text>
        </View>
      )}

      {/* 4. MANAGEMENT PRACTICES Accordions */}
      {detected && !!details.management_practices?.length && (
        <View style={{ gap: 12 }}>
          <Text style={styles.managementHeading}>
            {word('MANAGEMENT PRACTICES', 'रोग व्यवस्थापन पद्धती')}
          </Text>

          {details.management_practices.map((group) => {
            const items = mr && group.items_mr?.length ? group.items_mr : group.items;
            const isExpanded = !!open[group.category];
            const cfg = PRACTICE_ICONS[group.category] || { icon: 'eco', bg: '#234938' };

            return (
              <View key={group.category} style={styles.accordionCard}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  onPress={() => setOpen((prev) => ({ ...prev, [group.category]: !prev[group.category] }))}
                  style={styles.accordionHeader}
                  activeOpacity={0.7}
                >
                  <View style={styles.accordionHeaderLeft}>
                    <View style={[styles.practiceIconWrap, { backgroundColor: cfg.bg }]}>
                      <Icon name={cfg.icon} size={18} color="#ffffff" />
                    </View>
                    <Text style={styles.practiceTitle}>
                      {mr ? group.title_mr : group.title}
                    </Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{items.length}</Text>
                    </View>
                  </View>
                  <Icon
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color="#64748b"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.accordionBody}>
                    <View style={styles.divider} />
                    {items.map((item, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* 5. CHEMICAL REFERENCES & DOSAGE Table */}
      {detected && !!details.chemical_references?.length && (
        <View style={styles.card}>
          <View style={styles.chemHeader}>
            <Icon name="science" size={18} color="#b91c1c" />
            <Text style={styles.sectionHeading}>{word('CHEMICAL REFERENCES & DOSAGE', 'रासायनिक संदर्भ आणि मात्रा')}</Text>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 2.2 }]}>{word('PRODUCT', 'उत्पादन')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>{word('DOSAGE', 'मात्रा')}</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.8 }]}>{word('GROUP', 'गट')}</Text>
          </View>

          {/* Table Rows */}
          {details.chemical_references.map((row, i) => (
            <View
              key={i}
              style={[
                styles.tableDataRow,
                i === details.chemical_references!.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={[styles.tableCellProduct, { flex: 2.2 }]}>{row.product}</Text>
              <Text style={[styles.tableCellDosage, { flex: 1.5 }]}>{row.dosage}</Text>
              <Text style={[styles.tableCellGroup, { flex: 1.8 }]}>{row.group}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  /* 1. Treatment Banner */
  treatmentBanner: {
    backgroundColor: '#173d2a',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    shadowColor: '#173d2a',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  treatmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pillIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#204e37',
    justifyContent: 'center',
    alignItems: 'center',
  },
  treatmentSub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#58d68d',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  treatmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 22,
  },
  treatmentText: {
    fontSize: 14,
    color: '#eef7f1',
    lineHeight: 22,
    marginTop: 2,
  },

  /* 2. Details Grid */
  detailsGrid: {
    gap: 12,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8eee9',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCardTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5c7c6d',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  infoCardBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },

  /* 3. Base Card */
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8eee9',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#5c7c6d',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  aiModelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f6f8f5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  aiModelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  aiDiseaseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17231c',
  },
  aiModelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiScoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17231c',
  },
  aiBarTrack: {
    width: 48,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#dde7de',
    overflow: 'hidden',
  },
  aiBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  unconfirmedText: {
    fontSize: 12,
    color: '#65776c',
    lineHeight: 18,
  },

  /* 4. Chemical References Table */
  chemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eee9',
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#788c80',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f6f3',
    alignItems: 'center',
  },
  tableCellProduct: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17231c',
  },
  tableCellDosage: {
    fontSize: 13,
    color: '#49594f',
  },
  tableCellGroup: {
    fontSize: 13,
    color: '#5b6c61',
  },

  /* 5. Management Practices Accordion */
  managementHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3e5c50',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  accordionCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8eee9',
    borderRadius: 16,
    padding: 14,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  practiceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  practiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17231c',
    marginLeft: 12,
  },
  countBadge: {
    backgroundColor: '#f0f3f1',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#65776c',
  },
  accordionBody: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f3f1',
    marginVertical: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bulletDot: {
    fontSize: 15,
    color: '#65776c',
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 21,
  },

  /* Footer Note */
  footerNote: {
    fontSize: 11,
    lineHeight: 18,
    color: '#785b30',
    paddingHorizontal: 4,
  },
});
