import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  products: defineTable({
    name: v.string(),
    category: v.string(),
    unit: v.string(),
    price: v.number(),
    updated_at: v.optional(v.string()),
  }).index('by_name', ['name']),
  months: defineTable({
    year: v.number(),
    month: v.number(),
  }).index('by_year_month', ['year', 'month']),
  orders: defineTable({
    month_id: v.id('months'),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
  }).index('by_month_id', ['month_id']),
  order_items: defineTable({
    order_id: v.id('orders'),
    product_id: v.optional(v.id('products')),
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    price: v.number(),
  }).index('by_order_id', ['order_id']),
});
