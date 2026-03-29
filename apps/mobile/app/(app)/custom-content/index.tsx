import { type Href, useRouter } from 'expo-router';
import { ArrowLeft, Box, ChevronRight, Tags } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function CustomContentScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={10}
            className="rounded-full p-1">
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-foreground">Custom Content</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="mb-3 text-lg font-semibold text-foreground">Content</Text>

        <TouchableOpacity
          onPress={() => router.push('/custom-content/categories' as Href)}
          className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card p-4">
          <View className="flex-1 flex-row items-center gap-3">
            <Tags size={18} color={iconColor} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">Order Categories</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Manage labels used for each order
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={mutedColor} />
        </TouchableOpacity>

        <View className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card p-4 opacity-70">
          <View className="flex-1 flex-row items-center gap-3">
            <Box size={18} color={iconColor} />
            <View className="flex-1">
              <Text className="text-base font-semibold text-foreground">Products</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">Coming soon</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
