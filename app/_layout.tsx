import { AppSplashScreen } from '@/components/AppSplashScreen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

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
        // Custom splash will handle the transition
        setShowSplash(false);
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="device/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="multi-switch/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="floor-plan/index" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="floors/index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="security/index" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
