import { api } from '@/convex/_generated/api';
import { MONTH_NAMES } from '@/lib/months';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  ChevronRight,
  IndianRupee,
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

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
  const trend = currentMonth && previousMonth ? currentMonth.total - previousMonth.total : null;
  const loading = monthsResult === undefined;

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';
  const greenColor = '#22c55e';
  const redColor = '#ef4444';

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-5 pb-4 pt-14">
        <Text className="text-2xl font-bold text-foreground">Ration Tracker</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Monthly Grocery Expense Manager</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : (
          <>
            {currentMonth && (
              <View className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <Text className="text-sm font-medium text-muted-foreground">
                  {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                </Text>
                <View className="mt-2 flex-row items-end">
                  <IndianRupee size={24} color={iconColor} />
                  <Text className="text-3xl font-bold text-foreground">
                    {currentMonth.total.toFixed(0)}
                  </Text>
                </View>
                <View className="mt-3 flex-row gap-5">
                  <View className="flex-row items-center gap-1.5">
                    <ShoppingCart size={14} color={mutedColor} />
                    <Text className="text-xs text-muted-foreground">
                      {currentMonth.order_count} orders
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <CalendarDays size={14} color={mutedColor} />
                    <Text className="text-xs text-muted-foreground">
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
                        className="text-xs font-medium">
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
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5">
                <Plus size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="font-semibold text-primary-foreground">New Month</Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-3 text-lg font-semibold text-foreground">All Months</Text>
            {months.length === 0 ? (
              <View className="items-center py-10">
                <CalendarDays size={40} color={mutedColor} />
                <Text className="mt-3 text-center text-muted-foreground">
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
                  className="mb-2 flex-row items-center justify-between rounded-xl border border-border bg-card p-4">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      {MONTH_NAMES[month.month]} {month.year}
                    </Text>
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {month.order_count} orders · {month.item_count} items
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-lg font-bold text-foreground">
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
    </View>
  );
}
