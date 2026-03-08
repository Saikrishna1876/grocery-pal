import { ConvexError, v } from 'convex/values';

import { internalQuery, mutation, query } from './_generated/server';

export const get = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query('products').collect();
    return products.sort((a, b) => {
      const categoryCompare = a.category.localeCompare(b.category);
      if (categoryCompare !== 0) {
        return categoryCompare;
      }

      return a.name.localeCompare(b.name);
    });
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
    const name = args.name.trim();
    if (!name) {
      throw new ConvexError('Product name is required.');
    }

    const productId = await ctx.db.insert('products', {
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
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError('Product not found.');
    }

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
  args: {},
  handler: async (ctx) => {
    return ctx.db.query('products').collect();
  },
});
