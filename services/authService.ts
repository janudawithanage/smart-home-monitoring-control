import { supabase } from './supabase';

/**
 * Register a new user with email + password.
 *
 * When "Confirm email" is enabled in Supabase (the default for new projects),
 * this returns `data.session === null` and the user must click the link in
 * the confirmation email before they can sign in. When it's disabled, a
 * session is returned immediately.
 */
export async function signUp(email: string, password: string, fullName?: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
