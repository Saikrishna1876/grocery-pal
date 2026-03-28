import { ConvexError, v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { requireCurrentUser } from './auth';
import { listOrdersWithItemsForMonth } from './domain';
import { ensureDefaultOrderCategories, getUncategorizedCategory } from './orderCategories';
import {
  findLatestUserProductByName,
  findSharedProductByName,
  getAccessibleProduct,
  getUserOverrideForSource,
  upsertProductOverride,
} from './productCatalog';

const orderItemInput = v.object({
  product_id: v.optional(v.id('products')),
  name: v.string(),
  quantity: v.number(),
  unit: v.string(),
  price: v.number(),
});

type ReaderCtx = Pick<QueryCtx, 'db'>;
type WriterCtx = Pick<MutationCtx, 'db'>;

async function getOwnedMonth(ctx: ReaderCtx, userId: string, monthId: Id<'months'>) {
  const month = await ctx.db.get(monthId);
  if (!month || month.userId !== userId) {
    throw new ConvexError('Month not found.');
  }

  return month;
}

async function upsertUserProduct(
  ctx: WriterCtx,
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

  const existing = await findLatestUserProductByName(ctx, userId, name);

  if (existing) {
    await ctx.db.patch(existing._id, {
      unit,
      price: item.price,
      updated_at: now,
    });
    return (await ctx.db.get(existing._id)) ?? existing;
  }

  const sharedProduct = await findSharedProductByName(ctx, name);
  if (sharedProduct) {
    if (sharedProduct.price === item.price) {
      return sharedProduct;
    }

    return upsertProductOverride(ctx, userId, sharedProduct, {
      name: sharedProduct.name,
      category: sharedProduct.category,
      unit: sharedProduct.unit,
      price: item.price,
    });
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

async function resolveProductForOrder(
  ctx: WriterCtx,
  userId: string,
  item: {
    product_id?: Id<'products'>;
    name: string;
    unit: string;
    price: number;
  }
) {
  if (!item.product_id) {
    return upsertUserProduct(ctx, userId, item);
  }

  const product = await getAccessibleProduct(ctx, userId, item.product_id);
  const now = new Date().toISOString();

  if (product.userId === userId) {
    if (product.price !== item.price) {
      await ctx.db.patch(product._id, {
        price: item.price,
        updated_at: now,
      });
      return (await ctx.db.get(product._id)) ?? product;
    }

    return product;
  }

  const existingOverride = await getUserOverrideForSource(ctx, userId, product._id);
  const baseProduct = existingOverride ?? product;

  if (baseProduct.price === item.price) {
    return baseProduct;
  }

  return upsertProductOverride(ctx, userId, product, {
    name: baseProduct.name,
    category: baseProduct.category,
    unit: baseProduct.unit,
    price: item.price,
  });
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
    category_id: v.optional(v.id('order_categories')),
    items: v.array(orderItemInput),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    await getOwnedMonth(ctx, user._id, args.month_id);
    const categories = await ensureDefaultOrderCategories(ctx, user._id);

    if (args.items.length === 0) {
      throw new ConvexError('At least one item is required.');
    }

    const category = args.category_id
      ? categories.find((item) => item._id === args.category_id)
      : await getUncategorizedCategory(ctx, user._id);

    if (!category) {
      throw new ConvexError('Order category not found.');
    }

    const orderId = await ctx.db.insert('orders', {
      userId: user._id,
      month_id: args.month_id,
      source: args.source || 'manual',
      notes: args.notes?.trim() || undefined,
      category_id: category._id,
      category_name: category.name,
    });

    for (const item of args.items) {
      const name = item.name.trim();
      if (!name) {
        throw new ConvexError('Item name is required.');
      }

      const unit = item.unit.trim() || 'unit';
      const product = await resolveProductForOrder(ctx, user._id, {
        product_id: item.product_id,
        name,
        unit,
        price: item.price,
      });

      await ctx.db.insert('order_items', {
        order_id: orderId,
        product_id: product?._id,
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

export const updateCategory = mutation({
  args: {
    id: v.id('orders'),
    category_id: v.id('order_categories'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const order = await ctx.db.get(args.id);

    if (!order || order.userId !== user._id) {
      throw new ConvexError('Order not found.');
    }

    const categories = await ensureDefaultOrderCategories(ctx, user._id);
    const category = categories.find((item) => item._id === args.category_id);
    if (!category) {
      throw new ConvexError('Order category not found.');
    }

    await ctx.db.patch(order._id, {
      category_id: category._id,
      category_name: category.name,
    });

    return ctx.db.get(order._id);
  },
});
