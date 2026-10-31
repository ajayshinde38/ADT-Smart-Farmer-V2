import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import L from 'leaflet';
import { API_BASE_URL, ApiClient } from '../services/apiClient';

import { hasRasterForIndex, InteractiveGISMapProps } from './gisMapTypes';
import { GISMapAttribution, GISMapLegend, GISMapToolbar } from './GISMapControls';
export type { InteractiveGISMapProps } from './gisMapTypes';

import {
  PALETTE_VEG,
  PALETTE_WATER,
  FALLBACK_COLOR,
  getClassIndex,
  getColorForIndex,
  getPaletteForIndex,
  getClassRange,
} from '../utils/gisColorScale';

export { PALETTE_VEG, PALETTE_WATER, getColorForIndex, getClassIndex, FALLBACK_COLOR };

export const getIndexColorFromPalette = (indexKey: string, val: number | null | undefined): string => {
  return getColorForIndex(indexKey, val);
};

// Complete Authentic Leaflet 1.9.4 CSS inlined without harmful !important position overrides
const OFFICIAL_LEAFLET_CSS = `
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
.leaflet-zoom-box {
  width: 0;
  height: 0;
  box-sizing: border-box;
  z-index: 800;
}
.leaflet-overlay-pane svg {
  -moz-user-select: none;
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
  pointer-events: auto;
  float: left;
  clear: both;
}
.leaflet-top,
.leaflet-bottom {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
.leaflet-top    { top: 0; }
.leaflet-right  { right: 0; }
.leaflet-bottom { bottom: 0; }
.leaflet-left   { left: 0; }
.leaflet-right .leaflet-control { float: right; margin-right: 10px; }
.leaflet-bottom .leaflet-control { margin-bottom: 10px; }

.leaflet-zoom-animated {
  transform-origin: 0 0;
}
svg.leaflet-zoom-animated {
  will-change: transform;
}
.leaflet-zoom-anim .leaflet-zoom-animated {
  transition: transform 0.25s cubic-bezier(0,0,0.25,1);
}
.leaflet-zoom-anim .leaflet-tile,
.leaflet-pan-anim .leaflet-tile {
  transition: none;
}
.leaflet-zoom-anim .leaflet-zoom-hide {
  visibility: hidden;
}

.leaflet-interactive {
  cursor: pointer;
}
.leaflet-grab {
  cursor: grab;
}
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-image-layer,
.leaflet-pane > svg path,
.leaflet-tile-container {
  pointer-events: none;
}
.leaflet-marker-icon.leaflet-interactive,
.leaflet-image-layer.leaflet-interactive,
.leaflet-pane > svg path.leaflet-interactive {
  pointer-events: auto;
}

.leaflet-container .leaflet-control-attribution {
  background: rgba(15, 23, 42, 0.85);
  color: #94a3b8;
  font-size: 10px;
  padding: 3px 8px;
  margin: 0;
  border-radius: 6px 0 0 0;
  pointer-events: auto;
}
.leaflet-control-attribution a {
  color: #38bdf8;
  text-decoration: none;
}
.leaflet-control-attribution a:hover {
  text-decoration: underline;
}

.custom-leaflet-tooltip {
  background-color: #0f172a !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: #f8fafc !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  border-radius: 6px !important;
  padding: 4px 8px !important;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4) !important;
}

.leaflet-popup {
  position: absolute;
  text-align: center;
  margin-bottom: 20px;
}
.leaflet-popup-content-wrapper {
  padding: 2px;
  text-align: left;
  border-radius: 12px;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.leaflet-popup-content {
  margin: 12px 14px;
  line-height: 1.4;
  font-size: 13px;
}
`;

export const InteractiveGISMap: React.FC<InteractiveGISMapProps> = ({
  coordinates,
  overlayVisible = true,
  geojson,
  farmerName,
  areaAcres,
  latitude,
  longitude,
  activeIndex,
  indexValue,
  captureDate,
  language = 'en',
  rasterInfo = null,
  mode = 'A',
  mapHeight = 440,
  onToggleMode,
  authorizationToken,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const farmLayerGroupRef = useRef<L.FeatureGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const rasterLayerRef = useRef<L.ImageOverlay | null>(null);
  const hasInitialBoundsFitRef = useRef<boolean>(false);
  const resizeObserverRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [basemap, setBasemap] = useState<'satellite' | 'street'>('satellite');
  const [mapError, setMapError] = useState<string | null>(null);
  const [tileWarning, setTileWarning] = useState<string | null>(null);
  const [rasterFailed, setRasterFailed] = useState(false);

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

  // 2. Initialize Leaflet Map with correct maxNativeZoom to fix Zoom disappearance
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
            : 19.209693;

      const initialLng =
        longitude && !isNaN(Number(longitude))
          ? Number(longitude)
          : coordinates && coordinates.length > 0 && !isNaN(Number(coordinates[0][0]))
            ? Number(coordinates[0][0])
            : 77.113003;

      // Map supports deep zooming up to zoom level 21
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 4,
        maxZoom: 21,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
      });

      // Initial center at level 16
      map.setView([initialLat, initialLng], 16);

      // CRITICAL FIX: maxNativeZoom: 18 prevents Esri from returning "Map data not yet available"
      // When zoomed into level 19, 20 or 21, Leaflet automatically overzooms native level 18 tiles
      const esriTiles = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 18,
          maxZoom: 21,
          attribution:
            'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics',
        }
      );

      let tileErrors = 0;
      esriTiles.on('tileerror', () => {
        tileErrors++;
        if (tileErrors > 8 && isMountedRef.current) {
          setTileWarning('Satellite tiles loading slowly. Check network connection.');
        }
      });
      esriTiles.on('tileload', () => {
        if (tileErrors > 0 && isMountedRef.current) {
          tileErrors = 0;
          setTileWarning(null);
        }
      });

      esriTiles.addTo(map);
      tileLayerRef.current = esriTiles;

      const farmGroup = L.featureGroup().addTo(map);
      farmLayerGroupRef.current = farmGroup;

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
          if (farmLayerGroupRef.current) {
            farmLayerGroupRef.current.clearLayers();
            farmLayerGroupRef.current.removeFrom(mapRef.current);
            farmLayerGroupRef.current = null;
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

  // 3. Basemap Switcher (Satellite ↔ Street) with overzoom protection
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    if (basemap === 'satellite') {
      const esriLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxNativeZoom: 18,
          maxZoom: 21,
          attribution:
            'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a>, Maxar, Earthstar Geographics',
        }
      ).addTo(map);
      tileLayerRef.current = esriLayer;
    } else {
      const osmLayer = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxNativeZoom: 19,
          maxZoom: 21,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        }
      ).addTo(map);
      tileLayerRef.current = osmLayer;
    }
    const layer = tileLayerRef.current;
    let errors = 0;
    const failed = () => { if (++errors > 8) setTileWarning(language === 'mr' ? 'नकाशाची चित्रे उपलब्ध नाहीत. इंटरनेट तपासा.' : 'Map imagery unavailable. Check your connection.'); };
    const loaded = () => { errors = 0; setTileWarning(null); };
    layer?.on('tileerror', failed); layer?.on('tileload', loaded);
    return () => { layer?.off('tileerror', failed); layer?.off('tileload', loaded); };
  }, [basemap, isMapReady, language]);

  // 4. Farm Vector Overlays & Genuine Sentinel-2 Raster Layer
  useEffect(() => {
    const map = mapRef.current;
    const group = farmLayerGroupRef.current;
    if (!map || !group || !isMapReady) return;

    group.clearLayers();

    if (rasterLayerRef.current) {
      try {
        rasterLayerRef.current.removeFrom(map);
      } catch (e) { }
      rasterLayerRef.current = null;
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
          validLatLngs.push([c1, c0]);
        }
      }
    }

    if (validLatLngs.length < 3) return;

    const dynamicThemeColor = getColorForIndex(activeIndex, indexValue);
    // Mode A: Palette color dynamically chosen from authentic 20-class scale
    const hasData = Boolean(captureDate) && typeof indexValue === 'number' && Number.isFinite(indexValue);
    const isModeB = mode === 'B' && hasRasterForIndex({ rasterInfo, activeIndex });

    const abort = new AbortController();
    let rasterUrl: string | null = null;
    setRasterFailed(false);
    map.whenReady(() => {
      if (!isMountedRef.current || !mapRef.current || !farmLayerGroupRef.current) return;
      if (isModeB && rasterInfo?.bounds && rasterInfo?.overlay_urls?.[activeIndex.toLowerCase()]) {
        const bounds = rasterInfo.bounds as L.LatLngBoundsExpression;
        const token = authorizationToken || ApiClient.getToken();
        // Raster URLs returned by FastAPI are API-relative. Always resolve them
        // against the configured BACKEND, not the Expo/Vercel frontend origin.
        const rawUrl = rasterInfo.overlay_urls[activeIndex.toLowerCase()];
        let rasterEndpoint: URL | null = null;
        try {
          rasterEndpoint = new URL(rawUrl, `${API_BASE_URL}/`);
          const apiBase = new URL(API_BASE_URL);
          const apiPrefix = apiBase.pathname.replace(/\/$/, '');
          // Never send the farmer bearer token to an unexpected origin/path.
          if (
            rasterEndpoint.origin !== apiBase.origin ||
            !rasterEndpoint.pathname.startsWith(`${apiPrefix}/gis/plot/`) ||
            !rasterEndpoint.pathname.endsWith('.png')
          ) {
            throw new Error('Raster URL is outside the authorized GIS API');
          }
        } catch (error) {
          rasterEndpoint = null;
          console.warn('Invalid GIS raster URL:', error);
          setRasterFailed(true);
        }

        if (rasterEndpoint) fetch(rasterEndpoint.toString(), {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: abort.signal,
          redirect: 'error',
        }).then(async response => {
          if (!response.ok) throw new Error(`Raster HTTP ${response.status}`);
          const blob = await response.blob();
          if (!blob.size || (!blob.type.includes('image/png') && blob.type !== 'application/octet-stream')) {
            throw new Error('Raster response is not a PNG image');
          }
          return blob;
        }).then(blob => {
          if (abort.signal.aborted || !mapRef.current) return;
          rasterUrl = URL.createObjectURL(blob);
          const overlay = L.imageOverlay(rasterUrl, bounds, { opacity: overlayVisible ? 0.94 : 0, interactive: false });
          overlay.on('error', () => { if (!abort.signal.aborted) setRasterFailed(true); });
          overlay.addTo(mapRef.current);
          rasterLayerRef.current = overlay;
          // Clip the authentic image to the boundary in Web Mercator coordinates.
          // The same projected proportions remain aligned during zoom and pan.
          const northWest = map.project([rasterInfo!.bounds![1][0], rasterInfo!.bounds![0][1]], 0);
          const southEast = map.project([rasterInfo!.bounds![0][0], rasterInfo!.bounds![1][1]], 0);
          const clip = validLatLngs.map(point => {
            const pixel = map.project(point, 0);
            return `${100 * (pixel.x - northWest.x) / (southEast.x - northWest.x)}% ${100 * (pixel.y - northWest.y) / (southEast.y - northWest.y)}%`;
          }).join(',');
          const applyClip = () => {
            const img = overlay.getElement();
            if (img) img.style.clipPath = `polygon(${clip})`;
          };
          overlay.on('load', applyClip);
          applyClip();
          polygon.bringToFront();
        }).catch(() => { if (!abort.signal.aborted) setRasterFailed(true); });
      }

      // 1. Draw Farm Boundary Polygon (Mode A: Verified Farm-Average Uniform Tint; Mode B: Transparent fill over real pixels)
      const polygon = L.polygon(validLatLngs, {
        color: '#4ade80', // Boundary remains visible independently of measurements
        weight: 3,
        fillColor: dynamicThemeColor,
        fillOpacity: !overlayVisible || isModeB ? 0.0 : (hasData ? 0.42 : 0.0), // In Mode B, 0 opacity allows authentic pixel raster to show through
        dashArray: undefined,
      });

      group.addLayer(polygon);

      // Hover on desktop, tap on mobile. Read authentic PNG color classes,
      // never invent an exact per-pixel index value from a rendered PNG.
      let sourcePixels: CanvasRenderingContext2D | null = null;
      let inspectionTip: L.Tooltip | null = null;
      let pinned = false;
      const inspect = (event: L.LeafletMouseEvent) => {
        if (!overlayVisible) return;
        let label = '';
        if (isModeB && rasterInfo?.bounds) {
          const image = rasterLayerRef.current?.getElement() as HTMLImageElement | undefined;
          if (!image?.complete || !image.naturalWidth) return;
          if (!sourcePixels) {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) return;
            try {
              context.drawImage(image, 0, 0);
            } catch (_) { return; }
            sourcePixels = context;
          }
          const [southWest, northEast] = rasterInfo.bounds;
          const nw = map.project([northEast[0], southWest[1]], 0);
          const se = map.project([southWest[0], northEast[1]], 0);
          const cursor = map.project(event.latlng, 0);
          const rx = (cursor.x - nw.x) / (se.x - nw.x);
          const ry = (cursor.y - nw.y) / (se.y - nw.y);
          if (rx < 0 || ry < 0 || rx >= 1 || ry >= 1) return;
          const px = Math.floor(rx * sourcePixels.canvas.width);
          const py = Math.floor(ry * sourcePixels.canvas.height);
          const pixel = sourcePixels.getImageData(px, py, 1, 1).data;
          if (!pixel[3]) {
            label = language === 'mr' ? 'या ठिकाणी डेटा नाही' : 'No valid satellite pixel';
          } else {
            const i = getPaletteForIndex(activeIndex).findIndex((hex) =>
              parseInt(hex.slice(1, 3), 16) === pixel[0] &&
              parseInt(hex.slice(3, 5), 16) === pixel[1] &&
              parseInt(hex.slice(5, 7), 16) === pixel[2]
            );
            if (i < 0) {
              label = language === 'mr' ? 'रंग श्रेणी उपलब्ध नाही' : 'Pixel class unavailable';
            } else {
              const range = getClassRange(i);
              label = `${activeIndex.toUpperCase()}: ${range.low.toFixed(2)}–${range.high.toFixed(2)} (${language === 'mr' ? 'उपग्रह रंग श्रेणी' : 'satellite class range'})`;
            }
          }
        } else if (hasData && indexValue != null) {
          label = `${activeIndex.toUpperCase()}: ${indexValue.toFixed(2)} (${language === 'mr' ? 'शेताची सरासरी' : 'field average'})`;
        }
        if (!label) return;
        if (!inspectionTip) {
          inspectionTip = L.tooltip({ permanent: true, direction: 'top', offset: L.point(0, -12), interactive: false, className: 'custom-leaflet-tooltip' });
        }
        inspectionTip.setLatLng(event.latlng).setContent(label);
        if (!map.hasLayer(inspectionTip)) inspectionTip.addTo(map);
      };
      polygon.on('mousemove', (event: L.LeafletMouseEvent) => { if (!pinned) inspect(event); });
      polygon.on('click', (event: L.LeafletMouseEvent) => { pinned = true; inspect(event); });
      polygon.on('mouseout', () => { if (!pinned && inspectionTip) map.removeLayer(inspectionTip); });
      polygon.on('remove', () => { if (inspectionTip) map.removeLayer(inspectionTip); });

      // 3. Fit Map to Polygon once on load without resetting user pan/zoom on index selection
      const polyBounds = polygon.getBounds();
      if (!hasInitialBoundsFitRef.current && polyBounds.isValid()) {
        map.fitBounds(polyBounds, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 30], maxZoom: 19 });
        hasInitialBoundsFitRef.current = true;
      }
    });
    return () => {
      abort.abort();
      if (rasterUrl) URL.revokeObjectURL(rasterUrl);
    };
  }, [
    coordinates,
    isMapReady,
    farmerName,
    areaAcres,
    latitude,
    longitude,
    activeIndex,
    indexValue,
    captureDate,
    language,
    rasterInfo,
    overlayVisible,
    mode,
    authorizationToken,
  ]);

  useEffect(() => { mapRef.current?.invalidateSize(); }, [mapHeight]);

  const handleCenter = useCallback(() => {
    const map = mapRef.current;
    const group = farmLayerGroupRef.current;
    if (!map) return;

    if (group && group.getLayers().length > 0) {
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { paddingTopLeft: [30, 30], paddingBottomRight: [30, 30], maxZoom: 19 });
        return;
      }
    }

    if (latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      map.setView([Number(latitude), Number(longitude)], 16);
    }
  }, [latitude, longitude, captureDate, overlayVisible]);

  const handleZoomIn = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    if (mapRef.current) mapRef.current.zoomOut();
  }, []);

  const hasData = Boolean(captureDate) && typeof indexValue === 'number' && Number.isFinite(indexValue);
  const isModeB = mode === 'B' && hasRasterForIndex({ rasterInfo, activeIndex });

  return (
    <View style={styles.wrapper}>
      <View style={{ position: 'relative' }}>
        {/* 1. Large Farm Map Viewport */}
        <div
          ref={mapContainerRef}
          style={{
            position: 'relative',
            width: '100%',
            height: mapHeight,
            backgroundColor: '#1e293b',
            zIndex: 1,
          }}
        />

        {rasterFailed && <View style={styles.warningOverlay}>
          <Text style={styles.warningText}>{language === 'mr' ? 'रंगीत नकाशा उपलब्ध नाही. सरासरी पाहा.' : 'Real satellite image could not load. The field-average value is still available below.'}</Text>
        </View>}

        {mapError && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>⚠️ {mapError}</Text>
          </View>
        )}

        {tileWarning && !mapError && (
          <View style={styles.warningOverlay}>
            <Text style={styles.warningText}>🛰️ {tileWarning}</Text>
          </View>
        )}

      </View>
      {(hasData || isModeB) && overlayVisible && <GISMapLegend activeIndex={activeIndex} language={language} spatial={isModeB} canCompare={hasRasterForIndex({ rasterInfo, activeIndex }) && hasData} onToggleMode={onToggleMode} />}
      <GISMapToolbar language={language} basemap={basemap} onBasemap={setBasemap} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onCenter={handleCenter} />
      <GISMapAttribution language={language} basemap={basemap} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: '#dfe8db', borderWidth: 1, borderColor: '#dce6da' },
  errorOverlay: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 600, padding: 14, borderRadius: 12, backgroundColor: '#f9e7dd' },
  errorText: { fontSize: 13, color: '#8b4233', lineHeight: 20 },
  warningOverlay: { position: 'absolute', top: 12, left: 12, right: 12, zIndex: 600, padding: 12, borderRadius: 12, backgroundColor: '#fff4dc' },
  warningText: { fontSize: 13, color: '#765624', lineHeight: 20 },
});
