import { ConvexError, v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireCurrentUser } from './auth';
import { getLastUsedOrderCategory } from './domain';

const UNCATEGORIZED_KEY = 'uncategorized';
const STARTER_CATEGORY_NAMES = ['Friends', 'Guests', 'Family', 'Office'];

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  uncategorized: 'Uncategorized',
};

type ReaderCtx = Pick<QueryCtx, 'db'>;
type WriterCtx = Pick<MutationCtx, 'db'>;

function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function compareCategories(
  a: { name: string; systemKey?: string },
  b: { name: string; systemKey?: string }
) {
  const aPinned = a.systemKey === UNCATEGORIZED_KEY ? 0 : a.systemKey ? 1 : 2;
  const bPinned = b.systemKey === UNCATEGORIZED_KEY ? 0 : b.systemKey ? 1 : 2;

  if (aPinned !== bPinned) {
    return aPinned - bPinned;
  }

  return a.name.localeCompare(b.name);
}

async function getCategoryById(ctx: ReaderCtx, userId: string, categoryId: Id<'order_categories'>) {
  const category = await ctx.db.get(categoryId);
  if (!category || category.userId !== userId) {
    throw new ConvexError('Order category not found.');
  }

  return category as Doc<'order_categories'>;
}

async function getCategoryByNormalizedName(ctx: ReaderCtx, userId: string, normalizedName: string) {
  return (await ctx.db
    .query('order_categories')
    .withIndex('by_user_normalized_name', (q) =>
      q.eq('userId', userId).eq('normalizedName', normalizedName)
    )
    .unique()) as Doc<'order_categories'> | null;
}

async function getCategoryBySystemKey(ctx: ReaderCtx, userId: string, systemKey: string) {
  return (await ctx.db
    .query('order_categories')
    .withIndex('by_user_system_key', (q) => q.eq('userId', userId).eq('systemKey', systemKey))
    .unique()) as Doc<'order_categories'> | null;
}

async function ensureCategory(ctx: WriterCtx, userId: string, name: string, systemKey?: string) {
  if (systemKey) {
    const existingBySystemKey = await getCategoryBySystemKey(ctx, userId, systemKey);
    if (existingBySystemKey) {
      return existingBySystemKey;
    }
  }

  const normalizedName = normalizeCategoryName(name);
  const existing = await getCategoryByNormalizedName(ctx, userId, normalizedName);
  if (existing) {
    if (systemKey && !existing.systemKey) {
      await ctx.db.patch(existing._id, { systemKey });
      return ((await ctx.db.get(existing._id)) ?? existing) as Doc<'order_categories'>;
    }

    return existing;
  }

  const categoryId = await ctx.db.insert('order_categories', {
    userId,
    name,
    normalizedName,
    systemKey,
  });

  return (await ctx.db.get(categoryId)) as Doc<'order_categories'>;
}

export async function ensureDefaultOrderCategories(ctx: WriterCtx, userId: string) {
  const existingCategories = (await ctx.db
    .query('order_categories')
    .withIndex('by_user_normalized_name', (q) => q.eq('userId', userId))
    .collect()) as Doc<'order_categories'>[];

  if (existingCategories.length === 0) {
    const seededCategories = await Promise.all([
      ensureCategory(ctx, userId, DEFAULT_CATEGORY_LABELS[UNCATEGORIZED_KEY], UNCATEGORIZED_KEY),
      ...STARTER_CATEGORY_NAMES.map((name) => ensureCategory(ctx, userId, name)),
    ]);

    return seededCategories.sort(compareCategories);
  }

  const uncategorized = existingCategories.find(
    (category) => category.systemKey === UNCATEGORIZED_KEY
  );
  if (!uncategorized) {
    existingCategories.push(
      await ensureCategory(
        ctx,
        userId,
        DEFAULT_CATEGORY_LABELS[UNCATEGORIZED_KEY],
        UNCATEGORIZED_KEY
      )
    );
  }

  return existingCategories.sort(compareCategories);
}

export async function getUncategorizedCategory(ctx: WriterCtx, userId: string) {
  const existing = await getCategoryBySystemKey(ctx, userId, UNCATEGORIZED_KEY);
  const uncategorized = existing ?? (await ensureDefaultOrderCategories(ctx, userId))[0];
  if (!uncategorized) {
    throw new ConvexError('Uncategorized category not available.');
  }

  return uncategorized;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const categories = await ensureDefaultOrderCategories(ctx as unknown as WriterCtx, user._id);
    const orders = await ctx.db
      .query('orders')
      .withIndex('by_user_month_id', (q) => q.eq('userId', user._id))
      .collect();
    const usageCounts = new Map<string, number>();

    for (const order of orders) {
      if (!order.category_id) {
        continue;
      }

      usageCounts.set(order.category_id, (usageCounts.get(order.category_id) ?? 0) + 1);
    }

    return categories.map((category) => ({
      ...category,
      usageCount: usageCounts.get(category._id) ?? 0,
    }));
  },
});

export const getLastUsed = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    await ensureDefaultOrderCategories(ctx as unknown as WriterCtx, user._id);
    return getLastUsedOrderCategory(ctx, user._id);
  },
});

export const getById = query({
  args: {
    id: v.id('order_categories'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await ensureDefaultOrderCategories(ctx as unknown as WriterCtx, user._id);
    return getCategoryById(ctx, user._id, args.id);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await ensureDefaultOrderCategories(ctx, user._id);

    const name = args.name.trim().replace(/\s+/g, ' ');
    if (!name) {
      throw new ConvexError('Category name is required.');
    }

    const normalizedName = normalizeCategoryName(name);
    const existing = await getCategoryByNormalizedName(ctx, user._id, normalizedName);
    if (existing) {
      throw new ConvexError('Category already exists.');
    }

    const categoryId = await ctx.db.insert('order_categories', {
      userId: user._id,
      name,
      normalizedName,
    });

    return ctx.db.get(categoryId);
  },
});

export const update = mutation({
  args: {
    id: v.id('order_categories'),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await ensureDefaultOrderCategories(ctx, user._id);

    const category = await getCategoryById(ctx, user._id, args.id);
    if (category.systemKey === UNCATEGORIZED_KEY) {
      throw new ConvexError('Uncategorized cannot be renamed.');
    }

    const name = args.name.trim().replace(/\s+/g, ' ');
    if (!name) {
      throw new ConvexError('Category name is required.');
    }

    const normalizedName = normalizeCategoryName(name);
    const duplicate = await getCategoryByNormalizedName(ctx, user._id, normalizedName);
    if (duplicate && duplicate._id !== category._id) {
      throw new ConvexError('Category already exists.');
    }

    await ctx.db.patch(category._id, {
      name,
      normalizedName,
    });

    return ctx.db.get(category._id);
  },
});

export const remove = mutation({
  args: {
    id: v.id('order_categories'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await ensureDefaultOrderCategories(ctx, user._id);

    const category = await getCategoryById(ctx, user._id, args.id);
    if (category.systemKey) {
      throw new ConvexError('Default categories cannot be deleted.');
    }

    const linkedOrder = await ctx.db
      .query('orders')
      .withIndex('by_user_category_id', (q) =>
        q.eq('userId', user._id).eq('category_id', category._id)
      )
      .first();

    if (linkedOrder) {
      throw new ConvexError('Category is in use by existing orders.');
    }

    await ctx.db.delete(category._id);
    return { success: true };
  },
});
