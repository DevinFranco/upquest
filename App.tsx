import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Notifications    from 'expo-notifications';
import { Colors } from './constants/theme';
import { initNotifications } from './utils/notifications';
import { initHealthKit }     from './utils/health';
import HomeScreen            from './screens/HomeScreen';
import ProfileSetupScreen    from './screens/ProfileSetupScreen';
import PlanChatScreen        from './screens/PlanChatScreen';
import ScheduleScreen        from './screens/ScheduleScreen';
import HealthSyncScreen      from './screens/HealthSyncScreen';
import ProfileScreen         from './screens/ProfileScreen';
import WeightTrackerScreen   from './screens/WeightTrackerScreen';

export type RootStackParamList = {
  MainTabs:      undefined;
  ProfileSetup:  { editing?: boolean };
  PlanChat:      { stats?: any; goals?: any; labs?: any; mode?: 'onboarding' | 'modify'; currentPlan?: any };
  Schedule:      { scheduleId: string };
  HealthSync:    undefined;
  WeightTracker: undefined;
  Paywall:       { feature?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border, height: 70, paddingBottom: 10, paddingTop: 8 },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, [string, string]> = {
            'My Plan':  ['home',          'home-outline'],
            'Progress': ['trending-up',   'trending-up-outline'],
            'Profile':  ['person-circle', 'person-circle-outline'],
          };
          const [a, b] = map[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? a : b) as any} size={focused ? size + 2 : size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="My Plan"  component={HomeScreen} />
      <Tab.Screen name="Progress" component={WeightTrackerScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready,      setReady]      = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const navigationRef = React.useRef<any>(null);

  useEffect(() => {
    (async () => {
      await AsyncStorage.getItem('upquest_profile').then(val => {
        setHasProfile(!!val);
      });
      // Kick off notifications + HealthKit in background (non-blocking)
      initNotifications().catch(() => {});
      initHealthKit().catch(() => {});
      setReady(true);
    })();

    // ── Notification deeplink handler ──────────────────────────────────────
    // Fires when user TAPS a notification while app is backgrounded/closed
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      const nav  = navigationRef.current;
      if (!nav) return;
      // Any routine/reminder taps → open the Schedule screen
      if (data?.type === 'routine' || data?.screen === 'Schedule') {
        nav.navigate('Schedule', { scheduleId: 'current' });
      } else if (data?.screen === 'HealthSync') {
        nav.navigate('HealthSync');
      } else if (data?.screen === 'MainTabs') {
        nav.navigate('MainTabs');
      }
    });

    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <NavigationContainer
          ref={navigationRef}
          theme={{ dark: true, colors: { primary: Colors.primary, background: Colors.background, card: Colors.surface, text: Colors.textPrimary, border: Colors.border, notification: Colors.primary } }}
        >
          <Stack.Navigator
            screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: Colors.background } }}
            initialRouteName={hasProfile ? 'MainTabs' : 'ProfileSetup'}
          >
            <Stack.Screen name="ProfileSetup"  component={ProfileSetupScreen} />
            <Stack.Screen name="MainTabs"      component={Tabs} />
            <Stack.Screen name="PlanChat"      component={PlanChatScreen}       options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Schedule"      component={ScheduleScreen}       options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="HealthSync"    component={HealthSyncScreen}     options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="WeightTracker" component={WeightTrackerScreen}  options={{ animation: 'slide_from_bottom' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' },
});
