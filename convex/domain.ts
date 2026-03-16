import { ConvexError } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';

import { listAccessibleProducts } from './productCatalog';

type UserId = string;

type OrderWithItems = Doc<'orders'> & {
  id: Id<'orders'>;
  items: Doc<'order_items'>[];
  total: number;
};

type OrderCategorySummary = Pick<Doc<'orders'>, '_id' | '_creationTime' | 'category_id'>;

type ItemAggregate = {
  name: string;
  category: string;
  quantity: number;
  total: number;
  count: number;
};

type SpendByCategory = {
  category: string;
  amount: number;
};

export async function listOrdersWithItemsForMonth(ctx: any, userId: UserId, monthId: Id<'months'>) {
  const orders = await ctx.db
    .query('orders')
    .withIndex('by_user_month_id', (q: any) => q.eq('userId', userId).eq('month_id', monthId))
    .order('desc')
    .collect();

  const orderList = await Promise.all(
    orders.map(async (order: Doc<'orders'>): Promise<OrderWithItems> => {
      const items = await ctx.db
        .query('order_items')
        .withIndex('by_order_id', (q: any) => q.eq('order_id', order._id))
        .collect();
      const total = items.reduce(
        (sum: number, item: Doc<'order_items'>) => sum + item.price * item.quantity,
        0
      );

      return { ...order, id: order._id, items, total };
    })
  );

  return orderList;
}

export async function getMonthAnalytics(ctx: any, userId: UserId, monthId: Id<'months'>) {
  const month = await ctx.db.get(monthId);
  if (!month || month.userId !== userId) {
    throw new ConvexError('Month not found.');
  }

  const orders = await listOrdersWithItemsForMonth(ctx, userId, monthId);
  const products = await listAccessibleProducts(ctx, userId);
  const productsById = new Map<string, Doc<'products'>>(
    products.map((product: Doc<'products'>) => [product._id, product])
  );

  let total = 0;
  let itemCount = 0;
  const itemMap = new Map<string, ItemAggregate>();
  const byItemCategory = new Map<string, number>();
  const byOrderCategory = new Map<string, number>();

  for (const order of orders) {
    const orderCategoryName = order.category_name?.trim() || 'Uncategorized';
    const orderTotal = order.total;

    byOrderCategory.set(
      orderCategoryName,
      (byOrderCategory.get(orderCategoryName) ?? 0) + orderTotal
    );

    for (const item of order.items) {
      const subtotal = item.price * item.quantity;
      total += subtotal;
      itemCount += 1;

      const product = item.product_id ? productsById.get(item.product_id) : undefined;
      const category = product?.category ?? 'Other';
      const key = item.name.trim().toLowerCase();
      const aggregate = itemMap.get(key) ?? {
        name: item.name,
        category,
        quantity: 0,
        total: 0,
        count: 0,
      };

      aggregate.quantity += item.quantity;
      aggregate.total += subtotal;
      aggregate.count += 1;
      aggregate.category = category;
      itemMap.set(key, aggregate);
      byItemCategory.set(category, (byItemCategory.get(category) ?? 0) + subtotal);
    }
  }

  const items = Array.from(itemMap.values()).sort((a, b) => b.total - a.total);
  const mapSpendByCategory = (source: Map<string, number>): SpendByCategory[] =>
    Array.from(source.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

  return {
    total,
    order_count: orders.length,
    item_count: itemCount,
    items,
    top_items: items.slice(0, 5),
    by_item_category: mapSpendByCategory(byItemCategory),
    by_order_category: mapSpendByCategory(byOrderCategory),
  };
}

export async function getMonthSummaries(ctx: any, userId: UserId) {
  const months = await ctx.db
    .query('months')
    .withIndex('by_user_year_month', (q: any) => q.eq('userId', userId))
    .order('desc')
    .collect();

  return Promise.all(
    months.map(async (month: Doc<'months'>) => {
      const analytics = await getMonthAnalytics(ctx, userId, month._id);
      return {
        ...month,
        id: month._id,
        total: analytics.total,
        order_count: analytics.order_count,
        item_count: analytics.item_count,
      };
    })
  );
}

export async function getLastUsedOrderCategory(ctx: any, userId: UserId) {
  const orders = (await ctx.db
    .query('orders')
    .withIndex('by_user_month_id', (q: any) => q.eq('userId', userId))
    .collect()) as OrderCategorySummary[];

  const latestCategorizedOrder = orders
    .sort((a, b) => b._creationTime - a._creationTime)
    .find((order) => order.category_id);
  return latestCategorizedOrder?.category_id ?? null;
}
