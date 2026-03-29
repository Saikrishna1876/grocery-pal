import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalQuery, mutation, query } from './_generated/server';
import { requireCurrentUser } from './auth';
import {
  getAccessibleProduct,
  getUserOverrideForSource,
  listCatalogProducts,
  sameProductValues,
  upsertProductOverride,
} from './productCatalog';

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return listCatalogProducts(ctx, user._id);
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
    const existing = await getAccessibleProduct(ctx, user._id, args.id);
    const baseProduct =
      existing.userId === user._id
        ? existing
        : ((await getUserOverrideForSource(ctx, user._id, existing._id)) ?? existing);
    const nextValues = {
      name: args.name?.trim() ?? baseProduct.name,
      category: args.category?.trim() ?? baseProduct.category,
      unit: args.unit?.trim() ?? baseProduct.unit,
      price: args.price ?? baseProduct.price,
    };

    if (sameProductValues(baseProduct, nextValues)) {
      return baseProduct;
    }

    if (existing.userId === user._id) {
      await ctx.db.patch(existing._id, {
        ...nextValues,
        updated_at: new Date().toISOString(),
      });

      return ctx.db.get(existing._id);
    }

    return upsertProductOverride(ctx, user._id, existing, nextValues);
  },
});

export const catalog = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return listCatalogProducts(ctx, args.userId);
  },
});
