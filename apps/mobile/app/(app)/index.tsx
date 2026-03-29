import { useMutation, useQuery } from 'convex/react';
import { type Href, useRouter } from 'expo-router';
import {
  CalendarDays,
  Camera,
  ChevronRight,
  IndianRupee,
  LogOut,
  Plus,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { api } from '@/convex/_generated/api';
import { signOut } from '@/lib/auth/client';
import { MONTH_NAMES } from '@/lib/months';

type MonthSummary = {
  _id: string;
  year: number;
  month: number;
  total: number;
  order_count: number;
  item_count: number;
};

export default function Dashboard() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [signingOut, setSigningOut] = React.useState(false);
  const monthsResult = useQuery(api.months.get);
  const createMonth = useMutation(api.months.add);

  const createCurrentMonth = async () => {
    const now = new Date();
    try {
      await createMonth({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
    } catch (error) {
      console.error('Failed to create month:', error);
    }
  };

  const months = (monthsResult ?? []) as MonthSummary[];
  const currentMonth = months[0];
  const previousMonth = months[1];
  const currentMonthTitle = currentMonth
    ? `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`
    : undefined;
  const trend = currentMonth && previousMonth ? currentMonth.total - previousMonth.total : null;
  const loading = monthsResult === undefined;

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';
  const greenColor = '#22c55e';
  const redColor = '#ef4444';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-foreground text-2xl font-bold">Grocery Pal</Text>
          </View>
          <TouchableOpacity
            disabled={signingOut}
            onPress={handleSignOut}
            className="border-border flex-row items-center gap-2 rounded-full border px-3 py-2"
          >
            <LogOut size={16} color={iconColor} />
            <Text className="text-foreground text-xs font-medium">
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 172 }}>
        {loading ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : (
          <>
            {currentMonth && (
              <View className="border-border bg-card mb-6 rounded-2xl border p-5 shadow-sm">
                <Text className="text-muted-foreground text-sm font-medium">
                  {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                </Text>
                <View className="mt-2 flex-row items-end">
                  <IndianRupee size={24} color={iconColor} />
                  <Text className="text-foreground text-3xl font-bold">
                    {currentMonth.total.toFixed(0)}
                  </Text>
                </View>
                <View className="mt-3 flex-row gap-5">
                  <View className="flex-row items-center gap-1.5">
                    <ShoppingCart size={14} color={mutedColor} />
                    <Text className="text-muted-foreground text-xs">
                      {currentMonth.order_count} orders
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <CalendarDays size={14} color={mutedColor} />
                    <Text className="text-muted-foreground text-xs">
                      {currentMonth.item_count} items
                    </Text>
                  </View>
                  {trend !== null && (
                    <View className="flex-row items-center gap-1">
                      {trend > 0 ? (
                        <TrendingUp size={14} color={redColor} />
                      ) : (
                        <TrendingDown size={14} color={greenColor} />
                      )}
                      <Text
                        style={{ color: trend > 0 ? redColor : greenColor }}
                        className="text-xs font-medium"
                      >
                        {trend > 0 ? '+' : ''}
                        {trend.toFixed(0)} vs last month
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <View className="mb-6 flex-row gap-3">
              <TouchableOpacity
                onPress={createCurrentMonth}
                className="bg-primary flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
              >
                <Plus size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="text-primary-foreground font-semibold">New Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/custom-content' as Href)}
                className="border-border bg-card flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3.5"
              >
                <Tag size={18} color={iconColor} />
                <Text className="text-foreground font-semibold">Custom Content</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-foreground mb-3 text-lg font-semibold">All Months</Text>
            {months.length === 0 ? (
              <View className="items-center py-10">
                <CalendarDays size={40} color={mutedColor} />
                <Text className="text-muted-foreground mt-3 text-center">
                  No months yet. Create one to start tracking!
                </Text>
              </View>
            ) : (
              months.map((month) => (
                <TouchableOpacity
                  key={month._id}
                  onPress={() =>
                    router.push({
                      pathname: '/month/[id]',
                      params: {
                        id: month._id,
                        title: `${MONTH_NAMES[month.month]} ${month.year}`,
                      },
                    })
                  }
                  className="border-border bg-card mb-2 flex-row items-center justify-between rounded-xl border p-4"
                >
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-semibold">
                      {MONTH_NAMES[month.month]} {month.year}
                    </Text>
                    <Text className="text-muted-foreground mt-0.5 text-xs">
                      {month.order_count} orders · {month.item_count} items
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground text-lg font-bold">
                      ₹{month.total.toFixed(0)}
                    </Text>
                    <ChevronRight size={18} color={mutedColor} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>

      <View className="border-border bg-background border-t px-5 pb-8 pt-3">
        <View className="flex-row gap-3">
          <TouchableOpacity
            disabled={!currentMonth}
            onPress={() =>
              currentMonth &&
              router.push({
                pathname: '/order/scan',
                params: { monthId: currentMonth._id, monthTitle: currentMonthTitle },
              })
            }
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              currentMonth ? 'bg-primary' : 'bg-secondary'
            }`}
          >
            <Camera size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
            <Text className="text-primary-foreground font-semibold">Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!currentMonth}
            onPress={() =>
              currentMonth &&
              router.push({
                pathname: '/order/review',
                params: {
                  monthId: currentMonth._id,
                  monthTitle: currentMonthTitle,
                  items: '[]',
                  source: 'manual',
                },
              })
            }
            className="border-border bg-card flex-row items-center justify-center gap-2 rounded-xl border px-5 py-3.5"
          >
            <Plus size={18} color={iconColor} />
            <Text className="text-foreground font-semibold">Manual</Text>
          </TouchableOpacity>
        </View>
        {!currentMonth && (
          <Text className="text-muted-foreground mt-2 text-center text-xs">
            Create a month to add orders.
          </Text>
        )}
      </View>
    </View>
  );
}
