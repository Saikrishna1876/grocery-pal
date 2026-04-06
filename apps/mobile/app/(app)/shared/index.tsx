import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getErrorMessage } from '@/lib/error';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, Plus, Share2, Users } from 'lucide-react-native';
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

type SharedListSummary = {
  _id: Id<'shared_lists'>;
  name: string;
  notes?: string;
  role: 'owner' | 'editor';
  remainingItems: number;
  converted_order_id?: Id<'orders'>;
};

export default function SharedListsHubScreen() {
  const router = useRouter();
  const pushRoute = router.push as unknown as (href: string) => void;
  const openList = React.useCallback(
    (listId: string) => {
      pushRoute(['', 'shared', listId].join('/'));
    },
    [pushRoute]
  );
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const lists = (useQuery(api.sharedLists.get) ?? []) as SharedListSummary[];

  const createList = useMutation(api.sharedLists.create);
  const acceptInvite = useMutation(api.sharedLists.acceptInvite);

  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showJoinModal, setShowJoinModal] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [joining, setJoining] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newNotes, setNewNotes] = React.useState('');
  const [inviteToken, setInviteToken] = React.useState('');

  const iconColor = isDark ? '#e5e5e5' : '#171717';
  const mutedColor = isDark ? '#a3a3a3' : '#737373';

  const onCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Missing name', 'Enter a list name first.');
      return;
    }

    setCreating(true);
    try {
      const created = await createList({
        name: newName,
        notes: newNotes.trim() || undefined,
      });
      setShowCreateModal(false);
      setNewName('');
      setNewNotes('');

      if (created?._id) {
        openList(created._id);
      }
    } catch (error: unknown) {
      Alert.alert('Unable to create list', getErrorMessage(error, 'Try again in a moment.'));
    } finally {
      setCreating(false);
    }
  };

  const onJoinWithToken = async () => {
    const token = inviteToken.trim();
    if (!token) {
      Alert.alert('Missing token', 'Paste an invite token to join.');
      return;
    }

    setJoining(true);
    try {
      await acceptInvite({ token });
      setInviteToken('');
      setShowJoinModal(false);
      Alert.alert('Joined', 'You can now access the shared list.');
    } catch (error: unknown) {
      Alert.alert('Unable to join', getErrorMessage(error, 'The invite token is invalid.'));
    } finally {
      setJoining(false);
    }
  };

  const copyJoinTip = async () => {
    await Share.share({
      message:
        'Paste your invite token in Shared Lists -> Join with token. If you only have a link, copy its token value.',
    });
  };

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-5 pb-4 pt-14">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={() => router.back()} className="rounded-full p-1">
              <ArrowLeft size={22} color={iconColor} />
            </TouchableOpacity>
            <View>
              <Text className="text-foreground text-xl font-bold">Shared Lists</Text>
              <Text className="text-muted-foreground text-xs">
                Collaborate and convert to orders
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            className="bg-primary rounded-full px-3 py-2">
            <View className="flex-row items-center gap-1.5">
              <Plus size={14} color={isDark ? '#0a0a0a' : '#fafafa'} />
              <Text className="text-primary-foreground text-xs font-semibold">New</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="mb-3 flex-row gap-2">
          <TouchableOpacity
            onPress={() => setShowJoinModal(true)}
            className="border-border bg-card flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3">
            <Users size={16} color={iconColor} />
            <Text className="text-foreground text-sm font-semibold">Join with Token</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={copyJoinTip}
            className="border-border bg-card flex-row items-center justify-center gap-2 rounded-xl border px-4 py-3">
            <Share2 size={16} color={iconColor} />
            <Text className="text-foreground text-sm font-semibold">Help</Text>
          </TouchableOpacity>
        </View>

        {lists.length === 0 ? (
          <View className="border-border bg-card items-center rounded-2xl border border-dashed p-8">
            <Users size={36} color={mutedColor} />
            <Text className="text-foreground mt-3 text-base font-semibold">
              No shared lists yet
            </Text>
            <Text className="text-muted-foreground mt-1 text-center text-xs">
              Create one and invite people to collaboratively add, update, remove, and complete
              items.
            </Text>
          </View>
        ) : (
          lists.map((list) => {
            const done = list.remainingItems === 0;
            return (
              <TouchableOpacity
                key={list._id}
                onPress={() => openList(list._id)}
                className="border-border bg-card mb-2 rounded-xl border p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-semibold">{list.name}</Text>
                    <Text className="text-muted-foreground mt-0.5 text-xs">
                      {list.role === 'owner' ? 'Owner' : 'Editor'}
                      {list.notes ? ` · ${list.notes}` : ''}
                    </Text>
                  </View>
                  <View
                    className={`rounded-full px-2 py-1 ${done ? 'bg-green-500/15' : 'bg-secondary'}`}>
                    <Text
                      className={`text-xs font-medium ${done ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {done ? 'Ready' : `${list.remainingItems} left`}
                    </Text>
                  </View>
                </View>
                {done && (
                  <View className="mt-3 flex-row items-center gap-1.5">
                    <CheckCircle2 size={14} color="#22c55e" />
                    <Text className="text-xs text-green-500">
                      {list.converted_order_id
                        ? 'Converted to order'
                        : 'All items complete. Owner can convert to order.'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => setShowCreateModal(false)}
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-base font-semibold">Create Shared List</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="List name"
              placeholderTextColor={mutedColor}
              className="border-border bg-card text-foreground mt-4 rounded-xl border px-3 py-3"
            />
            <TextInput
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={mutedColor}
              className="border-border bg-card text-foreground mt-3 rounded-xl border px-3 py-3"
            />
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                className="bg-secondary flex-1 rounded-xl py-3">
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={creating}
                onPress={onCreate}
                className={`flex-1 rounded-xl py-3 ${creating ? 'bg-secondary' : 'bg-primary'}`}>
                <Text
                  className={`text-center font-semibold ${
                    creating ? 'text-muted-foreground' : 'text-primary-foreground'
                  }`}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}>
        <View className="flex-1 justify-end">
          <TouchableOpacity
            className="flex-1 bg-black/40"
            onPress={() => setShowJoinModal(false)}
          />
          <View className="border-border bg-background border-t px-5 pb-8 pt-5">
            <Text className="text-foreground text-base font-semibold">Join with Invite Token</Text>
            <Text className="text-muted-foreground mt-1 text-xs">
              Ask the owner for the invite token from their share link.
            </Text>
            <TextInput
              value={inviteToken}
              onChangeText={setInviteToken}
              placeholder="Paste invite token"
              placeholderTextColor={mutedColor}
              className="border-border bg-card text-foreground mt-4 rounded-xl border px-3 py-3"
              autoCapitalize="none"
            />
            <View className="mt-4 flex-row gap-2">
              <TouchableOpacity
                onPress={() => setShowJoinModal(false)}
                className="bg-secondary flex-1 rounded-xl py-3">
                <Text className="text-foreground text-center font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={joining}
                onPress={onJoinWithToken}
                className={`flex-1 rounded-xl py-3 ${joining ? 'bg-secondary' : 'bg-primary'}`}>
                <Text
                  className={`text-center font-semibold ${
                    joining ? 'text-muted-foreground' : 'text-primary-foreground'
                  }`}>
                  {joining ? 'Joining...' : 'Join'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
