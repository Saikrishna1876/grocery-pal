import { convexTest } from 'convex-test';
import { exportJWK, generateKeyPair } from 'jose';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import { api, internal } from '../convex/_generated/api';
import betterAuthSchema from '../convex/betterAuth/schema';
import schema from '../convex/schema';

const modules = {
  ...import.meta.glob('../convex/*.ts'),
  ...import.meta.glob('../convex/_generated/*.{js,ts}'),
};

const betterAuthModules = {
  ...import.meta.glob('../convex/betterAuth/*.ts'),
  ...import.meta.glob('../convex/betterAuth/_generated/*.{js,ts}'),
};

const AUTH_PASSWORD = 'password123';
const AUTH_SECRET = 'test-better-auth-secret';

beforeAll(async () => {
  process.env.BETTER_AUTH_SECRET = AUTH_SECRET;
  process.env.CONVEX_SITE_URL = 'http://127.0.0.1';

  if (process.env.JWKS) {
    return;
  }

  const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
  const now = Date.now();
  process.env.JWKS = JSON.stringify([
    {
      id: 'test-key',
      publicKey: JSON.stringify(await exportJWK(publicKey)),
      privateKey: JSON.stringify(await exportJWK(privateKey)),
      createdAt: now,
      alg: 'RS256',
    },
  ]);
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

function createBackend() {
  const t = convexTest(schema, modules);
  t.registerComponent('betterAuth', betterAuthSchema, betterAuthModules);
  return t;
}

async function createAuthenticatedUser(
  t: ReturnType<typeof createBackend>,
  email: string,
  name: string
) {
  const signUpResponse = await t.fetch('/api/auth/sign-up/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      name,
      password: AUTH_PASSWORD,
    }),
  });

  expect(signUpResponse.ok).toBe(true);
  const signUpBody = await signUpResponse.json();
  expect(signUpBody.token).toBeTruthy();

  const sessionResponse = await t.fetch('/api/auth/get-session', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${signUpBody.token}`,
    },
  });

  expect(sessionResponse.ok).toBe(true);
  const sessionBody = await sessionResponse.json();

  return {
    userId: sessionBody.user.id as string,
    sessionId: sessionBody.session.id as string,
    sessionToken: signUpBody.token as string,
    auth: t.withIdentity({
      subject: sessionBody.user.id as string,
      sessionId: sessionBody.session.id as string,
    }),
  };
}

describe('Convex backend auth + ownership', () => {
  test('email/password sign-up creates a user session and protected queries reject unauthenticated calls', async () => {
    const t = createBackend();
    const createdUser = await createAuthenticatedUser(t, 'auth-user@example.com', 'Auth User');

    const authUser = await createdUser.auth.query(api.auth.getAuthUser, {});

    expect(authUser.email).toBe('auth-user@example.com');
    expect(authUser._id).toBe(createdUser.userId);
    await expect(t.query(api.months.get, {})).rejects.toThrow('Unauthenticated');
  });

  test('months dedupe within one user and two users can create the same calendar month independently', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'user-a@example.com', 'User A');
    const userB = await createAuthenticatedUser(t, 'user-b@example.com', 'User B');

    const first = await userA.auth.mutation(api.months.add, { year: 2026, month: 3 });
    const duplicate = await userA.auth.mutation(api.months.add, { year: 2026, month: 3 });
    const secondUserMonth = await userB.auth.mutation(api.months.add, { year: 2026, month: 3 });

    const monthsA = await userA.auth.query(api.months.get, {});
    const monthsB = await userB.auth.query(api.months.get, {});

    expect(first?._id).toBe(duplicate?._id);
    expect(secondUserMonth?._id).not.toBe(first?._id);
    expect(monthsA).toHaveLength(1);
    expect(monthsB).toHaveLength(1);
  });

  test('orders.add auto-creates products, updates owned products, and rejects foreign product references', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'order-a@example.com', 'Order A');
    const userB = await createAuthenticatedUser(t, 'order-b@example.com', 'Order B');

    const monthA = await userA.auth.mutation(api.months.add, { year: 2026, month: 2 });
    const monthB = await userB.auth.mutation(api.months.add, { year: 2026, month: 2 });
    const productA = await userA.auth.mutation(api.products.add, {
      name: 'Rice',
      category: 'Grains',
      unit: 'kg',
      price: 50,
    });
    const productB = await userB.auth.mutation(api.products.add, {
      name: 'Rice',
      category: 'Grains',
      unit: 'kg',
      price: 90,
    });

    await expect(
      userB.auth.mutation(api.orders.add, {
        month_id: monthB!._id,
        source: 'manual',
        notes: '',
        items: [
          {
            product_id: productA!._id,
            name: 'Rice',
            quantity: 1,
            unit: 'kg',
            price: 55,
          },
        ],
      })
    ).rejects.toThrow('Product not found.');

    await userA.auth.mutation(api.orders.add, {
      month_id: monthA!._id,
      source: 'manual',
      notes: '',
      items: [
        {
          product_id: productA!._id,
          name: 'Rice',
          quantity: 2,
          unit: 'kg',
          price: 55,
        },
        {
          name: 'Oil',
          quantity: 1,
          unit: 'ltr',
          price: 140,
        },
      ],
    });

    const productsA = await userA.auth.query(api.products.get, {});
    const productsB = await userB.auth.query(api.products.get, {});

    expect(productsA).toHaveLength(2);
    expect(productsA.find((product) => product.name === 'Rice')?.price).toBe(55);
    expect(productsA.find((product) => product.name === 'Oil')?.userId).toBe(userA.userId);
    expect(productsB).toHaveLength(1);
    expect(productsB[0]?.price).toBe(productB?.price);
  });

  test('analytics and month detail queries are scoped to the signed-in user', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'analytics-a@example.com', 'Analytics A');
    const userB = await createAuthenticatedUser(t, 'analytics-b@example.com', 'Analytics B');

    const monthA1 = await userA.auth.mutation(api.months.add, { year: 2026, month: 1 });
    const monthA2 = await userA.auth.mutation(api.months.add, { year: 2026, month: 2 });
    const monthB = await userB.auth.mutation(api.months.add, { year: 2026, month: 1 });

    await userA.auth.mutation(api.orders.add, {
      month_id: monthA1!._id,
      source: 'manual',
      notes: '',
      items: [{ name: 'Dal', quantity: 2, unit: 'kg', price: 120 }],
    });
    await userA.auth.mutation(api.orders.add, {
      month_id: monthA2!._id,
      source: 'manual',
      notes: '',
      items: [{ name: 'Oil', quantity: 1, unit: 'ltr', price: 150 }],
    });
    await userB.auth.mutation(api.orders.add, {
      month_id: monthB!._id,
      source: 'manual',
      notes: '',
      items: [{ name: 'Sugar', quantity: 1, unit: 'kg', price: 60 }],
    });

    const analyticsA = await userA.auth.query(api.analytics.getByMonth, { monthId: monthA1!._id });
    const comparisonA = await userA.auth.query(api.analytics.getComparison, {});

    expect(analyticsA.total).toBe(240);
    expect(analyticsA.top_items[0]?.name).toBe('Dal');
    expect(comparisonA).toHaveLength(2);
    expect(comparisonA.every((month) => month.total !== 60)).toBe(true);

    await expect(
      userA.auth.query(api.orders.getByMonth, { monthId: monthB!._id })
    ).rejects.toThrow('Month not found.');
    await expect(
      userA.auth.query(api.analytics.getByMonth, { monthId: monthB!._id })
    ).rejects.toThrow('Month not found.');
  });

  test('order removal is owner-scoped and still cascades order_items deletion', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'remove-a@example.com', 'Remove A');
    const userB = await createAuthenticatedUser(t, 'remove-b@example.com', 'Remove B');

    const monthA = await userA.auth.mutation(api.months.add, { year: 2026, month: 1 });
    await userB.auth.mutation(api.months.add, { year: 2026, month: 1 });

    const order = await userA.auth.mutation(api.orders.add, {
      month_id: monthA!._id,
      source: 'manual',
      notes: '',
      items: [{ name: 'Oil', quantity: 1, unit: 'ltr', price: 140 }],
    });

    await expect(userB.auth.mutation(api.orders.remove, { id: order!._id })).rejects.toThrow(
      'Order not found.'
    );

    await userA.auth.mutation(api.orders.remove, { id: order!._id });

    const analytics = await userA.auth.query(api.analytics.getByMonth, { monthId: monthA!._id });
    const orderItems = await t.run(async (ctx) => ctx.db.query('order_items').collect());

    expect(analytics.total).toBe(0);
    expect(orderItems).toHaveLength(0);
  });

  test('legacy ownerless rows stay hidden and the cleanup mutation purges them safely', async () => {
    const t = createBackend();
    const user = await createAuthenticatedUser(t, 'legacy@example.com', 'Legacy User');
    const month = await user.auth.mutation(api.months.add, { year: 2026, month: 4 });

    await t.run(async (ctx) => {
      const legacyMonthId = await ctx.db.insert('months', { year: 1999, month: 12 });
      const legacyOrderId = await ctx.db.insert('orders', {
        month_id: legacyMonthId,
        source: 'manual',
        notes: 'legacy',
      });
      await ctx.db.insert('order_items', {
        order_id: legacyOrderId,
        name: 'Legacy Rice',
        quantity: 1,
        unit: 'kg',
        price: 10,
      });
      await ctx.db.insert('products', {
        name: 'Legacy Product',
        category: 'Other',
        unit: 'unit',
        price: 10,
      });
    });

    const monthsBeforeCleanup = await user.auth.query(api.months.get, {});
    const ordersBeforeCleanup = await user.auth.query(api.orders.getByMonth, { monthId: month!._id });

    expect(monthsBeforeCleanup).toHaveLength(1);
    expect(ordersBeforeCleanup).toHaveLength(0);

    const cleanupResult = await t.mutation(internal.auth.cleanupLegacyOwnerlessData, {});

    const monthsAfterCleanup = await t.run(async (ctx) => ctx.db.query('months').collect());
    const ordersAfterCleanup = await t.run(async (ctx) => ctx.db.query('orders').collect());
    const itemsAfterCleanup = await t.run(async (ctx) => ctx.db.query('order_items').collect());
    const productsAfterCleanup = await t.run(async (ctx) => ctx.db.query('products').collect());

    expect(cleanupResult.monthsDeleted).toBe(1);
    expect(cleanupResult.ordersDeleted).toBe(1);
    expect(cleanupResult.orderItemsDeleted).toBe(1);
    expect(cleanupResult.productsDeleted).toBe(1);
    expect(monthsAfterCleanup).toHaveLength(1);
    expect(ordersAfterCleanup).toHaveLength(0);
    expect(itemsAfterCleanup).toHaveLength(0);
    expect(productsAfterCleanup).toHaveLength(0);
  });

  test('scan.processImage still fails fast when the Gemini key is missing for an authenticated user', async () => {
    const t = createBackend();
    const user = await createAuthenticatedUser(t, 'scan@example.com', 'Scan User');

    await expect(
      user.auth.action(api.scan.processImage, { image: 'ZmFrZQ==', type: 'receipt' })
    ).rejects.toThrow('GEMINI_API_KEY is not configured.');
  });
});
