import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalQuery, mutation, query } from './_generated/server';
import { requireCurrentUser } from './auth';

function sortProducts<T extends { category: string; name: string }>(products: T[]) {
  return products.sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return a.name.localeCompare(b.name);
  });
}

async function getOwnedProduct(ctx: any, userId: string, productId: Id<'products'>) {
  const product = await ctx.db.get(productId);
  if (!product || product.userId !== userId) {
    throw new ConvexError('Product not found.');
  }

  return product;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const products = await ctx.db
      .query('products')
      .withIndex('by_user_name', (q) => q.eq('userId', user._id))
      .collect();
    return sortProducts(products);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const name = args.name.trim();
    if (!name) {
      throw new ConvexError('Product name is required.');
    }

    const productId = await ctx.db.insert('products', {
      userId: user._id,
      name,
      category: args.category.trim() || 'Other',
      unit: args.unit.trim() || 'unit',
      price: args.price,
      updated_at: new Date().toISOString(),
    });

    return ctx.db.get(productId);
  },
});

export const update = mutation({
  args: {
    id: v.id('products'),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await getOwnedProduct(ctx, user._id, args.id);

    const name = args.name?.trim() ?? existing.name;
    await ctx.db.patch(args.id, {
      name,
      category: args.category?.trim() ?? existing.category,
      unit: args.unit?.trim() ?? existing.unit,
      price: args.price ?? existing.price,
      updated_at: new Date().toISOString(),
    });

    return ctx.db.get(args.id);
  },
});

export const catalog = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return sortProducts(
      await ctx.db
        .query('products')
        .withIndex('by_user_name', (q) => q.eq('userId', args.userId))
        .collect()
    );
  },
});
