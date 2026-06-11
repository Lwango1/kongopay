import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { onBackgroundMessageReceived } from './src/services/notifications';

onBackgroundMessageReceived(async (remoteMessage) => {
  const data = remoteMessage.data;
  if (data?.type === 'signal') {
    const label = `${data.indexType === 'BOOM' ? 'Boom' : 'Crash'} ${data.indexNumber}`;
    const dir = data.direction === 'up' ? 'Hausse' : 'Baisse';
  }
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
