import { useMutation, useQuery } from 'convex/react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BarChart3, Package, Search, Tag, Trash2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useCachedQueryValue } from '@/lib/cached-query';
import { getErrorMessage } from '@/lib/error';

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

export default function MonthDetail() {
  const { id, title } = useLocalSearchParams<{ id: string; title: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const monthId = id as Id<'months'> | undefined;
  const ordersLiveResult = useQuery(api.orders.getByMonth, monthId ? { monthId } : 'skip');
  const categoriesLiveResult = useQuery(api.orderCategories.get);
  const ordersState = useCachedQueryValue<Order[]>({
    queryName: 'orders.getByMonth',
    args: monthId ? { monthId } : undefined,
    liveData: ordersLiveResult as Order[] | undefined,
    loaderDelayMs: 900,
  });
  const categoriesState = useCachedQueryValue<OrderCategory[]>({
    queryName: 'orderCategories.get',
    liveData: categoriesLiveResult as OrderCategory[] | undefined,
    loaderDelayMs: 900,
  });
  const categories = categoriesState.data ?? [];
  const removeOrder = useMutation(api.orders.remove);
  const updateOrderCategory = useMutation(api.orders.updateCategory);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedCategoryOrderId, setExpandedCategoryOrderId] = React.useState<Id<'orders'> | null>(
    null,
  );
  const [updatingCategoryOrderId, setUpdatingCategoryOrderId] = React.useState<Id<'orders'> | null>(
    null,
  );

  const orders = ordersState.data ?? [];
  const showLoader = monthId ? ordersState.showLoader : false;
  const waitingForFirstLoad = monthId ? ordersState.isInitialLoading && !showLoader : false;
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
        item.name.toLowerCase().includes(normalizedSearchQuery),
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
        getErrorMessage(error, 'Failed to update category.'),
      );
    } finally {
      setUpdatingCategoryOrderId(null);
    }
  };

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
              <ArrowLeft size={22} color={iconColor} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text numberOfLines={2} className="text-foreground text-xl font-bold">
                {title}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            disabled={!monthId}
            onPress={() =>
              monthId &&
              router.push(
                `/month/analytics?monthId=${encodeURIComponent(id)}&monthTitle=${encodeURIComponent(title ?? '')}` as Href,
              )
            }
            className="border-border max-w-full flex-row items-center gap-1.5 rounded-full border px-3 py-2"
          >
            <BarChart3 size={16} color={iconColor} />
            <Text numberOfLines={1} className="text-foreground text-xs font-medium">
              Analytics
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {showLoader ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : waitingForFirstLoad ? (
          <View className="mt-20" />
        ) : (
          <>
            <Text className="text-foreground mb-3 text-lg font-semibold">Orders</Text>

            <View className="border-border bg-card mb-3 rounded-xl border px-3 py-2">
              <View className="flex-row items-center gap-2">
                <Search size={16} color={mutedColor} />
                <TextInput
                  className="text-foreground flex-1 py-1 text-sm"
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
                <Text className="text-muted-foreground mt-3 text-center">
                  No orders yet. Add your first order!
                </Text>
              </View>
            ) : filteredOrders.length === 0 ? (
              <View className="border-border bg-card items-center rounded-xl border py-8">
                <Package size={28} color={mutedColor} />
                <Text className="text-muted-foreground mt-2 text-center text-sm">
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
                    className="border-border bg-card mb-2 rounded-xl border p-4"
                  >
                    <View className="flex-row items-start justify-between gap-2">
                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-foreground text-base font-semibold">
                            ₹{order.total.toFixed(0)}
                          </Text>
                          <TouchableOpacity
                            disabled={updatingThisOrder || categories.length === 0}
                            onPress={() => toggleOrderCategoryPicker(order._id)}
                            className="bg-primary/10 rounded-full px-2 py-0.5"
                          >
                            <View className="flex-row items-center gap-1">
                              <Tag size={10} color={iconColor} />
                              <Text numberOfLines={1} className="text-foreground text-xs">
                                {updatingThisOrder
                                  ? 'Updating...'
                                  : (order.category_name ?? 'Uncategorized')}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          <View className="bg-secondary rounded-full px-2 py-0.5">
                            <Text numberOfLines={1} className="text-muted-foreground text-xs">
                              {order.source}
                            </Text>
                          </View>
                        </View>
                        <Text numberOfLines={2} className="text-muted-foreground mt-1 text-xs">
                          {order.items.length} items ·{' '}
                          {new Date(order._creationTime).toLocaleDateString()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteOrder(order._id)}
                        className="rounded-full p-2"
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    {pickerOpen && categories.length > 0 && (
                      <View className="border-border/50 mt-3 border-t pt-3">
                        <Text className="text-muted-foreground mb-2 text-xs">Select category</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
                        >
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
                                }`}
                              >
                                <Text
                                  numberOfLines={1}
                                  className={`text-xs font-medium ${
                                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                                  }`}
                                >
                                  {category.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
                    <View className="border-border/50 mt-3 border-t pt-3">
                      {order.items.slice(0, 4).map((item) => (
                        <View key={item._id} className="flex-row items-center justify-between py-1">
                          <Text
                            numberOfLines={2}
                            className="text-muted-foreground flex-1 pr-2 text-sm"
                          >
                            {item.name} x{item.quantity} {item.unit}
                          </Text>
                          <Text className="text-foreground shrink-0 text-sm">
                            ₹{(item.price * item.quantity).toFixed(0)}
                          </Text>
                        </View>
                      ))}
                      {order.items.length > 4 && (
                        <Text className="text-muted-foreground mt-1 text-xs">
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
