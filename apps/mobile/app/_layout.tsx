import '@/global.css';

import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { ThemeProvider } from '@react-navigation/core';
import { ConvexReactClient } from 'convex/react';
import {
  type Href,
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform, Text, View } from 'react-native';
import { authBaseUrl, authClient, useSession } from '@/lib/auth/client';
import { resolveRuntimeUrl } from '@/lib/runtime-url';
import { NAV_THEME } from '@/lib/theme';
import { ThemePreferenceProvider } from '@/lib/theme-preference';

const convexUrl = resolveRuntimeUrl(process.env.EXPO_PUBLIC_CONVEX_URL);

if (!convexUrl) {
  throw new Error('EXPO_PUBLIC_CONVEX_URL is not configured.');
}

const convex = new ConvexReactClient(convexUrl);

function DevNetworkDiagnostics() {
  React.useEffect(() => {
    if (!__DEV__) {
      return;
    }

    console.log('[runtime] Convex URL:', convexUrl);
    console.log('[runtime] Auth URL:', authBaseUrl);

    return convex.subscribeToConnectionState((state) => {
      if (state.isWebSocketConnected && state.connectionRetries === 0) {
        return;
      }

      console.log('[runtime] Convex connection state:', state);
    });
  }, []);

  return null;
}

function LoadingScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="bg-background flex-1 items-center justify-center px-6">
      <Text className="text-foreground text-lg font-semibold">Grocery Pal</Text>
      <Text
        className="text-muted-foreground mt-2 text-center text-sm"
        style={{ color: isDark ? '#a3a3a3' : '#737373' }}>
        Loading your secure workspace...
      </Text>
    </View>
  );
}

function UnsupportedPlatformScreen() {
  return (
    <View className="bg-background flex-1 items-center justify-center px-6">
      <Text className="text-foreground text-lg font-semibold">Native only</Text>
      <Text className="text-muted-foreground mt-2 text-center text-sm">
        Better Auth is configured for iOS and Android in this phase. Open the app in a native
        simulator or device.
      </Text>
    </View>
  );
}

function RootNavigator() {
  const { colorScheme } = useColorScheme();
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const currentGroup = segments[0] as string | undefined;

  const isAuthenticated = Boolean(session?.session);
  const inAuthGroup = currentGroup === '(auth)';
  const waitingForRedirect =
    !isPending && ((isAuthenticated && inAuthGroup) || (!isAuthenticated && !inAuthGroup));

  React.useEffect(() => {
    if (Platform.OS === 'web' || !navigationState?.key || isPending) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/sign-in' as Href);
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace('/' as Href);
    }
  }, [inAuthGroup, isAuthenticated, isPending, navigationState?.key, router]);

  if (Platform.OS === 'web') {
    return <UnsupportedPlatformScreen />;
  }

  if (!navigationState?.key || isPending || waitingForRedirect) {
    return <LoadingScreen />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colorScheme === 'dark' ? '#0a0a0a' : '#ffffff' },
      }}
    />
  );
}

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <ThemePreferenceProvider>
        <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
          <DevNetworkDiagnostics />
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
        </ThemeProvider>
      </ThemePreferenceProvider>
    </ConvexBetterAuthProvider>
  );
}
