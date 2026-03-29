import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Appearance } from 'react-native';
import {
  getThemePreference,
  setThemePreference as persistThemePreference,
  resolveSystemColorScheme,
  type ThemePreference,
} from '@/lib/color-scheme-preference';

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
};

const ThemePreferenceContext = React.createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: React.ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [themePreference, setThemePreferenceState] = React.useState<ThemePreference>('system');

  const applyThemePreference = React.useCallback(
    (preference: ThemePreference) => {
      setColorScheme(preference === 'system' ? resolveSystemColorScheme() : preference);
    },
    [setColorScheme],
  );

  React.useEffect(() => {
    let isActive = true;

    void (async () => {
      const storedPreference = await getThemePreference();
      if (!isActive) {
        return;
      }

      setThemePreferenceState(storedPreference);
      applyThemePreference(storedPreference);
    })();

    return () => {
      isActive = false;
    };
  }, [applyThemePreference]);

  React.useEffect(() => {
    const subscription = Appearance.addChangeListener(() => {
      if (themePreference === 'system') {
        applyThemePreference('system');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [applyThemePreference, themePreference]);

  const setThemePreference = React.useCallback(
    async (preference: ThemePreference) => {
      setThemePreferenceState(preference);
      applyThemePreference(preference);
      await persistThemePreference(preference);
    },
    [applyThemePreference],
  );

  const value = React.useMemo(
    () => ({ themePreference, setThemePreference }),
    [setThemePreference, themePreference],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const context = React.useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider.');
  }

  return context;
}
