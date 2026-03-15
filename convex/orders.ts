import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireCurrentUser } from './auth';
import { listOrdersWithItemsForMonth } from './domain';

const orderItemInput = v.object({
  product_id: v.optional(v.id('products')),
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
  price: v.number(),
});

async function getOwnedMonth(ctx: any, userId: string, monthId: Id<'months'>) {
  const month = await ctx.db.get(monthId);
  if (!month || month.userId !== userId) {
    throw new ConvexError('Month not found.');
  }

  return month;
}

async function getOwnedProduct(ctx: any, userId: string, productId: Id<'products'>) {
  const product = await ctx.db.get(productId);
  if (!product || product.userId !== userId) {
    throw new ConvexError('Product not found.');
  }

  return product;
}

async function upsertUserProduct(
  ctx: any,
  userId: string,
  item: {
    name: string;
    unit: string;
    price: number;
  }
) {
  const now = new Date().toISOString();
  const name = item.name.trim();
  const unit = item.unit.trim() || 'unit';

  const existing = await ctx.db
    .query('products')
    .withIndex('by_user_name', (q: any) => q.eq('userId', userId).eq('name', name))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      unit,
      price: item.price,
      updated_at: now,
    });
    return (await ctx.db.get(existing._id)) ?? existing;
  }

  const productId = await ctx.db.insert('products', {
    userId,
    name,
    category: 'Other',
    unit,
    price: item.price,
    updated_at: now,
  });

  return ctx.db.get(productId);
}

export const getByMonth = query({
  args: {
    monthId: v.id('months'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedMonth(ctx, user._id, args.monthId);
    return listOrdersWithItemsForMonth(ctx, user._id, args.monthId);
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
    const user = await requireCurrentUser(ctx);
    await getOwnedMonth(ctx, user._id, args.month_id);

    if (args.items.length === 0) {
      throw new ConvexError('At least one item is required.');
    }

    const orderId = await ctx.db.insert('orders', {
      userId: user._id,
      month_id: args.month_id,
      source: args.source || 'manual',
      notes: args.notes?.trim() || undefined,
    });

    const now = new Date().toISOString();
    for (const item of args.items) {
      const name = item.name.trim();
      if (!name) {
        throw new ConvexError('Item name is required.');
      }

      const unit = item.unit.trim() || 'unit';
      let productId: Id<'products'> | undefined;

      if (item.product_id) {
        const product = await getOwnedProduct(ctx, user._id, item.product_id);
        productId = product._id;
        await ctx.db.patch(product._id, {
          price: item.price,
          updated_at: now,
        });
      } else {
        const product = await upsertUserProduct(ctx, user._id, {
          name,
          unit,
          price: item.price,
        });
        productId = product?._id;
      }

      await ctx.db.insert('order_items', {
        order_id: orderId,
        product_id: productId,
        name,
        quantity: item.quantity,
        unit,
        price: item.price,
      });
    }

    return ctx.db.get(orderId);
  },
});

export const remove = mutation({
  args: {
    id: v.id('orders'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const order = await ctx.db.get(args.id);
    if (!order || order.userId !== user._id) {
      throw new ConvexError('Order not found.');
    }

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
