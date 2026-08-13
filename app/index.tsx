import { useAuth } from '@/context/AuthContext';
import { Redirect } from 'expo-router';

/**
 * Root index — the app entry point.
 * Authenticated users go straight to the tabs; everyone else lands on login.
 */
export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
