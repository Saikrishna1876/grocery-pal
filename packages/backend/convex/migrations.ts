import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const importProducts = mutation({
  args: {
    products: v.array(
      v.object({
        userId: v.optional(v.string()),
        name: v.string(),
        category: v.string(),
        unit: v.string(),
        price: v.number(),
        updated_at: v.optional(v.string()),
        // We might want to pass the old ID to return a mapping, but for now we just return the new ID
        originalId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const idMapping: Record<string, string> = {};
    for (const product of args.products) {
      const { originalId, ...data } = product;
      const newId = await ctx.db.insert('products', data);
      idMapping[originalId] = newId;
    }
    return idMapping;
  },
});

export const importOrderCategories = mutation({
  args: {
    categories: v.array(
      v.object({
        userId: v.string(),
        name: v.string(),
        normalizedName: v.string(),
        systemKey: v.optional(v.string()),
        originalId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const idMapping: Record<string, string> = {};
    for (const category of args.categories) {
      const { originalId, ...data } = category;
      const newId = await ctx.db.insert('order_categories', data);
      idMapping[originalId] = newId;
    }
    return idMapping;
  },
});

export const importMonths = mutation({
  args: {
    months: v.array(
      v.object({
        userId: v.optional(v.string()),
        year: v.number(),
        month: v.number(),
        originalId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const idMapping: Record<string, string> = {};
    for (const item of args.months) {
      const { originalId, ...data } = item;
      const newId = await ctx.db.insert('months', data);
      idMapping[originalId] = newId;
    }
    return idMapping;
  },
});

export const importOrders = mutation({
  args: {
    orders: v.array(
      v.object({
        userId: v.optional(v.string()),
        month_id: v.id('months'),
        source: v.optional(v.string()),
        notes: v.optional(v.string()),
        category_id: v.optional(v.id('order_categories')),
        category_name: v.optional(v.string()),
        originalId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const idMapping: Record<string, string> = {};
    for (const item of args.orders) {
      const { originalId, ...data } = item;
      const newId = await ctx.db.insert('orders', data);
      idMapping[originalId] = newId;
    }
    return idMapping;
  },
});

export const importOrderItems = mutation({
  args: {
    orderItems: v.array(
      v.object({
        order_id: v.id('orders'),
        product_id: v.optional(v.id('products')),
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        price: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const item of args.orderItems) {
      await ctx.db.insert('order_items', item);
    }
  },
});
