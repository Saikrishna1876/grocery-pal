import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ArrowLeft, Pencil, Plus, Tags, Trash2 } from 'lucide-react-native';
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

type OrderCategory = Doc<'order_categories'> & {
  usageCount: number;
};

export default function OrderCategoriesScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const categories = (useQuery(api.orderCategories.get) ?? []) as OrderCategory[];
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
    } catch (error: any) {
      Alert.alert('Unable to add', error.message || 'Failed to add category.');
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
    } catch (error: any) {
      Alert.alert('Unable to update', error.message || 'Failed to update category.');
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
                } catch (error: any) {
                  Alert.alert('Unable to delete', error.message || 'Failed to delete category.');
                }
              },
            },
          ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingTop: 72, paddingBottom: 48 }}>
          <View className="mb-6 flex-row items-start gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="rounded-full border border-border p-2">
              <ArrowLeft size={18} color={iconColor} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">Order Categories</Text>
              <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                Manage the single category attached to every order. Historical analytics keeps the
                category snapshot saved on each order.
              </Text>
            </View>
          </View>

          <View className="mb-6 rounded-[28px] border border-border bg-card p-5">
            <View className="flex-row items-center gap-2">
              <Tags size={18} color={iconColor} />
              <Text className="text-sm font-semibold text-foreground">Add a custom category</Text>
            </View>
            <TextInput
              className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Birthday party, Trip crew, Visitors..."
              placeholderTextColor={isDark ? '#737373' : '#a3a3a3'}
            />
            <TouchableOpacity
              onPress={submitNewCategory}
              disabled={saving || !newCategoryName.trim()}
              className={`mt-4 flex-row items-center justify-center gap-2 rounded-2xl py-3 ${
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
          </View>

          {categories.map((category) => {
            const isEditing = editingId === category._id;
            const isProtected = Boolean(category.systemKey);

            return (
              <View
                key={category._id}
                className="mb-3 rounded-[24px] border border-border bg-card p-4">
                {isEditing ? (
                  <>
                    <TextInput
                      className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground"
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
                        className="flex-1 rounded-2xl border border-border py-3">
                        <Text className="text-center font-medium text-foreground">Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={saveCategoryEdit}
                        className="flex-1 rounded-2xl bg-primary py-3">
                        <Text className="text-center font-medium text-primary-foreground">
                          Save
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-base font-semibold text-foreground">
                            {category.name}
                          </Text>
                          {isProtected && (
                            <View className="rounded-full bg-secondary px-2 py-1">
                              <Text className="text-[11px] font-medium text-muted-foreground">
                                Default
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="mt-1 text-xs text-muted-foreground">
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
                            className="rounded-full border border-border p-2">
                            <Pencil size={15} color={iconColor} />
                          </TouchableOpacity>
                        )}
                        {!isProtected && (
                          <TouchableOpacity
                            onPress={() => confirmDelete(category)}
                            className="rounded-full border border-border p-2">
                            <Trash2 size={15} color="#ef4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {isProtected && (
                      <Text className="mt-3 text-xs leading-5 text-muted-foreground">
                        Default categories stay available at all times so saved orders always have a
                        stable home.
                      </Text>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
