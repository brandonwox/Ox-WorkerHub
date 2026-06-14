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

import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

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

  // TODO(supabase): bootstrap the auth session here and drive the active
  // worker/role from it once the backend is wired.

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={appTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(installer)" />
        <Stack.Screen name="(desktop)" />
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
      </Stack>
    </ThemeProvider>
  );
}
