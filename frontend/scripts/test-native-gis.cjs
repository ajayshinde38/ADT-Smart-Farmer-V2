// Executes the generated map's event logic with mocked Leaflet/network services.
// No browser automation or external network calls are performed here.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/utils/nativeGISDocument.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsObject={};
vm.runInNewContext(compiled,{exports:exportsObject,URL});
const {createNativeGISDocument,scriptJSON}=exportsObject;
const html=createNativeGISDocument('http://127.0.0.1:8000');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const farm='fa0094b2-c218-441d-bc1a-870f0a01430b';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness(fetcher){
  const state={polygons:[],images:[],fits:0,requests:[],revoked:[],zoom:0,messages:[],events:{}};
  const notice={textContent:'',style:{}};
  const map={setView(){return this;},fitBounds(){state.fits++;},removeLayer(){},zoomIn(){state.zoom++;},zoomOut(){state.zoom--;},invalidateSize(){},remove(){state.removed=true;},
    project([lat,lon]){return {x:(lon+180)/360,y:(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2};}};
  const layer=()=>({addTo(){return this;},on(){return this;}});
  const L={map:()=>map,tileLayer:()=>layer(),polygon:(points,options)=>{
    state.polygons.push({points,options});return {...layer(),getBounds:()=>({isValid:()=>true}),bringToFront(){}};
  },imageOverlay:(url,bounds,options)=>{
    const image={style:{}};state.images.push({url,bounds,options,image});return {...layer(),getElement:()=>image};
  }};
  const URLMock=class extends URL {};
  URLMock.createObjectURL=()=> 'blob:test-'+state.images.length;
  URLMock.revokeObjectURL=url=>state.revoked.push(url);
  const window={L,ReactNativeWebView:{postMessage:message=>state.messages.push(JSON.parse(message))},addEventListener:(name,fn)=>state.events[name]=fn};
  const fetch=(url,options)=>{state.requests.push({url,options});return fetcher?fetcher(url,options):Promise.resolve({ok:true,blob:async()=>({})});};
  vm.runInNewContext(script,{window,L,URL:URLMock,document:{getElementById:()=>notice},fetch,AbortController});
  return {state,window,notice};
}
const payload={farmId:farm,coordinates:[[77,20],[78,20],[78,19],[77,19],[77,20]],activeIndex:'ndvi',indexValue:0.4,
  captureDate:'2024-10-12',mode:'B',token:'test-only-token',rasterInfo:{is_available:true,acquisition_date:'2024-10-12',bounds:[[19,77],[20,78]],overlay_urls:{ndvi:`/api/v1/gis/plot/${farm}/raster/ndvi.png`,ndmi:`/api/v1/gis/plot/${farm}/raster/ndmi.png`}}};

async function main(){
  assert.throws(()=>createNativeGISDocument('file:///private'));
  assert.throws(()=>createNativeGISDocument('https://user:secret@example.com'));
  assert(!html.includes(payload.token));
  assert(html.includes('attributionControl:false'),'Attribution is moved to the React Native footer');
  const malicious='</script><script>throw new Error("injected")</script>\u2028';
  assert(!scriptJSON(malicious).includes('<'));
  assert.equal(JSON.parse(scriptJSON(malicious)),malicious);

  const real=harness();
  assert.equal(real.state.messages[0].type,'map-ready');
  real.window.updateFarmMap(payload);await tick();
  assert.equal(real.state.requests.length,1);
  assert.equal(real.state.requests[0].options.headers.Authorization,'Bearer test-only-token');
  assert.equal(real.state.requests[0].url,`http://127.0.0.1:8000/api/v1/gis/plot/${farm}/raster/ndvi.png`);
  assert.equal(real.state.polygons[0].options.fillOpacity,0);
  assert(real.state.images[0].image.style.clipPath.startsWith('polygon(0% 0%,100% 0%'));
  real.window.updateFarmMap({...payload,activeIndex:'ndmi'});await tick();
  assert.equal(real.state.fits,1,'Changing a layer must preserve the farmer’s zoom/pan');
  assert(real.state.requests[0].options.signal.aborted);
  assert.equal(real.state.revoked.length,1);
  real.window.controlFarmMap('center');assert.equal(real.state.fits,2);
  real.window.controlFarmMap('in');assert.equal(real.state.zoom,1);
  real.window.updateFarmMap({...payload,overlayVisible:false});await tick();
  assert.equal(real.state.requests.length,2,'Photo-only comparison must not fetch a new raster');

  const average=harness();
  average.window.updateFarmMap({...payload,mode:'A'});
  assert.equal(average.state.requests.length,0);
  assert.equal(average.state.polygons[0].options.fillOpacity,0.25);
  average.window.updateFarmMap({...payload,mode:'A',captureDate:null,indexValue:null});
  assert.equal(average.state.polygons.at(-1).options.fillOpacity,0,'Unobserved fields must have no invented colour');

  for(const url of ['https://example.com/private.png',`/api/v1/gis/plot/another-farm/raster/ndvi.png`,payload.rasterInfo.overlay_urls.ndvi+'?token=secret']){
    const denied=harness();
    denied.window.updateFarmMap({...payload,rasterInfo:{...payload.rasterInfo,overlay_urls:{ndvi:url}}});await tick();
    assert.equal(denied.state.requests.length,0,'Credentials must never go to another farm or destination');
  }
  const resolves=[];
  const racing=harness(()=>new Promise(resolve=>resolves.push(resolve)));
  racing.window.updateFarmMap(payload);
  racing.window.updateFarmMap({...payload,activeIndex:'ndmi'});
  resolves[1]({ok:true,blob:async()=>({})});await tick();
  resolves[0]({ok:true,blob:async()=>({})});await tick();
  assert.equal(racing.state.images.length,1,'Late raster responses must not overwrite the selected layer');
  racing.state.events.pagehide();assert(racing.state.removed);
  console.log('Native GIS map behavior passed: clipping, auth, missing data, comparison, pan/zoom, stale responses and cleanup.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
