import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<any>(null);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingShareUrl, setPendingShareUrl] = useState<string | null>(null);

  // Tracks every URL we have already consumed so getInitialURL() and the
  // 'url' event listener can both fire on cold-start without double-navigating.
  const consumedUrls = useRef<Set<string>>(new Set());

  const segments = useSegments();
  const router = useRouter();

  // ── Incoming URL handler ───────────────────────────────────────────────────
  // Defined as a ref-stable callback to avoid stale closure warnings and
  // to keep the two Linking hooks below simple.
  const handleIncomingUrl = useRef((raw: string) => {
    const parsed = Linking.parse(raw);
    if (parsed.hostname !== 'share') return;
    const url = parsed.queryParams?.url;
    if (typeof url !== 'string' || url.length === 0) return;
    if (consumedUrls.current.has(url)) return; // dedup: initial + event can both fire
    consumedUrls.current.add(url);
    setPendingShareUrl(url);
  });

  // Keep the ref up-to-date if the component ever re-renders (it won't for
  // a root layout, but this is the correct pattern).
  useEffect(() => {
    handleIncomingUrl.current = (raw: string) => {
      const parsed = Linking.parse(raw);
      if (parsed.hostname !== 'share') return;
      const url = parsed.queryParams?.url;
      if (typeof url !== 'string' || url.length === 0) return;
      if (consumedUrls.current.has(url)) return;
      consumedUrls.current.add(url);
      setPendingShareUrl(url);
    };
  });

  // ── Listen for share URLs (cold-start and while running) ──────────────────
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => { if (url) handleIncomingUrl.current(url); })
      .catch(() => {}); // never let a Linking failure crash the promise chain

    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingUrl.current(url));
    return () => sub.remove();
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        if (session?.user) await checkUsername(session.user.id);
      })
      .catch(() => {})  // network failure: treat as logged-out, still unblock the UI
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) await checkUsername(session.user.id);
        else setHasUsername(null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkUsername(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116 = no rows — profile doesn't exist yet, user needs to pick a username.
      // Any other error is a transient failure (network, RLS); don't redirect the user.
      if (error.code === 'PGRST116') {
        setHasUsername(false);
      }
      // else: leave hasUsername as-is and wait for the next auth state change to retry.
      return;
    }

    setHasUsername(!!(data?.username));
  }

  // ── Auth-based navigation ──────────────────────────────────────────────────
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

    if (hasUsername === false && !inUsername && !inOnboarding) {
      router.replace('/username');
      return;
    }

    if (hasUsername && !inTabs && !inOnboarding) {
      router.replace('/(tabs)' as any);
    }
  }, [session, hasUsername, segments, loading]);

  // ── Navigate to Save tab once auth is settled and a URL is pending ─────────
  useEffect(() => {
    if (!pendingShareUrl) return;
    if (loading) return;
    if (!session || hasUsername !== true) return;

    const url = pendingShareUrl;
    setPendingShareUrl(null);
    // navigate() replaces within the tab navigator rather than pushing a new
    // stack entry — avoids a stale history entry when the user presses Back.
    router.navigate(`/(tabs)/save?url=${encodeURIComponent(url)}` as any);
  }, [pendingShareUrl, session, hasUsername, loading]);

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
