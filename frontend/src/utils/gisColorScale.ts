/**
 * ADT Smart Farmer V2 - GIS Color Scale Utility
 * 
 * DIRECT EXTRACTION FROM ORIGINAL GIS PROJECT (MapViewer.jsx) & FERTINEX VRA
 * Source Reference: C:\\Users\\ADT AI\\Desktop\\GIS (2)\\GIS\\frontend\\kvk-frontend\\src\\components\\MapViewer.jsx
 * Reference VRA: C:\\Users\\ADT AI\\Downloads\\FertiNex\\Fertigation Model
 * 
 * Palettes:
 * 1. PALETTE_VEG: Used for vegetation indices (NDVI, EVI, NDRE, MSAVI, SAVI) - 20 equal classes (-1.0 to +1.0)
 * 2. PALETTE_WATER: Used for moisture/water indices (NDMI, NDWI) - 20 equal classes (-1.0 to +1.0)
 * 3. PALETTE_VRA: Used for FertiNex 3-Zone Variable Rate Precision Application:
 *    - Zone 1 (#ef4444): Low Vigor / Deficit Area (+25% Booster Dose)
 *    - Zone 2 (#10b981): Optimal Growth / Target Area (100% Standard STCR Dose)
 *    - Zone 3 (#0d9488): Dense Canopy / High Vigor Area (-25% Reduced Rate)
 */

// 1. ORIGINAL 20-CLASS VEGETATION PALETTE (Hex codes exactly from MapViewer.jsx)
export const PALETTE_VEG = [
  '#660000', '#8B0000', '#B22222', '#CD5C5C', '#FF0000', '#FF4500',
  '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#E8F48C', '#D4E157',
  '#AED581', '#81C784', '#4CAF50', '#43A047', '#388E3C', '#2E7D32',
  '#1B5E20', '#00FF00'
] as const;

// Scientific descriptions from MapViewer.jsx
export const DESC_VEG = [
  "Deep Water/Snow", "Water", "Clear Water", "Shallow Water", "Wet Soil",
  "Moist Bare Soil", "Bare Soil", "Dry Sand/Rock", "Sparse Vegetation",
  "Dead/Stressed Veg", "Very Low Veg", "Early Growth", "Low Veg",
  "Moderate-Low Veg", "Moderate Veg", "Moderate-High Veg", "High Veg",
  "Dense Canopy", "Very Dense Canopy", "Peak Bright Vegetation"
] as const;

// Marathi descriptions for farmer readability
export const DESC_VEG_MR = [
  "खोल पाणी / बर्फ", "पाणी", "स्वच्छ पाणी", "उथळ पाणी", "ओली माती",
  "ओलावा असलेली माती", "उघडी माती", "सुकी वाळू / खडक", "अतिशय विरळ वनस्पती",
  "सुके / तणावग्रस्त पीक", "अल्प वनस्पती", "सुरुवातीची वाढ", "कमी वाढ",
  "मध्यम-कमी वाढ", "मध्यम वाढ", "मध्यम-चांगली वाढ", "चांगली जोमदार वाढ",
  "दाट पाने / आच्छादन", "अतिशय दाट पीक", "सर्वोच्च हिरवेगार पीक"
] as const;

// 2. ORIGINAL 20-CLASS MOISTURE & WATER PALETTE (Hex codes exactly from MapViewer.jsx)
export const PALETTE_WATER = [
  '#8B0000', '#B22222', '#FF0000', '#FF4500', '#FF8C00', '#FFA500',
  '#FFD700', '#FFFF00', '#FAFAD2', '#E0F7FA', '#B2EBF2', '#80DEEA',
  '#4DD0E1', '#00BCD4', '#0097A7', '#1E90FF', '#4169E1', '#0000FF',
  '#0000CD', '#00008B'
] as const;

// Scientific descriptions from MapViewer.jsx
export const DESC_WATER = [
  "Dense Vegetation / Very Dry", "Moderate Vegetation", "Sparse Vegetation",
  "Dry Bare Soil", "Moist Bare Soil", "Slightly Moist", "Moist Soil",
  "Very Moist Soil", "Wet Surface", "Saturated Soil", "Shallow / Turbid Water",
  "Shallow Water", "Moderate Water", "Clear Shallow Water", "Deepening Water",
  "Deep Water", "Very Deep Water", "Open Water", "Deep Open Water",
  "Deepest Clear Water"
] as const;

// Marathi descriptions for farmer readability
export const DESC_WATER_MR = [
  "दाट पीक / अत्यंत कोरडे", "मध्यम पीक / कोरडे", "विरळ पीक / कोरडी जमीन",
  "कोरडी माती", "किंचित ओलसर माती", "अल्प ओलावा", "ओलसर माती",
  "चांगला ओलावा", "ओला पृष्ठभाग", "संपृक्त (भरपूर ओलावा) माती", "उथळ / गढूळ पाणी",
  "उथळ पाणी", "मध्यम पाणी", "स्वच्छ उथळ पाणी", "खोल जाणारे पाणी",
  "खोल पाणी", "अतिशय खोल पाणी", "मोकळे पाणी", "खोल मोकळे पाणी",
  "अत्यंत खोल स्वच्छ पाणी"
] as const;

// 3. FERTINEX 3-ZONE PRECISION VRA PALETTE
export const PALETTE_VRA = [
  '#ef4444', // Zone 1: Low Vigor / Deficit (+25% Booster Dose, 1.25x)
  '#10b981', // Zone 2: Optimal Target (100% Standard STCR Dose, 1.00x)
  '#0d9488', // Zone 3: Dense Canopy / High Vigor (-25% Reduced Rate, 0.75x)
] as const;

export const DESC_VRA = [
  "Zone 1: Low Vigor / Deficit Area (+25% Booster Dose)",
  "Zone 2: Optimal Growth / Target Area (100% Standard STCR Dose)",
  "Zone 3: Dense Canopy / High Vigor Area (-25% Reduced Rate)"
] as const;

export const DESC_VRA_MR = [
  "विभाग १: कमी वाढ / कमतरता (+२५% वाढीव खत)",
  "विभाग २: उत्तम वाढ / प्रमाण (१००% मानक खत)",
  "विभाग ३: दाट वाढ / अति जोमदार (-२५% कमी खत)"
] as const;

// Default neutral fallback for missing or unmeasured data
export const FALLBACK_COLOR = '#94a3b8'; // Neutral Slate Grey

export type IndexGroup = 'vegetation' | 'water' | 'vra';

export interface ClassBoundary {
  classIndex: number;
  low: number;
  high: number;
  color: string;
  descEn: string;
  descMr: string;
}

/**
 * Determine the index group ('vegetation' | 'water' | 'vra') for an index key.
 */
export function getIndexGroup(indexKey: string): IndexGroup {
  const normalized = (indexKey || '').toLowerCase().trim();
  if (normalized === 'vra') {
    return 'vra';
  }
  if (normalized === 'ndmi' || normalized === 'ndwi') {
    return 'water';
  }
  return 'vegetation';
}

/**
 * Get the palette array for a specific index.
 */
export function getPaletteForIndex(indexKey: string): readonly string[] {
  const group = getIndexGroup(indexKey);
  if (group === 'vra') return PALETTE_VRA;
  if (group === 'water') return PALETTE_WATER;
  return PALETTE_VEG;
}

/**
 * Get the descriptions array for a specific index.
 */
export function getDescriptionsForIndex(indexKey: string, lang: 'en' | 'mr' = 'en'): readonly string[] {
  const group = getIndexGroup(indexKey);
  if (group === 'vra') {
    return lang === 'mr' ? DESC_VRA_MR : DESC_VRA;
  }
  if (group === 'water') {
    return lang === 'mr' ? DESC_WATER_MR : DESC_WATER;
  }
  return lang === 'mr' ? DESC_VEG_MR : DESC_VEG;
}

/**
 * Exact implementation of getClassIndex from original MapViewer.jsx:
 * Enhanced to support 3-Zone VRA reclassification.
 */
export function getClassIndex(
  value: number | null | undefined,
  min: number = -1.0,
  max: number = 1.0,
  indexKey?: string
): number {
  if (value === null || value === undefined) return -1;
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num) || !isFinite(num)) return -1;

  if (indexKey && getIndexGroup(indexKey) === 'vra') {
    if (num === 1 || num === 1.0) return 0;
    if (num === 2 || num === 2.0) return 1;
    if (num === 3 || num === 3.0) return 2;
    if (num < 0.44) return 0;
    if (num < 0.62) return 1;
    return 2;
  }

  if (num <= min) return 0;
  if (num >= max) return 19;

  const step = (max - min) / 20.0;
  const normalized = Math.round(((num - min) / step) * 1e8) / 1e8;
  const index = Math.floor(normalized);
  return Math.min(19, Math.max(0, index));
}

/**
 * Get the hex color for an index value.
 * Returns FALLBACK_COLOR for null, undefined, or NaN values.
 */
export function getColorForIndex(
  indexKey: string,
  value: number | null | undefined,
  min: number = -1.0,
  max: number = 1.0
): string {
  const cIdx = getClassIndex(value, min, max, indexKey);
  if (cIdx === -1) {
    return FALLBACK_COLOR;
  }
  const palette = getPaletteForIndex(indexKey);
  return palette[cIdx] || FALLBACK_COLOR;
}

/**
 * Get the human-readable description for an index value.
 */
export function getDescriptionForValue(
  indexKey: string,
  value: number | null | undefined,
  lang: 'en' | 'mr' = 'en',
  min: number = -1.0,
  max: number = 1.0
): string {
  const cIdx = getClassIndex(value, min, max, indexKey);
  if (cIdx === -1) {
    return lang === 'mr' ? 'माहिती उपलब्ध नाही' : 'No Data / Unmeasured';
  }
  const descriptions = getDescriptionsForIndex(indexKey, lang);
  return descriptions[cIdx] || (lang === 'mr' ? 'माहिती उपलब्ध नाही' : 'No Data / Unmeasured');
}

/**
 * Compute the low and high values for class i in [min, max].
 */
export function getClassRange(classIndex: number, min: number = -1.0, max: number = 1.0): { low: number; high: number } {
  const clampedIdx = Math.min(19, Math.max(0, classIndex));
  const step = (max - min) / 20.0;
  const low = parseFloat((min + clampedIdx * step).toFixed(2));
  const high = parseFloat((clampedIdx === 19 ? max : min + (clampedIdx + 1) * step).toFixed(2));
  return { low, high };
}

/**
 * Returns all class boundaries, colors, and descriptions for legend generation.
 */
export function getAllClassBoundaries(
  indexKey: string,
  min: number = -1.0,
  max: number = 1.0
): ClassBoundary[] {
  if (getIndexGroup(indexKey) === 'vra') {
    return [
      {
        classIndex: 0,
        low: 0.0,
        high: 0.44,
        color: PALETTE_VRA[0],
        descEn: DESC_VRA[0],
        descMr: DESC_VRA_MR[0],
      },
      {
        classIndex: 1,
        low: 0.44,
        high: 0.62,
        color: PALETTE_VRA[1],
        descEn: DESC_VRA[1],
        descMr: DESC_VRA_MR[1],
      },
      {
        classIndex: 2,
        low: 0.62,
        high: 1.0,
        color: PALETTE_VRA[2],
        descEn: DESC_VRA[2],
        descMr: DESC_VRA_MR[2],
      },
    ];
  }

  const palette = getPaletteForIndex(indexKey);
  const descEn = getDescriptionsForIndex(indexKey, 'en');
  const descMr = getDescriptionsForIndex(indexKey, 'mr');

  const boundaries: ClassBoundary[] = [];
  for (let i = 0; i < 20; i++) {
    const { low, high } = getClassRange(i, min, max);
    boundaries.push({
      classIndex: i,
      low,
      high,
      color: palette[i],
      descEn: descEn[i],
      descMr: descMr[i],
    });
  }
  return boundaries;
}
