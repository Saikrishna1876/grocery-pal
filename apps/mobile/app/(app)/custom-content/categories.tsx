import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useCachedQueryValue } from '@/lib/cached-query';
import { getErrorMessage } from '@/lib/error';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react-native';
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

type OrderCategory = Doc<'order_categories'> & {
  usageCount: number;
};

export default function OrderCategoriesScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const categoriesLiveResult = useQuery(api.orderCategories.get);
  const categoriesState = useCachedQueryValue<OrderCategory[]>({
    queryName: 'orderCategories.get',
    liveData: categoriesLiveResult as OrderCategory[] | undefined,
    loaderDelayMs: 900,
  });
  const categories = categoriesState.data ?? [];
  const showLoader = categoriesState.showLoader;
  const waitingForFirstLoad = categoriesState.isInitialLoading && !showLoader;
  const addCategory = useMutation(api.orderCategories.add);
  const updateCategory = useMutation(api.orderCategories.update);
  const removeCategory = useMutation(api.orderCategories.remove);

  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingId, setEditingId] = React.useState<Id<'order_categories'> | null>(null);
  const [editingName, setEditingName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const iconColor = isDark ? '#e5e5e5' : '#171717';

  const submitNewCategory = async () => {
    if (!newCategoryName.trim() || saving) {
      return;
    }

    setSaving(true);
    try {
      await addCategory({ name: newCategoryName });
      setNewCategoryName('');
    } catch (error: unknown) {
      Alert.alert('Unable to add', getErrorMessage(error, 'Failed to add category.'));
    } finally {
      setSaving(false);
    }
  };

  const saveCategoryEdit = async () => {
    if (!editingId || !editingName.trim() || saving) {
      return;
    }

    setSaving(true);
    try {
      await updateCategory({ id: editingId, name: editingName });
      setEditingId(null);
      setEditingName('');
    } catch (error: unknown) {
      Alert.alert('Unable to update', getErrorMessage(error, 'Failed to update category.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (category: OrderCategory) => {
    Alert.alert(
      'Delete Category',
      category.usageCount > 0
        ? 'This category is already used by saved orders and cannot be deleted.'
        : `Delete ${category.name}?`,
      category.usageCount > 0
        ? [{ text: 'OK' }]
        : [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await removeCategory({ id: category._id });
                } catch (error: unknown) {
                  Alert.alert(
                    'Unable to delete',
                    getErrorMessage(error, 'Failed to delete category.')
                  );
                }
              },
            },
          ]
    );
  };

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={10}
            className="rounded-full p-1">
            <ArrowLeft size={22} color={iconColor} />
          </TouchableOpacity>
          <View>
            <Text className="text-foreground text-xl font-bold">Order Categories</Text>
            <Text className="text-muted-foreground text-xs">Manage labels for each order</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
          <Text className="text-foreground mb-3 text-lg font-semibold">Add Category</Text>

          <View className="border-border bg-card mb-3 rounded-xl border px-3 py-2">
            <TextInput
              className="text-foreground py-1 text-sm"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Birthday party, Trip crew, Visitors..."
              placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
            />
          </View>

          <TouchableOpacity
            onPress={submitNewCategory}
            disabled={saving || !newCategoryName.trim()}
            className={`mb-6 flex-row items-center justify-center gap-2 rounded-xl py-3.5 ${
              saving || !newCategoryName.trim() ? 'bg-muted' : 'bg-primary'
            }`}>
            <Plus size={16} color={isDark ? '#0a0a0a' : '#fafafa'} />
            <Text
              className={`font-semibold ${
                saving || !newCategoryName.trim()
                  ? 'text-muted-foreground'
                  : 'text-primary-foreground'
              }`}>
              {saving ? 'Saving...' : 'Add Category'}
            </Text>
          </TouchableOpacity>

          <Text className="text-foreground mb-3 text-lg font-semibold">Categories</Text>

          {showLoader ? (
            <ActivityIndicator size="large" className="mt-8" />
          ) : waitingForFirstLoad ? (
            <View className="mt-8" />
          ) : (
            categories.map((category) => {
              const isEditing = editingId === category._id;
              const isProtected = Boolean(category.systemKey);

              return (
                <View
                  key={category._id}
                  className="border-border bg-card mb-2 rounded-xl border p-4">
                  {isEditing ? (
                    <>
                      <TextInput
                        className="border-border bg-background text-foreground rounded-xl border px-3 py-2 text-sm"
                        value={editingName}
                        onChangeText={setEditingName}
                        placeholder="Category name"
                        placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
                      />
                      <View className="mt-3 flex-row gap-3">
                        <TouchableOpacity
                          onPress={() => {
                            setEditingId(null);
                            setEditingName('');
                          }}
                          className="border-border flex-1 rounded-xl border py-3">
                          <Text className="text-foreground text-center font-medium">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={saveCategoryEdit}
                          disabled={saving || !editingName.trim()}
                          className={`flex-1 rounded-xl py-3 ${
                            saving || !editingName.trim() ? 'bg-muted' : 'bg-primary'
                          }`}>
                          <Text
                            className={`text-center font-medium ${
                              saving || !editingName.trim()
                                ? 'text-muted-foreground'
                                : 'text-primary-foreground'
                            }`}>
                            {saving ? 'Saving...' : 'Save'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text className="text-foreground text-base font-semibold">
                              {category.name}
                            </Text>
                            {isProtected && (
                              <View className="bg-secondary rounded-full px-2 py-1">
                                <Text className="text-muted-foreground text-[11px] font-medium">
                                  Default
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-muted-foreground mt-1 text-xs">
                            {category.usageCount} {category.usageCount === 1 ? 'order' : 'orders'}{' '}
                            linked
                          </Text>
                        </View>

                        <View className="flex-row items-center gap-2">
                          {!isProtected && (
                            <TouchableOpacity
                              onPress={() => {
                                setEditingId(category._id);
                                setEditingName(category.name);
                              }}
                              className="border-border rounded-full border p-2">
                              <Pencil size={15} color={iconColor} />
                            </TouchableOpacity>
                          )}
                          {!isProtected && (
                            <TouchableOpacity
                              onPress={() => confirmDelete(category)}
                              className="border-border rounded-full border p-2">
                              <Trash2 size={15} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {isProtected && (
                        <Text className="text-muted-foreground mt-3 text-xs leading-5">
                          Default categories stay available at all times so saved orders always have
                          a stable home.
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
