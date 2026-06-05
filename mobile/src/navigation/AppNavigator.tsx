import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import WalletScreen from '../screens/WalletScreen';
import TradingScreen from '../screens/TradingScreen';
import DerivScreen from '../screens/DerivScreen';
import DepositScreen from '../screens/DepositScreen';
import AdminScreen from '../screens/AdminScreen';
import { COLORS } from '../constants/theme';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
};

export type BottomTabParamList = {
  WalletTab: undefined;
  TradingTab: undefined;
  DerivTab: undefined;
  DepositTab: undefined;
  AdminTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<BottomTabParamList>();

function TabIcon({ icon }: { icon: string }) {
  return <Text style={{ fontSize: 18 }}>{icon}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.border },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      <Tab.Screen
        name="WalletTab"
        component={WalletScreen}
        options={{
          title: 'Wallet',
          tabBarIcon: () => <TabIcon icon="🏦" />,
          headerTitle: 'Portefeuille',
        }}
      />
      <Tab.Screen
        name="TradingTab"
        component={TradingScreen}
        options={{
          title: 'Trading',
          tabBarIcon: () => <TabIcon icon="📈" />,
          headerTitle: 'Marché',
        }}
      />
      <Tab.Screen
        name="DerivTab"
        component={DerivScreen}
        options={{
          title: 'Boom & Crash',
          tabBarIcon: () => <TabIcon icon="📊" />,
          headerTitle: 'Indices Synthétiques',
        }}
      />
      <Tab.Screen
        name="DepositTab"
        component={DepositScreen}
        options={{
          title: 'Dépôt',
          tabBarIcon: () => <TabIcon icon="💳" />,
          headerTitle: 'Dépôt',
        }}
      />
      <Tab.Screen
        name="AdminTab"
        component={AdminScreen}
        options={{
          title: 'Admin',
          tabBarIcon: () => <TabIcon icon="🛠️" />,
          headerTitle: 'Administration',
        }}
      />
    </Tab.Navigator>
  );
}

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    primary: COLORS.primary,
    border: COLORS.border,
  },
};

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.surface }, headerTintColor: COLORS.text }}>
        {user ? (
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
