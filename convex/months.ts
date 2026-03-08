import { v } from 'convex/values';

import { mutation, query } from './_generated/server';
import { getMonthSummaries } from './domain';

export const get = query({
  args: {},
  handler: async (ctx) => {
    return getMonthSummaries(ctx);
  },
});

export const add = mutation({
  args: {
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('months')
      .withIndex('by_year_month', (q) => q.eq('year', args.year).eq('month', args.month))
      .unique();

    if (existing) {
      return existing;
    }

    const monthId = await ctx.db.insert('months', {
      year: args.year,
      month: args.month,
    });

    return ctx.db.get(monthId);
  },
});
