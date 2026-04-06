import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getErrorMessage } from '@/lib/error';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Plus,
  Share2,
  Trash2,
  Undo2,
  UserPlus,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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
  items: Array<{
    _id: Id<'shared_list_items'>;
    name: string;
    quantity: number;
    unit: string;
    price: number;
    completed: boolean;
  }>;
  canConvertToOrder: boolean;
};

type OrderCategory = {
  _id: Id<'order_categories'>;
  name: string;
};

export default function SharedListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const listId = id as Id<'shared_lists'> | undefined;

  const detail = useQuery(api.sharedLists.getById, listId ? { id: listId } : 'skip') as
    | SharedListDetail
    | undefined;
  const categories = (useQuery(api.orderCategories.get) ?? []) as OrderCategory[];

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

  const [name, setName] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [unit, setUnit] = React.useState('unit');
  const [price, setPrice] = React.useState('0');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<Id<'order_categories'> | null>(
    null
  );
  const [editingItemId, setEditingItemId] = React.useState<Id<'shared_list_items'> | null>(null);
  const [completingItemId, setCompletingItemId] = React.useState<Id<'shared_list_items'> | null>(null);
  const [completionPrice, setCompletionPrice] = React.useState('0');
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  const resetItemForm = () => {
    setName('');
    setQuantity('1');
    setUnit('unit');
    setPrice('0');
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
        getErrorMessage(error, 'Please check the values and try again.')
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
        getErrorMessage(error, 'Please check the values and try again.')
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCompleted = async (item: SharedListDetail['items'][number]) => {
    if (!item.completed) {
      setCompletingItemId(item._id);
      setCompletionPrice(String(item.price));
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

    const parsedPrice = Number(completionPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Invalid price', 'Enter a valid non-negative price before ticking the item.');
      return;
    }

    setCompleting(true);
    try {
      await toggleItemCompletion({
        id: completingItemId,
        completed: true,
        price: parsedPrice,
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
      const invite = await createShareLink({ list_id: listId });
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

  const activeItems = detail?.items ?? [];
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
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
              <ArrowLeft size={22} color={iconColor} />
            </TouchableOpacity>
            <View>
              <Text className="text-foreground text-xl font-bold">
                {detail?.list.name ?? 'Shared List'}
              </Text>
              <Text className="text-muted-foreground text-xs">
                {isOwner ? 'Owner' : 'Editor'} · ₹{total.toFixed(0)}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1">
            {isOwner && (
              <TouchableOpacity
                onPress={() => setShowShareModal(true)}
                className="border-border bg-card rounded-full border p-2">
                <UserPlus size={16} color={iconColor} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              className="bg-primary rounded-full p-2">
              <Plus size={16} color={isDark ? '#0a0a0a' : '#fafafa'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
        {activeItems.length === 0 ? (
          <View className="border-border bg-card items-center rounded-2xl border border-dashed p-8">
            <CheckCircle2 size={30} color={mutedColor} />
            <Text className="text-muted-foreground mt-3 text-sm">
              No items yet. Add your first item.
            </Text>
          </View>
        ) : (
          activeItems.map((item) => (
            <View key={item._id} className="border-border bg-card mb-2 rounded-xl border p-4">
              <View className="flex-row items-center justify-between gap-3">
                <TouchableOpacity
                  onPress={() => toggleCompleted(item)}
                  className="flex-1">
                  <Text
                    className={`text-base font-semibold ${
                      item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}>
                    {item.name}
                  </Text>
                  <Text className="text-muted-foreground mt-0.5 text-xs">
                    {item.quantity} {item.unit} · ₹{item.price.toFixed(2)} each
                  </Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => toggleCompleted(item)}
                    className={`rounded-full px-2 py-1 ${item.completed ? 'bg-green-500/15' : 'bg-secondary'}`}>
                    <View className="flex-row items-center gap-1">
                      <Check size={12} color={item.completed ? '#22c55e' : mutedColor} />
                      <Text
                        className={`text-xs ${item.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {item.completed ? 'Done' : 'Open'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openEdit(item)}
                    className="border-border bg-background rounded-full border p-2">
                    <Copy size={14} color={iconColor} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteItem(item._id)}
                    className="rounded-full border border-red-500/30 bg-red-500/10 p-2">
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        {isOwner && (
          <TouchableOpacity
            disabled={!detail?.canConvertToOrder}
            onPress={() => setShowConvertModal(true)}
            className={`mt-4 rounded-xl py-3 ${detail?.canConvertToOrder ? 'bg-primary' : 'bg-secondary'}`}>
            <Text
              className={`text-center font-semibold ${
                detail?.canConvertToOrder ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}>
              {detail?.list.converted_order_id
                ? 'Already Converted'
                : detail?.canConvertToOrder
                  ? 'Convert to Order'
                  : 'Complete all items to convert'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onRestoreLastDeleted}
          className="border-border bg-card mt-3 flex-row items-center justify-center gap-2 rounded-xl border py-3">
          <Undo2 size={14} color={iconColor} />
          <Text className="text-foreground text-xs font-medium">
            Restore deleted item (next step)
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showAddModal || showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          resetItemForm();
        }}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetItemForm();
            }}
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-base font-semibold">
              {showEditModal ? 'Update Item' : 'Add Item'}
            </Text>
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
                className="bg-secondary flex-1 rounded-xl py-3">
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving}
                onPress={showEditModal ? submitEdit : submitAdd}
                className={`flex-1 rounded-xl py-3 ${saving ? 'bg-secondary' : 'bg-primary'}`}>
                <Text
                  className={`text-center font-semibold ${
                    saving ? 'text-muted-foreground' : 'text-primary-foreground'
                  }`}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCompleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCompleteModal(false);
          setCompletingItemId(null);
        }}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => {
              setShowCompleteModal(false);
              setCompletingItemId(null);
            }}
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-base font-semibold">Tick Item and Set Price</Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              Confirm the price paid for this item while marking it complete.
            </Text>
            <TextInput
              value={completionPrice}
              onChangeText={setCompletionPrice}
              keyboardType="decimal-pad"
              placeholder="Price"
              placeholderTextColor={mutedColor}
              className="border-border bg-card text-foreground mt-4 rounded-xl border px-3 py-3"
            />
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  setShowCompleteModal(false);
                  setCompletingItemId(null);
                }}
                className="bg-secondary flex-1 rounded-xl py-3">
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={completing}
                onPress={submitCompletionWithPrice}
                className={`flex-1 rounded-xl py-3 ${completing ? 'bg-secondary' : 'bg-primary'}`}>
                <Text
                  className={`text-center font-semibold ${
                    completing ? 'text-muted-foreground' : 'text-primary-foreground'
                  }`}>
                  {completing ? 'Saving...' : 'Complete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => setShowShareModal(false)}
          />
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
            <View className="mt-4 gap-2">
              <TouchableOpacity onPress={onShareWithEmail} className="bg-primary rounded-xl py-3">
                <Text className="text-primary-foreground text-center font-semibold">
                  Invite by Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onCreateShareLink}
                className="border-border bg-card flex-row items-center justify-center gap-2 rounded-xl border py-3">
                <Share2 size={14} color={iconColor} />
                <Text className="text-foreground font-semibold">Create Share Token</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showConvertModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConvertModal(false)}>
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
              contentContainerStyle={{ gap: 8, paddingTop: 14, paddingRight: 8 }}>
              {categories.map((category) => {
                const selected = selectedCategoryId === category._id;
                return (
                  <TouchableOpacity
                    key={category._id}
                    onPress={() => setSelectedCategoryId(category._id)}
                    className={`rounded-full border px-4 py-2 ${
                      selected ? 'border-primary bg-primary' : 'border-border bg-card'
                    }`}>
                    <Text
                      className={`text-xs font-medium ${
                        selected ? 'text-primary-foreground' : 'text-foreground'
                      }`}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowConvertModal(false)}
                className="bg-secondary flex-1 rounded-xl py-3">
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
