import { createClient } from '@convex-dev/better-auth';
import { betterAuth } from 'better-auth';
import { ConvexError } from 'convex/values';

import { components, internal } from './_generated/api';
import type { DataModel } from './_generated/dataModel';
import { internalMutation, type MutationCtx } from './_generated/server';
import { buildAuthOptions } from './authOptions';

export const authComponent = createClient<DataModel>(components.betterAuth);

type AuthAdapterCtx = Parameters<typeof authComponent.adapter>[0];
type AuthUserCtx = Parameters<typeof authComponent.getAuthUser>[0];
type CtxWithRunMutation = Pick<MutationCtx, 'runMutation'>;

function hasRunMutation(ctx: unknown): ctx is CtxWithRunMutation {
  if (typeof ctx !== 'object' || ctx === null || !('runMutation' in ctx)) {
    return false;
  }

  return typeof (ctx as { runMutation?: unknown }).runMutation === 'function';
}

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

export const createAuthOptions = () =>
  buildAuthOptions({
    secret: getBetterAuthSecret(),
    baseURL: getBetterAuthBaseUrl(),
    jwks: process.env.JWKS,
  });

export const createAuth = <TCtx>(ctx: TCtx) =>
  betterAuth({
    ...createAuthOptions(),
    database: authComponent.adapter(ctx as AuthAdapterCtx),
    databaseHooks: {
      user: {
        create: {
          after: async (authUser) => {
            if (!hasRunMutation(ctx)) {
              return;
            }

            await ctx.runMutation(internal.orderCategories.seedDefaultsForUser, {
              userId: authUser.id,
            });
          },
        },
      },
    },
  });

export const { getAuthUser } = authComponent.clientApi();

export async function requireCurrentUser<TCtx>(ctx: TCtx) {
  try {
    return await authComponent.getAuthUser(ctx as AuthUserCtx);
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
