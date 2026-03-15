import { v } from 'convex/values';

import { query } from './_generated/server';
import { requireCurrentUser } from './auth';
import { getMonthAnalytics, getMonthSummaries } from './domain';

export const getByMonth = query({
  args: {
    monthId: v.id('months'),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    return getMonthAnalytics(ctx, user._id, args.monthId);
  },
});

export const getComparison = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx);
    const months = await getMonthSummaries(ctx, user._id);
    return months.slice(0, 6).map((month) => ({
      year: month.year,
      month: month.month,
      total: month.total,
      order_count: month.order_count,
    }));
  },
});
