import React, { useEffect, useState, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Nunito_800ExtraBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { CostosProvider } from './src/context/CostosContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AnimatedSplash } from './src/components/AnimatedSplash';
import { Toast } from './src/components/Toast';
import { DeudasIcon, EstadisticasIcon, FinanzasIcon, AjustesIcon } from './src/components/TabIcons';
import { useCostos } from './src/context/CostosContext';
import { requestNotificationPermissions, scheduleDueDateNotifications } from './src/services/notifications';
import { OnboardingModal } from './src/components/OnboardingModal';
import { FinanzasProvider } from './src/context/FinanzasContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PersonDetailScreen } from './src/screens/PersonDetailScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { MovementsScreen } from './src/screens/MovementsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { StatisticsScreen } from './src/screens/StatisticsScreen';
import { FinanzasScreen } from './src/screens/FinanzasScreen';
import { ChartDetailScreen } from './src/screens/ChartDetailScreen';
import { PeriodFilter, Currency } from './src/types';

SplashScreen.preventAutoHideAsync();

export type RootStackParamList = {
  MainTabs: undefined;
  PersonDetail: { personId: string };
  History: { filter: PeriodFilter; currency?: Currency };
  Movements: undefined;
  ChartDetail: undefined;
};

export type TabParamList = {
  Deudas: { deletingPersonId?: string } | undefined;
  Estadisticas: undefined;
  Finanzas: undefined;
  Ajustes: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00C4A8',
        tabBarInactiveTintColor: theme.subtext,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          const s = size - 2;
          if (route.name === 'Deudas')      return <DeudasIcon size={s} color={color} />;
          if (route.name === 'Estadisticas') return <EstadisticasIcon size={s} color={color} />;
          if (route.name === 'Finanzas')    return <FinanzasIcon size={s} color={color} />;
          if (route.name === 'Ajustes')     return <AjustesIcon size={s} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Deudas"       component={HomeScreen}       options={{ tabBarLabel: 'Deudas' }} />
      <Tab.Screen name="Estadisticas" component={StatisticsScreen} options={{ tabBarLabel: 'Estadísticas' }} />
      <Tab.Screen name="Finanzas"     component={FinanzasScreen}   options={{ tabBarLabel: 'Finanzas' }} />
      <Tab.Screen name="Ajustes"      component={SettingsScreen}   options={{ tabBarLabel: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

// Vive dentro de CostosProvider — pide permisos una vez y reprograma solo
// cuando cambian las deudas con vencimiento o los nombres de personas.
function NotificationScheduler() {
  const { debts, persons } = useCostos();

  // Refs siempre actualizados — usados en el effect de scheduling para
  // evitar stale closures sin que eso dispare el effect.
  const debtsRef   = useRef(debts);
  const personsRef = useRef(persons);
  useEffect(() => { debtsRef.current   = debts;   }, [debts]);
  useEffect(() => { personsRef.current = persons; }, [persons]);

  // Pedir permisos una sola vez al montar
  useEffect(() => { requestNotificationPermissions(); }, []);

  // Hash estable de lo que importa para notificaciones:
  // deudas pendientes con vencimiento + nombres de personas
  const dueDateKey = useMemo(() =>
    debts
      .filter(d => d.status === 'pendiente' && d.dueDate)
      .map(d => `${d.id}|${d.dueDate}`)
      .sort()
      .join(','),
  [debts]);

  const personNamesKey = useMemo(() =>
    persons.map(p => `${p.id}|${p.name}`).sort().join(','),
  [persons]);

  // Solo reprogramar cuando el hash relevante cambia
  useEffect(() => {
    scheduleDueDateNotifications(debtsRef.current, personsRef.current);
  }, [dueDateKey, personNamesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function AppContent() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs"     component={MainTabs} />
        <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
        <Stack.Screen name="History"      component={HistoryScreen} />
        <Stack.Screen name="Movements"    component={MovementsScreen} />
        <Stack.Screen name="ChartDetail"  component={ChartDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const ONBOARDING_KEY = '@vera_onboarding_done';

function AppRouter() {
  const { session, loading } = useAuth();
  const { isDark } = useTheme();
  const [splashDone, setSplashDone] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Chequear si el usuario ya vio el onboarding
  useEffect(() => {
    if (!session) return;
    AsyncStorage.getItem(ONBOARDING_KEY).then(val => {
      if (val === null) setShowOnboarding(true);
    });
  }, [session]);

  async function handleOnboardingDone() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  }

  if (loading) return null;
  if (!session) return (
    <>
      <StatusBar style="dark" />
      <LoginScreen />
    </>
  );

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <CostosProvider>
      <FinanzasProvider>
        <NotificationScheduler />
        <AppContent />
        <Toast />
        {!splashDone && <AnimatedSplash onFinish={() => setSplashDone(true)} />}
        <OnboardingModal visible={showOnboarding} onDone={handleOnboardingDone} />
      </FinanzasProvider>
    </CostosProvider>
    </>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Nunito_800ExtraBold, Nunito_700Bold });
  if (!fontsLoaded) return null;

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
