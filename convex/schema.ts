import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { tables as authTables } from './betterAuth/schema';

export default defineSchema({
  ...authTables,
  products: defineTable({
    userId: v.optional(v.string()),
    sourceProductId: v.optional(v.id('products')),
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    price: v.number(),
    updated_at: v.optional(v.string()),
  })
    .index('by_user_name', ['userId', 'name'])
    .index('by_user_source_product', ['userId', 'sourceProductId']),
  months: defineTable({
    userId: v.optional(v.string()),
    year: v.number(),
    month: v.number(),
  }).index('by_user_year_month', ['userId', 'year', 'month']),
  orders: defineTable({
    userId: v.optional(v.string()),
    month_id: v.id('months'),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index('by_user_month_id', ['userId', 'month_id']),
  order_items: defineTable({
    order_id: v.id('orders'),
    product_id: v.optional(v.id('products')),
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    price: v.number(),
  }).index('by_order_id', ['order_id']),
});
