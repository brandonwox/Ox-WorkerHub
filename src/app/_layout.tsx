import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSupabaseSession } from '@/integrations/supabase/session';
import { colors, fonts } from '@/theme';

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

const appTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
  },
};

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

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={appTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(mobile)" />
        <Stack.Screen name="(desktop)" />
        <Stack.Screen name="set-password" />
        {/* Full-screen login gate (no modal/header) — it's the logged-out landing. */}
        <Stack.Screen name="sign-in" />
        <Stack.Screen
          name="job/[id]"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Jobcard Details',
            headerTitleStyle: {
              fontFamily: fonts.bold,
              color: colors.textPrimary,
            },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
          }}
        />
        {/* A parent Job's page (jobsite info + photo wall), opened from the
            installer Pics tab. */}
        <Stack.Screen
          name="job-site/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Job Photos',
            headerTitleStyle: {
              fontFamily: fonts.bold,
              color: colors.textPrimary,
            },
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
          }}
        />
        {/* Full-screen in-app camera (native only). */}
        <Stack.Screen
          name="camera/[jobId]"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
