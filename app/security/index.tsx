import { Redirect } from 'expo-router';

/**
 * /security deep-link redirect — all security UI now lives inside the main
 * tab screen (app/(tabs)/index.tsx) for smooth, animation-free tab switching.
 */
export default function SecurityRedirect() {
  return <Redirect href="/(tabs)" />;
}
