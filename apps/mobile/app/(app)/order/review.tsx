import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useCachedQueryValue } from '@/lib/cached-query';
import { getErrorMessage } from '@/lib/error';
import { useMutation, useQuery } from 'convex/react';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Search,
  Settings2,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ReviewItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  product_id: Id<'products'> | null;
  database_price: number | null;
  price_difference: number | null;
  confidence: string;
  matched_product: string | null;
};

type OrderCategory = Doc<'order_categories'> & {
  usageCount: number;
};

type ParsedReviewItem = {
  product_id?: Id<'products'> | null;
  name?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  database_price?: number | null;
  price_difference?: number | null;
  confidence?: string;
  matched_product?: string | null;
};

export default function ReviewScreen() {
  const {
    monthId,
    monthTitle,
    items: itemsParam,
    source,
  } = useLocalSearchParams<{
    monthId: string;
    monthTitle: string;
    items: string;
    source: string;
  }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [reviewItems, setReviewItems] = React.useState<ReviewItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [showAddItem, setShowAddItem] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemPrice, setNewItemPrice] = React.useState('');
  const [newItemQty, setNewItemQty] = React.useState('1');
  const [newItemUnit, setNewItemUnit] = React.useState('unit');
  const productsLiveResult = useQuery(api.products.get);
  const categoriesLiveResult = useQuery(api.orderCategories.get);
  const lastUsedCategoryIdLiveResult = useQuery(api.orderCategories.getLastUsed);
  const productsState = useCachedQueryValue<Doc<'products'>[]>({
    queryName: 'products.get',
    liveData: productsLiveResult as Doc<'products'>[] | undefined,
  });
  const categoriesState = useCachedQueryValue<OrderCategory[]>({
    queryName: 'orderCategories.get',
    liveData: categoriesLiveResult as OrderCategory[] | undefined,
  });
  const lastUsedCategoryState = useCachedQueryValue<Id<'order_categories'> | null>({
    queryName: 'orderCategories.getLastUsed',
    liveData: lastUsedCategoryIdLiveResult as Id<'order_categories'> | null | undefined,
  });
  const products = productsState.data ?? [];
  const categories = categoriesState.data ?? [];
  const lastUsedCategoryId = lastUsedCategoryState.data;
  const createOrder = useMutation(api.orders.add);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<Id<'order_categories'> | null>(
    null
  );
  const userSelectedCategoryRef = React.useRef(false);

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  React.useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(itemsParam || '[]');
      const parsedItems = Array.isArray(parsed) ? (parsed as ParsedReviewItem[]) : [];
      const withIds = parsedItems.map((item, index: number) => ({
        id: `item-${index}-${Date.now()}`,
        name: item.name || '',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'unit',
        price: Number(item.price) || 0,
        product_id: (item.product_id as Id<'products'> | null) || null,
        database_price: item.database_price != null ? Number(item.database_price) : null,
        price_difference: item.price_difference != null ? Number(item.price_difference) : null,
        confidence: item.confidence || 'medium',
        matched_product: item.matched_product || null,
      }));
      setReviewItems(withIds);
    } catch {
      setReviewItems([]);
    }
  }, [itemsParam]);

  React.useEffect(() => {
    if (categories.length === 0) {
      return;
    }

    const selectedStillExists = selectedCategoryId
      ? categories.some((category) => category._id === selectedCategoryId)
      : false;

    const uncategorized = categories.find((category) => category.systemKey === 'uncategorized');
    const fallbackCategoryId = uncategorized?._id ?? categories[0]!._id;

    if (lastUsedCategoryId === undefined) {
      if (!selectedStillExists) {
        setSelectedCategoryId(fallbackCategoryId);
      }
      return;
    }

    const preferredCategory = lastUsedCategoryId
      ? categories.find((category) => category._id === lastUsedCategoryId)
      : undefined;
    if (
      preferredCategory &&
      !userSelectedCategoryRef.current &&
      selectedCategoryId !== preferredCategory._id
    ) {
      setSelectedCategoryId(preferredCategory._id);
      return;
    }

    if (!selectedStillExists) {
      setSelectedCategoryId(fallbackCategoryId);
    }
  }, [categories, lastUsedCategoryId, selectedCategoryId]);

  const updateItem = (id: string, updates: Partial<ReviewItem>) => {
    setReviewItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const updated = { ...item, ...updates };
        if (updates.price !== undefined && item.database_price !== null) {
          updated.price_difference = Number(updates.price) - item.database_price;
        }

        return updated;
      })
    );
  };

  const removeItem = (id: string) => {
    setReviewItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addManualItem = () => {
    if (!newItemName.trim()) {
      return;
    }

    const matchedProduct = products.find(
      (product) => product.name.toLowerCase() === newItemName.toLowerCase()
    );
    const price = Number(newItemPrice) || matchedProduct?.price || 0;
    const dbPrice = matchedProduct ? Number(matchedProduct.price) : null;

    const newItem: ReviewItem = {
      id: `item-manual-${Date.now()}`,
      name: newItemName.trim(),
      quantity: Number(newItemQty) || 1,
      unit: matchedProduct?.unit || newItemUnit,
      price,
      product_id: matchedProduct?._id || null,
      database_price: dbPrice,
      price_difference: dbPrice !== null ? price - dbPrice : null,
      confidence: 'high',
      matched_product: matchedProduct?.name || null,
    };

    setReviewItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemQty('1');
    setNewItemUnit('unit');
    setShowAddItem(false);
  };

  const selectProductForAdd = (product: Doc<'products'>) => {
    setNewItemName(product.name);
    setNewItemPrice(product.price.toString());
    setNewItemUnit(product.unit);
    setSearchQuery('');
  };

  const total = reviewItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const selectedCategory =
    categories.find((category) => category._id === selectedCategoryId) ?? null;

  const confirmOrder = async () => {
    if (reviewItems.length === 0) {
      Alert.alert('No Items', 'Add at least one item before confirming.');
      return;
    }

    if (!selectedCategoryId) {
      Alert.alert('Choose Category', 'Select one order category before confirming.');
      return;
    }

    setSaving(true);
    try {
      await createOrder({
        month_id: monthId as Id<'months'>,
        source: source || 'manual',
        notes: '',
        category_id: selectedCategoryId,
        items: reviewItems.map((item) => ({
          product_id: item.product_id || undefined,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
        })),
      });

      router.replace({
        pathname: '/month/[id]',
        params: { id: monthId, title: monthTitle },
      });
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error, 'Failed to save order'));
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = searchQuery.trim()
    ? products.filter((product) => product.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
              <ArrowLeft size={22} color={iconColor} />
            </TouchableOpacity>
            <View>
              <Text className="text-foreground text-xl font-bold">Review Order</Text>
              <Text className="text-muted-foreground text-xs">
                {monthTitle} · {reviewItems.length} items
              </Text>
            </View>
          </View>
          <View className="bg-secondary rounded-full px-3 py-1">
            <Text className="text-muted-foreground text-xs font-medium">{source}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled">
          <View className="border-border bg-card mb-4 rounded-2xl border p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-foreground text-sm font-semibold">Order Category</Text>
                <Text className="text-muted-foreground mt-1 text-xs">
                  Use one category per order so analytics stays easy to read.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/custom-content/categories' as Href)}
                className="border-border flex-row items-center gap-1 rounded-full border px-3 py-2">
                <Settings2 size={14} color={iconColor} />
                <Text className="text-foreground text-xs font-medium">Manage</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingTop: 14, paddingRight: 8 }}>
              {categories.map((category) => {
                const isSelected = selectedCategoryId === category._id;
                return (
                  <TouchableOpacity
                    key={category._id}
                    onPress={() => {
                      userSelectedCategoryRef.current = true;
                      setSelectedCategoryId(category._id);
                    }}
                    className={`rounded-full border px-4 py-2 ${
                      isSelected ? 'border-primary bg-primary' : 'border-border bg-background'
                    }`}>
                    <Text
                      className={`text-sm font-medium ${
                        isSelected ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedCategory && (
              <Text className="text-muted-foreground mt-3 text-xs">
                Saving this order under {selectedCategory.name}.
              </Text>
            )}
          </View>

          {reviewItems.length === 0 && !showAddItem ? (
            <View className="items-center py-16">
              <AlertTriangle size={40} color={mutedColor} />
              <Text className="text-muted-foreground mt-3 text-center text-base font-medium">
                No items detected
              </Text>
              <Text className="text-muted-foreground mt-1 text-center text-sm">
                Add items manually to create an order
              </Text>
            </View>
          ) : (
            reviewItems.map((item) => (
              <View key={item.id} className="border-border bg-card mb-3 rounded-xl border p-4">
                <View className="mr-2 flex-row items-start justify-between">
                  <View className="flex-1">
                    <TextInput
                      className="text-foreground text-base font-semibold"
                      value={item.name}
                      onChangeText={(text) => updateItem(item.id, { name: text })}
                      placeholder="Item name"
                      placeholderTextColor={mutedColor}
                    />
                    {item.matched_product && (
                      <Text className="text-muted-foreground mt-0.5 text-xs">
                        Matched: {item.matched_product}
                      </Text>
                    )}
                    {item.confidence === 'low' && (
                      <View className="mt-1 flex-row items-center gap-1">
                        <AlertTriangle size={12} color="#f59e0b" />
                        <Text className="text-xs" style={{ color: '#f59e0b' }}>
                          Low confidence - please verify
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeItem(item.id)}
                    className="rounded-full p-1.5">
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View className="mt-3 flex-row items-center gap-3">
                  <View className="border-border flex-row items-center rounded-lg border">
                    <TouchableOpacity
                      onPress={() =>
                        updateItem(item.id, { quantity: Math.max(0.5, item.quantity - 1) })
                      }
                      className="px-3 py-2">
                      <Minus size={14} color={iconColor} />
                    </TouchableOpacity>
                    <TextInput
                      className="text-foreground min-w-[40px] text-center text-sm font-medium"
                      value={item.quantity.toString()}
                      onChangeText={(text) => {
                        const number = parseFloat(text);
                        if (!Number.isNaN(number)) {
                          updateItem(item.id, { quantity: number });
                        }
                      }}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      onPress={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                      className="px-3 py-2">
                      <Plus size={14} color={iconColor} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    className="border-border text-foreground rounded-lg border px-3 py-2 text-sm"
                    value={item.unit}
                    onChangeText={(text) => updateItem(item.id, { unit: text })}
                    placeholder="unit"
                    placeholderTextColor={mutedColor}
                    style={{ minWidth: 60 }}
                  />
                  <View className="flex-1 items-end">
                    <View className="flex-row items-center">
                      <Text className="text-muted-foreground mr-1 text-sm">₹</Text>
                      <TextInput
                        className="text-foreground text-lg font-bold"
                        value={item.price.toString()}
                        onChangeText={(text) => {
                          const number = parseFloat(text);
                          if (!Number.isNaN(number)) {
                            updateItem(item.id, { price: number });
                          }
                        }}
                        keyboardType="numeric"
                        style={{ minWidth: 50, textAlign: 'right' }}
                      />
                    </View>
                  </View>
                </View>

                {item.database_price !== null &&
                  item.price_difference !== null &&
                  item.price_difference !== 0 && (
                    <View
                      className="mt-3 flex-row items-center gap-2 rounded-lg px-3 py-2"
                      style={{
                        backgroundColor:
                          item.price_difference > 0
                            ? isDark
                              ? 'rgba(239,68,68,0.1)'
                              : 'rgba(239,68,68,0.05)'
                            : isDark
                              ? 'rgba(34,197,94,0.1)'
                              : 'rgba(34,197,94,0.05)',
                      }}>
                      {item.price_difference > 0 ? (
                        <TrendingUp size={14} color="#ef4444" />
                      ) : (
                        <TrendingDown size={14} color="#22c55e" />
                      )}
                      <Text className="flex-1 text-xs" style={{ color: mutedColor }}>
                        DB price: ₹{item.database_price.toFixed(2)} {' · '}
                        {item.price_difference > 0 ? '+' : ''}₹{item.price_difference.toFixed(2)}
                      </Text>
                      <Text
                        className="text-xs font-medium"
                        style={{ color: item.price_difference > 0 ? '#ef4444' : '#22c55e' }}>
                        {item.price_difference > 0 ? 'Higher' : 'Lower'}
                      </Text>
                    </View>
                  )}
              </View>
            ))
          )}

          {showAddItem ? (
            <View className="border-border bg-card rounded-xl border p-4">
              <Text className="text-foreground mb-3 text-sm font-semibold">Add Manual Item</Text>
              <View className="border-border mb-3 rounded-lg border px-3 py-2">
                <View className="flex-row items-center gap-2">
                  <Search size={16} color={mutedColor} />
                  <TextInput
                    className="text-foreground flex-1 text-sm"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search products..."
                    placeholderTextColor={mutedColor}
                  />
                </View>
              </View>

              {filteredProducts.length > 0 && (
                <View className="border-border mb-3 max-h-48 rounded-lg border">
                  <ScrollView nestedScrollEnabled>
                    {filteredProducts.slice(0, 8).map((product) => (
                      <TouchableOpacity
                        key={product._id}
                        onPress={() => selectProductForAdd(product)}
                        className="border-border border-b px-3 py-3 last:border-b-0">
                        <Text className="text-foreground text-sm font-medium">{product.name}</Text>
                        <Text className="text-muted-foreground text-xs">
                          {product.category} · {product.unit} · ₹{product.price}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View className="gap-3">
                <TextInput
                  className="border-border text-foreground rounded-lg border px-3 py-3 text-sm"
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder="Item name"
                  placeholderTextColor={mutedColor}
                />
                <View className="flex-row gap-3">
                  <TextInput
                    className="border-border text-foreground flex-1 rounded-lg border px-3 py-3 text-sm"
                    value={newItemQty}
                    onChangeText={setNewItemQty}
                    placeholder="Qty"
                    placeholderTextColor={mutedColor}
                    keyboardType="numeric"
                  />
                  <TextInput
                    className="border-border text-foreground flex-1 rounded-lg border px-3 py-3 text-sm"
                    value={newItemUnit}
                    onChangeText={setNewItemUnit}
                    placeholder="Unit"
                    placeholderTextColor={mutedColor}
                  />
                  <TextInput
                    className="border-border text-foreground flex-1 rounded-lg border px-3 py-3 text-sm"
                    value={newItemPrice}
                    onChangeText={setNewItemPrice}
                    placeholder="Price"
                    placeholderTextColor={mutedColor}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View className="mt-4 flex-row gap-3">
                <TouchableOpacity
                  onPress={() => setShowAddItem(false)}
                  className="border-border flex-1 rounded-xl border py-3">
                  <Text className="text-foreground text-center font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addManualItem}
                  className="bg-primary flex-1 rounded-xl py-3">
                  <Text className="text-primary-foreground text-center font-medium">Add Item</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowAddItem(true)}
              className="border-border bg-card rounded-xl border border-dashed py-4">
              <Text className="text-foreground text-center font-medium">+ Add Manual Item</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View className="border-border bg-background border-t px-5 pb-8 pt-4">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">Total</Text>
            <Text className="text-foreground text-2xl font-bold">₹{total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            onPress={confirmOrder}
            disabled={saving || reviewItems.length === 0}
            className={`flex-row items-center justify-center gap-2 rounded-xl py-4 ${
              saving || reviewItems.length === 0 ? 'bg-muted' : 'bg-primary'
            }`}>
            <Check size={18} color={isDark ? '#0a0a0a' : '#fafafa'} />
            <Text
              className={`text-base font-semibold ${
                saving || reviewItems.length === 0
                  ? 'text-muted-foreground'
                  : 'text-primary-foreground'
              }`}>
              {saving ? 'Saving...' : 'Confirm Order'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
