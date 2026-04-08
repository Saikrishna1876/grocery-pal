import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Plus,
  Search,
  Share2,
  Trash2,
  Undo2,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText as Text } from '@/components/app-text';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useCachedQueryValue } from '@/lib/cached-query';
import { getErrorMessage } from '@/lib/error';
import { getScreenColorTokens } from '@/lib/screen-color-tokens';

type SharedListDetail = {
  list: {
    _id: Id<'shared_lists'>;
    name: string;
    notes?: string;
    owner_id: string;
    converted_order_id?: Id<'orders'>;
  };
  membership: {
    role: 'owner' | 'editor';
  };
  members: Array<{
    _id: Id<'shared_list_members'>;
    user_id: string;
    role: 'owner' | 'editor';
    created_at: number;
    user_name?: string;
    user_email?: string;
    user_image?: string;
    added_by_name?: string;
  }>;
  items: Array<{
    _id: Id<'shared_list_items'>;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    completed: boolean;
    created_at: number;
    created_by_name?: string;
    created_by_email?: string;
  }>;
  canConvertToOrder: boolean;
};

type OrderCategory = {
  _id: Id<'order_categories'>;
  name: string;
};

const SHARE_TOKEN_EXPIRY_OPTIONS = [3, 5, 10] as const;

export default function SharedListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const listId = id as Id<'shared_lists'> | undefined;

  const detailLiveResult = useQuery(api.sharedLists.getById, listId ? { id: listId } : 'skip');
  const categoriesLiveResult = useQuery(api.orderCategories.get);
  const productsLiveResult = useQuery(api.products.get);
  const detailState = useCachedQueryValue<SharedListDetail>({
    queryName: 'sharedLists.getById',
    args: listId ? { id: listId } : undefined,
    liveData: detailLiveResult as SharedListDetail | undefined,
    loaderDelayMs: 900,
  });
  const categoriesState = useCachedQueryValue<OrderCategory[]>({
    queryName: 'orderCategories.get',
    liveData: categoriesLiveResult as OrderCategory[] | undefined,
  });
  const productsState = useCachedQueryValue<Doc<'products'>[]>({
    queryName: 'products.get',
    liveData: productsLiveResult as Doc<'products'>[] | undefined,
  });
  const detail = detailState.data;
  const categories = categoriesState.data ?? [];
  const products = productsState.data ?? [];
  const showLoader = detailState.showLoader;
  const waitingForFirstLoad = detailState.isInitialLoading && !showLoader;

  const addItem = useMutation(api.sharedLists.addItem);
  const updateItem = useMutation(api.sharedLists.updateItem);
  const toggleItemCompletion = useMutation(api.sharedLists.toggleItemCompletion);
  const removeItem = useMutation(api.sharedLists.removeItem);
  const shareWithEmail = useMutation(api.sharedLists.shareWithEmail);
  const createShareLink = useMutation(api.sharedLists.createShareLink);
  const convertToOrder = useMutation(api.sharedLists.convertToOrder);

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [showConvertModal, setShowConvertModal] = React.useState(false);
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);
  const [showMembersModal, setShowMembersModal] = React.useState(false);

  const [name, setName] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [unit, setUnit] = React.useState('unit');
  const [price, setPrice] = React.useState('0');
  const [productSearchQuery, setProductSearchQuery] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [shareTokenDays, setShareTokenDays] =
    React.useState<(typeof SHARE_TOKEN_EXPIRY_OPTIONS)[number]>(3);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<Id<'order_categories'> | null>(
    null,
  );
  const [editingItemId, setEditingItemId] = React.useState<Id<'shared_list_items'> | null>(null);
  const [completingItemId, setCompletingItemId] = React.useState<Id<'shared_list_items'> | null>(
    null,
  );
  const [completionPrice, setCompletionPrice] = React.useState('0');
  const [completionQuantity, setCompletionQuantity] = React.useState('1');
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const { iconColor, mutedColor, selectedCardBg, selectedCardBorder, selectedLabelColor } =
    getScreenColorTokens(isDark);

  const resetItemForm = () => {
    setName('');
    setQuantity('1');
    setUnit('unit');
    setPrice('0');
    setProductSearchQuery('');
    setEditingItemId(null);
  };

  const parseItem = () => ({
    name,
    quantity: Number(quantity),
    unit,
    price: Number(price),
  });

  const openEdit = (item: SharedListDetail['items'][number]) => {
    setEditingItemId(item._id);
    setName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setPrice(String(item.price));
    setShowEditModal(true);
  };

  const submitAdd = async () => {
    if (!listId) {
      return;
    }

    setSaving(true);
    try {
      await addItem({ list_id: listId, item: parseItem() });
      setShowAddModal(false);
      resetItemForm();
    } catch (error: unknown) {
      Alert.alert(
        'Unable to add item',
        getErrorMessage(error, 'Please check the values and try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editingItemId) {
      return;
    }

    setSaving(true);
    try {
      await updateItem({ id: editingItemId, item: parseItem() });
      setShowEditModal(false);
      resetItemForm();
    } catch (error: unknown) {
      Alert.alert(
        'Unable to update item',
        getErrorMessage(error, 'Please check the values and try again.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleted = async (item: SharedListDetail['items'][number]) => {
    if (!item.completed) {
      setCompletingItemId(item._id);
      setCompletionPrice(String(item.price));
      setCompletionQuantity(String(item.quantity));
      setShowCompleteModal(true);
      return;
    }

    try {
      await toggleItemCompletion({ id: item._id, completed: false });
    } catch (error: unknown) {
      Alert.alert('Unable to update item', getErrorMessage(error, 'Try again in a moment.'));
    }
  };

  const submitCompletionWithPrice = async () => {
    if (!completingItemId) {
      return;
    }

    const parsedPrice = completionPrice.trim() ? Number(completionPrice) : undefined;
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      Alert.alert('Invalid price', 'Enter a valid non-negative price before ticking the item.');
      return;
    }

    const parsedQuantity = completionQuantity.trim() ? Number(completionQuantity) : undefined;
    if (parsedQuantity !== undefined && (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0)) {
      Alert.alert('Invalid quantity', 'Enter a valid quantity greater than zero.');
      return;
    }

    setCompleting(true);
    try {
      await toggleItemCompletion({
        id: completingItemId,
        completed: true,
        price: parsedPrice,
        quantity: parsedQuantity,
      });
      setShowCompleteModal(false);
      setCompletingItemId(null);
    } catch (error: unknown) {
      Alert.alert('Unable to update item', getErrorMessage(error, 'Try again in a moment.'));
    } finally {
      setCompleting(false);
    }
  };

  const deleteItem = async (itemId: Id<'shared_list_items'>) => {
    try {
      await removeItem({ id: itemId });
    } catch (error: unknown) {
      Alert.alert('Unable to remove item', getErrorMessage(error, 'Try again in a moment.'));
    }
  };

  const onShareWithEmail = async () => {
    if (!listId) {
      return;
    }

    const email = inviteEmail.trim();
    if (!email) {
      Alert.alert('Missing email', 'Enter an email address to invite.');
      return;
    }

    try {
      const invite = await shareWithEmail({ list_id: listId, email });
      const token = invite?.token ?? '';
      setInviteEmail('');
      setShowShareModal(false);
      if (!token) {
        Alert.alert('Invite created', 'Send the invite email and ask user to join with token.');
        return;
      }

      await Share.share({ message: `Join my Grocery Pal shared list with token: ${token}` });
    } catch (error: unknown) {
      Alert.alert('Unable to share list', getErrorMessage(error, 'Try again in a moment.'));
    }
  };

  const onCreateShareLink = async () => {
    if (!listId) {
      return;
    }

    try {
      const invite = await createShareLink({ list_id: listId, expires_in_days: shareTokenDays });
      const token = invite?.token ?? '';
      if (!token) {
        throw new Error('Invite token was not returned.');
      }

      await Share.share({
        message: `Join my Grocery Pal shared list with this token: ${token}`,
      });
      setShowShareModal(false);
    } catch (error: unknown) {
      Alert.alert('Unable to create link', getErrorMessage(error, 'Try again in a moment.'));
    }
  };

  const onConvert = async () => {
    if (!listId || !selectedCategoryId) {
      Alert.alert('Missing category', 'Select a category for the order.');
      return;
    }

    try {
      const result = await convertToOrder({
        list_id: listId,
        category_id: selectedCategoryId,
      });
      setShowConvertModal(false);
      Alert.alert('Converted', 'List converted to order successfully.', [
        {
          text: 'Open Month',
          onPress: () => {
            if (!result?.monthId) {
              return;
            }

            router.push({
              pathname: '/month/[id]',
              params: { id: result.monthId },
            });
          },
        },
        { text: 'Close', style: 'cancel' },
      ]);
    } catch (error: unknown) {
      Alert.alert('Unable to convert', getErrorMessage(error, 'Complete all items and try again.'));
    }
  };

  const onRestoreLastDeleted = async () => {
    Alert.alert('Coming soon', 'Item restore list will be added in the next iteration.');
  };

  const selectProductForAdd = (product: (typeof products)[number]) => {
    setName(product.name);
    setQuantity('1');
    setUnit(product.unit);
    setPrice(String(product.price));
    setProductSearchQuery('');
  };

  const filteredProducts = productSearchQuery.trim()
    ? products.filter((product) =>
        product.name.toLowerCase().includes(productSearchQuery.trim().toLowerCase()),
      )
    : [];

  const formatAddedAt = (timestamp: number) =>
    new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  const activeItems = detail?.items ?? [];
  const members = detail?.members ?? [];
  const total = activeItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const isOwner = detail?.membership.role === 'owner';

  React.useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0]?._id ?? null);
    }
  }, [categories, selectedCategoryId]);

  if (!listId) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Text className="text-muted-foreground">Missing list id.</Text>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="min-w-[220px] flex-1 flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
              <ArrowLeft size={22} color={iconColor} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text numberOfLines={2} className="text-foreground text-xl font-bold">
                {detail?.list.name ?? 'Shared List'}
              </Text>
              <Text numberOfLines={2} className="text-muted-foreground text-xs">
                {isOwner ? 'Owner' : 'Editor'} · ₹{total.toFixed(0)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowMembersModal(true)}
            className="border-border bg-card flex-row items-center gap-2 rounded-full border px-3 py-2"
          >
            <Users size={14} color={iconColor} />
            <Text className="text-foreground text-xs font-semibold">{members.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 196 }}>
        {showLoader ? (
          <ActivityIndicator size="large" className="mt-20" />
        ) : waitingForFirstLoad ? (
          <View className="mt-20" />
        ) : activeItems.length === 0 ? (
          <View className="border-border bg-card items-center rounded-2xl border border-dashed p-8">
            <CheckCircle2 size={30} color={mutedColor} />
            <Text className="text-muted-foreground mt-3 text-sm">
              No items yet. Add your first item.
            </Text>
          </View>
        ) : (
          activeItems.map((item) => (
            <View key={item._id} className="border-border bg-card mb-2 rounded-xl border p-4">
              <View className="flex-row items-start justify-between gap-3">
                <TouchableOpacity onPress={() => toggleCompleted(item)} className="flex-1">
                  <Text
                    numberOfLines={2}
                    className={`text-base font-semibold ${
                      item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {item.name}
                  </Text>
                  <Text numberOfLines={2} className="text-muted-foreground mt-0.5 text-xs">
                    {item.quantity} {item.unit} · ₹{item.price.toFixed(2)} each
                  </Text>
                  <Text numberOfLines={1} className="text-muted-foreground mt-0.5 text-[11px]">
                    Added by {item.created_by_name || item.created_by_email || 'Unknown user'}{' '}
                    {' • '}
                    {formatAddedAt(item.created_at)}
                  </Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => toggleCompleted(item)}
                    className={`rounded-full px-2 py-1 ${item.completed ? 'bg-green-500/15' : 'bg-secondary'}`}
                  >
                    <View className="flex-row items-center gap-1">
                      <Check size={12} color={item.completed ? '#22c55e' : mutedColor} />
                      <Text
                        className={`text-xs ${item.completed ? 'text-green-500' : 'text-muted-foreground'}`}
                      >
                        {item.completed ? 'Done' : 'Open'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openEdit(item)}
                    className="border-border bg-background rounded-full border p-2"
                  >
                    <Copy size={14} color={iconColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteItem(item._id)}
                    className="rounded-full border border-red-500/30 bg-red-500/10 p-2"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity
          onPress={onRestoreLastDeleted}
          className="border-border bg-card mt-3 flex-row items-center justify-center gap-2 rounded-xl border py-3"
        >
          <Undo2 size={14} color={iconColor} />
          <Text className="text-foreground text-xs font-medium">
            Restore deleted item (next step)
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View className="border-border bg-background border-t px-5 pb-8 pt-3">
        <View className="flex-row flex-wrap gap-3">
          {isOwner && (
            <TouchableOpacity
              onPress={() => setShowShareModal(true)}
              className="border-border bg-card min-w-[100px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3.5"
            >
              <UserPlus size={16} color={iconColor} />
              <Text className="text-foreground text-sm font-semibold">Share</Text>
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity
              disabled={!detail?.canConvertToOrder}
              onPress={() => setShowConvertModal(true)}
              className={`min-w-[120px] flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
                detail?.canConvertToOrder ? 'bg-primary' : 'bg-secondary'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  detail?.canConvertToOrder ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {detail?.list.converted_order_id
                  ? 'Converted'
                  : detail?.canConvertToOrder
                    ? 'Convert'
                    : 'Complete Items'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            className="border-border bg-card min-w-[100px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border py-3.5"
          >
            <Plus size={16} color={iconColor} />
            <Text className="text-foreground text-sm font-semibold">Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showAddModal || showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          resetItemForm();
        }}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetItemForm();
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="w-full"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8 }}
            >
              <View className="border-border bg-background border-t px-5 pb-8 pt-5">
                <Text className="text-foreground text-base font-semibold">
                  {showEditModal ? 'Update Item' : 'Add Item'}
                </Text>
                {!showEditModal && (
                  <>
                    <View className="border-border bg-card mt-4 rounded-xl border px-3 py-2.5">
                      <View className="flex-row items-center gap-2">
                        <Search size={16} color={mutedColor} />
                        <TextInput
                          value={productSearchQuery}
                          onChangeText={setProductSearchQuery}
                          placeholder="Search existing items"
                          placeholderTextColor={mutedColor}
                          className="text-foreground flex-1 text-sm"
                        />
                      </View>
                    </View>

                    {filteredProducts.length > 0 && (
                      <View className="border-border bg-card mt-2 max-h-44 rounded-xl border">
                        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {filteredProducts.slice(0, 8).map((product) => (
                            <TouchableOpacity
                              key={product._id}
                              onPress={() => selectProductForAdd(product)}
                              className="border-border border-b px-3 py-3 last:border-b-0"
                            >
                              <Text className="text-foreground text-sm font-medium">
                                {product.name}
                              </Text>
                              <Text className="text-muted-foreground text-xs">
                                {product.category} · {product.unit} · ₹{product.price}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Name"
                  placeholderTextColor={mutedColor}
                  className="border-border bg-card text-foreground mt-4 rounded-xl border px-3 py-3"
                />
                <View className="mt-3 flex-row gap-2">
                  <TextInput
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="decimal-pad"
                    placeholder="Qty"
                    placeholderTextColor={mutedColor}
                    className="border-border bg-card text-foreground flex-1 rounded-xl border px-3 py-3"
                  />
                  <TextInput
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="Unit"
                    placeholderTextColor={mutedColor}
                    className="border-border bg-card text-foreground flex-1 rounded-xl border px-3 py-3"
                  />
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="Price"
                    placeholderTextColor={mutedColor}
                    className="border-border bg-card text-foreground flex-1 rounded-xl border px-3 py-3"
                  />
                </View>
                <View className="mt-4 flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      resetItemForm();
                    }}
                    className="bg-secondary flex-1 rounded-xl py-3"
                  >
                    <Text className="text-foreground text-center font-medium">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={saving}
                    onPress={showEditModal ? submitEdit : submitAdd}
                    className={`flex-1 rounded-xl py-3 ${saving ? 'bg-secondary' : 'bg-primary'}`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        saving ? 'text-muted-foreground' : 'text-primary-foreground'
                      }`}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showCompleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCompleteModal(false);
          setCompletingItemId(null);
        }}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => {
              setShowCompleteModal(false);
              setCompletingItemId(null);
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="w-full"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8 }}
            >
              <View className="border-border bg-background border-t px-5 pb-8 pt-5">
                <Text className="text-foreground text-base font-semibold">
                  Tick Item and Set Price
                </Text>
                <Text className="text-muted-foreground mt-1 text-xs">
                  Quantity and price are prefilled from the item. Edit either one if needed.
                </Text>
                <View className="mt-4 flex-row gap-2">
                  <TextInput
                    value={completionQuantity}
                    onChangeText={setCompletionQuantity}
                    keyboardType="decimal-pad"
                    placeholder="Quantity"
                    placeholderTextColor={mutedColor}
                    className="border-border bg-card text-foreground flex-1 rounded-xl border px-3 py-3"
                  />
                  <TextInput
                    value={completionPrice}
                    onChangeText={setCompletionPrice}
                    keyboardType="decimal-pad"
                    placeholder="Price"
                    placeholderTextColor={mutedColor}
                    className="border-border bg-card text-foreground flex-1 rounded-xl border px-3 py-3"
                  />
                </View>
                <View className="mt-4 flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setShowCompleteModal(false);
                      setCompletingItemId(null);
                    }}
                    className="bg-secondary flex-1 rounded-xl py-3"
                  >
                    <Text className="text-foreground text-center font-medium">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={completing}
                    onPress={submitCompletionWithPrice}
                    className={`flex-1 rounded-xl py-3 ${completing ? 'bg-secondary' : 'bg-primary'}`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        completing ? 'text-muted-foreground' : 'text-primary-foreground'
                      }`}
                    >
                      {completing ? 'Saving...' : 'Complete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showMembersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMembersModal(false)}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => setShowMembersModal(false)}
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-base font-semibold">List Members</Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              Everyone currently in this shared list.
            </Text>

            <ScrollView className="mt-4 max-h-72">
              <View className="gap-2">
                {members.map((member) => (
                  <View
                    key={member._id}
                    className="border-border bg-card flex-row items-center justify-between rounded-xl border px-3 py-3"
                  >
                    <View className="mr-3 flex-1">
                      <Text className="text-foreground text-sm font-semibold">
                        {member.user_name || member.user_email || 'Unknown user'}
                      </Text>
                      <Text className="text-muted-foreground mt-0.5 text-xs">
                        {member.user_email || 'No email available'}
                      </Text>
                    </View>
                    <View
                      style={
                        member.role === 'owner'
                          ? { backgroundColor: selectedCardBg, borderColor: selectedCardBorder }
                          : undefined
                      }
                      className={`rounded-full border px-3 py-1.5 ${
                        member.role === 'owner' ? 'border-primary bg-card' : 'border-border bg-card'
                      }`}
                    >
                      <Text
                        style={member.role === 'owner' ? { color: selectedLabelColor } : undefined}
                        className="text-foreground text-xs font-semibold"
                      >
                        {member.role === 'owner' ? 'Owner' : 'Editor'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowMembersModal(false)}
              className="bg-primary mt-4 rounded-xl py-3"
            >
              <Text className="text-primary-foreground text-center font-semibold">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => setShowShareModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="w-full"
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8 }}
            >
              <View className="border-border bg-background border-t px-5 pb-8 pt-5">
                <Text className="text-foreground text-base font-semibold">Share List</Text>
                <TextInput
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  placeholder="Invite by email"
                  placeholderTextColor={mutedColor}
                  autoCapitalize="none"
                  className="border-border bg-card text-foreground mt-4 rounded-xl border px-3 py-3"
                />
                <Text className="text-muted-foreground mt-4 text-xs">Share token expiry</Text>
                <View className="mt-2 flex-row gap-2">
                  {SHARE_TOKEN_EXPIRY_OPTIONS.map((days) => {
                    const selected = shareTokenDays === days;

                    return (
                      <TouchableOpacity
                        key={days}
                        onPress={() => setShareTokenDays(days)}
                        activeOpacity={0.9}
                        style={
                          selected
                            ? { backgroundColor: selectedCardBg, borderColor: selectedCardBorder }
                            : undefined
                        }
                        className={`rounded-full border px-4 py-2 ${
                          selected ? 'border-primary bg-card' : 'border-border bg-card'
                        }`}
                      >
                        <Text
                          style={selected ? { color: selectedLabelColor } : undefined}
                          className="text-foreground text-xs font-semibold"
                        >
                          {days} days
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="mt-4 gap-2">
                  <TouchableOpacity
                    onPress={onShareWithEmail}
                    className="bg-primary rounded-xl py-3"
                  >
                    <Text className="text-primary-foreground text-center font-semibold">
                      Invite by Email
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onCreateShareLink}
                    className="border-border bg-card flex-row items-center justify-center gap-2 rounded-xl border py-3"
                  >
                    <Share2 size={14} color={iconColor} />
                    <Text className="text-foreground font-semibold">Create Share Token</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showConvertModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConvertModal(false)}
      >
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => setShowConvertModal(false)}
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-base font-semibold">Convert to Order</Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              Current month is auto-selected. Choose category for the created order.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 14, paddingRight: 8 }}
            >
              {categories.map((category) => {
                const selected = selectedCategoryId === category._id;
                return (
                  <TouchableOpacity
                    key={category._id}
                    onPress={() => setSelectedCategoryId(category._id)}
                    activeOpacity={0.9}
                    style={
                      selected
                        ? { backgroundColor: selectedCardBg, borderColor: selectedCardBorder }
                        : undefined
                    }
                    className={`rounded-full border px-4 py-2 ${
                      selected ? 'border-primary bg-card' : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      style={selected ? { color: selectedLabelColor } : undefined}
                      className="text-foreground text-xs font-medium"
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowConvertModal(false)}
                className="bg-secondary flex-1 rounded-xl py-3"
              >
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onConvert} className="bg-primary flex-1 rounded-xl py-3">
                <Text className="text-primary-foreground text-center font-semibold">Convert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
