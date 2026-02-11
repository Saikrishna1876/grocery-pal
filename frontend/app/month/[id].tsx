import { BACKEND_URL } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  IndianRupee,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  price: number;
};

type Order = {
  id: number;
  source: string;
  notes: string;
  created_at: string;
  items: OrderItem[];
  total: number;
};

type AnalyticsData = {
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
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const headers = { 'ngrok-skip-browser-warning': 'true' };

  const fetchData = React.useCallback(async () => {
    try {
      const [ordersRes, analyticsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/months/${id}/orders`, { headers }),
        fetch(`${BACKEND_URL}/api/months/${id}/analytics`, { headers }),
      ]);
      setOrders(await ordersRes.json());
      setAnalytics(await analyticsRes.json());
    } catch (e) {
      console.error('Failed to fetch data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deleteOrder = (orderId: number) => {
    Alert.alert('Delete Order', 'Are you sure you want to delete this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${BACKEND_URL}/api/orders/${orderId}`, {
            method: 'DELETE',
            headers,
          });
          fetchData();
        },
      },
    ]);
  };

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : (
          <>
            {/* Stats Row */}
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

            {/* Top Items */}
            {analytics && analytics.top_items.length > 0 && (
              <View className="mb-5 rounded-xl border border-border bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-foreground">Top Items</Text>
                {analytics.top_items.map((item, i) => (
                  <View
                    key={i}
                    className="flex-row items-center justify-between border-b border-border/50 py-2 last:border-b-0"
                  >
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs text-muted-foreground">{i + 1}.</Text>
                      <Text className="text-sm text-foreground">{item.name}</Text>
                    </View>
                    <Text className="text-sm font-medium text-foreground">
                      ₹{item.total.toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Category Breakdown */}
            {analytics && analytics.by_category.length > 0 && (
              <View className="mb-5 rounded-xl border border-border bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-foreground">By Category</Text>
                {analytics.by_category.map((cat, i) => {
                  const pct = analytics.total > 0 ? (cat.amount / analytics.total) * 100 : 0;
                  return (
                    <View key={i} className="mb-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-foreground">{cat.category}</Text>
                        <Text className="text-sm text-muted-foreground">
                          ₹{cat.amount.toFixed(0)} ({pct.toFixed(0)}%)
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

            {/* Add Order Buttons */}
            <View className="mb-5 flex-row gap-3">
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/order/scan',
                    params: { monthId: id, monthTitle: title },
                  })
                }
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3.5"
              >
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
                className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5"
              >
                <Plus size={18} color={iconColor} />
                <Text className="font-semibold text-foreground">Manual</Text>
              </TouchableOpacity>
            </View>

            {/* Orders List */}
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
                <View
                  key={order.id}
                  className="mb-2 rounded-xl border border-border bg-card p-4"
                >
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
                        {new Date(order.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteOrder(order.id)}
                      className="rounded-full p-2"
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                  {/* Item list */}
                  <View className="mt-3 border-t border-border/50 pt-3">
                    {order.items.slice(0, 4).map((item) => (
                      <View key={item.id} className="flex-row items-center justify-between py-1">
                        <Text className="text-sm text-muted-foreground">
                          {item.name} x{item.quantity} {item.unit}
                        </Text>
                        <Text className="text-sm text-foreground">₹{(Number(item.price) * Number(item.quantity)).toFixed(0)}</Text>
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
