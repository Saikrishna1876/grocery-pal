import { ConvexError, v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { listOrdersWithItemsForMonth } from './domain';

const orderItemInput = v.object({
  product_id: v.optional(v.id('products')),
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
  price: v.number(),
});

export const getByMonth = query({
  args: {
    monthId: v.id('months'),
  },
  handler: async (ctx, args) => {
    return listOrdersWithItemsForMonth(ctx, args.monthId);
  },
});

export const add = mutation({
  args: {
    month_id: v.id('months'),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    items: v.array(orderItemInput),
  },
  handler: async (ctx, args) => {
    const month = await ctx.db.get(args.month_id);
    if (!month) {
      throw new ConvexError('Month not found.');
    }

    if (args.items.length === 0) {
      throw new ConvexError('At least one item is required.');
    }

    const orderId = await ctx.db.insert('orders', {
      month_id: args.month_id,
      source: args.source || 'manual',
      notes: args.notes?.trim() || undefined,
    });

    for (const item of args.items) {
      await ctx.db.insert('order_items', {
        order_id: orderId,
        product_id: item.product_id,
        name: item.name.trim(),
        quantity: item.quantity,
        unit: item.unit.trim() || 'unit',
        price: item.price,
      });

      if (item.product_id) {
        await ctx.db.patch(item.product_id, {
          price: item.price,
          updated_at: new Date().toISOString(),
        });
      }
    }

    return ctx.db.get(orderId);
  },
});

export const remove = mutation({
  args: {
    id: v.id('orders'),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query('order_items')
      .withIndex('by_order_id', (q) => q.eq('order_id', args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
