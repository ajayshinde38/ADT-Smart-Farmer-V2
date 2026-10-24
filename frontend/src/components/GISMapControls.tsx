import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getPaletteForIndex } from '../utils/gisColorScale';

type Language='en'|'mr';
export const GISMapLegend=({activeIndex,language,spatial,canCompare,onToggleMode}: {
  activeIndex:string;language:Language;spatial:boolean;canCompare:boolean;onToggleMode?:(mode:'A'|'B')=>void;
}) => <View style={styles.legendPosition} pointerEvents="box-none"><View style={styles.legend}>
  <Text style={styles.legendTitle}>{activeIndex.toUpperCase()} · {language==='mr' ? (spatial?'शेतातील बदल':'शेताची सरासरी') : (spatial?'Field variation':'Field average')}</Text>
  <View style={styles.ramp}>{getPaletteForIndex(activeIndex).map((color,index)=><View key={index} style={{flex:1,backgroundColor:color}}/>)}</View>
  <View style={styles.labels}><Text style={styles.tick}>−1</Text><Text style={styles.tick}>0</Text><Text style={styles.tick}>+1</Text></View>
  {canCompare && onToggleMode && <View style={styles.modes}>{(['B','A'] as const).map(mode=><TouchableOpacity key={mode} accessibilityRole="button" accessibilityState={{selected:spatial===(mode==='B')}} onPress={()=>onToggleMode(mode)} style={[styles.mode,spatial===(mode==='B') && styles.active]}><Text style={styles.modeText}>{language==='mr'?(mode==='B'?'रंगीत नकाशा':'सरासरी'):(mode==='B'?'Colour map':'Average')}</Text></TouchableOpacity>)}</View>}
</View></View>;

export const GISMapToolbar=({language,basemap,onBasemap,onZoomIn,onZoomOut,onCenter}: {
  language:Language;basemap:'satellite'|'street';onBasemap:(map:'satellite'|'street')=>void;onZoomIn:()=>void;onZoomOut:()=>void;onCenter:()=>void;
}) => <View style={styles.toolbar}>
  <View style={styles.group}>{(['satellite','street'] as const).map(base=><TouchableOpacity key={base} accessibilityRole="button" accessibilityState={{selected:base===basemap}} style={[styles.base,base===basemap && styles.active]} onPress={()=>onBasemap(base)}><Text style={styles.buttonText}>{language==='mr'?(base==='satellite'?'उपग्रह':'रस्ते'):(base==='satellite'?'Satellite':'Street')}</Text></TouchableOpacity>)}</View>
  <View style={styles.group}>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={language==='mr'?'जवळून पाहा':'Zoom In'} style={styles.icon} onPress={onZoomIn}><Text style={styles.zoom}>+</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={language==='mr'?'दूरून पाहा':'Zoom Out'} style={styles.icon} onPress={onZoomOut}><Text style={styles.zoom}>−</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={language==='mr'?'शेत मध्यभागी आणा':'Center on Farm'} style={styles.base} onPress={onCenter}><Text style={styles.buttonText}>◎ {language==='mr'?'शेत':'Center'}</Text></TouchableOpacity>
  </View>
</View>;

const styles=StyleSheet.create({legendPosition:{position:'absolute',right:12,bottom:30,zIndex:500,maxWidth:'76%'},legend:{padding:12,width:216,maxWidth:'100%',backgroundColor:'#ffffffed',borderRadius:12,borderWidth:1,borderColor:'#d9e7da',gap:7},legendTitle:{fontSize:11,fontWeight:'700',color:'#214c31'},ramp:{height:9,flexDirection:'row',overflow:'hidden',borderRadius:3},labels:{flexDirection:'row',justifyContent:'space-between'},tick:{fontSize:10,color:'#6d7d70'},modes:{flexDirection:'row',gap:4},mode:{flex:1,minHeight:40,padding:5,justifyContent:'center',alignItems:'center',borderRadius:7,backgroundColor:'#f3f6f0'},modeText:{fontSize:11,color:'#28503a'},active:{backgroundColor:'#dcefd8'},toolbar:{padding:8,backgroundColor:'#fff',flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:6,borderTopWidth:1,borderColor:'#e1e9df'},group:{flexDirection:'row',gap:4},base:{minHeight:44,paddingHorizontal:12,justifyContent:'center',alignItems:'center',borderRadius:9},buttonText:{color:'#305c3c',fontSize:12,fontWeight:'600'},icon:{width:44,height:44,alignItems:'center',justifyContent:'center',backgroundColor:'#f0f4ed',borderRadius:9},zoom:{fontSize:22,color:'#305c3c'}});
