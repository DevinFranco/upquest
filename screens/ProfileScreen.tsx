import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RootStackParamList } from '../App';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ACT: Record<string,string> = { sedentary:'Sedentary', light:'Light', moderate:'Moderate', active:'Active', very_active:'Very Active' };

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('upquest_profile').then(v => setProfile(v ? JSON.parse(v) : null));
  }, []));

  const reset = () => Alert.alert('Reset App', 'This clears your profile and Quest. Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: async () => {
      await AsyncStorage.multiRemove(['upquest_profile', 'upquest_plan']);
      navigation.replace('ProfileSetup', {});
    }},
  ]);

  return (
    <LinearGradient colors={['#0A0A0F','#12121A']} style={{ flex:1 }}>
      <SafeAreaView style={{ flex:1 }}>
        <ScrollView contentContainerStyle={{ padding:24, paddingBottom:60 }}>
          <Text style={s.title}>Profile</Text>

          {!profile ? (
            <View style={s.card}>
              <Text style={{ color:'#9090A8', textAlign:'center', marginBottom:16 }}>No profile set up yet.</Text>
              <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('ProfileSetup', {})}>
                <Text style={s.btnTxt}>Set Up Profile</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={s.card}>
                <Text style={s.cardTitle}>Stats</Text>
                {[
                  ['Sex',      profile.stats?.sex],
                  ['Age',      `${profile.stats?.age} yrs`],
                  ['Height',   `${Math.floor((profile.stats?.height_inches||0)/12)}ft ${(profile.stats?.height_inches||0)%12}in`],
                  ['Weight',   `${profile.stats?.weight_lbs} lbs`],
                  ['Activity', ACT[profile.stats?.activity_level] ?? profile.stats?.activity_level],
                ].map(([l,v]) => (
                  <View key={l} style={s.row}>
                    <Text style={s.rowL}>{l}</Text>
                    <Text style={s.rowV}>{v}</Text>
                  </View>
                ))}
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>Goals</Text>
                <Text style={{ color:'#9090A8', fontSize:14, lineHeight:22, textTransform:'capitalize' }}>
                  {(profile.goals ?? []).join(', ').replace(/_/g,' ')}
                </Text>
              </View>

              <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('ProfileSetup', { editing: true })}>
                <Text style={s.btnTxt}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[s.btn, { backgroundColor:'transparent', borderWidth:1, borderColor:'#2A2A38', marginTop:12 }]} onPress={reset}>
            <Text style={[s.btnTxt, { color:'#5A5A70' }]}>Reset All Data</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  title:     { fontSize:26, fontWeight:'800', color:'#F0F0FF', marginBottom:20 },
  card:      { backgroundColor:'#16161E', borderRadius:16, padding:20, marginBottom:16, borderWidth:1, borderColor:'#2A2A38' },
  cardTitle: { color:'#F0F0FF', fontWeight:'700', fontSize:16, marginBottom:14 },
  row:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#1E1E2A' },
  rowL:      { color:'#5A5A70', fontSize:14 },
  rowV:      { color:'#F0F0FF', fontSize:14, fontWeight:'600', textTransform:'capitalize' },
  btn:       { backgroundColor:'#7C3AED', borderRadius:12, paddingVertical:14, alignItems:'center', marginTop:4 },
  btnTxt:    { color:'#fff', fontWeight:'700', fontSize:15 },
});
