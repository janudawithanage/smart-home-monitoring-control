import { Redirect } from 'expo-router';

/**
 * /floors deep-link redirect — all floors UI now lives inside the main
 * tab screen (app/(tabs)/index.tsx) for smooth, animation-free tab switching.
 */
export default function FloorsRedirect() {
  return <Redirect href="/(tabs)" />;
}
