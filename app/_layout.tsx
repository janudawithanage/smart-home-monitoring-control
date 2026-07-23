import { AppSplashScreen } from '@/components/AppSplashScreen';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

// Keep the native splash screen visible while we initialise
SplashScreen.preventAutoHideAsync();

// Fade the native splash out once we're ready
SplashScreen.setOptions({ duration: 400, fade: true });

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  // Controls whether we show our custom in-app splash screen
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Simulate loading resources (fonts, initial data, etc.)
        // Replace / extend this with real async work as needed
        await new Promise<void>((resolve) => setTimeout(resolve, 5000));
      } catch (e) {
        console.warn('Splash screen prepare error:', e);
      } finally {
        // Hide the native splash and let our custom screen take over
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" />
        <AppSplashScreen onAnimationComplete={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="device" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
