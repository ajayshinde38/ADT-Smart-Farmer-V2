import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import L from 'leaflet';

import { hasRasterForIndex, InteractiveGISMapProps } from './gisMapTypes';
export type { InteractiveGISMapProps } from './gisMapTypes';

import {
  PALETTE_VEG,
  PALETTE_WATER,
  PALETTE_VRA,
  DESC_VEG,
  DESC_VEG_MR,
  DESC_WATER,
  DESC_WATER_MR,
  DESC_VRA,
  DESC_VRA_MR,
  FALLBACK_COLOR,
  getClassIndex,
  getColorForIndex,
  getPaletteForIndex,
} from '../utils/gisColorScale';

export { PALETTE_VEG, PALETTE_WATER, getColorForIndex, getClassIndex, FALLBACK_COLOR };

export const getIndexColorFromPalette = (indexKey: string, val: number | null | undefined): string => {
  return getColorForIndex(indexKey, val);
};

// ── 20-CLASS PALETTES & DESCRIPTIONS CONFIGURATION (from MapViewer.jsx) ──
const INDEX_CONFIG: Record<
  string,
  {
    min: number;
    max: number;
    colors: readonly string[];
    descEn: readonly string[];
    descMr: readonly string[];
  }
> = {
  ndvi: { min: -1.0, max: 1.0, colors: PALETTE_VEG, descEn: DESC_VEG, descMr: DESC_VEG_MR },
  evi: { min: -1.0, max: 1.0, colors: PALETTE_VEG, descEn: DESC_VEG, descMr: DESC_VEG_MR },
  ndre: { min: -1.0, max: 1.0, colors: PALETTE_VEG, descEn: DESC_VEG, descMr: DESC_VEG_MR },
  msavi: { min: -1.0, max: 1.0, colors: PALETTE_VEG, descEn: DESC_VEG, descMr: DESC_VEG_MR },
  ndmi: { min: -1.0, max: 1.0, colors: PALETTE_WATER, descEn: DESC_WATER, descMr: DESC_WATER_MR },
  ndwi: { min: -1.0, max: 1.0, colors: PALETTE_WATER, descEn: DESC_WATER, descMr: DESC_WATER_MR },
  vra:  { min: 0.0, max: 1.0, colors: PALETTE_VRA, descEn: DESC_VRA, descMr: DESC_VRA_MR },
};

// ── POINT-IN-POLYGON (Ray-Casting Algorithm for Accurate Parcel Hover) ──
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  // point is [lat, lng]
  const lat = point[0];
  const lng = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const lati = polygon[i][0];
    const lngi = polygon[i][1];
    const latj = polygon[j][0];
    const lngj = polygon[j][1];

    const intersect =
      lati > lat !== latj > lat &&
      lng < ((lngj - lngi) * (lat - lati)) / (latj - lati) + lngi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── SYNTHETIC HIGH-RESOLUTION RASTER GENERATOR (128x128 from MapViewer.jsx) ──
function generateSyntheticRaster(points: [number, number][], baseVal: number, layerName: string) {
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  points.forEach((p) => {
    // p is [lat, lng], so p[1] is lng (x), p[0] is lat (y)
    if (p[1] < xmin) xmin = p[1];
    if (p[1] > xmax) xmax = p[1];
    if (p[0] < ymin) ymin = p[0];
    if (p[0] > ymax) ymax = p[0];
  });

  const dx = (xmax - xmin) * 0.04 || 0.0001;
  const dy = (ymax - ymin) * 0.04 || 0.0001;
  xmin -= dx; xmax += dx;
  ymin -= dy; ymax += dy;

  const width = 128;
  const height = 128;
  const pixelWidth = (xmax - xmin) / width;
  const pixelHeight = (ymax - ymin) / height;

  const grid: Float32Array[] = [];
  const validBase = (baseVal !== undefined && baseVal !== null && !isNaN(baseVal)) ? Number(baseVal) : 0.5;

  for (let y = 0; y < height; y++) {
    const row = new Float32Array(width);
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      // High-resolution spatial field canopy variation waves matching MapViewer.jsx
      const wave1 = Math.sin(nx * 8.0 + ny * 5.0) * 0.05;
      const wave2 = Math.cos(nx * 3.5 - ny * 9.0) * 0.04;
      const centerPeak = Math.sin(Math.PI * nx) * Math.sin(Math.PI * ny) * 0.06;
      if (layerName.toLowerCase() === 'vra') {
        const ndviCell = validBase + wave1 + wave2 + centerPeak;
        const ndreCell = ndviCell * 0.72;
        const rviCell = 0.48 + wave1 * 0.5;
        // FertiNex VRA Multi-Modal Formula: 0.35*NDVI + 0.35*NDRE + 0.30*RVI
        const vigor = 0.35 * ndviCell + 0.35 * ndreCell + 0.30 * rviCell;
        let zoneVal = 2.0;
        if (vigor < 0.44) zoneVal = 1.0;
        else if (vigor >= 0.62) zoneVal = 3.0;
        row[x] = zoneVal;
      } else {
        let val = validBase + wave1 + wave2 + centerPeak - 0.02;
        if (val > 1.0) val = 1.0;
        if (val < -1.0) val = -1.0;
        row[x] = parseFloat(val.toFixed(3));
      }
    }
    grid.push(row);
  }

  return {
    width,
    height,
    xmin,
    xmax,
    ymin,
    ymax,
    pixelWidth,
    pixelHeight,
    values: [grid],
    layerName,
  };
}

// ── CUSTOM CANVAS RASTER CLIPPING (from MapViewer.jsx) ──
function createClippedStaticImage(
  raster: ReturnType<typeof generateSyntheticRaster>,
  config: { min: number; max: number; colors: readonly string[] },
  points: [number, number][],
  clipToPolygon: boolean
): string {
  const width = raster.width;
  const height = raster.height;
  const data = raster.values[0];
  const xmin = raster.xmin;
  const xmax = raster.xmax;
  const ymin = raster.ymin;
  const ymax = raster.ymax;

  const rasterCanvas = document.createElement('canvas');
  rasterCanvas.width = width;
  rasterCanvas.height = height;
  const rctx = rasterCanvas.getContext('2d');
  if (!rctx) return '';
  const imgData = rctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = data[y][x];
      const i = (y * width + x) * 4;

      if (val === undefined || isNaN(val) || val < -100) {
        imgData.data[i + 3] = 0;
      } else {
        const cIdx = getClassIndex(val, config.min, config.max, raster.layerName);
        const hex = config.colors[cIdx];
        imgData.data[i] = parseInt(hex.slice(1, 3), 16);
        imgData.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        imgData.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        imgData.data[i + 3] = 230; // 90% opacity for satellite map visibility
      }
    }
  }
  rctx.putImageData(imgData, 0, 0);

  if (!clipToPolygon) {
    return rasterCanvas.toDataURL('image/png');
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = height;
  const fctx = finalCanvas.getContext('2d');
  if (!fctx) return rasterCanvas.toDataURL('image/png');

  fctx.beginPath();
  points.forEach((pt, index) => {
    // pt is [lat, lng]
    const px = ((pt[1] - xmin) / (xmax - xmin)) * width;
    const py = ((ymax - pt[0]) / (ymax - ymin)) * height;
    if (index === 0) fctx.moveTo(px, py);
    else fctx.lineTo(px, py);
  });
  fctx.closePath();

  fctx.fillStyle = '#ffffff';
  fctx.fill();
  fctx.globalCompositeOperation = 'source-in';
  fctx.drawImage(rasterCanvas, 0, 0);

  return finalCanvas.toDataURL('image/png');
}

// Complete Authentic Leaflet CSS inlined
const OFFICIAL_LEAFLET_CSS = `
.leaflet-container .leaflet-image-layer { image-rendering: auto; }
.pixel-map { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas,
.leaflet-zoom-box,
.leaflet-image-layer,
.leaflet-layer {
  position: absolute;
  left: 0;
  top: 0;
}
.leaflet-container {
  overflow: hidden;
  position: relative;
  outline: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #0f172a;
}
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
  -webkit-user-select: none;
  -moz-user-select: none;
  user-select: none;
  -webkit-user-drag: none;
}
.leaflet-tile::selection {
  background: transparent;
}
.leaflet-container .leaflet-overlay-pane svg {
  max-width: none !important;
  max-height: none !important;
}
.leaflet-container .leaflet-marker-pane img,
.leaflet-container .leaflet-shadow-pane img,
.leaflet-container .leaflet-tile-pane img,
.leaflet-container img.leaflet-image-layer,
.leaflet-container .leaflet-tile {
  max-width: none !important;
  max-height: none !important;
  width: auto;
  padding: 0;
}
.leaflet-tile {
  filter: inherit;
  visibility: hidden;
}
.leaflet-tile-loaded {
  visibility: inherit;
}
.leaflet-pane         { z-index: 400; }
.leaflet-tile-pane    { z-index: 200; }
.leaflet-overlay-pane { z-index: 400; }
.leaflet-shadow-pane  { z-index: 500; }
.leaflet-marker-pane  { z-index: 600; }
.leaflet-tooltip-pane { z-index: 650; }
.leaflet-popup-pane   { z-index: 700; }
.leaflet-map-pane canvas { z-index: 100; }
.leaflet-map-pane svg    { z-index: 200; }

.leaflet-control {
  position: relative;
  z-index: 800;
  pointer-events: visiblePainted;
  pointer-events: auto;
}
.leaflet-top,
.leaflet-bottom {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
.leaflet-top { top: 0; }
.leaflet-right { right: 0; }
.leaflet-bottom { bottom: 0; }
.leaflet-left { left: 0; }

.leaflet-control-attribution {
  font-size: 9px !important;
  background: rgba(0, 0, 0, 0.55) !important;
  color: #94a3b8 !important;
  padding: 2px 6px !important;
  border-radius: 4px 0 0 0;
}
.leaflet-control-attribution a {
  color: #38bdf8 !important;
  text-decoration: none;
}
`;

export const InteractiveGISMap: React.FC<InteractiveGISMapProps> = ({
  coordinates,
  overlayVisible = true,
  latitude,
  longitude,
  activeIndex = 'ndvi',
  indexValue,
  language = 'en',
  clipMode = 'polygon',
  showBbox = true,
  selectedVraZone = 'all',
  mapHeight = 440,
  onInspectPixel,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const bboxLayerRef = useRef<L.Rectangle | null>(null);
  const rasterLayerRef = useRef<L.ImageOverlay | null>(null);
  const currentRasterRef = useRef<ReturnType<typeof generateSyntheticRaster> | null>(null);
  const hasInitialBoundsFitRef = useRef<boolean>(false);
  const resizeObserverRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Live mouse hover telemetry tooltip state
  const [hoverTooltip, setHoverTooltip] = useState<{
    show: boolean;
    x: number;
    y: number;
    layer: string;
    val: string;
    desc: string;
    color: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    layer: '',
    val: '',
    desc: '',
    color: '#69f0ae',
  });

  // Reset bounds fit flag when coordinates change
  useEffect(() => {
    hasInitialBoundsFitRef.current = false;
  }, [coordinates]);

  // 1. Inject Leaflet official CSS synchronously into document head
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const styleId = 'leaflet-official-bundle-css';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = OFFICIAL_LEAFLET_CSS;
      document.head.appendChild(style);
    }
  }, []);

  // 2. Initialize Leaflet Map with Google Satellite basemap
  useEffect(() => {
    isMountedRef.current = true;
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapRef.current) return;

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    try {
      const initialLat =
        latitude && !isNaN(Number(latitude))
          ? Number(latitude)
          : coordinates && coordinates.length > 0 && !isNaN(Number(coordinates[0][1]))
            ? Number(coordinates[0][1])
            : 19.2008;

      const initialLng =
        longitude && !isNaN(Number(longitude))
          ? Number(longitude)
          : coordinates && coordinates.length > 0 && !isNaN(Number(coordinates[0][0]))
            ? Number(coordinates[0][0])
            : 77.1268;

      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 4,
        maxZoom: 21,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
      }).setView([initialLat, initialLng], 16);

      // Attribution
      L.control.attribution({ position: 'bottomright', prefix: '<a href="https://leafletjs.com" target="_blank">Leaflet</a>' }).addTo(map);

      // Google Satellite Tile Layer
      const googleTiles = L.tileLayer(
        'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        {
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          maxZoom: 21,
          attribution: '&copy; Google',
        }
      ).addTo(map);

      tileLayerRef.current = googleTiles;
      mapRef.current = map;

      map.whenReady(() => {
        if (!isMountedRef.current) return;
        map.invalidateSize();
        setIsMapReady(true);
      });

      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          if (isMountedRef.current && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        });
        setTimeout(() => {
          if (isMountedRef.current && mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 150);

        if (typeof window.ResizeObserver !== 'undefined') {
          const ro = new window.ResizeObserver(() => {
            if (isMountedRef.current && mapRef.current) {
              mapRef.current.invalidateSize();
            }
          });
          ro.observe(container);
          resizeObserverRef.current = ro;
        }
      }
    } catch (err: any) {
      console.error('Failed to initialize Leaflet map container:', err);
      if (isMountedRef.current) {
        setMapError('Failed to initialize map viewport.');
      }
    }

    return () => {
      isMountedRef.current = false;
      setIsMapReady(false);

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (mapRef.current) {
        try {
          if (rasterLayerRef.current) {
            mapRef.current.removeLayer(rasterLayerRef.current);
            rasterLayerRef.current = null;
          }
          if (bboxLayerRef.current) {
            mapRef.current.removeLayer(bboxLayerRef.current);
            bboxLayerRef.current = null;
          }
          if (polygonLayerRef.current) {
            mapRef.current.removeLayer(polygonLayerRef.current);
            polygonLayerRef.current = null;
          }
          if (tileLayerRef.current) {
            tileLayerRef.current.removeFrom(mapRef.current);
            tileLayerRef.current = null;
          }
          mapRef.current.off();
          mapRef.current.remove();
        } catch (cleanupErr) {
          console.warn('Safe cleanup on map unmount:', cleanupErr);
        } finally {
          mapRef.current = null;
        }
      }

      if (container && (container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
    };
  }, []);

  // 3. HD 20-Class Rasterization, Canvas Clipping, Bounding Box, and Telemetry (Exact MapViewer.jsx logic)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Clean up previous layers
    if (rasterLayerRef.current) {
      try { map.removeLayer(rasterLayerRef.current); } catch {}
      rasterLayerRef.current = null;
    }
    if (bboxLayerRef.current) {
      try { map.removeLayer(bboxLayerRef.current); } catch {}
      bboxLayerRef.current = null;
    }
    if (polygonLayerRef.current) {
      try { map.removeLayer(polygonLayerRef.current); } catch {}
      polygonLayerRef.current = null;
    }

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
      return;
    }

    const validLatLngs: [number, number][] = [];
    for (const pt of coordinates) {
      if (Array.isArray(pt) && pt.length >= 2) {
        const c0 = Number(pt[0]);
        const c1 = Number(pt[1]);
        if (!isNaN(c0) && !isNaN(c1) && isFinite(c0) && isFinite(c1)) {
          validLatLngs.push([c1, c0]); // [lat, lng]
        }
      }
    }

    if (validLatLngs.length < 3) return;

    const key = String(activeIndex || 'ndvi').toLowerCase();
    const cfg = INDEX_CONFIG[key] || INDEX_CONFIG.ndvi;
    const baseVal = (typeof indexValue === 'number' && Number.isFinite(indexValue)) ? indexValue : 0.5;

    // 1. Generate HD 128x128 Synthetic Field Raster from genuine GIS project logic
    const raster = generateSyntheticRaster(validLatLngs, baseVal, key);
    currentRasterRef.current = raster;

    // 2. Render Canvas-clipped static image
    const clipToPolygon = clipMode !== 'bbox';
    const dataUrl = createClippedStaticImage(raster, cfg, validLatLngs, clipToPolygon);

    // 3. Add to map as HD ImageOverlay
    const imageBounds: L.LatLngBoundsExpression = [[raster.ymin, raster.xmin], [raster.ymax, raster.xmax]];
    if (dataUrl) {
      const overlay = L.imageOverlay(dataUrl, imageBounds, {
        opacity: overlayVisible ? 1.0 : 0.0,
        className: 'pixel-map',
        interactive: false,
      }).addTo(map);
      rasterLayerRef.current = overlay;
    }

    // 4. Draw Bounding Box rectangle if enabled
    if (showBbox) {
      const bbox = L.rectangle(imageBounds, {
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '6, 6',
        fill: false,
        interactive: false,
      }).addTo(map);
      bboxLayerRef.current = bbox;
    }

    // 5. Draw Farm Boundary Polygon outline
    const polygon = L.polygon(validLatLngs, {
      color: '#69f0ae',
      weight: 2.5,
      fill: false,
      interactive: true,
    }).addTo(map);
    polygonLayerRef.current = polygon;

    // 6. CONTINUOUS MOUSE HOVER TELEMETRY (MapViewer.jsx mousemove listener)
    const handleInspect = (e: L.LeafletMouseEvent) => {
      if (!currentRasterRef.current) return;
      const r = currentRasterRef.current;
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      // Check if mouse is within raster extent
      if (lng < r.xmin || lng > r.xmax || lat < r.ymin || lat > r.ymax) {
        setHoverTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
        return;
      }

      // Check if mouse is inside the actual farm polygon
      if (clipMode !== 'bbox' && !isPointInPolygon([lat, lng], validLatLngs)) {
        setHoverTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
        return;
      }

      const x = Math.floor(((lng - r.xmin) / r.pixelWidth));
      const y = Math.floor(((r.ymax - lat) / r.pixelHeight));

      if (x >= 0 && x < r.width && y >= 0 && y < r.height) {
        const val = r.values[0][y][x];
        if (val !== undefined && val > -100 && !isNaN(val)) {
          const cIdx = getClassIndex(val, cfg.min, cfg.max, key);
          const isMr = language === 'mr';
          const desc = (isMr ? cfg.descMr[cIdx] : cfg.descEn[cIdx]) || cfg.descEn[0];
          const hex = cfg.colors[cIdx] || cfg.colors[0];

          const containerPt = e.containerPoint;
          const displayVal = key === 'vra'
            ? `${isMr ? 'झोन' : 'Zone'} ${cIdx + 1}`
            : val.toFixed(3);

          setHoverTooltip({
            show: true,
            x: containerPt.x,
            y: containerPt.y,
            layer: key === 'vra' ? 'VRA (3-ZONE)' : key.toUpperCase(),
            val: displayVal,
            desc,
            color: hex,
          });

          if (onInspectPixel) {
            onInspectPixel({ layer: key.toUpperCase(), value: val, description: desc });
          }
          return;
        }
      }

      setHoverTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
    };

    const handleMouseLeave = () => {
      setHoverTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
    };

    // Attach to map and polygon for seamless cursor tracking everywhere inside the field
    map.on('mousemove', handleInspect);
    map.on('mouseout', handleMouseLeave);
    polygon.on('mousemove', handleInspect);
    polygon.on('mouseout', handleMouseLeave);

    polygon.bringToFront();
    if (bboxLayerRef.current) bboxLayerRef.current.bringToFront();

    // Initial fit
    const polyBounds = polygon.getBounds();
    if (!hasInitialBoundsFitRef.current && polyBounds.isValid()) {
      map.fitBounds(polyBounds, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 30], maxZoom: 19 });
      hasInitialBoundsFitRef.current = true;
    }

    return () => {
      map.off('mousemove', handleInspect);
      map.off('mouseout', handleMouseLeave);
      polygon.off('mousemove', handleInspect);
      polygon.off('mouseout', handleMouseLeave);
      setHoverTooltip((prev) => (prev.show ? { ...prev, show: false } : prev));
    };
  }, [
    coordinates,
    isMapReady,
    activeIndex,
    indexValue,
    overlayVisible,
    clipMode,
    showBbox,
    language,
    onInspectPixel,
  ]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, [mapHeight]);

  return (
    <View style={styles.wrapper}>
      <View style={{ position: 'relative' }}>
        <div
          ref={mapContainerRef}
          onMouseLeave={() => setHoverTooltip((prev) => (prev.show ? { ...prev, show: false } : prev))}
          style={{
            position: 'relative',
            width: '100%',
            height: mapHeight,
            backgroundColor: '#0f172a',
            zIndex: 1,
            cursor: 'crosshair',
          }}
        />

        {/* Live Cursor Floating Hover Telemetry Tooltip */}
        {hoverTooltip.show && (
          <div
            style={{
              position: 'absolute',
              left: hoverTooltip.x,
              top: hoverTooltip.y,
              transform: hoverTooltip.y < 100 ? 'translate(-50%, 20px)' : 'translate(-50%, -125%)',
              zIndex: 1000,
              pointerEvents: 'none',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1.5px solid #69f0ae',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              minWidth: '140px',
              textAlign: 'center',
              userSelect: 'none',
              transition: 'opacity 0.05s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '2px' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: hoverTooltip.color,
                  display: 'inline-block',
                  border: '1px solid rgba(255,255,255,0.4)',
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#69f0ae', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                {hoverTooltip.layer}
              </span>
            </div>
            <div style={{ fontSize: '21px', fontWeight: 900, lineHeight: 1.15, margin: '2px 0', color: '#ffffff' }}>
              {hoverTooltip.val}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1', lineHeight: 1.2 }}>
              {hoverTooltip.desc}
            </div>
          </div>
        )}

        {mapError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>⚠️ {mapError}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 600,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f9e7dd',
  },
  errorText: {
    fontSize: 13,
    color: '#8b4233',
    lineHeight: 20,
  },
});
