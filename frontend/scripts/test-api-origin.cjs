const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync('src/services/apiClient.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function resolve(os,origin,configured,metroHost){
  const context={exports:{},URL,process:{env:{EXPO_PUBLIC_API_BASE_URL:configured}},
    window:origin?{location:new URL(origin)}:undefined,
    require:name=>name==='react-native'?{Platform:{OS:os}}:name==='expo-constants'?{default:{expoConfig:{hostUri:metroHost}}}: {}};
  vm.runInNewContext(compiled,context);return context.exports.API_BASE_URL;
}
assert.equal(resolve('web','http://172.16.104.220:8002','http://172.16.104.220:8000/api/v1'),'http://172.16.104.220:8002/api/v1');
assert.equal(resolve('web','http://127.0.0.1:8002','http://old-host:8000/api/v1'),'http://127.0.0.1:8002/api/v1');
assert.equal(resolve('web','https://farmer.example','https://api.example/api/v1'),'https://api.example/api/v1');
assert.equal(resolve('web','http://192.168.1.5:8081',undefined),'http://192.168.1.5:8002/api/v1');
assert.equal(resolve('android',undefined,undefined,'192.168.1.5:8081'),'http://192.168.1.5:8002/api/v1');
assert.equal(resolve('android',undefined,'https://api.example/api/v1'),'https://api.example/api/v1');
console.log('API origin checks passed: LAN same-origin, stale build settings, hosted HTTPS, Expo and Android.');
