import { useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BarChart3, IndianRupee, ShoppingCart, Tag } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { MONTH_NAMES } from '@/lib/months';

type AnalyticsData = {
  total: number;
  order_count: number;
  top_items: { name: string; quantity: number; total: number }[];
  by_item_category: { category: string; amount: number }[];
  by_order_category: { category: string; amount: number }[];
};

type AnalyticsViewModel = {
  total: number;
  order_count: number;
  top_items: { name: string; quantity: number; total: number }[];
  by_item_category: { category: string; amount: number }[];
  by_order_category: { category: string; amount: number }[];
};

type ComparisonPoint = {
  year: number;
  month: number;
  total: number;
  order_count: number;
};

export default function MonthAnalytics() {
  const { monthId, monthTitle } = useLocalSearchParams<{ monthId: string; monthTitle: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();

  const parsedMonthId = monthId as Id<'months'> | undefined;
  const analyticsResult = useQuery(
    api.analytics.getByMonth,
    parsedMonthId ? { monthId: parsedMonthId } : 'skip',
  );
  const comparisonResult = useQuery(api.analytics.getComparison);

  const analyticsData = analyticsResult as Partial<AnalyticsData> | undefined;
  const analytics: AnalyticsViewModel | null = analyticsData
    ? {
        total: analyticsData.total ?? 0,
        order_count: analyticsData.order_count ?? 0,
        top_items: Array.isArray(analyticsData.top_items) ? analyticsData.top_items : [],
        by_item_category: Array.isArray(analyticsData.by_item_category)
          ? analyticsData.by_item_category
          : [],
        by_order_category: Array.isArray(analyticsData.by_order_category)
          ? analyticsData.by_order_category
          : [],
      }
    : null;

  const comparisonData = (comparisonResult as ComparisonPoint[] | undefined) ?? [];
  const trendData = React.useMemo(() => {
    return [...comparisonData].sort((a, b) => {
      if (a.year === b.year) {
        return a.month - b.month;
      }
      return a.year - b.year;
    });
  }, [comparisonData]);

  const loading = parsedMonthId
    ? analyticsResult === undefined || comparisonResult === undefined
    : false;
  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const chartWidth = Math.max(screenWidth - 72, 220);
  const chartHeight = 170;
  const chartPaddingX = 18;
  const chartPaddingY = 16;

  const maxTrend = React.useMemo(() => {
    if (trendData.length === 0) {
      return 1;
    }

    return trendData.reduce((acc, point) => Math.max(acc, point.total), 1);
  }, [trendData]);

  const linePoints = React.useMemo(() => {
    if (trendData.length < 2) {
      return [] as { x: number; y: number }[];
    }

    return trendData.map((point, index) => {
      const x = chartPaddingX + (index / (trendData.length - 1)) * (chartWidth - chartPaddingX * 2);
      const y =
        chartHeight - chartPaddingY - (point.total / maxTrend) * (chartHeight - chartPaddingY * 2);

      return { x, y };
    });
  }, [chartWidth, maxTrend, trendData]);

  const linePointsText = linePoints.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-foreground text-xl font-bold">Analytics</Text>
            <Text className="text-muted-foreground text-xs">
              {monthTitle ?? 'Month'} insights and trend graphs
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : !analytics ? (
          <View className="items-center py-10">
            <BarChart3 size={40} color={iconColor} />
            <Text className="text-muted-foreground mt-3 text-center">No analytics found.</Text>
          </View>
        ) : (
          <>
            <View className="mb-5 flex-row gap-3">
              <View className="border-border bg-card flex-1 items-center rounded-xl border p-4">
                <IndianRupee size={20} color={iconColor} />
                <Text className="text-foreground mt-1 text-xl font-bold">
                  ₹{analytics.total.toFixed(0)}
                </Text>
                <Text className="text-muted-foreground text-xs">Total Spent</Text>
              </View>
              <View className="border-border bg-card flex-1 items-center rounded-xl border p-4">
                <ShoppingCart size={20} color={iconColor} />
                <Text className="text-foreground mt-1 text-xl font-bold">
                  {analytics.order_count}
                </Text>
                <Text className="text-muted-foreground text-xs">Orders</Text>
              </View>
            </View>

            <View className="border-border bg-card mb-5 rounded-xl border p-4">
              <Text className="text-foreground mb-3 text-sm font-semibold">
                Monthly Spend Trend
              </Text>
              {linePoints.length >= 2 ? (
                <>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Line
                      x1={chartPaddingX}
                      y1={chartHeight - chartPaddingY}
                      x2={chartWidth - chartPaddingX}
                      y2={chartHeight - chartPaddingY}
                      stroke={isDark ? '#262626' : '#e5e5e5'}
                      strokeWidth={1}
                    />
                    <Polyline
                      points={linePointsText}
                      fill="none"
                      stroke={isDark ? '#60a5fa' : '#2563eb'}
                      strokeWidth={3}
                    />
                    {linePoints.map((point, index) => (
                      <Circle
                        key={`trend-point-${trendData[index]?.month}-${trendData[index]?.year}`}
                        cx={point.x}
                        cy={point.y}
                        r={4}
                        fill={isDark ? '#60a5fa' : '#2563eb'}
                      />
                    ))}
                  </Svg>
                  <View className="mt-3 flex-row justify-between">
                    <Text className="text-muted-foreground text-xs">
                      {MONTH_NAMES[trendData[0].month]} {trendData[0].year}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {MONTH_NAMES[trendData[trendData.length - 1].month]}{' '}
                      {trendData[trendData.length - 1].year}
                    </Text>
                  </View>
                </>
              ) : (
                <Text className="text-muted-foreground text-sm">
                  Add at least 2 months to view the trend graph.
                </Text>
              )}
            </View>

            {analytics.by_order_category.length > 0 && (
              <View className="border-border bg-card mb-5 rounded-xl border p-4">
                <Text className="text-foreground mb-3 text-sm font-semibold">
                  Order Category Mix
                </Text>
                {analytics.by_order_category.map((category, index) => {
                  const pct = analytics.total > 0 ? (category.amount / analytics.total) * 100 : 0;
                  return (
                    <View key={`${category.category}-${index}`} className="mb-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-1.5">
                          <Tag size={12} color={iconColor} />
                          <Text className="text-foreground text-sm">{category.category}</Text>
                        </View>
                        <Text className="text-muted-foreground text-xs">
                          ₹{category.amount.toFixed(0)} ({pct.toFixed(0)}%)
                        </Text>
                      </View>
                      <View className="bg-secondary mt-1.5 h-2.5 overflow-hidden rounded-full">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isDark ? '#60a5fa' : '#2563eb',
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {analytics.by_item_category.length > 0 && (
              <View className="border-border bg-card mb-5 rounded-xl border p-4">
                <Text className="text-foreground mb-3 text-sm font-semibold">
                  Product Category Mix
                </Text>
                {analytics.by_item_category.map((category, index) => {
                  const pct = analytics.total > 0 ? (category.amount / analytics.total) * 100 : 0;
                  return (
                    <View key={`${category.category}-${index}`} className="mb-3">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-foreground text-sm">{category.category}</Text>
                        <Text className="text-muted-foreground text-xs">
                          ₹{category.amount.toFixed(0)} ({pct.toFixed(0)}%)
                        </Text>
                      </View>
                      <View className="bg-secondary mt-1.5 h-2.5 overflow-hidden rounded-full">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isDark ? '#34d399' : '#059669',
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {analytics.top_items.length > 0 && (
              <View className="border-border bg-card rounded-xl border p-4">
                <Text className="text-foreground mb-3 text-sm font-semibold">Top Items</Text>
                {analytics.top_items.slice(0, 5).map((item, index) => (
                  <View
                    key={`${item.name}-${index}`}
                    className="border-border/50 flex-row items-center justify-between border-b py-2 last:border-b-0"
                  >
                    <Text className="text-foreground text-sm">
                      {index + 1}. {item.name}
                    </Text>
                    <Text className="text-foreground text-sm font-medium">
                      ₹{item.total.toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
