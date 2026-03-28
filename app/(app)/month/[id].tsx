import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getErrorMessage } from '@/lib/error';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Camera,
  IndianRupee,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Order = {
  _id: Id<'orders'>;
  source?: string;
  notes?: string;
  category_id?: Id<'order_categories'>;
  category_name?: string;
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

type OrderCategory = {
  _id: Id<'order_categories'>;
  name: string;
  usageCount: number;
  systemKey?: string;
};

type AnalyticsData = {
  total: number;
  order_count: number;
  top_items: { name: string; quantity: number; total: number }[];
  by_item_category: { category: string; amount: number }[];
  by_order_category: { category: string; amount: number }[];
};

export default function MonthDetail() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const monthId = id as Id<'months'> | undefined;
  const ordersResult = useQuery(api.orders.getByMonth, monthId ? { monthId } : 'skip');
  const analyticsResult = useQuery(api.analytics.getByMonth, monthId ? { monthId } : 'skip');
  const categories = (useQuery(api.orderCategories.get) ?? []) as OrderCategory[];
  const removeOrder = useMutation(api.orders.remove);
  const updateOrderCategory = useMutation(api.orders.updateCategory);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedCategoryOrderId, setExpandedCategoryOrderId] = React.useState<Id<'orders'> | null>(
    null
  );
  const [updatingCategoryOrderId, setUpdatingCategoryOrderId] = React.useState<Id<'orders'> | null>(
    null
  );

  const orders = React.useMemo(() => (ordersResult as Order[] | undefined) ?? [], [ordersResult]);
  const analytics = (analyticsResult as AnalyticsData | undefined) ?? null;
  const loading = monthId ? ordersResult === undefined || analyticsResult === undefined : false;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredOrders = React.useMemo(() => {
    if (!normalizedSearchQuery) {
      return orders;
    }

    return orders.filter((order) => {
      const categoryMatch = (order.category_name ?? 'Uncategorized')
        .toLowerCase()
        .includes(normalizedSearchQuery);
      const sourceMatch = (order.source ?? '').toLowerCase().includes(normalizedSearchQuery);
      const notesMatch = (order.notes ?? '').toLowerCase().includes(normalizedSearchQuery);
      const itemMatch = order.items.some((item) =>
        item.name.toLowerCase().includes(normalizedSearchQuery)
      );

      return categoryMatch || sourceMatch || notesMatch || itemMatch;
    });
  }, [normalizedSearchQuery, orders]);

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

  const toggleOrderCategoryPicker = (orderId: Id<'orders'>) => {
    setExpandedCategoryOrderId((current) => (current === orderId ? null : orderId));
  };

  const applyOrderCategory = async (orderId: Id<'orders'>, categoryId: Id<'order_categories'>) => {
    if (updatingCategoryOrderId === orderId) {
      return;
    }

    setUpdatingCategoryOrderId(orderId);
    try {
      await updateOrderCategory({ id: orderId, category_id: categoryId });
      setExpandedCategoryOrderId(null);
    } catch (error: unknown) {
      Alert.alert(
        'Unable to change category',
        getErrorMessage(error, 'Failed to update category.')
      );
    } finally {
      setUpdatingCategoryOrderId(null);
    }
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

            {/* {analytics && analytics.top_items.length > 0 && (
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
            )} */}

            {analytics && analytics.by_order_category.length > 0 && (
              <View className="mb-5 rounded-xl border border-border bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-foreground">
                  By Order Category
                </Text>
                {analytics.by_order_category.map((category, index) => {
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

            {analytics && analytics.by_item_category.length > 0 && (
              <View className="mb-5 rounded-xl border border-border bg-card p-4">
                <Text className="mb-3 text-sm font-semibold text-foreground">
                  By Product Category
                </Text>
                {analytics.by_item_category.map((category, index) => {
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

            <View className="mb-4 flex-row gap-3">
              <TouchableOpacity
                disabled={!monthId}
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
                disabled={!monthId}
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

            <View className="mb-3 rounded-xl border border-border bg-card px-3 py-2">
              <View className="flex-row items-center gap-2">
                <Search size={16} color={mutedColor} />
                <TextInput
                  className="flex-1 py-1 text-sm text-foreground"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search orders, notes, items, category..."
                  placeholderTextColor={mutedColor}
                />
              </View>
            </View>

            {orders.length === 0 ? (
              <View className="items-center py-10">
                <Package size={40} color={mutedColor} />
                <Text className="mt-3 text-center text-muted-foreground">
                  No orders yet. Add your first order!
                </Text>
              </View>
            ) : filteredOrders.length === 0 ? (
              <View className="items-center rounded-xl border border-border bg-card py-8">
                <Package size={28} color={mutedColor} />
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  No matching orders for "{searchQuery.trim()}"
                </Text>
              </View>
            ) : (
              filteredOrders.map((order) => {
                const pickerOpen = expandedCategoryOrderId === order._id;
                const updatingThisOrder = updatingCategoryOrderId === order._id;

                return (
                  <View
                    key={order._id}
                    className="mb-2 rounded-xl border border-border bg-card p-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="text-base font-semibold text-foreground">
                            ₹{order.total.toFixed(0)}
                          </Text>
                          <TouchableOpacity
                            disabled={updatingThisOrder || categories.length === 0}
                            onPress={() => toggleOrderCategoryPicker(order._id)}
                            className="rounded-full bg-primary/10 px-2 py-0.5">
                            <View className="flex-row items-center gap-1">
                              <Tag size={10} color={iconColor} />
                              <Text className="text-xs text-foreground">
                                {updatingThisOrder
                                  ? 'Updating...'
                                  : (order.category_name ?? 'Uncategorized')}
                              </Text>
                            </View>
                          </TouchableOpacity>
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
                    {pickerOpen && categories.length > 0 && (
                      <View className="mt-3 border-t border-border/50 pt-3">
                        <Text className="mb-2 text-xs text-muted-foreground">Select category</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                          {categories.map((category) => {
                            const isSelected = category._id === order.category_id;
                            return (
                              <TouchableOpacity
                                key={category._id}
                                disabled={updatingThisOrder}
                                onPress={() => applyOrderCategory(order._id, category._id)}
                                className={`rounded-full border px-3 py-1.5 ${
                                  isSelected
                                    ? 'border-primary bg-primary'
                                    : 'border-border bg-background'
                                }`}>
                                <Text
                                  className={`text-xs font-medium ${
                                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                                  }`}>
                                  {category.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
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
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
