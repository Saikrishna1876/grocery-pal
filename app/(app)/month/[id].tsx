import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  IndianRupee,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type Order = {
  _id: Id<'orders'>;
  source?: string;
  notes?: string;
  _creationTime: number;
  items: {
    _id: string;
    name: string;
    quantity: number;
    unit: string;
    price: number;
  }[];
  total: number;
};

type AnalyticsData = {
  total: number;
  order_count: number;
  top_items: { name: string; quantity: number; total: number }[];
  by_category: { category: string; amount: number }[];
};

type AnalyticsViewModel = {
  total: number;
  order_count: number;
  top_items: { name: string; quantity: number; total: number }[];
  by_category: { category: string; amount: number }[];
};

export default function MonthDetail() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const monthId = id as Id<'months'> | undefined;
  const ordersResult = useQuery(api.orders.getByMonth, monthId ? { monthId } : 'skip');
  const analyticsResult = useQuery(api.analytics.getByMonth, monthId ? { monthId } : 'skip');
  const removeOrder = useMutation(api.orders.remove);

  const orders = (ordersResult as Order[] | undefined) ?? [];
  const analyticsData = analyticsResult as Partial<AnalyticsData> | undefined;
  const analytics: AnalyticsViewModel | null = analyticsData
    ? {
        total: analyticsData.total ?? 0,
        order_count: analyticsData.order_count ?? 0,
        top_items: Array.isArray(analyticsData.top_items) ? analyticsData.top_items : [],
        by_category: Array.isArray(analyticsData.by_category) ? analyticsData.by_category : [],
      }
    : null;
  const loading = monthId ? ordersResult === undefined || analyticsResult === undefined : false;

  const deleteOrder = (orderId: Id<'orders'>) => {
    Alert.alert('Delete Order', 'Are you sure you want to delete this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeOrder({ id: orderId });
        },
      },
    ]);
  };

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-foreground">{title}</Text>
            <Text className="text-xs text-muted-foreground">Monthly expense details</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : (
          <>
            {analytics && (
              <View className="mb-5 flex-row gap-3">
                <View className="flex-1 items-center rounded-xl border border-border bg-card p-4">
                  <IndianRupee size={20} color={iconColor} />
                  <Text className="mt-1 text-xl font-bold text-foreground">
                    ₹{analytics.total.toFixed(0)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Total Spent</Text>
                </View>
                <View className="flex-1 items-center rounded-xl border border-border bg-card p-4">
                  <ShoppingCart size={20} color={iconColor} />
                  <Text className="mt-1 text-xl font-bold text-foreground">
                    {analytics.order_count}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Orders</Text>
                </View>
              </View>
            )}

            {analytics && analytics.top_items.length > 0 && (
              <View className="mb-5 rounded-xl border border-border bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-foreground">Top Items</Text>
                {analytics.top_items.map((item, index) => (
                  <View
                    key={`${item.name}-${index}`}
                    className="flex-row items-center justify-between border-b border-border/50 py-2 last:border-b-0">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted-foreground">{index + 1}.</Text>
                      <Text className="text-sm text-foreground">{item.name}</Text>
                    </View>
                    <Text className="text-sm font-medium text-foreground">
                      ₹{item.total.toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {analytics && analytics.by_category.length > 0 && (
              <View className="mb-5 rounded-xl border border-border bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-foreground">By Category</Text>
                {analytics.by_category.map((category, index) => {
                  const pct = analytics.total > 0 ? (category.amount / analytics.total) * 100 : 0;
                  return (
                    <View key={`${category.category}-${index}`} className="mb-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-foreground">{category.category}</Text>
                        <Text className="text-sm text-muted-foreground">
                          ₹{category.amount.toFixed(0)} ({pct.toFixed(0)}%)
                        </Text>
                      </View>
                      <View className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                        <View
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View className="mb-5 flex-row gap-3">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/order/scan',
                    params: { monthId: id, monthTitle: title },
                  })
                }
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5">
                <Camera size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="font-semibold text-primary-foreground">Scan Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/order/review',
                    params: { monthId: id, monthTitle: title, items: '[]', source: 'manual' },
                  })
                }
                className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5">
                <Plus size={18} color={iconColor} />
                <Text className="font-semibold text-foreground">Manual</Text>
              </TouchableOpacity>
            </View>

            <Text className="mb-3 text-lg font-semibold text-foreground">Orders</Text>
            {orders.length === 0 ? (
              <View className="items-center py-10">
                <Package size={40} color={mutedColor} />
                <Text className="mt-3 text-center text-muted-foreground">
                  No orders yet. Add your first order!
                </Text>
              </View>
            ) : (
              orders.map((order) => (
                <View key={order._id} className="mb-2 rounded-xl border border-border bg-card p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-base font-semibold text-foreground">
                          ₹{order.total.toFixed(0)}
                        </Text>
                        <View className="rounded-full bg-secondary px-2 py-0.5">
                          <Text className="text-xs text-muted-foreground">{order.source}</Text>
                        </View>
                      </View>
                      <Text className="mt-1 text-xs text-muted-foreground">
                        {order.items.length} items ·{' '}
                        {new Date(order._creationTime).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteOrder(order._id)}
                      className="rounded-full p-2">
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  <View className="mt-3 border-t border-border/50 pt-3">
                    {order.items.slice(0, 4).map((item) => (
                      <View key={item._id} className="flex-row items-center justify-between py-1">
                        <Text className="text-sm text-muted-foreground">
                          {item.name} x{item.quantity} {item.unit}
                        </Text>
                        <Text className="text-sm text-foreground">
                          ₹{(item.price * item.quantity).toFixed(0)}
                        </Text>
                      </View>
                    ))}
                    {order.items.length > 4 && (
                      <Text className="mt-1 text-xs text-muted-foreground">
                        +{order.items.length - 4} more items
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
