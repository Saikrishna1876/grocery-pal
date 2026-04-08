import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { requireCurrentUser } from './auth';
import { getMonthSummaries } from './domain';

export const get = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    return getMonthSummaries(ctx, user._id);
  },
});

export const add = mutation({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const existing = await ctx.db
      .query('months')
      .withIndex('by_user_year_month', (q) =>
        q.eq('userId', user._id).eq('year', args.year).eq('month', args.month),
      )
      .unique();

    if (existing) {
      return existing;
    }

    const monthId = await ctx.db.insert('months', {
      userId: user._id,
      year: args.year,
      month: args.month,
    });

    return ctx.db.get(monthId);
  },
});
