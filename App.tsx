import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { CostosProvider } from './src/context/CostosContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { Toast } from './src/components/Toast';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PersonDetailScreen } from './src/screens/PersonDetailScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MovementsScreen } from './src/screens/MovementsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PeriodFilter, Currency } from './src/types';

SplashScreen.preventAutoHideAsync();

export type RootStackParamList = {
  Home: { deletingPersonId?: string } | undefined;
  PersonDetail: { personId: string };
  History: { filter: PeriodFilter; currency?: Currency };
  Movements: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Movements" component={MovementsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppRouter() {
  const { session, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  if (!session) return <LoginScreen />;

  return (
    <CostosProvider>
      <AppContent />
      <Toast />
      {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
    </CostosProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <AppRouter />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
