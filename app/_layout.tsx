import { AppSplashScreen } from '@/components/AppSplashScreen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(auth)',
};

function RootNavigator() {
  const { user, isLoading } = useAuth();
  // Controls whether we show our custom in-app splash screen
  const [splashDone, setSplashDone] = useState(false);

  // Hold the splash until its animation finishes AND the auth session has
  // been restored from AsyncStorage, so we never flash the login screen for
  // an already-authenticated user.
  if (!splashDone || isLoading) {
    return (
      <>
        <StatusBar style="light" />
        <AppSplashScreen onAnimationComplete={() => setSplashDone(true)} />
      </>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="device/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="multi-switch/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="floor-plan/index" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="floors/index" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="security/index" options={{ headerShown: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
