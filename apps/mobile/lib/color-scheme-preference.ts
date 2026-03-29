import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_PREFERENCE_KEY = 'grocery-pal-theme-preference';

const validThemePreferences: ThemePreference[] = ['light', 'dark', 'system'];

export function resolveSystemColorScheme(): 'light' | 'dark' {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const value = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
    if (value && validThemePreferences.includes(value as ThemePreference)) {
      return value as ThemePreference;
    }
  } catch (error) {
    console.error('Failed to read theme preference:', error);
  }

  return 'system';
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  try {
    await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, preference);
  } catch (error) {
    console.error('Failed to save theme preference:', error);
  }
}
