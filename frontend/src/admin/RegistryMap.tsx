import React from 'react';
import { View,TouchableOpacity } from 'react-native';
import { AppText as Text,ui } from '../components/ui';
import { GISData } from '../types';
export const RegistryMap=({farms,onSelect}:{farms:GISData[];onSelect:(id:string)=>void})=><View style={{gap:8}}><Text style={ui.note}>Select a farm to open its interactive map.</Text>{farms.map(farm=><TouchableOpacity accessibilityRole="button" key={farm.farm_id} style={{minHeight:48,padding:12,borderRadius:12,backgroundColor:'#edf6eb'}} onPress={()=>onSelect(farm.farm_id)}><Text>{farm.area_acres} acres · {farm.farm_id.slice(0,8)}</Text></TouchableOpacity>)}</View>;
