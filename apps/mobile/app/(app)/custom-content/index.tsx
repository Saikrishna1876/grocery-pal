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
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={10}
            className="rounded-full p-1"
          >
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-foreground text-xl font-bold">Custom Content</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="text-foreground mb-3 text-lg font-semibold">Content</Text>

        <TouchableOpacity
          onPress={() => router.push('/custom-content/categories' as Href)}
          className="border-border bg-card mb-2 flex-row items-center justify-between rounded-xl border p-4"
        >
          <View className="flex-1 flex-row items-center gap-3">
            <Tags size={18} color={iconColor} />
            <View className="flex-1">
              <Text className="text-foreground text-base font-semibold">Order Categories</Text>
              <Text className="text-muted-foreground mt-0.5 text-xs">
                Manage labels used for each order
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={mutedColor} />
        </TouchableOpacity>

        <View className="border-border bg-card mb-2 flex-row items-center justify-between rounded-xl border p-4 opacity-70">
          <View className="flex-1 flex-row items-center gap-3">
            <Box size={18} color={iconColor} />
            <View className="flex-1">
              <Text className="text-foreground text-base font-semibold">Products</Text>
              <Text className="text-muted-foreground mt-0.5 text-xs">Coming soon</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
