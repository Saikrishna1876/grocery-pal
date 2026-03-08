import { v } from 'convex/values';

import { query } from './_generated/server';
import { getMonthAnalytics, getMonthSummaries } from './domain';

export const getByMonth = query({
  args: {
    monthId: v.id('months'),
  },
  handler: async (ctx, args) => {
    return getMonthAnalytics(ctx, args.monthId);
  },
});

export const getComparison = query({
  args: {},
  handler: async (ctx) => {
    const months = await getMonthSummaries(ctx);
    return months.slice(0, 6).map((month) => ({
      year: month.year,
      month: month.month,
      total: month.total,
      order_count: month.order_count,
    }));
  },
});
