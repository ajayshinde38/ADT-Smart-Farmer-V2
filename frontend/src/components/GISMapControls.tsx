import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Language = 'en' | 'mr';
type Basemap = 'satellite' | 'street';

/**
 * A simple mode selector, not a colour-scale legend. A true spatial map is
 * offered only when the backend supplies a genuine raster for this index.
 */
export const GISMapLegend = ({ language, spatial, canCompare, onToggleMode }: {
  activeIndex: string;
  language: Language;
  spatial: boolean;
  canCompare: boolean;
  onToggleMode?: (mode: 'A' | 'B') => void;
}) => {
  if (!canCompare || !onToggleMode) return null;

  return (
    <View style={styles.modeStrip}>
      <Text style={styles.modeTitle}>
        {language === 'mr' ? 'नकाशा दृश्य' : 'Map view'}
      </Text>
      <View style={styles.modeGroup}>
        {(['B', 'A'] as const).map((mode) => {
          const selected = spatial === (mode === 'B');
          return (
            <TouchableOpacity
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onToggleMode(mode)}
              activeOpacity={0.85}
              style={[styles.modeButton, selected && styles.modeSelected]}
            >
              <Text style={[styles.modeButtonText, selected && styles.modeSelectedText]}>
                {language === 'mr'
                  ? mode === 'B' ? 'रंगीत नकाशा' : 'सरासरी'
                  : mode === 'B' ? 'Satellite colours' : 'Field average'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export const GISMapToolbar = ({ language, basemap, onBasemap, onZoomIn, onZoomOut, onCenter }: {
  language: Language;
  basemap: Basemap;
  onBasemap: (map: Basemap) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
}) => (
  <View style={styles.toolbar}>
    <View style={styles.group}>
      {(['satellite', 'street'] as const).map((base) => (
        <TouchableOpacity
          key={base}
          accessibilityRole="button"
          accessibilityState={{ selected: base === basemap }}
          style={[styles.base, base === basemap && styles.baseSelected]}
          onPress={() => onBasemap(base)}
        >
          <Text style={styles.buttonText}>
            {language === 'mr'
              ? base === 'satellite' ? 'उपग्रह' : 'रस्ते'
              : base === 'satellite' ? 'Satellite' : 'Street'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
    <View style={styles.group}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === 'mr' ? 'जवळून पाहा' : 'Zoom in'} style={styles.iconButton} onPress={onZoomIn}>
        <Text style={styles.zoom}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === 'mr' ? 'दूरून पाहा' : 'Zoom out'} style={styles.iconButton} onPress={onZoomOut}>
        <Text style={styles.zoom}>−</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={language === 'mr' ? 'शेत मध्यभागी आणा' : 'Recenter farm'} style={styles.base} onPress={onCenter}>
        <Text style={styles.buttonText}>◎ {language === 'mr' ? 'शेत' : 'Center'}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

/**
 * Basemap credit must remain legible and adjacent to imagery, even when
 * Leaflet's default bottom-right attribution box is removed.
 */
export const GISMapAttribution = ({ basemap }: {
  language: Language;
  basemap: Basemap;
}) => {
  const satellite = basemap === 'satellite';
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={satellite ? 'Imagery credits: Esri, Maxar, Earthstar Geographics' : 'Map credit: OpenStreetMap contributors'}
      onPress={() => void Linking.openURL(satellite ? 'https://www.esri.com/' : 'https://www.openstreetmap.org/copyright')}
      style={styles.credits}
    >
      <Text style={styles.creditText} numberOfLines={2}>
        {satellite
          ? 'Imagery © Esri, Maxar, Earthstar Geographics'
          : 'Map data © OpenStreetMap contributors'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  modeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#F8FBF8',
    borderBottomWidth: 1,
    borderColor: '#E1EAE1',
  },
  modeTitle: { color: '#486654', fontSize: 11, fontWeight: '700' },
  modeGroup: { flexDirection: 'row', gap: 5 },
  modeButton: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#EDF3ED', borderWidth: 1, borderColor: 'transparent',
  },
  modeSelected: { backgroundColor: '#DDF2E2', borderColor: '#B8DDC3' },
  modeButtonText: { fontSize: 11, fontWeight: '600', color: '#53705B' },
  modeSelectedText: { color: '#15643D', fontWeight: '800' },
  toolbar: {
    paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#FFFFFF',
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    alignItems: 'center', gap: 6,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  base: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 9 },
  baseSelected: { backgroundColor: '#E2F3E5' },
  buttonText: { color: '#305C3C', fontSize: 11, fontWeight: '700' },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4ED', borderRadius: 9 },
  zoom: { fontSize: 21, color: '#305C3C' },
  credits: {
    minHeight: 25, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F7F9F6', paddingHorizontal: 8, paddingVertical: 4,
    borderTopWidth: 1, borderTopColor: '#EDF0EB',
  },
  creditText: { fontSize: 10, lineHeight: 14, color: '#65766A', textAlign: 'center' },
});
