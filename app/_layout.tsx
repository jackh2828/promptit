import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await checkUsername(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await checkUsername(session.user.id);
      } else {
        setHasUsername(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUsername(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    // Auto-generated usernames from email prefix should be treated as "not set"
    // if they were never explicitly chosen (we'll check by looking at username screen visits)
    setHasUsername(!!(data?.username));
  }

  useEffect(() => {
    if (loading) return;

    const segment = segments[0];
    const inTabs = segment === '(tabs)';
    const inLogin = segment === 'login';
    const inUsername = segment === 'username';
    const inOnboarding = segment === 'onboarding';

    if (!session) {
      if (!inLogin) router.replace('/login');
      return;
    }

    // Logged in but no username set — go to username picker
    if (hasUsername === false && !inUsername && !inOnboarding) {
      router.replace('/username');
      return;
    }

    // Logged in with username — go to tabs
    if (hasUsername && !inTabs && !inOnboarding) {
      router.replace('/(tabs)' as any);
    }
  }, [session, hasUsername, segments, loading]);

  if (loading) return null;

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="username" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
