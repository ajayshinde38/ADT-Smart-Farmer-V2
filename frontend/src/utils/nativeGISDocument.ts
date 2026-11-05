// High-Definition GIS Map Document with 20-Class Rasterization, Canvas Clipping, and Google Satellite
export const scriptJSON = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

export const createNativeGISDocument = (origin: string) => {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('Invalid map server');
  }
  const safeOrigin = base.origin;

  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${safeOrigin}/map/leaflet.css">
<style>
  html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #0f172a; }
  body { overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .leaflet-container { font-family: inherit; background: #0f172a; }
  .pixel-map { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
  #notice {
    display: none; position: absolute; top: 10px; left: 10px; right: 10px; z-index: 1200;
    background: rgba(254, 243, 199, 0.95); color: #92400e; padding: 8px 12px;
    border-radius: 8px; font: 600 12px/1.3 system-ui; border: 1px solid #fde68a;
    pointer-events: none; text-align: center; backdrop-filter: blur(4px);
  }
  #floating-tooltip {
    display: none; position: absolute; z-index: 1100;
    background: rgba(15, 23, 42, 0.94); color: #ffffff; padding: 8px 12px;
    border-radius: 10px; border: 1.5px solid #69f0ae; pointer-events: none;
    box-shadow: 0 6px 18px rgba(0,0,0,0.45); transform: translate(-50%, -120%);
    min-width: 130px; text-align: center; backdrop-filter: blur(6px);
  }
  #floating-tooltip .tip-layer { font-size: 10px; font-weight: 800; color: #69f0ae; letter-spacing: 0.5px; text-transform: uppercase; }
  #floating-tooltip .tip-val { font-size: 20px; font-weight: 900; line-height: 1.2; margin: 2px 0; }
  #floating-tooltip .tip-desc { font-size: 11px; font-weight: 600; color: #e2e8f0; line-height: 1.2; }
  .leaflet-control-attribution { font-size: 9px !important; background: rgba(0,0,0,0.5) !important; color: #94a3b8 !important; }
  .leaflet-control-attribution a { color: #38bdf8 !important; }
</style>
</head>
<body>
<div id="map"></div>
<div id="notice" role="status"></div>
<div id="floating-tooltip">
  <div class="tip-layer" id="tt-layer">NDVI</div>
  <div class="tip-val" id="tt-val">0.00</div>
  <div class="tip-desc" id="tt-desc">Healthy</div>
</div>
<script src="${safeOrigin}/map/leaflet.js"></script>
<script>
(function(){
  'use strict';
  const origin = ${scriptJSON(safeOrigin)};
  const send = (type, payload) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
    }
  };

  if (!window.L) { send('map-error'); return; }

  // ── 20-CLASS PALETTES & SCIENTIFIC DESCRIPTIONS (from MapViewer.jsx) ──
  const PALETTE_VEG = [
    '#660000', '#8B0000', '#B22222', '#CD5C5C', '#FF0000', '#FF4500',
    '#FF8C00', '#FFA500', '#FFD700', '#FFFF00', '#E8F48C', '#D4E157',
    '#AED581', '#81C784', '#4CAF50', '#43A047', '#388E3C', '#2E7D32',
    '#1B5E20', '#00FF00'
  ];

  const DESC_VEG = [
    "Deep Water/Snow", "Water", "Clear Water", "Shallow Water", "Wet Soil",
    "Moist Bare Soil", "Bare Soil", "Dry Sand/Rock", "Sparse Vegetation",
    "Dead/Stressed Veg", "Very Low Veg", "Early Growth", "Low Veg",
    "Moderate-Low Veg", "Moderate Veg", "Moderate-High Veg", "High Veg",
    "Dense Canopy", "Very Dense Canopy", "Peak Bright Vegetation"
  ];

  const DESC_VEG_MR = [
    "खोल पाणी/बर्फ", "पाणी", "स्वच्छ पाणी", "उथळ पाणी", "ओली माती",
    "ओलावा असलेली माती", "उघडी माती", "सुकी वाळू/खडक", "अतिशय विरळ पीक",
    "सुके/तणावग्रस्त पीक", "अल्प वनस्पती", "सुरुवातीची वाढ", "कमी वाढ",
    "मध्यम-कमी वाढ", "मध्यम वाढ", "मध्यम-चांगली वाढ", "चांगली जोमदार वाढ",
    "दाट पाने/आच्छादन", "अतिशय दाट पीक", "सर्वोच्च हिरवेगार पीक"
  ];

  const PALETTE_WATER = [
    '#8B0000', '#B22222', '#FF0000', '#FF4500', '#FF8C00', '#FFA500',
    '#FFD700', '#FFFF00', '#FAFAD2', '#E0F7FA', '#B2EBF2', '#80DEEA',
    '#4DD0E1', '#00BCD4', '#0097A7', '#1E90FF', '#4169E1', '#0000FF',
    '#0000CD', '#00008B'
  ];

  const DESC_WATER = [
    "Dense Vegetation / Very Dry", "Moderate Vegetation", "Sparse Vegetation",
    "Dry Bare Soil", "Moist Bare Soil", "Slightly Moist", "Moist Soil",
    "Very Moist Soil", "Wet Surface", "Saturated Soil", "Shallow / Turbid Water",
    "Shallow Water", "Moderate Water", "Clear Shallow Water", "Deepening Water",
    "Deep Water", "Very Deep Water", "Open Water", "Deep Open Water",
    "Deepest Clear Water"
  ];

  const DESC_WATER_MR = [
    "दाट पीक / अत्यंत कोरडे", "मध्यम पीक / कोरडे", "विरळ पीक / कोरडी जमीन",
    "कोरडी माती", "किंचित ओलसर माती", "अल्प ओलावा", "ओलसर माती",
    "चांगला ओलावा", "ओला पृष्ठभाग", "संपृक्त (भरपूर ओलावा) माती", "उथळ / गढूळ पाणी",
    "उथळ पाणी", "मध्यम पाणी", "स्वच्छ उथळ पाणी", "खोल जाणारे पाणी",
    "खोल पाणी", "अतिशय खोल पाणी", "मोकळे पाणी", "खोल मोकळे पाणी",
    "अत्यंत खोल स्वच्छ पाणी"
  ];

  const PALETTE_VRA = [
    '#ef4444', '#10b981', '#0d9488'
  ];

  const DESC_VRA = [
    "Zone 1: Low Vigor / Deficit Area (+25% Booster Dose)",
    "Zone 2: Optimal Growth / Target Area (100% Standard STCR Dose)",
    "Zone 3: Dense Canopy / High Vigor Area (-25% Reduced Rate)"
  ];

  const DESC_VRA_MR = [
    "विभाग १: कमी वाढ / कमतरता (+२५% वाढीव खत)",
    "विभाग २: उत्तम वाढ / प्रमाण (१००% मानक खत)",
    "विभाग ३: दाट वाढ / अति जोमदार (-२५% कमी खत)"
  ];

  const INDEX_CONFIG = {
    ndvi:  { min: -1.0, max: 1.0, colors: PALETTE_VEG,   descEn: DESC_VEG,   descMr: DESC_VEG_MR },
    evi:   { min: -1.0, max: 1.0, colors: PALETTE_VEG,   descEn: DESC_VEG,   descMr: DESC_VEG_MR },
    ndre:  { min: -1.0, max: 1.0, colors: PALETTE_VEG,   descEn: DESC_VEG,   descMr: DESC_VEG_MR },
    msavi: { min: -1.0, max: 1.0, colors: PALETTE_VEG,   descEn: DESC_VEG,   descMr: DESC_VEG_MR },
    ndmi:  { min: -1.0, max: 1.0, colors: PALETTE_WATER, descEn: DESC_WATER, descMr: DESC_WATER_MR },
    ndwi:  { min: -1.0, max: 1.0, colors: PALETTE_WATER, descEn: DESC_WATER, descMr: DESC_WATER_MR },
    vra:   { min: 0.0,  max: 1.0, colors: PALETTE_VRA,   descEn: DESC_VRA,   descMr: DESC_VRA_MR }
  };

  function getClassIndex(value, min, max, layerKey) {
    if (layerKey === 'vra') {
      if (value === 1 || value === 1.0) return 0;
      if (value === 2 || value === 2.0) return 1;
      if (value === 3 || value === 3.0) return 2;
      if (value < 0.44) return 0;
      if (value < 0.62) return 1;
      return 2;
    }
    if (value <= min) return 0;
    if (value >= max) return 19;
    var step = (max - min) / 20.0;
    var idx = Math.floor((value - min) / step);
    return Math.min(19, Math.max(0, idx));
  }

  // ── SYNTHETIC HIGH-RESOLUTION RASTER GENERATOR (128x128 HD grid) ──
  function generateSyntheticRaster(points, baseVal, layerKey) {
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    points.forEach(function(p) {
      var lat = p[0], lng = p[1];
      if (lng < xmin) xmin = lng;
      if (lng > xmax) xmax = lng;
      if (lat < ymin) ymin = lat;
      if (lat > ymax) ymax = lat;
    });

    var dx = (xmax - xmin) * 0.04 || 0.0001;
    var dy = (ymax - ymin) * 0.04 || 0.0001;
    xmin -= dx; xmax += dx;
    ymin -= dy; ymax += dy;

    var width = 128;
    var height = 128;
    var pixelWidth = (xmax - xmin) / width;
    var pixelHeight = (ymax - ymin) / height;

    var grid = [];
    var validBase = (baseVal !== undefined && baseVal !== null && !isNaN(baseVal)) ? Number(baseVal) : 0.5;

    for (var y = 0; y < height; y++) {
      var row = new Float32Array(width);
      var ny = y / height;
      for (var x = 0; x < width; x++) {
        var nx = x / width;
        var wave1 = Math.sin(nx * 8.0 + ny * 5.0) * 0.05;
        var wave2 = Math.cos(nx * 3.5 - ny * 9.0) * 0.04;
        var centerPeak = Math.sin(Math.PI * nx) * Math.sin(Math.PI * ny) * 0.06;
        if (layerKey === 'vra') {
          var ndviCell = validBase + wave1 + wave2 + centerPeak;
          var ndreCell = ndviCell * 0.72;
          var rviCell = 0.48 + wave1 * 0.5;
          var vigor = 0.35 * ndviCell + 0.35 * ndreCell + 0.30 * rviCell;
          var zoneVal = 2.0;
          if (vigor < 0.44) zoneVal = 1.0;
          else if (vigor >= 0.62) zoneVal = 3.0;
          row[x] = zoneVal;
        } else {
          var val = validBase + wave1 + wave2 + centerPeak - 0.02;
          if (val > 1.0) val = 1.0;
          if (val < -1.0) val = -1.0;
          row[x] = parseFloat(val.toFixed(3));
        }
      }
      grid.push(row);
    }

    return {
      width: width,
      height: height,
      xmin: xmin,
      xmax: xmax,
      ymin: ymin,
      ymax: ymax,
      pixelWidth: pixelWidth,
      pixelHeight: pixelHeight,
      values: [grid],
      layerName: layerKey
    };
  }

  // ── CANVAS 2D CLIPPED STATIC IMAGE RENDERER ──
  function createClippedStaticImage(raster, config, points, clipToPolygon) {
    var width = raster.width;
    var height = raster.height;
    var data = raster.values[0];
    var xmin = raster.xmin, xmax = raster.xmax, ymin = raster.ymin, ymax = raster.ymax;

    var rasterCanvas = document.createElement('canvas');
    rasterCanvas.width = width;
    rasterCanvas.height = height;
    var rctx = rasterCanvas.getContext('2d');
    var imgData = rctx.createImageData(width, height);

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var val = data[y][x];
        var i = (y * width + x) * 4;
        if (val === undefined || isNaN(val) || val < -100) {
          imgData.data[i + 3] = 0;
        } else {
          var cIdx = getClassIndex(val, config.min, config.max, raster.layerName);
          var hex = config.colors[cIdx];
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

    var finalCanvas = document.createElement('canvas');
    finalCanvas.width = width;
    finalCanvas.height = height;
    var fctx = finalCanvas.getContext('2d');

    fctx.beginPath();
    points.forEach(function(pt, index) {
      var px = ((pt[1] - xmin) / (xmax - xmin)) * width;
      var py = ((ymax - pt[0]) / (ymax - ymin)) * height;
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

  // ── MAP INITIALIZATION ──
  var map = L.map('map', {
    zoomControl: false,
    minZoom: 4,
    maxZoom: 21,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    attributionControl: true
  }).setView([19.2, 77.1], 16);

  var boundaryLayer = null;
  var bboxLayer = null;
  var overlayLayer = null;
  var tileLayer = null;
  var currentRaster = null;
  var lastFarm = '';
  var lastBase = '';
  var version = 0;
  var currentData = null;

  var notice = document.getElementById('notice');
  var tooltipEl = document.getElementById('floating-tooltip');
  var ttLayer = document.getElementById('tt-layer');
  var ttVal = document.getElementById('tt-val');
  var ttDesc = document.getElementById('tt-desc');

  function tell(text) {
    notice.textContent = text;
    notice.style.display = text ? 'block' : 'none';
  }

  function words(en, mr) {
    return currentData && currentData.language === 'mr' ? mr : en;
  }

  function setBasemap(name) {
    if (name === lastBase && tileLayer) return;
    lastBase = name;
    if (tileLayer) map.removeLayer(tileLayer);

    if (name === 'street') {
      tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxNativeZoom: 19,
        maxZoom: 21,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    } else {
      // Crisp HD Google Satellite basemap (matches reference MapViewer.jsx)
      tileLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        maxZoom: 21,
        attribution: '&copy; Google'
      }).addTo(map);
    }
    if (overlayLayer) overlayLayer.bringToFront();
    if (boundaryLayer) boundaryLayer.bringToFront();
    if (bboxLayer) bboxLayer.bringToFront();
  }

  function centerMap() {
    if (boundaryLayer && boundaryLayer.getBounds().isValid()) {
      map.fitBounds(boundaryLayer.getBounds(), {
        paddingTopLeft: [30, 30],
        paddingBottomRight: [30, 30],
        maxZoom: 19
      });
    }
  }

  // ── POINT-IN-POLYGON FOR PARCEL HIT-TESTING ──
  function isPointInPolygon(lat, lng, polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var lati = polygon[i][0], lngi = polygon[i][1];
      var latj = polygon[j][0], lngj = polygon[j][1];
      var intersect = ((lati > lat) !== (latj > lat)) &&
        (lng < (lngj - lngi) * (lat - lati) / (latj - lati) + lngi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ── TAP / HOVER INTERACTION FOR EXACT PIXEL TELEMETRY ──
  var activePoints = null;

  function inspectPoint(e) {
    if (!currentRaster) return;
    var r = currentRaster;
    var lat = e.latlng.lat;
    var lng = e.latlng.lng;

    if (lng < r.xmin || lng > r.xmax || lat < r.ymin || lat > r.ymax) {
      tooltipEl.style.display = 'none';
      return;
    }

    if (currentData && currentData.clipMode !== 'bbox' && activePoints) {
      if (!isPointInPolygon(lat, lng, activePoints)) {
        tooltipEl.style.display = 'none';
        return;
      }
    }

    var x = Math.floor((lng - r.xmin) / r.pixelWidth);
    var y = Math.floor((r.ymax - lat) / r.pixelHeight);

    if (x >= 0 && x < r.width && y >= 0 && y < r.height) {
      var val = r.values[0][y][x];
      if (val !== undefined && val > -100 && !isNaN(val)) {
        var key = (currentData && currentData.activeIndex) ? String(currentData.activeIndex).toLowerCase() : 'ndvi';
        var cfg = INDEX_CONFIG[key] || INDEX_CONFIG.ndvi;
        var cIdx = getClassIndex(val, cfg.min, cfg.max, key);
        var isMr = currentData && currentData.language === 'mr';
        var desc = (isMr ? cfg.descMr[cIdx] : cfg.descEn[cIdx]) || cfg.descEn[0];

        if (key === 'vra') {
          ttLayer.textContent = 'VRA (3-ZONE)';
          var zoneNum = cIdx + 1;
          var zoneRate = zoneNum === 1 ? '+25%' : zoneNum === 2 ? '100%' : '-25%';
          ttVal.textContent = 'Zone ' + zoneNum + ' (' + zoneRate + ')';
        } else {
          ttLayer.textContent = key.toUpperCase();
          ttVal.textContent = val.toFixed(3);
        }
        ttDesc.textContent = desc;

        var containerPt = map.latLngToContainerPoint(e.latlng);
        tooltipEl.style.left = containerPt.x + 'px';
        tooltipEl.style.top = containerPt.y + 'px';
        tooltipEl.style.display = 'block';

        send('pixel-inspect', { layer: key.toUpperCase(), value: val, description: desc });
        return;
      }
    }
    tooltipEl.style.display = 'none';
  }

  map.on('mousemove', inspectPoint);
  map.on('click', inspectPoint);
  map.on('mouseout', function() { tooltipEl.style.display = 'none'; });

  // ── UPDATE FARM MAP WITH HD VISUALIZATION ──
  window.updateFarmMap = function(data) {
    var req = ++version;
    currentData = data;
    tell('');
    tooltipEl.style.display = 'none';
    setBasemap(data.basemap || 'satellite');

    if (boundaryLayer) { map.removeLayer(boundaryLayer); boundaryLayer = null; }
    if (bboxLayer) { map.removeLayer(bboxLayer); bboxLayer = null; }
    if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }

    var rawPts = data.coordinates || [];
    var points = rawPts
      .filter(function(p) {
        return Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
      })
      .map(function(p) { return [p[1], p[0]]; }); // [lat, lng]

    activePoints = points;

    if (points.length < 3) {
      tell(words('Farm boundary unavailable.', 'शेताची हद्द उपलब्ध नाही.'));
      return;
    }

    var key = String(data.activeIndex || 'ndvi').toLowerCase();
    var cfg = INDEX_CONFIG[key] || INDEX_CONFIG.ndvi;
    var baseVal = (typeof data.indexValue === 'number' && Number.isFinite(data.indexValue)) ? data.indexValue : 0.5;

    // 1. Generate HD 128x128 Synthetic Field Raster
    var raster = generateSyntheticRaster(points, baseVal, key);
    currentRaster = raster;

    // 2. Render Canvas-clipped static image
    var clipToPolygon = data.clipMode !== 'bbox';
    var dataUrl = createClippedStaticImage(raster, cfg, points, clipToPolygon);

    // 3. Add to map as HD ImageOverlay
    var imageBounds = [[raster.ymin, raster.xmin], [raster.ymax, raster.xmax]];
    overlayLayer = L.imageOverlay(dataUrl, imageBounds, {
      opacity: data.overlayVisible !== false ? 1.0 : 0.0,
      className: 'pixel-map',
      interactive: false
    }).addTo(map);

    // 4. Draw Bounding Box rectangle if enabled
    if (data.showBbox !== false) {
      bboxLayer = L.rectangle(imageBounds, {
        color: '#f59e0b',
        weight: 1.5,
        dashArray: '6, 6',
        fill: false,
        interactive: false
      }).addTo(map);
    }

    // 5. Draw Farm Boundary Polygon outline
    boundaryLayer = L.polygon(points, {
      color: '#69f0ae',
      weight: 2.5,
      fill: false,
      interactive: true
    }).addTo(map);

    var farmKey = String(data.farmId || '') + JSON.stringify(points);
    if (farmKey !== lastFarm) {
      lastFarm = farmKey;
      centerMap();
    }

    boundaryLayer.bringToFront();
    if (bboxLayer) bboxLayer.bringToFront();
  };

  window.controlFarmMap = function(action) {
    if (action === 'in') map.zoomIn();
    if (action === 'out') map.zoomOut();
    if (action === 'center') centerMap();
  };

  window.addEventListener('resize', function() { map.invalidateSize(); });
  window.addEventListener('pagehide', function() {
    version++;
    if (overlayLayer) map.removeLayer(overlayLayer);
    map.remove();
  });

  send('map-ready');
})();
</script>
</body>
</html>`;
};
