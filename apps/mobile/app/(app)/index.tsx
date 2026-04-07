import { useMutation, useQuery } from 'convex/react';
import { type Href, useRouter } from 'expo-router';
import {
  CalendarDays,
  Camera,
  ChevronRight,
  IndianRupee,
  Plus,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { api } from '@/convex/_generated/api';
import { AppText as Text } from '@/components/app-text';
import { useCachedQueryValue } from '@/lib/cached-query';
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
  const [showAddOptions, setShowAddOptions] = React.useState(false);
  const monthsLiveResult = useQuery(api.months.get);
  const monthsState = useCachedQueryValue<MonthSummary[]>({
    queryName: 'months.get',
    liveData: monthsLiveResult as MonthSummary[] | undefined,
    loaderDelayMs: 900,
  });
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

  const months = monthsState.data ?? [];
  const currentMonth = months[0];
  const previousMonth = months[1];
  const currentMonthTitle = currentMonth
    ? `${MONTH_NAMES[currentMonth.month]} ${currentMonth.year}`
    : undefined;
  const trend = currentMonth && previousMonth ? currentMonth.total - previousMonth.total : null;
  const showLoader = monthsState.showLoader;
  const waitingForFirstLoad = monthsState.isInitialLoading && !showLoader;

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';
  const greenColor = '#22c55e';
  const redColor = '#ef4444';
  const addButtonIconColor = currentMonth ? (isDark ? '#0a0a0a' : '#fafafa') : mutedColor;

  const openAddOptions = () => {
    if (!currentMonth) {
      return;
    }

    setShowAddOptions(true);
  };

  const handleAddScan = () => {
    if (!currentMonth) {
      return;
    }

    setShowAddOptions(false);
    router.push({
      pathname: '/order/scan',
      params: { monthId: currentMonth._id, monthTitle: currentMonthTitle },
    });
  };

  const handleAddManual = () => {
    if (!currentMonth) {
      return;
    }

    setShowAddOptions(false);
    router.push({
      pathname: '/order/review',
      params: {
        monthId: currentMonth._id,
        monthTitle: currentMonthTitle,
        items: '[]',
        source: 'manual',
      },
    });
  };

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-foreground text-2xl font-bold">Grocery Pal</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 172 }}>
        {showLoader ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : waitingForFirstLoad ? (
          <View className="mt-20" />
        ) : (
          <>
            {currentMonth && (
              <View className="border-border bg-card mb-6 rounded-2xl border p-5 shadow-sm">
                <Text className="text-muted-foreground text-sm font-medium">
                  {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                </Text>
                <View className="mt-2 flex-row flex-wrap items-end gap-1">
                  <IndianRupee size={24} color={iconColor} />
                  <Text className="text-foreground text-3xl font-bold">
                    {currentMonth.total.toFixed(0)}
                  </Text>
                </View>
                <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2">
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
                        numberOfLines={2}
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

            <View className="mb-3 flex-row flex-wrap gap-3">
              <TouchableOpacity
                onPress={createCurrentMonth}
                className="bg-primary min-w-[160px] flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-3.5">
                <Plus size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="text-primary-foreground text-center font-semibold">New Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/custom-content' as Href)}
                className="border-border bg-card min-w-[160px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3.5">
                <Tag size={18} color={iconColor} />
                <Text className="text-foreground text-center font-semibold">Custom Content</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/shared' as Href)}
              className="border-border bg-card mb-6 flex-row items-center justify-between rounded-xl border px-4 py-3.5">
              <View className="flex-row items-center gap-2">
                <Users size={18} color={iconColor} />
                <Text className="text-foreground font-semibold">Shared Lists</Text>
              </View>
              <ChevronRight size={18} color={mutedColor} />
            </TouchableOpacity>

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
                  className="border-border bg-card mb-2 flex-row items-center justify-between rounded-xl border p-4">
                  <View className="flex-1 pr-3">
                    <Text numberOfLines={1} className="text-foreground text-base font-semibold">
                      {MONTH_NAMES[month.month]} {month.year}
                    </Text>
                    <Text numberOfLines={1} className="text-muted-foreground mt-0.5 text-xs">
                      {month.order_count} orders · {month.item_count} items
                    </Text>
                  </View>
                  <View className="shrink-0 flex-row items-center gap-2">
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
        <View className="flex-row flex-wrap gap-3">
          <TouchableOpacity
            onPress={() => router.push('/profile' as Href)}
            className="border-border bg-card min-w-[140px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3.5">
            <User size={18} color={iconColor} />
            <Text className="text-foreground text-center font-semibold">Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!currentMonth}
            onPress={openAddOptions}
            className={`min-w-[140px] flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              currentMonth ? 'bg-primary' : 'bg-secondary'
            }`}>
            <Plus size={18} color={addButtonIconColor} />
            <Text
              className={`font-semibold ${
                currentMonth ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}>
              Add
            </Text>
          </TouchableOpacity>
        </View>
        {!currentMonth && (
          <Text className="text-muted-foreground mt-2 text-center text-xs">
            Create a month to add orders.
          </Text>
        )}
      </View>

      <Modal
        visible={showAddOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddOptions(false)}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowAddOptions(false)}
            className="flex-1 bg-black/40"
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-lg font-semibold">Add Order</Text>
            <Text className="text-muted-foreground mt-1 text-sm">{currentMonthTitle ?? ''}</Text>

            <View className="mt-5 gap-3">
              <TouchableOpacity
                onPress={handleAddScan}
                className="bg-primary flex-row items-center justify-center gap-2 rounded-xl py-4">
                <Camera size={20} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="text-primary-foreground text-base font-semibold">Scan Items</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddManual}
                className="border-border bg-card flex-row items-center justify-center gap-2 rounded-xl border py-4">
                <Plus size={20} color={iconColor} />
                <Text className="text-foreground text-base font-semibold">Add Manually</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAddOptions(false)}
                className="bg-secondary rounded-xl py-3">
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
