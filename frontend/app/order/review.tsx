import { BACKEND_URL } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Minus,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
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
  product_id: number | null;
  database_price: number | null;
  price_difference: number | null;
  confidence: string;
  matched_product: string | null;
};

type Product = {
  id: number;
  name: string;
  category: string;
  unit: string;
  price: number;
};

export default function ReviewScreen() {
  const { monthId, monthTitle, items: itemsParam, source } = useLocalSearchParams<{
    monthId: string;
    monthTitle: string;
    items: string;
    source: string;
  }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [reviewItems, setReviewItems] = React.useState<ReviewItem[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [showAddItem, setShowAddItem] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemPrice, setNewItemPrice] = React.useState('');
  const [newItemQty, setNewItemQty] = React.useState('1');
  const [newItemUnit, setNewItemUnit] = React.useState('unit');

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  React.useEffect(() => {
    try {
      const parsed = JSON.parse(itemsParam || '[]');
      const withIds = parsed.map((item: any, i: number) => ({
        id: `item-${i}-${Date.now()}`,
        name: item.name || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'unit',
        price: Number(item.price) || 0,
        product_id: item.product_id || null,
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
    fetch(`${BACKEND_URL}/api/products`, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    })
      .then((r) => r.json())
      .then(setProducts)
      .catch(console.error);
  }, []);

  const updateItem = (id: string, updates: Partial<ReviewItem>) => {
    setReviewItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
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
    if (!newItemName.trim()) return;
    const matchedProduct = products.find(
      (p) => p.name.toLowerCase() === newItemName.toLowerCase()
    );
    const price = Number(newItemPrice) || matchedProduct?.price || 0;
    const dbPrice = matchedProduct ? Number(matchedProduct.price) : null;

    const newItem: ReviewItem = {
      id: `item-manual-${Date.now()}`,
      name: newItemName.trim(),
      quantity: Number(newItemQty) || 1,
      unit: matchedProduct?.unit || newItemUnit,
      price,
      product_id: matchedProduct?.id || null,
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

  const selectProductForAdd = (product: Product) => {
    setNewItemName(product.name);
    setNewItemPrice(product.price.toString());
    setNewItemUnit(product.unit);
    setSearchQuery('');
  };

  const total = reviewItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const confirmOrder = async () => {
    if (reviewItems.length === 0) {
      Alert.alert('No Items', 'Add at least one item before confirming.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          month_id: Number(monthId),
          source: source || 'manual',
          notes: '',
          items: reviewItems.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            price: item.price,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save order');
      }

        // Go back to month detail
        router.replace({
          pathname: '/month/[id]',
          params: { id: monthId, title: monthTitle },
        });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = searchQuery.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="border-b border-border px-5 pb-4 pt-14">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
              <ArrowLeft size={22} color={iconColor} />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-bold text-foreground">Review Order</Text>
              <Text className="text-xs text-muted-foreground">
                {monthTitle} · {reviewItems.length} items
              </Text>
            </View>
          </View>
          <View className="rounded-full bg-secondary px-3 py-1">
            <Text className="text-xs font-medium text-muted-foreground">{source}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Items List */}
          {reviewItems.length === 0 && !showAddItem ? (
            <View className="items-center py-16">
              <AlertTriangle size={40} color={mutedColor} />
              <Text className="mt-3 text-center text-base font-medium text-muted-foreground">
                No items detected
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                Add items manually to create an order
              </Text>
            </View>
          ) : (
            reviewItems.map((item) => (
              <View
                key={item.id}
                className="mb-3 rounded-xl border border-border bg-card p-4"
              >
                {/* Item header row */}
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-2">
                    <TextInput
                      className="text-base font-semibold text-foreground"
                      value={item.name}
                      onChangeText={(text) => updateItem(item.id, { name: text })}
                      placeholder="Item name"
                      placeholderTextColor={mutedColor}
                    />
                    {item.matched_product && (
                      <Text className="mt-0.5 text-xs text-muted-foreground">
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
                    className="rounded-full p-1.5"
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                {/* Quantity & Unit row */}
                <View className="mt-3 flex-row items-center gap-3">
                  <View className="flex-row items-center rounded-lg border border-border">
                    <TouchableOpacity
                      onPress={() =>
                        updateItem(item.id, { quantity: Math.max(0.5, item.quantity - 1) })
                      }
                      className="px-3 py-2"
                    >
                      <Minus size={14} color={iconColor} />
                    </TouchableOpacity>
                    <TextInput
                      className="min-w-[40px] text-center text-sm font-medium text-foreground"
                      value={item.quantity.toString()}
                      onChangeText={(text) => {
                        const num = parseFloat(text);
                        if (!isNaN(num)) updateItem(item.id, { quantity: num });
                      }}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      onPress={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                      className="px-3 py-2"
                    >
                      <Plus size={14} color={iconColor} />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
                    value={item.unit}
                    onChangeText={(text) => updateItem(item.id, { unit: text })}
                    placeholder="unit"
                    placeholderTextColor={mutedColor}
                    style={{ minWidth: 60 }}
                  />
                  <View className="flex-1 items-end">
                    <View className="flex-row items-center">
                      <Text className="text-sm text-muted-foreground mr-1">₹</Text>
                      <TextInput
                        className="text-lg font-bold text-foreground"
                        value={item.price.toString()}
                        onChangeText={(text) => {
                          const num = parseFloat(text);
                          if (!isNaN(num)) updateItem(item.id, { price: num });
                        }}
                        keyboardType="numeric"
                        style={{ minWidth: 50, textAlign: 'right' }}
                      />
                    </View>
                  </View>
                </View>

                {/* Adaptive Price Memory: price difference indicator */}
                {item.database_price !== null && item.price_difference !== null && item.price_difference !== 0 && (
                  <View
                    className="mt-3 flex-row items-center gap-2 rounded-lg px-3 py-2"
                    style={{
                      backgroundColor: item.price_difference > 0
                        ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)')
                        : (isDark ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.05)'),
                    }}
                  >
                    {item.price_difference > 0 ? (
                      <TrendingUp size={14} color="#ef4444" />
                    ) : (
                      <TrendingDown size={14} color="#22c55e" />
                    )}
                    <Text className="flex-1 text-xs" style={{ color: mutedColor }}>
                      DB price: ₹{item.database_price.toFixed(2)}
                      {' · '}
                      {item.price_difference > 0 ? '+' : ''}
                      ₹{item.price_difference.toFixed(2)}
                    </Text>
                    <Text
                      className="text-xs font-medium"
                      style={{ color: item.price_difference > 0 ? '#ef4444' : '#22c55e' }}
                    >
                      {item.price_difference > 0 ? 'Increase' : 'Decrease'}
                    </Text>
                  </View>
                )}

                {/* Subtotal */}
                <View className="mt-2 flex-row justify-end">
                  <Text className="text-xs text-muted-foreground">
                    Subtotal: ₹{(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
              </View>
            ))
          )}

          {/* Add Item Section */}
          {showAddItem ? (
            <View className="mb-3 rounded-xl border-2 border-dashed border-primary/30 bg-card p-4">
              <Text className="mb-3 text-sm font-semibold text-foreground">Add Item</Text>

              {/* Search products */}
              <View className="mb-3 flex-row items-center gap-2 rounded-lg border border-border px-3 py-2">
                <Search size={16} color={mutedColor} />
                <TextInput
                  className="flex-1 text-sm text-foreground"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products..."
                  placeholderTextColor={mutedColor}
                />
              </View>

              {filteredProducts.length > 0 && (
                <View className="mb-3 max-h-40 rounded-lg border border-border bg-background">
                  <ScrollView nestedScrollEnabled>
                    {filteredProducts.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => selectProductForAdd(p)}
                        className="flex-row items-center justify-between border-b border-border/50 px-3 py-2.5"
                      >
                        <View>
                          <Text className="text-sm font-medium text-foreground">{p.name}</Text>
                          <Text className="text-xs text-muted-foreground">{p.category} · {p.unit}</Text>
                        </View>
                        <Text className="text-sm font-medium text-foreground">₹{p.price}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Manual fields */}
              <TextInput
                className="mb-2 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground"
                value={newItemName}
                onChangeText={setNewItemName}
                placeholder="Item name"
                placeholderTextColor={mutedColor}
              />
              <View className="mb-2 flex-row gap-2">
                <TextInput
                  className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground"
                  value={newItemQty}
                  onChangeText={setNewItemQty}
                  placeholder="Qty"
                  placeholderTextColor={mutedColor}
                  keyboardType="numeric"
                />
                <TextInput
                  className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground"
                  value={newItemUnit}
                  onChangeText={setNewItemUnit}
                  placeholder="Unit"
                  placeholderTextColor={mutedColor}
                />
                <TextInput
                  className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm text-foreground"
                  value={newItemPrice}
                  onChangeText={setNewItemPrice}
                  placeholder="Price"
                  placeholderTextColor={mutedColor}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowAddItem(false)}
                  className="flex-1 items-center rounded-lg border border-border py-2.5"
                >
                  <Text className="text-sm font-medium text-muted-foreground">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={addManualItem}
                  className="flex-1 items-center rounded-lg bg-primary py-2.5"
                >
                  <Text className="text-sm font-semibold text-primary-foreground">Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowAddItem(true)}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3.5"
            >
              <Plus size={18} color={mutedColor} />
              <Text className="text-sm font-medium text-muted-foreground">Add Item Manually</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Bottom Confirm Bar */}
        <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-card px-5 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">
              {reviewItems.length} items
            </Text>
            <View className="flex-row items-center">
              <Text className="text-sm text-muted-foreground mr-1">Total:</Text>
              <Text className="text-2xl font-bold text-foreground">₹{total.toFixed(0)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={confirmOrder}
            disabled={saving || reviewItems.length === 0}
            className={`flex-row items-center justify-center gap-2 rounded-xl py-4 ${
              saving || reviewItems.length === 0 ? 'bg-muted' : 'bg-primary'
            }`}
          >
            {saving ? (
              <ActivityIndicator color={isDark ? '#0a0a0a' : '#fafafa'} />
            ) : (
              <>
                <Check size={20} color={isDark ? '#0a0a0a' : '#fafafa'} />
                <Text className="text-base font-semibold text-primary-foreground">
                  Confirm & Save Order
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
