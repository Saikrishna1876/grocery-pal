import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut, Mail, Monitor, Moon, Sun, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { signOut, useSession } from '@/lib/auth/client';
import { getScreenColorTokens } from '@/lib/screen-color-tokens';
import { useThemePreference } from '@/lib/theme-preference';

type ThemeOption = 'light' | 'dark' | 'system';

export default function ProfileScreen() {
  const { data: session } = useSession();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { themePreference, setThemePreference } = useThemePreference();
  const isDark = colorScheme === 'dark';
  const [signingOut, setSigningOut] = React.useState(false);
  const isMounted = React.useRef(true);

  const { iconColor, mutedColor, selectedCardBg, selectedCardBorder, selectedLabelColor } =
    getScreenColorTokens(isDark);
  const displayName = session?.user?.name?.trim() || 'Grocery Pal User';
  const email = session?.user?.email?.trim() || 'No email available';

  const themeOptions: {
    key: ThemeOption;
    label: string;
    icon: typeof Sun;
  }[] = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
    { key: 'system', label: 'System', icon: Monitor },
  ];

  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
      Alert.alert('Unable to sign out', 'Please try again.');
    } finally {
      if (isMounted.current) {
        setSigningOut(false);
      }
    }
  };

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-foreground text-xl font-bold">Profile</Text>
            <Text className="text-muted-foreground text-xs">Account and session</Text>
          </View>
        </View>
      </View>

      <View className="flex-1 px-5 py-6">
        <View className="border-border bg-card rounded-2xl border p-4">
          <View className="flex-row items-center gap-2">
            <User size={18} color={iconColor} />
            <Text className="text-muted-foreground text-sm font-medium">Name</Text>
          </View>
          <Text className="text-foreground mt-2 text-lg font-semibold">{displayName}</Text>

          <View className="mt-5 flex-row items-center gap-2">
            <Mail size={18} color={iconColor} />
            <Text className="text-muted-foreground text-sm font-medium">Email</Text>
          </View>
          <Text className="text-foreground mt-2 text-base">{email}</Text>
        </View>

        <View className="border-border bg-card mt-5 rounded-2xl border p-4">
          <Text className="text-foreground text-sm font-semibold">Theme</Text>
          <Text className="text-muted-foreground mt-1 text-xs">Choose how Grocery Pal looks.</Text>

          <View className="mt-4 flex-row gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = themePreference === option.key;

              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    void setThemePreference(option.key);
                  }}
                  activeOpacity={0.9}
                  style={
                    isSelected
                      ? { backgroundColor: selectedCardBg, borderColor: selectedCardBorder }
                      : undefined
                  }
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${
                    isSelected ? 'border-primary bg-background' : 'border-border bg-background'
                  }`}
                >
                  <Icon size={14} color={isSelected ? selectedLabelColor : iconColor} />
                  <Text
                    style={isSelected ? { color: selectedLabelColor } : undefined}
                    className="text-foreground text-xs font-semibold"
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          disabled={signingOut}
          onPress={handleSignOut}
          className="mt-5 flex-row items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-3.5"
        >
          {signingOut ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <>
              <LogOut size={18} color="#ef4444" />
              <Text className="font-semibold text-red-500">Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text className="mt-3 text-center text-xs" style={{ color: mutedColor }}>
          You can access Profile from the Dashboard action bar.
        </Text>
      </View>
    </View>
  );
}
