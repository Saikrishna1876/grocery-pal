import { ConvexError, v } from 'convex/values';

import { components } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireCurrentUser } from './auth';
import { ensureDefaultOrderCategories } from './orderCategories';

type ReaderCtx = Pick<QueryCtx, 'db'>;
type WriterCtx = Pick<MutationCtx, 'db'>;
type AuthFunctionCtx = Parameters<typeof requireCurrentUser>[0];

type MemberRole = 'owner' | 'editor';

const COLLAB_ITEM_VALIDATOR = v.object({
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
  price: v.number(),
});

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function buildInviteToken() {
  return crypto.randomUUID();
}

function validateCollaborativeItem(item: { quantity: number; price: number }) {
  if (item.quantity <= 0) {
    throw new ConvexError('Item quantity must be greater than zero.');
  }

  if (item.price < 0) {
    throw new ConvexError('Item price cannot be negative.');
  }
}

async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  return requireCurrentUser(ctx as unknown as AuthFunctionCtx);
}

async function getListById(ctx: ReaderCtx, listId: Id<'shared_lists'>) {
  const list = await ctx.db.get(listId);
  if (!list || list.deleted_at) {
    throw new ConvexError('Shared list not found.');
  }

  return list;
}

async function getMembership(ctx: ReaderCtx, listId: Id<'shared_lists'>, userId: string) {
  return ctx.db
    .query('shared_list_members')
    .withIndex('by_list_user', (q) => q.eq('list_id', listId).eq('user_id', userId))
    .unique();
}

async function requireMemberAccess(ctx: ReaderCtx, listId: Id<'shared_lists'>, userId: string) {
  const membership = await getMembership(ctx, listId, userId);
  if (!membership) {
    throw new ConvexError('Access denied.');
  }

  return membership;
}

async function requireOwnerAccess(ctx: ReaderCtx, listId: Id<'shared_lists'>, userId: string) {
  const membership = await requireMemberAccess(ctx, listId, userId);
  if (membership.role !== 'owner') {
    throw new ConvexError('Only the owner can perform this action.');
  }

  return membership;
}

async function upsertMember(
  ctx: WriterCtx,
  listId: Id<'shared_lists'>,
  userId: string,
  addedBy: string,
  role: MemberRole
) {
  const existing = await getMembership(ctx, listId, userId);
  if (existing) {
    if (existing.role !== role) {
      await ctx.db.patch(existing._id, { role });
      return (await ctx.db.get(existing._id)) ?? existing;
    }

    return existing;
  }

  const memberId = await ctx.db.insert('shared_list_members', {
    list_id: listId,
    user_id: userId,
    role,
    added_by: addedBy,
    created_at: Date.now(),
  });

  return ctx.db.get(memberId);
}

async function writeActivity(
  ctx: WriterCtx,
  listId: Id<'shared_lists'>,
  actorUserId: string,
  eventType: string,
  metadata?: string,
  itemId?: Id<'shared_list_items'>
) {
  await ctx.db.insert('shared_list_activity_events', {
    list_id: listId,
    actor_user_id: actorUserId,
    event_type: eventType,
    item_id: itemId,
    metadata,
    created_at: Date.now(),
  });
}

async function touchList(ctx: WriterCtx, listId: Id<'shared_lists'>) {
  await ctx.db.patch(listId, { updated_at: Date.now() });
}

async function getOrCreateCurrentMonth(ctx: WriterCtx, userId: string) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const existing = await ctx.db
    .query('months')
    .withIndex('by_user_year_month', (q) =>
      q.eq('userId', userId).eq('year', year).eq('month', month)
    )
    .unique();

  if (existing) {
    return existing;
  }

  const monthId = await ctx.db.insert('months', {
    userId,
    year,
    month,
  });

  const created = await ctx.db.get(monthId);
  if (!created) {
    throw new ConvexError('Unable to create month.');
  }

  return created;
}

type UserSummary = {
  name: string;
  email?: string;
  image?: string;
};

type BetterAuthUserRecord = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

function extractBetterAuthUserRecord(value: unknown): BetterAuthUserRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : null;
  const email = typeof record.email === 'string' ? record.email : null;
  const image = typeof record.image === 'string' ? record.image : null;

  return { name, email, image };
}

async function resolveUserSummary(ctx: QueryCtx, userId: string) {
  const deriveFallbackName = (email?: string) => {
    const emailPrefix = typeof email === 'string' ? email.split('@')[0] : undefined;
    return emailPrefix || 'Unknown user';
  };

  const byComponentId = extractBetterAuthUserRecord(
    await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', operator: 'eq', value: userId }],
    })
  );

  if (byComponentId) {
    const fallbackName = deriveFallbackName(byComponentId.email ?? undefined);
    return {
      name: byComponentId.name || fallbackName,
      email: byComponentId.email || undefined,
      image: byComponentId.image || undefined,
    } satisfies UserSummary;
  }

  const byComponentUserId = extractBetterAuthUserRecord(
    await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: 'userId', operator: 'eq', value: userId }],
    })
  );

  if (byComponentUserId) {
    const fallbackName = deriveFallbackName(byComponentUserId.email ?? undefined);
    return {
      name: byComponentUserId.name || fallbackName,
      email: byComponentUserId.email || undefined,
      image: byComponentUserId.image || undefined,
    } satisfies UserSummary;
  }

  const normalizedUserId = ctx.db.normalizeId('user', userId);
  if (normalizedUserId) {
    const byId = await ctx.db.get(normalizedUserId);
    if (byId) {
      const fallbackName = deriveFallbackName(byId.email);
      return {
        name: byId.name || fallbackName,
        email: byId.email || undefined,
        image: byId.image || undefined,
      } satisfies UserSummary;
    }
  }

  const byUserId = await ctx.db
    .query('user')
    .withIndex('userId', (q) => q.eq('userId', userId))
    .unique();

  if (!byUserId) {
    return {
      name: 'Unknown user',
    } satisfies UserSummary;
  }

  const fallbackName = deriveFallbackName(byUserId.email);
  return {
    name: byUserId.name || fallbackName,
    email: byUserId.email || undefined,
    image: byUserId.image || undefined,
  } satisfies UserSummary;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    const memberships = await ctx.db
      .query('shared_list_members')
      .withIndex('by_user_id', (q) => q.eq('user_id', user._id))
      .collect();

    const results: Array<Doc<'shared_lists'> & { role: MemberRole; remainingItems: number }> = [];

    for (const membership of memberships) {
      const list = await ctx.db.get(membership.list_id);
      if (!list || list.deleted_at) {
        continue;
      }

      const items = await ctx.db
        .query('shared_list_items')
        .withIndex('by_list_id', (q) => q.eq('list_id', list._id))
        .collect();
      const remainingItems = items.filter((item) => !item.deleted_at && !item.completed).length;

      results.push({
        ...list,
        role: membership.role,
        remainingItems,
      });
    }

    return results.sort((a, b) => b.updated_at - a.updated_at);
  },
});

export const getById = query({
  args: {
    id: v.id('shared_lists'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.id);
    const membership = await requireMemberAccess(ctx, list._id, user._id);

    const members = await ctx.db
      .query('shared_list_members')
      .withIndex('by_list_id', (q) => q.eq('list_id', list._id))
      .collect();
    const items = await ctx.db
      .query('shared_list_items')
      .withIndex('by_list_id', (q) => q.eq('list_id', list._id))
      .collect();
    const activity = await ctx.db
      .query('shared_list_activity_events')
      .withIndex('by_list_created_at', (q) => q.eq('list_id', list._id))
      .collect();

    const userSummaryCache = new Map<string, UserSummary>();
    const getUserSummary = async (userId: string) => {
      const cached = userSummaryCache.get(userId);
      if (cached) {
        return cached;
      }

      const resolved = await resolveUserSummary(ctx, userId);
      userSummaryCache.set(userId, resolved);
      return resolved;
    };

    const enrichedMembers = await Promise.all(
      members.map(async (member) => {
        const memberUser = await getUserSummary(member.user_id);
        const addedByUser = await getUserSummary(member.added_by);

        return {
          ...member,
          user_name: memberUser.name,
          user_email: memberUser.email,
          user_image: memberUser.image,
          added_by_name: addedByUser.name,
        };
      })
    );

    const activeItems = items.filter((item) => !item.deleted_at);
    const enrichedItems = await Promise.all(
      activeItems.map(async (item) => {
        const creator = await getUserSummary(item.created_by);
        return {
          ...item,
          created_by_name: creator.name,
          created_by_email: creator.email,
          created_by_image: creator.image,
        };
      })
    );

    return {
      list,
      membership,
      members: enrichedMembers,
      items: enrichedItems.sort((a, b) => a.created_at - b.created_at),
      canConvertToOrder:
        membership.role === 'owner' &&
        !list.converted_order_id &&
        activeItems.length > 0 &&
        activeItems.every((item) => item.completed),
      activity: activity.sort((a, b) => b.created_at - a.created_at),
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const name = normalizeName(args.name);

    if (!name) {
      throw new ConvexError('List name is required.');
    }

    const now = Date.now();
    const listId = await ctx.db.insert('shared_lists', {
      owner_id: user._id,
      name,
      notes: args.notes?.trim() || undefined,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert('shared_list_members', {
      list_id: listId,
      user_id: user._id,
      role: 'owner',
      added_by: user._id,
      created_at: now,
    });

    await writeActivity(ctx, listId, user._id, 'list_created');

    return ctx.db.get(listId);
  },
});

export const update = mutation({
  args: {
    id: v.id('shared_lists'),
    name: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.id);
    await requireMemberAccess(ctx, list._id, user._id);

    const name = normalizeName(args.name);
    if (!name) {
      throw new ConvexError('List name is required.');
    }

    await ctx.db.patch(list._id, {
      name,
      notes: args.notes?.trim() || undefined,
      updated_at: Date.now(),
    });

    await writeActivity(ctx, list._id, user._id, 'list_updated');

    return ctx.db.get(list._id);
  },
});

export const archive = mutation({
  args: {
    id: v.id('shared_lists'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.id);
    await requireOwnerAccess(ctx, list._id, user._id);

    await ctx.db.patch(list._id, {
      deleted_at: Date.now(),
      updated_at: Date.now(),
    });

    await writeActivity(ctx, list._id, user._id, 'list_archived');

    return { success: true };
  },
});

export const restore = mutation({
  args: {
    id: v.id('shared_lists'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await ctx.db.get(args.id);
    if (!list) {
      throw new ConvexError('Shared list not found.');
    }

    await requireOwnerAccess(ctx, list._id, user._id);

    await ctx.db.patch(list._id, {
      deleted_at: undefined,
      updated_at: Date.now(),
    });

    await writeActivity(ctx, list._id, user._id, 'list_restored');

    return ctx.db.get(list._id);
  },
});

export const addItem = mutation({
  args: {
    list_id: v.id('shared_lists'),
    item: COLLAB_ITEM_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.list_id);
    await requireMemberAccess(ctx, list._id, user._id);

    const name = normalizeName(args.item.name);
    if (!name) {
      throw new ConvexError('Item name is required.');
    }
    validateCollaborativeItem(args.item);

    const now = Date.now();
    const itemId = await ctx.db.insert('shared_list_items', {
      list_id: list._id,
      name,
      quantity: args.item.quantity,
      unit: normalizeName(args.item.unit) || 'unit',
      price: args.item.price,
      completed: false,
      created_by: user._id,
      updated_by: user._id,
      created_at: now,
      updated_at: now,
    });

    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'item_added', name, itemId);

    return ctx.db.get(itemId);
  },
});

export const updateItem = mutation({
  args: {
    id: v.id('shared_list_items'),
    item: COLLAB_ITEM_VALIDATOR,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.deleted_at) {
      throw new ConvexError('List item not found.');
    }

    const list = await getListById(ctx, item.list_id);
    await requireMemberAccess(ctx, list._id, user._id);

    const name = normalizeName(args.item.name);
    if (!name) {
      throw new ConvexError('Item name is required.');
    }
    validateCollaborativeItem(args.item);

    const unit = normalizeName(args.item.unit) || 'unit';

    await ctx.db.patch(item._id, {
      name,
      quantity: args.item.quantity,
      unit,
      price: args.item.price,
      updated_by: user._id,
      updated_at: Date.now(),
    });

    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'item_updated', name, item._id);

    return ctx.db.get(item._id);
  },
});

export const toggleItemCompletion = mutation({
  args: {
    id: v.id('shared_list_items'),
    completed: v.boolean(),
    price: v.optional(v.number()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.deleted_at) {
      throw new ConvexError('List item not found.');
    }

    const list = await getListById(ctx, item.list_id);
    await requireMemberAccess(ctx, list._id, user._id);

    if (args.price !== undefined && args.price < 0) {
      throw new ConvexError('Item price cannot be negative.');
    }

    if (args.quantity !== undefined && args.quantity <= 0) {
      throw new ConvexError('Item quantity must be greater than zero.');
    }

    const patch: {
      completed: boolean;
      completed_at?: number;
      updated_by: string;
      updated_at: number;
      price?: number;
      quantity?: number;
    } = {
      completed: args.completed,
      completed_at: args.completed ? Date.now() : undefined,
      updated_by: user._id,
      updated_at: Date.now(),
    };

    if (args.price !== undefined) {
      patch.price = args.price;
    }

    if (args.quantity !== undefined) {
      patch.quantity = args.quantity;
    }

    await ctx.db.patch(item._id, patch);

    await touchList(ctx, list._id);
    await writeActivity(
      ctx,
      list._id,
      user._id,
      args.completed ? 'item_completed' : 'item_reopened',
      item.name,
      item._id
    );

    return ctx.db.get(item._id);
  },
});

export const removeItem = mutation({
  args: {
    id: v.id('shared_list_items'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.deleted_at) {
      throw new ConvexError('List item not found.');
    }

    const list = await getListById(ctx, item.list_id);
    await requireMemberAccess(ctx, list._id, user._id);

    await ctx.db.patch(item._id, {
      deleted_at: Date.now(),
      deleted_by: user._id,
      updated_by: user._id,
      updated_at: Date.now(),
    });

    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'item_deleted', item.name, item._id);

    return { success: true };
  },
});

export const restoreItem = mutation({
  args: {
    id: v.id('shared_list_items'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new ConvexError('List item not found.');
    }

    const list = await getListById(ctx, item.list_id);
    await requireMemberAccess(ctx, list._id, user._id);

    await ctx.db.patch(item._id, {
      deleted_at: undefined,
      deleted_by: undefined,
      updated_by: user._id,
      updated_at: Date.now(),
    });

    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'item_restored', item.name, item._id);

    return ctx.db.get(item._id);
  },
});

export const shareWithEmail = mutation({
  args: {
    list_id: v.id('shared_lists'),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.list_id);
    await requireOwnerAccess(ctx, list._id, user._id);

    const email = args.email.trim().toLowerCase();
    if (!email) {
      throw new ConvexError('Email is required.');
    }

    const inviteId = await ctx.db.insert('shared_list_invites', {
      list_id: list._id,
      email,
      token: buildInviteToken(),
      is_multi_use: false,
      created_by: user._id,
      created_at: Date.now(),
      expires_at: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'invite_created', email);

    return ctx.db.get(inviteId);
  },
});

export const createShareLink = mutation({
  args: {
    list_id: v.id('shared_lists'),
    expires_in_days: v.optional(v.union(v.literal(3), v.literal(5), v.literal(10))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.list_id);
    await requireOwnerAccess(ctx, list._id, user._id);

    const days = args.expires_in_days ?? 3;
    const now = Date.now();
    const inviteId = await ctx.db.insert('shared_list_invites', {
      list_id: list._id,
      token: buildInviteToken(),
      is_multi_use: true,
      created_by: user._id,
      created_at: now,
      expires_at: now + days * 24 * 60 * 60 * 1000,
    });

    const invite = await ctx.db.get(inviteId);
    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'link_created');

    return invite;
  },
});

export const acceptInvite = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const invite = await ctx.db
      .query('shared_list_invites')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .unique();

    if (!invite || invite.revoked_at) {
      throw new ConvexError('Invite not found.');
    }

    const list = await getListById(ctx, invite.list_id);
    if (list.owner_id === user._id) {
      throw new ConvexError('You already own this list.');
    }

    const existingMembership = await getMembership(ctx, list._id, user._id);
    if (existingMembership) {
      throw new ConvexError('You are already added to this list.');
    }

    if (invite.expires_at < Date.now()) {
      throw new ConvexError('Invite token is expired.');
    }

    const isMultiUse = invite.is_multi_use === true;
    if (!isMultiUse && invite.accepted_at) {
      throw new ConvexError('Invite token is expired.');
    }

    if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ConvexError('Invite email does not match current user.');
    }

    const member = await upsertMember(ctx, list._id, user._id, invite.created_by, 'editor');

    if (!isMultiUse) {
      await ctx.db.patch(invite._id, {
        accepted_at: Date.now(),
      });
    }

    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'invite_accepted');

    return member;
  },
});

export const removeMember = mutation({
  args: {
    list_id: v.id('shared_lists'),
    user_id: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.list_id);
    await requireOwnerAccess(ctx, list._id, user._id);

    if (args.user_id === list.owner_id) {
      throw new ConvexError('Owner cannot be removed from the list.');
    }

    const member = await getMembership(ctx, list._id, args.user_id);
    if (!member) {
      throw new ConvexError('Member not found.');
    }

    await ctx.db.delete(member._id);
    await touchList(ctx, list._id);
    await writeActivity(ctx, list._id, user._id, 'member_removed');

    return { success: true };
  },
});

export const convertToOrder = mutation({
  args: {
    list_id: v.id('shared_lists'),
    category_id: v.id('order_categories'),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const list = await getListById(ctx, args.list_id);

    await requireOwnerAccess(ctx, list._id, user._id);

    if (list.owner_id !== user._id) {
      throw new ConvexError('Only the owner can convert this list.');
    }

    if (list.converted_order_id) {
      throw new ConvexError('List has already been converted to an order.');
    }

    const categories = await ensureDefaultOrderCategories(ctx, user._id);
    const category = categories.find((item) => item._id === args.category_id);
    if (!category) {
      throw new ConvexError('Order category not found.');
    }

    const items = await ctx.db
      .query('shared_list_items')
      .withIndex('by_list_id', (q) => q.eq('list_id', list._id))
      .collect();

    const activeItems = items.filter((item) => !item.deleted_at);

    if (activeItems.length === 0) {
      throw new ConvexError('At least one active item is required to convert.');
    }

    const hasIncomplete = activeItems.some((item) => !item.completed);
    if (hasIncomplete) {
      throw new ConvexError('Complete all items before converting the list to an order.');
    }

    const month = await getOrCreateCurrentMonth(ctx, user._id);

    const orderId = await ctx.db.insert('orders', {
      userId: user._id,
      month_id: month._id,
      source: `shared-list:${list._id}`,
      notes: list.notes?.trim() || `Converted from list: ${list.name}`,
      category_id: category._id,
      category_name: category.name,
    });

    for (const item of activeItems) {
      await ctx.db.insert('order_items', {
        order_id: orderId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
      });
    }

    await ctx.db.patch(list._id, {
      converted_order_id: orderId,
      converted_at: Date.now(),
      updated_at: Date.now(),
    });

    await writeActivity(ctx, list._id, user._id, 'list_converted', String(orderId));

    return {
      orderId,
      monthId: month._id,
    };
  },
});
