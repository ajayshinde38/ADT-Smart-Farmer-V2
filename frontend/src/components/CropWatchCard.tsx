import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text, Icon } from './ui';
import { shortDate } from '../utils/farmPresentation';
import { WeatherData } from '../types';

export const CropWatchCard = ({
  data,
  language,
  onScan,
  selectedDate,
}: {
  selectedDate?: string;
  data: WeatherData;
  language: 'en' | 'mr';
  onScan?: () => void;
}) => {
  const mr = language === 'mr';
  const [expanded, setExpanded] = useState(false);
  const day =
    selectedDate ||
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const checks =
    data.crop_watch_outlook?.find((item) => item.date === day)?.checks ||
    (!selectedDate ? data.crop_watch : undefined);

  if (!checks?.length) return null;

  const matches = checks
    .filter(
      (item) =>
        item.criteria_tested >= 2 &&
        (item.score ?? 0) >= 50 &&
        item.stage_eligible !== false
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);

  const names: Record<string, string> = {
    D7: 'कांडी कूज',
    P4: 'हुमणी',
    D2: 'तांबेरा',
    D4: 'काणी',
    D1: 'पोक्का बोईंग',
    P2: 'शेंडा पोखरणारी अळी',
    D3: 'लाल कूज',
    P7: 'पिठ्या ढेकूण',
  };

  const cuesMr: Record<string, string> = {
    D7: 'उगवण कमी होणे किंवा कुजलेल्या कांड्या तपासा.',
    P4: 'वाळणाऱ्या बेटांच्या मुळांजवळ हुमणी तपासा.',
    D2: 'पानांवर तांबूस पुटकुळ्या तपासा.',
    D4: 'काळ्या चाबकासारखी वाढ तपासा.',
    D1: 'वाकडी, पिवळसर कोवळी पाने तपासा.',
    P2: 'शेंड्यात छिद्रे व वाळलेला गाभा तपासा.',
    D3: 'कांडीत लालसर रंग व पांढरे पट्टे तपासा.',
    P7: 'पानांच्या आवरणाखाली पांढरे ढेकूण तपासा.',
  };

  const cuesEn: Record<string, string> = {
    D7: 'Check poorly germinated or rotting setts.',
    P4: 'Check roots around wilting cane for C-shaped grubs.',
    D2: 'Look for reddish-brown pustules on leaves.',
    D4: 'Look for black whip-like growth at the shoot tip.',
    D1: 'Check twisted, yellowing young leaves and the growing point.',
    P2: 'Check shoot holes and dead central shoots.',
    D3: 'Inspect affected stalks for red tissue with white patches.',
    P7: 'Check under leaf sheaths for white, waxy insects.',
  };

  const fullSymptomsMr: Record<string, string> = {
    D7: 'उगवण कमी किंवा विरळ होणे, अननसासारखा गोडसर आंबट वास येऊन बेणे कुजणे, आतील नसा काळ्या पडणे आणि फुटवे अशक्त निघणे किंवा न निघणे.',
    P4: "मुळांचे नुकसान, पाने पिवळी पडून बेट सुकणे किंवा वाळणे, पिकाची वाढ खुंटणे आणि मुळांच्या कार्यक्षेत्रातील मातीत 'C' आकाराच्या पांढऱ्या हुमणी अळ्या आढळणे.",
    D2: 'पानांवर लांबट पिवळसर-तपकिरी ठिपके तयार होऊन दोन्ही बाजूंना तांबूस-तपकिरी ते नारिंगी रंगाच्या पुटकुळ्या (बारीक फोड) येणे आणि पाने सुकणे.',
    D4: 'शेंड्यातून किंवा वाढीच्या टोकातून काळ्या चाबकासारखा लांबट पट्टा बाहेर पडणे; पाने अरुंद व ताठ होणे, बारीक कांड्या आणि अवाजवी फुटवे फुटणे.',
    D1: 'कोवळ्या पानांच्या तळाशी सुरकुत्या पडणे, पाने पिळवटणे, लहान राहणे व पिवळे पडणे; शेंड्याची वाढ विकृत होणे, शेंडा कुजणे व कांडीच्या आत शिडीसारखे लाल पट्टे दिसणे.',
    P2: 'नवीन पानांवर एका ओळीत छिद्रे (शॉट होल्स), पानाच्या मुख्य शिरेत लाल रंगाची भुयारे, वाळलेला मधला पोंगा (डेड हार्ट), आणि बगलफुटी फुटून शेंडा झाडू/गुच्छ सारखा दिसणे.',
    D3: 'वरून ३-४ क्रमांकाची पाने पिवळी पडून वाळणे, कांडी उभी चिरल्यास आतील भाग गडद लाल दिसणे व त्यावर पांढरे आडवे पट्टे आढळणे आणि अल्कोहोल/आंबलेला वास येणे.',
    P7: 'कांड्यांच्या पेऱ्यांवर पानाच्या आवरणाखाली गुलाबी-पांढऱ्या रंगाच्या पिठ्या ढेकणांचे पुंजके, मुंग्यांचा वावर आणि कांडीच्या सालीवर पांढरा मेणासारखा थर असणे.',
  };

  const unknownStage = checks.some((item) => item.stage_eligible == null);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <Icon name="pest-control" size={20} color="#047857" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {mr ? 'हवामान आधारित कीड व रोग अंदाज' : 'Weather-Based Pest & Disease Watch'}
          </Text>
          <Text style={styles.subDate}>
            {shortDate(day, language)} · {mr ? 'हवामानावर आधारित तपासणी' : 'Weather-based scouting'}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>
        {mr
          ? 'सध्याच्या हवामानामुळे खालील कीड व रोगांचा प्रादुर्भाव वाढण्याची शक्यता आहे. प्रत्यक्ष शेतात निरीक्षण करा.'
          : 'Current weather conditions favor the following pests/diseases. Scout your field to verify before applying any treatment.'}
      </Text>

      {matches.length > 0 ? (
        matches.map((item) => (
          <View key={item.rule_id} style={styles.item}>
            <View style={styles.itemNameRow}>
              <View style={styles.riskDot} />
              <Text style={styles.name}>
                {mr ? item.name_mr || names[item.rule_id] || item.name : item.name.split(' (')[0]}
              </Text>
              <View style={styles.riskBadge}>
                <Text style={styles.riskBadgeText}>
                  {mr ? 'अनुकूल हवामान' : 'Favorable Weather'}
                </Text>
              </View>
            </View>
            <Text style={styles.text}>
              {mr
                ? expanded
                  ? item.symptoms_mr || fullSymptomsMr[item.rule_id] || cuesMr[item.rule_id]
                  : cuesMr[item.rule_id]
                : expanded
                  ? item.symptoms
                  : cuesEn[item.rule_id]}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.text}>
          {mr
            ? 'सध्याच्या उपलब्ध हवामानात ठळक जुळणारे संकेत नाहीत. नियमित शेत तपासा.'
            : 'No high-risk weather match in the available checks. Continue routine field inspection.'}
        </Text>
      )}

      {unknownStage && (
        <Text style={styles.note}>
          {mr ? 'पिकाची अवस्था नोंदलेली नाही; मार्गदर्शन मर्यादित आहे.' : 'Crop stage is not recorded, so guidance is limited.'}
        </Text>
      )}

      {onScan && (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.action}
          onPress={onScan}
          activeOpacity={0.85}
        >
          <Icon name="qr-code-scanner" size={18} color="#ffffff" />
          <Text style={styles.actionText}>
            {mr ? 'पिकाचा फोटो तपासा (AI Scan)' : 'Check a crop photo (AI Scan)'} →
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((x) => !x)}
        style={styles.info}
        activeOpacity={0.7}
      >
        <Text style={styles.note}>
          {mr ? 'हे कसे ठरवले?' : 'How this is checked'} {expanded ? '−' : '+'}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <Text style={styles.note}>
          {mr
            ? 'संदर्भातील आठ नियम वापरून तापमान व आर्द्रता तपासली जाते. हे रोग होण्याची टक्केवारी नाही. फक्त हवामान पाहून फवारणी करू नका.'
            : 'Uses reference agronomic rules with forecast temperature and humidity to identify infection risks. This is not disease diagnosis. Scout before treating.'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#002d0a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  subDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  item: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    gap: 4,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#e11d48',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  riskBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b91c1c',
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
  },
  note: {
    fontSize: 11,
    lineHeight: 16,
    color: '#64748b',
  },
  action: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#047857',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    minHeight: 28,
    justifyContent: 'center',
  },
});
