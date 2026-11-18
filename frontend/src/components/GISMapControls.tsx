import React from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PALETTE_VEG, PALETTE_WATER, PALETTE_VRA, getIndexGroup } from '../utils/gisColorScale';

type Language = 'en' | 'mr';
type Basemap = 'satellite' | 'street';

export const GISMapLegend = ({
  activeIndex,
  language,
  clipMode = 'polygon',
  showBbox = true,
  onToggleClipMode,
  onToggleShowBbox,
}: {
  activeIndex: string;
  language: Language;
  clipMode?: 'polygon' | 'bbox';
  showBbox?: boolean;
  onToggleClipMode?: (mode: 'polygon' | 'bbox') => void;
  onToggleShowBbox?: (show: boolean) => void;
}) => {
  const isMr = language === 'mr';
  const group = getIndexGroup(activeIndex);
  const isWater = group === 'water';
  const isVra = group === 'vra';
  const palette = isVra ? PALETTE_VRA : isWater ? PALETTE_WATER : PALETTE_VEG;

  return (
    <View style={styles.legendContainer}>
      {/* 1. Mode Switcher: Field Parcel vs Bounding Box */}
      {onToggleClipMode && (
        <View style={styles.extentRow}>
          <View style={styles.extentButtonGroup}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: clipMode === 'polygon' }}
              onPress={() => onToggleClipMode('polygon')}
              style={[styles.extentBtn, clipMode === 'polygon' && styles.extentBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.extentBtnText, clipMode === 'polygon' && styles.extentBtnTextActive]}>
                🌱 {isMr ? 'शेताची हद्द' : 'Field Parcel'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ selected: clipMode === 'bbox' }}
              onPress={() => onToggleClipMode('bbox')}
              style={[styles.extentBtn, clipMode === 'bbox' && styles.extentBtnActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.extentBtnText, clipMode === 'bbox' && styles.extentBtnTextActive]}>
                📦 {isMr ? 'बाऊंडिंग बॉक्स' : 'Bounding Box'}
              </Text>
            </TouchableOpacity>
          </View>

          {onToggleShowBbox && (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: showBbox }}
              onPress={() => onToggleShowBbox(!showBbox)}
              style={styles.bboxCheckRow}
              activeOpacity={0.8}
            >
              <View style={[styles.checkboxBox, showBbox && styles.checkboxBoxChecked]}>
                {showBbox && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.bboxCheckLabel}>
                {isMr ? 'बॉक्स दाखवा' : 'Show Box'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 2. Color Scale Legend Bar: 3-Zone VRA or 20-Class Satellite Palettes */}
      {isVra ? (
        <View style={styles.scaleCard}>
          <View style={styles.scaleHeader}>
            <Text style={styles.scaleTitle}>
              VRA · {isMr ? '३-विभाग अचूक खत नियोजन' : '3-Zone Precision Rate'}
            </Text>
            <Text style={[styles.scaleTag, { backgroundColor: '#e6f4ea', color: '#0d652d' }]}>
              0.35·NDVI + 0.35·NDRE + 0.30·RVI
            </Text>
          </View>

          <View style={styles.paletteBar}>
            <View style={[styles.paletteSegment, { flex: 1, backgroundColor: '#ef4444' }]} />
            <View style={[styles.paletteSegment, { flex: 1, backgroundColor: '#10b981' }]} />
            <View style={[styles.paletteSegment, { flex: 1, backgroundColor: '#0d9488' }]} />
          </View>

          <View style={styles.scaleLabels}>
            <Text style={[styles.scaleBound, { color: '#dc2626', fontWeight: '700' }]}>
              {isMr ? 'विभाग १ (+२५%)' : 'Zone 1 (+25%)'}
            </Text>
            <Text style={[styles.scaleMid, { color: '#059669', fontWeight: '700' }]}>
              {isMr ? 'विभाग २ (१००%)' : 'Zone 2 (100%)'}
            </Text>
            <Text style={[styles.scaleBound, { color: '#0d9488', fontWeight: '700' }]}>
              {isMr ? 'विभाग ३ (-२५%)' : 'Zone 3 (-25%)'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.scaleCard}>
          <View style={styles.scaleHeader}>
            <Text style={styles.scaleTitle}>
              {activeIndex.toUpperCase()} {isMr ? 'रंग वर्गीकरण (२० स्तर)' : 'Color Scale (20 Classes)'}
            </Text>
            <Text style={styles.scaleTag}>
              {isWater ? (isMr ? 'जल/ओलावा' : 'Water/Moisture') : (isMr ? 'वनस्पती वाढ' : 'Vegetation')}
            </Text>
          </View>

          <View style={styles.paletteBar}>
            {palette.map((color, idx) => (
              <View
                key={idx}
                style={[styles.paletteSegment, { backgroundColor: color }]}
              />
            ))}
          </View>

          <View style={styles.scaleLabels}>
            <Text style={styles.scaleBound}>-1.0</Text>
            <Text style={styles.scaleMid}>0.0</Text>
            <Text style={styles.scaleBound}>+1.0</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export const GISMapToolbar = ({
  language,
  basemap,
  onBasemap,
  onZoomIn,
  onZoomOut,
  onCenter,
}: {
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
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={language === 'mr' ? 'जवळून पाहा' : 'Zoom in'}
        style={styles.iconButton}
        onPress={onZoomIn}
      >
        <Text style={styles.zoom}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={language === 'mr' ? 'दूरून पाहा' : 'Zoom out'}
        style={styles.iconButton}
        onPress={onZoomOut}
      >
        <Text style={styles.zoom}>−</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={language === 'mr' ? 'शेत मध्यभागी आणा' : 'Recenter farm'}
        style={styles.base}
        onPress={onCenter}
      >
        <Text style={styles.buttonText}>◎ {language === 'mr' ? 'शेत' : 'Center'}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export const GISMapAttribution = ({
  basemap,
}: {
  language: Language;
  basemap: Basemap;
}) => {
  const satellite = basemap === 'satellite';
  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={satellite ? 'Map data © Google' : 'Map data © OpenStreetMap contributors'}
      onPress={() => void Linking.openURL(satellite ? 'https://www.google.com/maps' : 'https://www.openstreetmap.org/copyright')}
      style={styles.credits}
    >
      <Text style={styles.creditText} numberOfLines={1}>
        {satellite ? 'Map data © Google' : 'Map data © OpenStreetMap contributors'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  legendContainer: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  extentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  extentButtonGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
    gap: 2,
    flex: 1,
  },
  extentBtn: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  extentBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  extentBtnTextActive: {
    fontWeight: '800',
    color: '#15803d',
  },
  bboxCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxBoxChecked: {
    backgroundColor: '#f59e0b',
  },
  checkmark: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 12,
  },
  bboxCheckLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  scaleCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  scaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  scaleTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scaleTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  paletteBar: {
    flexDirection: 'row',
    height: 10,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  paletteSegment: {
    flex: 1,
    height: '100%',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  scaleBound: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
  },
  scaleMid: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  base: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
  },
  baseSelected: {
    backgroundColor: '#22c55e',
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoom: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  credits: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  creditText: {
    fontSize: 9,
    color: '#94a3b8',
  },
});
