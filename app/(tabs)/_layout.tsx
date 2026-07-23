import { Tabs } from 'expo-router';
import React from 'react';

/**
 * Tab layout — headerShown is false because HomeScreen manages its own
 * top bar and custom bottom tab bar.  The Tabs navigator is kept here
 * to satisfy Expo Router's file-system routing requirements, but the
 * default tab bar is hidden in favour of the custom one rendered inside
 * app/(tabs)/index.tsx.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // custom tab bar lives inside HomeScreen
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
    </Tabs>
  );
}
