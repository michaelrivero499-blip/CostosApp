import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CostosProvider } from './src/context/CostosContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { PersonDetailScreen } from './src/screens/PersonDetailScreen';

export type RootStackParamList = {
  Home: { deletingPersonId?: string } | undefined;
  PersonDetail: { personId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <CostosProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </CostosProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
