import { createClient } from '@convex-dev/better-auth';
import type { GenericCtx } from '@convex-dev/better-auth/utils';
import { betterAuth } from 'better-auth';
import { ConvexError } from 'convex/values';

import { components } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { internalMutation } from './_generated/server';
import { buildAuthOptions } from './authOptions';
import schema from './betterAuth/schema';

type AuthCtx = GenericCtx<DataModel>;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  local: { schema },
});

function getBetterAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    console.warn('BETTER_AUTH_SECRET is not configured. Falling back to an insecure local secret.');
    return 'local-dev-better-auth-secret';
  }

  return secret;
}

function getBetterAuthBaseUrl() {
  // Prefer Convex-provided site URL when available.
  // NOTE: `CONVEX_SITE_URL` is injected automatically by Convex in deployed environments.
  const baseUrl = process.env.CONVEX_SITE_URL ?? process.env.SITE_URL;
  if (!baseUrl) {
    console.warn('CONVEX_SITE_URL (or SITE_URL) is not configured. Falling back to localhost.');
    return 'http://127.0.0.1';
  }

  return baseUrl;
}

export const createAuthOptions = (_ctx: AuthCtx) =>
  buildAuthOptions({
    secret: getBetterAuthSecret(),
    baseURL: getBetterAuthBaseUrl(),
    jwks: process.env.JWKS,
  });

export const createAuth = (ctx: AuthCtx) =>
  betterAuth({
    ...createAuthOptions(ctx),
    database: authComponent.adapter(ctx),
  });

export const { getAuthUser } = authComponent.clientApi();

export async function requireCurrentUser(ctx: AuthCtx) {
  try {
    return await authComponent.getAuthUser(ctx);
  } catch (error) {
    if (error instanceof ConvexError && error.data === 'Unauthenticated') {
      throw error;
    }

    throw new ConvexError('Unauthenticated');
  }
}

export const cleanupLegacyOwnerlessData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ownerlessMonths = (await ctx.db.query('months').collect()).filter(
      (month) => !month.userId
    );
    const ownerlessOrders = (await ctx.db.query('orders').collect()).filter(
      (order) => !order.userId
    );
    let deletedOrderItems = 0;
    for (const order of ownerlessOrders) {
      const items = await ctx.db
        .query('order_items')
        .withIndex('by_order_id', (q) => q.eq('order_id', order._id))
        .collect();

      for (const item of items) {
        await ctx.db.delete(item._id);
        deletedOrderItems += 1;
      }

      await ctx.db.delete(order._id);
    }

    for (const month of ownerlessMonths) {
      await ctx.db.delete(month._id);
    }
    return {
      monthsDeleted: ownerlessMonths.length,
      ordersDeleted: ownerlessOrders.length,
      orderItemsDeleted: deletedOrderItems,
      productsDeleted: 0,
    };
  },
});
