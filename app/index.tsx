import { Redirect } from 'expo-router';

/**
 * Root index — redirects to the login screen on first launch.
 * After successful authentication, the app navigates to (tabs).
 */
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
