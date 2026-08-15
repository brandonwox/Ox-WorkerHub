// Per-weight deep imports — the package root require()s EVERY variant's ttf,
// which Metro would then bundle wholesale.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { KeyboardDoneBar } from '@/components/KeyboardDoneBar';
import { useSupabaseSession } from '@/integrations/supabase/session';
import { useAppStore } from '@/store/useAppStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

// On web, react-native-web renders TextInput as a DOM <input>/<textarea>, which
// the browser decorates with a focus outline (the white ring). Strip it globally.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'rn-web-focus-reset';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      input, textarea, select, [contenteditable], [tabindex] { outline: none !important; }
      input:focus, textarea:focus, select:focus, [contenteditable]:focus, [tabindex]:focus,
      input:focus-visible, textarea:focus-visible, select:focus-visible,
      [contenteditable]:focus-visible, [tabindex]:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // Drive the active worker/role from the Supabase session (falls back to the
  // Developer dev base when not signed in).
  useSupabaseSession();

  // The selected theme (store.setTheme keeps the palette module in sync, so
  // colors.* already resolves against this scheme). The whole tree below is
  // keyed by it: switching remounts everything with fresh colors.
  const scheme = useAppStore((s) => s.theme);
  const pathname = usePathname();
  const router = useRouter();

  // Remounting the Stack resets navigation to the initial route, so remember
  // where the user was and put them back right after a theme switch. The ref
  // only tracks while the scheme is stable — on the switch render it still
  // holds the pre-switch route.
  const prevSchemeRef = useRef(scheme);
  const pathRef = useRef(pathname);
  if (scheme === prevSchemeRef.current) {
    pathRef.current = pathname;
  }
  useEffect(() => {
    if (scheme === prevSchemeRef.current) return;
    prevSchemeRef.current = scheme;
    if (pathRef.current && pathRef.current !== '/') {
      router.replace(pathRef.current as never);
    }
  }, [scheme, router]);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
      },
    };
  }, [scheme]);

  if (!fontsLoaded) return null;

  return (
    // Gesture root for react-native-gesture-handler (pinch-to-zoom on photos).
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider key={scheme} value={navTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(mobile)" />
          <Stack.Screen name="(desktop)" />
          <Stack.Screen name="set-password" />
          {/* Full-screen login gate (no modal/header) — it's the logged-out landing. */}
          <Stack.Screen name="sign-in" />
          {/* Work Request details renders its own close (X) button — no nav header.
              transparentModal (not 'modal'): the iOS pageSheet dims/scales the
              page behind it, and the tracker wants the page visible undimmed —
              so the screen draws its own sheet card over a transparent
              backdrop. */}
          <Stack.Screen
            name="work-request/[id]"
            options={{
              presentation: 'transparentModal',
              animation: 'slide_from_bottom',
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
          {/* A parent Job's page (cover photo + jobsite info + photo wall),
              opened from the installer Jobs tab. Renders its own X close
              button — no nav header. */}
          <Stack.Screen name="job-site/[id]" />
          {/* Full-screen in-app camera (native only). */}
          <Stack.Screen
            name="camera/[jobId]"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
        </Stack>
        {/* iOS "Done" bar over the keyboard — inputs opt in by id. */}
        <KeyboardDoneBar />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
