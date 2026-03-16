import { type Href, useRouter } from 'expo-router';
import { Box, ChevronRight, Tags } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

type ContentCardProps = {
  title: string;
  description: string;
  accent: string;
  onPress?: () => void;
  disabled?: boolean;
  icon: React.ComponentType<{ size?: number; color?: string }>;
};

function ContentCard({
  title,
  description,
  accent,
  onPress,
  disabled,
  icon: Icon,
}: ContentCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`mb-4 rounded-[28px] border border-border p-5 ${
        disabled ? 'bg-card opacity-70' : 'bg-card'
      }`}
      style={{
        shadowColor: accent,
        shadowOpacity: 0.08,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
      }}>
      <View className="flex-row items-start justify-between gap-4">
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}18` }}>
          <Icon size={24} color={accent} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-lg font-semibold text-foreground">{title}</Text>
            {!disabled && <ChevronRight size={18} color={accent} />}
          </View>
          <Text className="mt-2 text-sm leading-5 text-muted-foreground">{description}</Text>
          <View className="mt-4 self-start rounded-full border border-border px-3 py-1">
            <Text className="text-xs font-medium text-muted-foreground">
              {disabled ? 'Coming soon' : 'Open manager'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CustomContentScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accent = isDark ? '#f59e0b' : '#c2410c';
  const accentAlt = isDark ? '#38bdf8' : '#0369a1';

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingTop: 72, paddingBottom: 40 }}>
        <View className="mb-8 rounded-[32px] border border-border bg-card p-6">
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-muted-foreground">
            Workspace Library
          </Text>
          <Text className="mt-3 text-3xl font-bold text-foreground">Custom Content</Text>
          <Text className="mt-3 text-sm leading-6 text-muted-foreground">
            Keep reusable data in one place. Start with order categories now, then grow this area
            into products and more later.
          </Text>
        </View>

        <ContentCard
          title="Order Categories"
          description="Create, edit, and review the labels used to organize each order and power category analytics."
          accent={accent}
          icon={Tags}
          onPress={() => router.push('/custom-content/categories' as Href)}
        />

        <ContentCard
          title="Products"
          description="This slot is reserved for the upcoming product manager so all reusable content lives together."
          accent={accentAlt}
          icon={Box}
          disabled
        />
      </ScrollView>
    </View>
  );
}
