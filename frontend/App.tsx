import React,{useEffect,useState} from 'react';
import { StatusBar,StyleSheet,Platform,View } from 'react-native';
import { SafeAreaProvider,SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { LoginScreen } from './src/screens/LoginScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AdminLogin } from './src/admin/AdminLogin';
import { AdminDashboard } from './src/admin/AdminDashboard';
import { AdminAPI } from './src/admin/api';
import { AdminSession } from './src/admin/types';
import { FarmerProfile } from './src/types';
import { ApiClient } from './src/services/apiClient';
import { Loading,AppText as Text } from './src/components/ui';
export default function App(){
 const [fontsLoaded,fontError]=useFonts({Inter:require('./src/assets/fonts/Inter-400.ttf'),'Inter-Bold':require('./src/assets/fonts/Inter-700.ttf')});
 const [role,setRole]=useState<'farmer'|'admin'>(()=>Platform.OS==='web'&&typeof window!=='undefined'&&window.location.pathname.startsWith('/admin')?'admin':'farmer');
 const [farmer,setFarmer]=useState<FarmerProfile|null>(null),[token,setToken]=useState<string|null>(null),[language,setLanguage]=useState<'en'|'mr'>('en'),[admin,setAdmin]=useState<AdminSession|null>(null),[notice,setNotice]=useState('');
 const logout=()=>{ApiClient.setToken(null);setFarmer(null);setToken(null);};
 const adminLogout=()=>{AdminAPI.setToken(null);setAdmin(null);};
 useEffect(()=>{ApiClient.onUnauthorized=()=>{logout();setNotice('Your session expired. Please sign in again.');};AdminAPI.onExpired=()=>{adminLogout();setNotice('Administrator authorization expired. Please sign in again.');};return()=>{ApiClient.onUnauthorized=null;AdminAPI.onExpired=null;};},[]);
 useEffect(()=>{if(!admin?.expires_in)return;const timer=setTimeout(()=>{adminLogout();setNotice('Administrator session expired. Please sign in again.');},admin.expires_in*1000);return()=>clearTimeout(timer);},[admin]);
 const switchRole=(next:'farmer'|'admin')=>{logout();adminLogout();setRole(next);setNotice('');if(Platform.OS==='web')window.history.pushState({},'',next==='admin'?'/admin':'/');};
 if(!fontsLoaded&&!fontError)return <SafeAreaProvider><Loading/></SafeAreaProvider>;
 return <SafeAreaProvider><SafeAreaView edges={['top','left','right']} style={styles.root}><StatusBar barStyle="dark-content" backgroundColor="#fff"/>{!!notice&&<View style={styles.notice}><Text style={{color:'#80551e',fontSize:13,lineHeight:20}}>{notice}</Text></View>}{role==='admin'?(admin?<AdminDashboard session={admin} onLogout={adminLogout}/>:<AdminLogin onSuccess={value=>{setAdmin(value);setNotice('');}} onFarmer={()=>switchRole('farmer')}/>):farmer&&token?<RootNavigator farmer={farmer} language={language} onToggleLanguage={setLanguage} onLogout={logout}/>:<LoginScreen language={language} onToggleLanguage={setLanguage} onLoginSuccess={(profile,jwt)=>{setFarmer(profile);setToken(jwt);setNotice('');}} onAdmin={()=>switchRole('admin')}/>}</SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#fff'},notice:{padding:12,backgroundColor:'#fff3da'}});
