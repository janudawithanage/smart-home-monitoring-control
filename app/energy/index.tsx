import { Redirect } from 'expo-router';
import React from 'react';

/**
 * /energy deep-link redirect — all energy UI now lives inside the main
 * tab screen (app/(tabs)/index.tsx) for smooth, animation-free tab switching.
 */
export default function EnergyRedirect() {
  return <Redirect href="/(tabs)" />;
}
