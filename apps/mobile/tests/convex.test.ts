import { convexTest } from 'convex-test';
import { exportJWK, generateKeyPair } from 'jose';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import { api, internal } from '../../../packages/backend/convex/_generated/api';
import type { Doc, Id } from '../../../packages/backend/convex/_generated/dataModel';
import * as analyticsModule from '../../../packages/backend/convex/analytics';
import * as authConfigModule from '../../../packages/backend/convex/auth.config';
import * as authModule from '../../../packages/backend/convex/auth';
import * as authOptionsModule from '../../../packages/backend/convex/authOptions';
import * as generatedApiModule from '../../../packages/backend/convex/_generated/api';
import * as generatedServerModule from '../../../packages/backend/convex/_generated/server';
import * as httpModule from '../../../packages/backend/convex/http';
import * as domainModule from '../../../packages/backend/convex/domain';
import * as migrationsModule from '../../../packages/backend/convex/migrations';
import * as monthsModule from '../../../packages/backend/convex/months';
import * as orderCategoriesModule from '../../../packages/backend/convex/orderCategories';
import * as ordersModule from '../../../packages/backend/convex/orders';
import * as productCatalogModule from '../../../packages/backend/convex/productCatalog';
import * as productsModule from '../../../packages/backend/convex/products';
import * as scanModule from '../../../packages/backend/convex/scan';
import * as schemaModule from '../../../packages/backend/convex/schema';
import * as betterAuthAdapterModule from '../../../packages/backend/convex/betterAuth/adapter';
import * as betterAuthAuthModule from '../../../packages/backend/convex/betterAuth/auth';
import * as betterAuthGeneratedApiModule from '../../../packages/backend/convex/betterAuth/_generated/api';
import * as betterAuthGeneratedComponentModule from '../../../packages/backend/convex/betterAuth/_generated/component';
import * as betterAuthGeneratedDataModelModule from '../../../packages/backend/convex/betterAuth/_generated/dataModel';
import * as betterAuthGeneratedServerModule from '../../../packages/backend/convex/betterAuth/_generated/server';
import * as betterAuthSchemaModule from '../../../packages/backend/convex/betterAuth/schema';
import betterAuthSchema from '../../../packages/backend/convex/betterAuth/schema';
import schema from '../../../packages/backend/convex/schema';

const modules = {
  '../../../packages/backend/convex/analytics.ts': () => Promise.resolve(analyticsModule),
  '../../../packages/backend/convex/auth.config.ts': () => Promise.resolve(authConfigModule),
  '../../../packages/backend/convex/auth.ts': () => Promise.resolve(authModule),
  '../../../packages/backend/convex/authOptions.ts': () => Promise.resolve(authOptionsModule),
  '../../../packages/backend/convex/domain.ts': () => Promise.resolve(domainModule),
  '../../../packages/backend/convex/http.ts': () => Promise.resolve(httpModule),
  '../../../packages/backend/convex/migrations.ts': () => Promise.resolve(migrationsModule),
  '../../../packages/backend/convex/months.ts': () => Promise.resolve(monthsModule),
  '../../../packages/backend/convex/orderCategories.ts': () =>
    Promise.resolve(orderCategoriesModule),
  '../../../packages/backend/convex/orders.ts': () => Promise.resolve(ordersModule),
  '../../../packages/backend/convex/productCatalog.ts': () => Promise.resolve(productCatalogModule),
  '../../../packages/backend/convex/products.ts': () => Promise.resolve(productsModule),
  '../../../packages/backend/convex/scan.ts': () => Promise.resolve(scanModule),
  '../../../packages/backend/convex/schema.ts': () => Promise.resolve(schemaModule),
  '../../../packages/backend/convex/_generated/api.js': () => Promise.resolve(generatedApiModule),
  '../../../packages/backend/convex/_generated/server.js': () =>
    Promise.resolve(generatedServerModule),
};

const betterAuthModules = {
  '../../../packages/backend/convex/betterAuth/adapter.ts': () =>
    Promise.resolve(betterAuthAdapterModule),
  '../../../packages/backend/convex/betterAuth/auth.ts': () =>
    Promise.resolve(betterAuthAuthModule),
  '../../../packages/backend/convex/betterAuth/schema.ts': () =>
    Promise.resolve(betterAuthSchemaModule),
  '../../../packages/backend/convex/betterAuth/_generated/api.ts': () =>
    Promise.resolve(betterAuthGeneratedApiModule),
  '../../../packages/backend/convex/betterAuth/_generated/component.ts': () =>
    Promise.resolve(betterAuthGeneratedComponentModule),
  '../../../packages/backend/convex/betterAuth/_generated/dataModel.ts': () =>
    Promise.resolve(betterAuthGeneratedDataModelModule),
  '../../../packages/backend/convex/betterAuth/_generated/server.ts': () =>
    Promise.resolve(betterAuthGeneratedServerModule),
};

const AUTH_PASSWORD = 'password123';
const AUTH_SECRET = 'test-better-auth-secret';

type OrderCategory = Doc<'order_categories'> & { usageCount: number };
type ProductWithSource = Doc<'products'> & { sourceProductId?: Id<'products'> };
const orderCategories = api.orderCategories;

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
  }, 10000);

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

  test('shared default products are visible to everyone and direct edits fork once per user', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'shared-a@example.com', 'Shared A');
    const userB = await createAuthenticatedUser(t, 'shared-b@example.com', 'Shared B');

    const sharedProductId = await t.run(async (ctx) =>
      ctx.db.insert('products', {
        name: 'Milk',
        category: 'Dairy',
        unit: 'ltr',
        price: 60,
      })
    );

    const initialProductsA = await userA.auth.query(api.products.get, {});
    const initialProductsB = await userB.auth.query(api.products.get, {});

    expect(initialProductsA).toHaveLength(1);
    expect(initialProductsA[0]?.price).toBe(60);
    expect(initialProductsA[0]?.userId).toBeUndefined();
    expect(initialProductsB).toHaveLength(1);
    expect(initialProductsB[0]?._id).toBe(sharedProductId);

    const firstOverride = await userA.auth.mutation(api.products.update, {
      id: sharedProductId,
      price: 65,
    });
    const secondOverride = await userA.auth.mutation(api.products.update, {
      id: sharedProductId,
      price: 70,
    });

    const productsA = await userA.auth.query(api.products.get, {});
    const productsB = await userB.auth.query(api.products.get, {});
    const allMilkProducts = await t.run(async (ctx) =>
      ctx.db
        .query('products')
        .withIndex('by_user_name', (q) => q.eq('userId', undefined).eq('name', 'Milk'))
        .collect()
    );
    const ownedMilkProducts = await t.run(async (ctx) =>
      ctx.db
        .query('products')
        .withIndex('by_user_name', (q) => q.eq('userId', userA.userId).eq('name', 'Milk'))
        .collect()
    );

    expect(firstOverride?.userId).toBe(userA.userId);
    expect(firstOverride?.price).toBe(65);
    expect((firstOverride as ProductWithSource | null)?.sourceProductId).toBe(sharedProductId);
    expect(secondOverride?._id).toBe(firstOverride?._id);
    expect(secondOverride?.price).toBe(70);
    expect(productsA).toHaveLength(1);
    expect(productsA[0]?._id).toBe(firstOverride?._id);
    expect(productsA[0]?.price).toBe(70);
    expect(productsB).toHaveLength(1);
    expect(productsB[0]?._id).toBe(sharedProductId);
    expect(productsB[0]?.price).toBe(60);
    expect(allMilkProducts).toHaveLength(1);
    expect(ownedMilkProducts).toHaveLength(1);
  });

  test('order categories seed per user and support custom add, rename, and protected delete', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'categories-a@example.com', 'Categories A');
    const userB = await createAuthenticatedUser(t, 'categories-b@example.com', 'Categories B');

    const initialCategoriesA = (await userA.auth.query(orderCategories.get, {})) as OrderCategory[];
    const initialCategoriesB = (await userB.auth.query(orderCategories.get, {})) as OrderCategory[];

    expect(initialCategoriesA.map((category) => category.name)).toEqual([
      'Uncategorized',
      'Family',
      'Friends',
      'Guests',
      'Office',
    ]);
    expect(initialCategoriesB).toHaveLength(5);

    const customCategory = await userA.auth.mutation(orderCategories.add, {
      name: 'Travel Crew',
    });
    expect(customCategory?.name).toBe('Travel Crew');

    await expect(
      userA.auth.mutation(orderCategories.add, { name: 'travel    crew' })
    ).rejects.toThrow('Category already exists.');

    const renamedCategory = await userA.auth.mutation(orderCategories.update, {
      id: customCategory!._id,
      name: 'Trip Crew',
    });
    expect(renamedCategory?.name).toBe('Trip Crew');

    const uncategorized = initialCategoriesA.find(
      (category) => category.systemKey === 'uncategorized'
    );
    await expect(
      userA.auth.mutation(orderCategories.update, {
        id: uncategorized!._id,
        name: 'Misc',
      })
    ).rejects.toThrow('Uncategorized cannot be renamed.');

    const month = await userA.auth.mutation(api.months.add, { year: 2026, month: 5 });
    await userA.auth.mutation(api.orders.add, {
      month_id: month!._id,
      source: 'manual',
      notes: '',
      category_id: renamedCategory!._id,
      items: [{ name: 'Juice', quantity: 2, unit: 'ltr', price: 80 }],
    });

    const renamedAgain = await userA.auth.mutation(orderCategories.update, {
      id: renamedCategory!._id,
      name: 'Holiday Crew',
    });
    expect(renamedAgain?.name).toBe('Holiday Crew');

    const ordersAfterRename = await userA.auth.query(api.orders.getByMonth, {
      monthId: month!._id,
    });
    const analyticsAfterRename = await userA.auth.query(api.analytics.getByMonth, {
      monthId: month!._id,
    });
    expect(ordersAfterRename[0]?.category_name).toBe('Holiday Crew');
    expect(analyticsAfterRename.by_order_category).toEqual([
      { category: 'Holiday Crew', amount: 160 },
    ]);

    const categoriesAfterUse = (await userA.auth.query(orderCategories.get, {})) as OrderCategory[];
    expect(
      categoriesAfterUse.find((category) => category._id === renamedCategory!._id)?.usageCount
    ).toBe(1);

    await expect(
      userA.auth.mutation(orderCategories.remove, { id: renamedCategory!._id })
    ).rejects.toThrow('Category is in use by existing orders.');
    await expect(
      userB.auth.mutation(orderCategories.remove, { id: renamedCategory!._id })
    ).rejects.toThrow('Order category not found.');
  });

  test('orders.add auto-creates products, updates owned products, uses shared defaults, and rejects foreign product references', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'order-a@example.com', 'Order A');
    const userB = await createAuthenticatedUser(t, 'order-b@example.com', 'Order B');

    const monthA = await userA.auth.mutation(api.months.add, { year: 2026, month: 2 });
    const monthB = await userB.auth.mutation(api.months.add, { year: 2026, month: 2 });
    const categoriesA = (await userA.auth.query(orderCategories.get, {})) as OrderCategory[];
    const friendsCategory = categoriesA.find((category) => category.name === 'Friends');
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
    const sharedSugarId = await t.run(async (ctx) =>
      ctx.db.insert('products', {
        name: 'Sugar',
        category: 'Essentials',
        unit: 'kg',
        price: 42,
      })
    );

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
      category_id: friendsCategory!._id,
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
        {
          product_id: sharedSugarId,
          name: 'Sugar',
          quantity: 1,
          unit: 'kg',
          price: 42,
        },
      ],
    });

    await userA.auth.mutation(api.orders.add, {
      month_id: monthA!._id,
      source: 'manual',
      notes: '',
      items: [
        {
          product_id: sharedSugarId,
          name: 'Sugar',
          quantity: 1,
          unit: 'kg',
          price: 48,
        },
      ],
    });

    const productsA = await userA.auth.query(api.products.get, {});
    const productsB = await userB.auth.query(api.products.get, {});
    const ordersForMonthA = await userA.auth.query(api.orders.getByMonth, { monthId: monthA!._id });
    const orderItemsA = await t.run(async (ctx) => ctx.db.query('order_items').collect());
    const sugarItems = orderItemsA.filter((item) => item.name === 'Sugar');
    const allUserSugarProducts = await t.run(async (ctx) =>
      ctx.db
        .query('products')
        .withIndex('by_user_name', (q) => q.eq('userId', userA.userId).eq('name', 'Sugar'))
        .collect()
    );

    expect(productsA).toHaveLength(3);
    expect(productsA.find((product) => product.name === 'Rice')?.price).toBe(55);
    expect(productsA.find((product) => product.name === 'Oil')?.userId).toBe(userA.userId);
    expect(productsA.find((product) => product.name === 'Sugar')?.price).toBe(48);
    expect(productsB).toHaveLength(2);
    expect(productsB.find((product) => product.name === 'Rice')?.price).toBe(productB?.price);
    expect(productsB.find((product) => product.name === 'Sugar')?._id).toBe(sharedSugarId);
    expect(ordersForMonthA[0]?.category_name).toBe('Uncategorized');
    expect(ordersForMonthA[1]?.category_name).toBe('Friends');
    expect(sugarItems).toHaveLength(2);
    expect(sugarItems[0]?.product_id).toBe(sharedSugarId);
    expect(sugarItems[1]?.product_id).toBe(allUserSugarProducts[0]?._id);
    expect(allUserSugarProducts).toHaveLength(1);
    expect((allUserSugarProducts[0] as ProductWithSource | undefined)?.sourceProductId).toBe(
      sharedSugarId
    );
  });

  test('orders.updateCategory updates order snapshot and enforces ownership', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'category-update-a@example.com', 'Category A');
    const userB = await createAuthenticatedUser(t, 'category-update-b@example.com', 'Category B');

    const monthA = await userA.auth.mutation(api.months.add, { year: 2026, month: 7 });
    await userB.auth.mutation(api.months.add, { year: 2026, month: 7 });

    const firstCategory = await userA.auth.mutation(orderCategories.add, {
      name: 'Category One',
    });
    const secondCategory = await userA.auth.mutation(orderCategories.add, {
      name: 'Category Two',
    });
    const foreignCategory = await userB.auth.mutation(orderCategories.add, {
      name: 'Foreign Category',
    });

    const order = await userA.auth.mutation(api.orders.add, {
      month_id: monthA!._id,
      source: 'manual',
      notes: 'weekly groceries',
      category_id: firstCategory!._id,
      items: [{ name: 'Rice', quantity: 1, unit: 'kg', price: 90 }],
    });

    expect(order?.category_name).toBe('Category One');

    const updatedOrder = await userA.auth.mutation(api.orders.updateCategory, {
      id: order!._id,
      category_id: secondCategory!._id,
    });

    expect(updatedOrder?.category_name).toBe('Category Two');
    expect(updatedOrder?.category_id).toBe(secondCategory!._id);

    const ordersForMonthA = await userA.auth.query(api.orders.getByMonth, { monthId: monthA!._id });
    const analyticsA = await userA.auth.query(api.analytics.getByMonth, { monthId: monthA!._id });

    expect(ordersForMonthA[0]?.category_name).toBe('Category Two');
    expect(analyticsA.by_order_category).toEqual([{ category: 'Category Two', amount: 90 }]);

    await expect(
      userA.auth.mutation(api.orders.updateCategory, {
        id: order!._id,
        category_id: foreignCategory!._id,
      })
    ).rejects.toThrow('Order category not found.');

    await expect(
      userB.auth.mutation(api.orders.updateCategory, {
        id: order!._id,
        category_id: foreignCategory!._id,
      })
    ).rejects.toThrow('Order not found.');
  });

  test('analytics and month detail queries are scoped to the signed-in user', async () => {
    const t = createBackend();
    const userA = await createAuthenticatedUser(t, 'analytics-a@example.com', 'Analytics A');
    const userB = await createAuthenticatedUser(t, 'analytics-b@example.com', 'Analytics B');

    const monthA1 = await userA.auth.mutation(api.months.add, { year: 2026, month: 1 });
    const monthA2 = await userA.auth.mutation(api.months.add, { year: 2026, month: 2 });
    const monthB = await userB.auth.mutation(api.months.add, { year: 2026, month: 1 });
    const categoriesA = (await userA.auth.query(orderCategories.get, {})) as OrderCategory[];
    const friendsCategory = categoriesA.find((category) => category.name === 'Friends');
    const guestsCategory = categoriesA.find((category) => category.name === 'Guests');

    await userA.auth.mutation(api.orders.add, {
      month_id: monthA1!._id,
      source: 'manual',
      notes: '',
      category_id: friendsCategory!._id,
      items: [{ name: 'Dal', quantity: 2, unit: 'kg', price: 120 }],
    });
    await userA.auth.mutation(api.orders.add, {
      month_id: monthA2!._id,
      source: 'manual',
      notes: '',
      category_id: guestsCategory!._id,
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
    expect(analyticsA.by_order_category).toEqual([{ category: 'Friends', amount: 240 }]);
    expect(comparisonA).toHaveLength(2);
    expect(comparisonA.every((month) => month.total !== 60)).toBe(true);

    await expect(userA.auth.query(api.orders.getByMonth, { monthId: monthB!._id })).rejects.toThrow(
      'Month not found.'
    );
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

  test('cleanup removes ownerless months and orders without deleting shared products', async () => {
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
    const ordersBeforeCleanup = await user.auth.query(api.orders.getByMonth, {
      monthId: month!._id,
    });
    const productsBeforeCleanup = await user.auth.query(api.products.get, {});

    expect(monthsBeforeCleanup).toHaveLength(1);
    expect(ordersBeforeCleanup).toHaveLength(0);
    expect(productsBeforeCleanup).toHaveLength(1);
    expect(productsBeforeCleanup[0]?.name).toBe('Legacy Product');

    const cleanupResult = await t.mutation(internal.auth.cleanupLegacyOwnerlessData, {});

    const monthsAfterCleanup = await t.run(async (ctx) => ctx.db.query('months').collect());
    const ordersAfterCleanup = await t.run(async (ctx) => ctx.db.query('orders').collect());
    const itemsAfterCleanup = await t.run(async (ctx) => ctx.db.query('order_items').collect());
    const productsAfterCleanup = await t.run(async (ctx) => ctx.db.query('products').collect());

    expect(cleanupResult.monthsDeleted).toBe(1);
    expect(cleanupResult.ordersDeleted).toBe(1);
    expect(cleanupResult.orderItemsDeleted).toBe(1);
    expect(cleanupResult.productsDeleted).toBe(0);
    expect(monthsAfterCleanup).toHaveLength(1);
    expect(ordersAfterCleanup).toHaveLength(0);
    expect(itemsAfterCleanup).toHaveLength(0);
    expect(productsAfterCleanup).toHaveLength(1);
  });

  test('scan.processImage still fails fast when the Gemini key is missing for an authenticated user', async () => {
    const t = createBackend();
    const user = await createAuthenticatedUser(t, 'scan@example.com', 'Scan User');

    await expect(
      user.auth.action(api.scan.processImage, { image: 'ZmFrZQ==', type: 'receipt' })
    ).rejects.toThrow('GEMINI_API_KEY is not configured.');
  });
});
