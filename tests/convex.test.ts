import { convexTest } from 'convex-test';
import { afterEach, describe, expect, test } from 'vitest';

import { api } from '../convex/_generated/api';
import schema from '../convex/schema';

const modules = {
  ...import.meta.glob('../convex/*.ts'),
  ...import.meta.glob('../convex/_generated/*.{js,ts}'),
};

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('Convex backend', () => {
  test('months.add returns the existing month for duplicate year/month', async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation(api.months.add, { year: 2026, month: 3 });
    const second = await t.mutation(api.months.add, { year: 2026, month: 3 });
    const months = await t.query(api.months.get, {});

    expect(first?._id).toBe(second?._id);
    expect(months).toHaveLength(1);
    expect(months[0]?.year).toBe(2026);
    expect(months[0]?.month).toBe(3);
  });

  test('orders.add stores items, updates adaptive pricing, and feeds analytics', async () => {
    const t = convexTest(schema, modules);

    const month = await t.mutation(api.months.add, { year: 2026, month: 2 });
    const product = await t.mutation(api.products.add, {
      name: 'Rice',
      category: 'Grains',
      unit: 'kg',
      price: 50,
    });

    await t.mutation(api.orders.add, {
      month_id: month!._id,
      source: 'manual',
      notes: '',
      items: [
        {
          product_id: product!._id,
          name: 'Rice',
          quantity: 2,
          unit: 'kg',
          price: 55,
        },
      ],
    });

    const orders = await t.query(api.orders.getByMonth, { monthId: month!._id });
    const analytics = await t.query(api.analytics.getByMonth, { monthId: month!._id });
    const products = await t.query(api.products.get, {});

    expect(orders).toHaveLength(1);
    expect(orders[0]?.total).toBe(110);
    expect(analytics.total).toBe(110);
    expect(analytics.order_count).toBe(1);
    expect(analytics.top_items[0]?.name).toBe('Rice');
    expect(products[0]?.price).toBe(55);
  });

  test('orders.remove deletes the order and returns empty analytics for the month', async () => {
    const t = convexTest(schema, modules);

    const month = await t.mutation(api.months.add, { year: 2026, month: 1 });
    const order = await t.mutation(api.orders.add, {
      month_id: month!._id,
      source: 'manual',
      notes: '',
      items: [
        {
          name: 'Oil',
          quantity: 1,
          unit: 'ltr',
          price: 140,
        },
      ],
    });

    await t.mutation(api.orders.remove, { id: order!._id });

    const orders = await t.query(api.orders.getByMonth, { monthId: month!._id });
    const analytics = await t.query(api.analytics.getByMonth, { monthId: month!._id });

    expect(orders).toHaveLength(0);
    expect(analytics.total).toBe(0);
    expect(analytics.order_count).toBe(0);
    expect(analytics.items).toHaveLength(0);
  });

  test('scan.processImage fails fast when GEMINI_API_KEY is missing', async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.action(api.scan.processImage, { image: 'ZmFrZQ==', type: 'receipt' })
    ).rejects.toThrow('GEMINI_API_KEY is not configured.');
  });
});
