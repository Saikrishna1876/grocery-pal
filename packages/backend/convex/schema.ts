import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

import { tables as authTables } from './betterAuth/schema';

export default defineSchema({
  ...authTables,
  order_categories: defineTable({
    userId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    systemKey: v.optional(v.string()),
  })
    .index('by_user_normalized_name', ['userId', 'normalizedName'])
    .index('by_user_system_key', ['userId', 'systemKey']),
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
    category_id: v.optional(v.id('order_categories')),
    category_name: v.optional(v.string()),
  })
    .index('by_user_month_id', ['userId', 'month_id'])
    .index('by_user_category_id', ['userId', 'category_id']),
  order_items: defineTable({
    order_id: v.id('orders'),
    product_id: v.optional(v.id('products')),
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    price: v.number(),
  }).index('by_order_id', ['order_id']),
  shared_lists: defineTable({
    owner_id: v.string(),
    name: v.string(),
    notes: v.optional(v.string()),
    created_at: v.number(),
    updated_at: v.number(),
    deleted_at: v.optional(v.number()),
    converted_order_id: v.optional(v.id('orders')),
    converted_at: v.optional(v.number()),
  })
    .index('by_owner_id', ['owner_id'])
    .index('by_owner_updated_at', ['owner_id', 'updated_at']),
  shared_list_members: defineTable({
    list_id: v.id('shared_lists'),
    user_id: v.string(),
    role: v.union(v.literal('owner'), v.literal('editor')),
    added_by: v.string(),
    created_at: v.number(),
  })
    .index('by_list_id', ['list_id'])
    .index('by_user_id', ['user_id'])
    .index('by_list_user', ['list_id', 'user_id']),
  shared_list_items: defineTable({
    list_id: v.id('shared_lists'),
    name: v.string(),
    quantity: v.number(),
    unit: v.string(),
    price: v.number(),
    completed: v.boolean(),
    completed_at: v.optional(v.number()),
    created_by: v.string(),
    updated_by: v.string(),
    created_at: v.number(),
    updated_at: v.number(),
    deleted_at: v.optional(v.number()),
    deleted_by: v.optional(v.string()),
  }).index('by_list_id', ['list_id']),
  shared_list_invites: defineTable({
    list_id: v.id('shared_lists'),
    email: v.optional(v.string()),
    token: v.string(),
    is_multi_use: v.optional(v.boolean()),
    created_by: v.string(),
    created_at: v.number(),
    expires_at: v.number(),
    accepted_at: v.optional(v.number()),
    revoked_at: v.optional(v.number()),
  })
    .index('by_list_id', ['list_id'])
    .index('by_token', ['token']),
  shared_list_activity_events: defineTable({
    list_id: v.id('shared_lists'),
    actor_user_id: v.string(),
    event_type: v.string(),
    item_id: v.optional(v.id('shared_list_items')),
    metadata: v.optional(v.string()),
    created_at: v.number(),
  }).index('by_list_created_at', ['list_id', 'created_at']),
});
