import '@/global.css';

import { NAV_THEME } from '@/lib/theme';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error('EXPO_PUBLIC_CONVEX_URL is not configured.');
}

const convex = new ConvexReactClient(convexUrl);

export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colorScheme === 'dark' ? '#0a0a0a' : '#ffffff' },
          }}
        />
      </ThemeProvider>
    </ConvexProvider>
  );
}
