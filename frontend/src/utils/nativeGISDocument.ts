// Credentials travel only to the selected farm's local raster API, never tiles.
export const scriptJSON=(value:unknown)=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');

export const createNativeGISDocument=(origin:string)=>{
  const base=new URL(origin);
  if (!['http:','https:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid map server');
  const safeOrigin=base.origin;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${safeOrigin}/map/leaflet.css">
<style>html,body,#map{width:100%;height:100%;margin:0;background:#dfe8db}body{overflow:hidden}.leaflet-container{font-family:system-ui}.leaflet-control-attribution{font-size:9px!important;background:#ffffffdf!important;max-width:90%}.leaflet-image-layer{image-rendering:auto}#notice{display:none;position:absolute;top:12px;left:12px;right:12px;z-index:900;background:#fff4dc;color:#624919;padding:12px;border-radius:9px;font:13px/1.4 system-ui;pointer-events:none}</style></head><body><div id="map"></div><div id="notice" role="status"></div>
<script src="${safeOrigin}/map/leaflet.js"></script><script>
(function(){
 'use strict';
 const origin=${scriptJSON(safeOrigin)};
 const send=(type)=>{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:type}));};
 if(!window.L){send('map-error');return;}
 const map=L.map('map',{zoomControl:false,minZoom:4,maxZoom:21,zoomSnap:0.25,zoomDelta:0.5,attributionControl:false}).setView([19,77],15);
 let boundary=null,tiles=null,raster=null,abort=null,blobURL=null,lastFarm='',lastBase='',version=0,current=null,tileErrors=0;
 const notice=document.getElementById('notice');
 const tell=(text)=>{notice.textContent=text;notice.style.display=text?'block':'none';};
 const words=(en,mr)=>current&&current.language==='mr'?mr:en;
 function clearRaster(){
   if(abort)abort.abort();abort=null;
   if(raster)map.removeLayer(raster);raster=null;
   if(blobURL)URL.revokeObjectURL(blobURL);blobURL=null;
 }
 function center(){if(boundary&&boundary.getBounds().isValid())map.fitBounds(boundary.getBounds(),{paddingTopLeft:[30,30],paddingBottomRight:[30,30],maxZoom:19});}
 function basemap(name){
   if(name===lastBase)return;lastBase=name;tileErrors=0;
   if(tiles)map.removeLayer(tiles);
   const street=name==='street';
   tiles=L.tileLayer(street?'https://tile.openstreetmap.org/{z}/{x}/{y}.png':'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxNativeZoom:street?19:18,maxZoom:21,attribution:street?'&copy; OpenStreetMap contributors':'Tiles &copy; Esri, Maxar, Earthstar Geographics'}).addTo(map);
   tiles.on('tileerror',()=>{if(++tileErrors>8)tell(words('Map imagery unavailable. Check your connection.','नकाशाची चित्रे उपलब्ध नाहीत. इंटरनेट तपासा.'));});
   tiles.on('tileload',()=>{if(tileErrors>8)tell('');tileErrors=0;});
 }
 window.updateFarmMap=function(data){
   const request=++version;current=data;clearRaster();tell('');basemap(data.basemap||'satellite');
   if(boundary)map.removeLayer(boundary);boundary=null;
   const points=(data.coordinates||[]).filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=85).map(p=>[p[1],p[0]]);
   if(points.length<3){tell(words('Farm boundary unavailable.','शेताची हद्द उपलब्ध नाही.'));return;}
   const info=data.rasterInfo||{};
   const key=String(data.activeIndex||'ndvi').toLowerCase();
   const bounds=info.bounds;
   const validBounds=Array.isArray(bounds)&&bounds.length===2&&bounds.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))&&bounds[0][0]<bounds[1][0]&&bounds[0][1]<bounds[1][1];
   const spatial=data.mode==='B'&&info.is_available&&info.acquisition_date&&validBounds&&info.overlay_urls&&info.overlay_urls[key];
   const measured=!!data.captureDate&&typeof data.indexValue==='number'&&Number.isFinite(data.indexValue);
   boundary=L.polygon(points,{color:'#60e890',weight:3,fillColor:data.color||'#94a3b8',fillOpacity:data.overlayVisible!==false&&!spatial&&measured?0.25:0}).addTo(map);
   const farmKey=String(data.farmId||'')+JSON.stringify(points);
   if(farmKey!==lastFarm){lastFarm=farmKey;center();}
   if(!spatial||data.overlayVisible===false)return;
   let url;
   try{
     url=new URL(info.overlay_urls[key],origin);
     const expected=(data.access==='admin'?'/api/v1/admin/farms/':'/api/v1/gis/plot/')+data.farmId+'/raster/'+key+'.png';
     if(url.origin!==origin||url.pathname!==expected||url.search||url.hash||!['ndvi','ndre','evi','msavi','ndmi','ndwi'].includes(key))throw new Error('Invalid raster path');
   }catch(_){tell(words('Crop overlay unavailable.','रंगीत नकाशा उपलब्ध नाही.'));return;}
   abort=new AbortController();
   fetch(url.href,{headers:data.token?{Authorization:'Bearer '+data.token}:{},signal:abort.signal,credentials:'omit'})
   .then(response=>{if(!response.ok)throw new Error('Raster unavailable');return response.blob();})
   .then(blob=>{
     if(request!==version)return;
     blobURL=URL.createObjectURL(blob);
     raster=L.imageOverlay(blobURL,bounds,{opacity:0.94,interactive:false}).addTo(map);
     const nw=map.project([bounds[1][0],bounds[0][1]],0),se=map.project([bounds[0][0],bounds[1][1]],0);
     const clip=points.map(point=>{const pixel=map.project(point,0);return (100*(pixel.x-nw.x)/(se.x-nw.x))+'% '+(100*(pixel.y-nw.y)/(se.y-nw.y))+'%';}).join(',');
     const image=raster.getElement();if(image)image.style.clipPath='polygon('+clip+')';
     raster.on('error',()=>{if(request===version)tell(words('Crop overlay unavailable. Select Average.','रंगीत नकाशा उपलब्ध नाही. सरासरी पाहा.'));});
     boundary.bringToFront();
   }).catch(()=>{if(request===version)tell(words('Crop overlay unavailable. Select Average.','रंगीत नकाशा उपलब्ध नाही. सरासरी पाहा.'));});
 };
 window.controlFarmMap=function(action){if(action==='in')map.zoomIn();if(action==='out')map.zoomOut();if(action==='center')center();};
 window.addEventListener('resize',()=>map.invalidateSize());
 window.addEventListener('pagehide',()=>{version++;clearRaster();map.remove();});
 send('map-ready');
})();
</script></body></html>`;
};
