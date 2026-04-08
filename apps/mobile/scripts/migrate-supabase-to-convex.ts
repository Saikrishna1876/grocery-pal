import { createClient } from '@supabase/supabase-js';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import type { Id } from '../convex/_generated/dataModel.js';

// Load environment variables
// bun automatically loads .env, but we might need to be explicit if running with node
// Since we are running with bun, it should be fine. But just in case.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!supabaseUrl || !supabaseKey || !convexUrl) {
  console.error(
    'Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or EXPO_PUBLIC_CONVEX_URL',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const convex = new ConvexHttpClient(convexUrl);

async function migrate() {
  console.log('Starting migration...');

  // 1. Migrate Months
  console.log('Fetching months from Supabase...');
  const { data: months, error: monthsError } = await supabase.from('months').select('*');
  if (monthsError) throw new Error(`Error fetching months: ${monthsError.message}`);

  const monthIdMap: Record<string, Id<'months'>> = {};
  if (months && months.length > 0) {
    console.log(`Migrating ${months.length} months...`);
    // Batch in chunks if needed, but for simplicity do all
    // Map to Convex format
    const convexMonths = months.map((m) => ({
      userId: m.user_id || m.userId, // handle case variations
      year: m.year,
      month: m.month,
      originalId: m.id.toString(), // Ensure string
    }));

    const result = await convex.mutation(api.migrations.importMonths, { months: convexMonths });
    Object.assign(monthIdMap, result);
    console.log('Months migrated.');
  }

  // 2. Migrate Products
  console.log('Fetching products from Supabase...');
  const { data: products, error: productsError } = await supabase.from('products').select('*');
  if (productsError) throw new Error(`Error fetching products: ${productsError.message}`);

  const productIdMap: Record<string, Id<'products'>> = {};
  if (products && products.length > 0) {
    console.log(`Migrating ${products.length} products...`);
    const convexProducts = products.map((p) => ({
      userId: p.user_id || p.userId,
      name: p.name,
      category: p.category,
      unit: p.unit,
      price: p.price,
      updated_at: p.updated_at,
      originalId: p.id.toString(),
    }));

    const result = await convex.mutation(api.migrations.importProducts, {
      products: convexProducts,
    });
    Object.assign(productIdMap, result);
    console.log('Products migrated.');
  }

  // 3. Migrate Orders
  console.log('Fetching orders from Supabase...');
  const { data: orders, error: ordersError } = await supabase.from('orders').select('*');
  if (ordersError) throw new Error(`Error fetching orders: ${ordersError.message}`);

  const orderIdMap: Record<string, Id<'orders'>> = {};
  if (orders && orders.length > 0) {
    console.log(`Migrating ${orders.length} orders...`);
    const convexOrders = [];
    for (const o of orders) {
      const oldMonthId = o.month_id?.toString();
      const newMonthId = monthIdMap[oldMonthId];

      if (!newMonthId) {
        console.warn(
          `Skipping order ${o.id} because month ${oldMonthId} was not found in migration map.`,
        );
        continue;
      }

      convexOrders.push({
        userId: o.user_id || o.userId,
        month_id: newMonthId,
        source: o.source,
        notes: o.notes,
        originalId: o.id.toString(),
      });
    }

    if (convexOrders.length > 0) {
      const result = await convex.mutation(api.migrations.importOrders, { orders: convexOrders });
      Object.assign(orderIdMap, result);
    }
    console.log('Orders migrated.');
  }

  // 4. Migrate Order Items
  console.log('Fetching order_items from Supabase...');
  const { data: items, error: itemsError } = await supabase.from('order_items').select('*');
  if (itemsError) throw new Error(`Error fetching order_items: ${itemsError.message}`);

  if (items && items.length > 0) {
    console.log(`Migrating ${items.length} order items...`);
    const convexItems = [];
    for (const i of items) {
      const oldOrderId = i.order_id?.toString();
      const newOrderId = orderIdMap[oldOrderId];

      if (!newOrderId) {
        console.warn(`Skipping item ${i.id} because order ${oldOrderId} was not found.`);
        continue;
      }

      let newProductId: Id<'products'> | undefined;
      if (i.product_id) {
        const oldProductId = i.product_id.toString();
        newProductId = productIdMap[oldProductId];
        if (!newProductId) {
          console.warn(
            `Item ${i.id} references product ${oldProductId} which was not found. Keeping product_id undefined.`,
          );
        }
      }

      convexItems.push({
        order_id: newOrderId,
        product_id: newProductId,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        price: i.price,
      });
    }

    if (convexItems.length > 0) {
      // Chunk items to avoid payload limits
      const chunkSize = 100;
      for (let i = 0; i < convexItems.length; i += chunkSize) {
        const chunk = convexItems.slice(i, i + chunkSize);
        await convex.mutation(api.migrations.importOrderItems, { orderItems: chunk });
        console.log(`Migrated items ${i} to ${Math.min(i + chunkSize, convexItems.length)}`);
      }
    }
    console.log('Order Items migrated.');
  }

  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
