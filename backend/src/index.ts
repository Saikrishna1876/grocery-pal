import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const app = new Hono();

app.use('*', cors({ credentials: true, origin: (origin) => origin || '*' }));

app.get('/', (c) => c.json({ status: 'ok', message: 'Ration Tracker API' }));

// ─── PRODUCTS ───

app.get('/api/products', async (c) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('category')
    .order('name');
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.post('/api/products', async (c) => {
  const body = await c.req.json();
  const { data, error } = await supabase
    .from('products')
    .insert({ name: body.name, category: body.category, unit: body.unit, price: body.price })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.patch('/api/products/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { data, error } = await supabase
    .from('products')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ─── MONTHS ───

app.get('/api/months', async (c) => {
  const { data, error } = await supabase
    .from('months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);

  // Enrich with totals
  const enriched = await Promise.all(
    (data || []).map(async (m: any) => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('month_id', m.id);
      const orderIds = (orders || []).map((o: any) => o.id);
      let total = 0;
      let itemCount = 0;
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('price, quantity')
          .in('order_id', orderIds);
        (items || []).forEach((item: any) => {
          total += Number(item.price) * Number(item.quantity);
          itemCount++;
        });
      }
      return { ...m, total, order_count: orderIds.length, item_count: itemCount };
    })
  );

  return c.json(enriched);
});

app.post('/api/months', async (c) => {
  const body = await c.req.json();
  // Check for existing
  const { data: existing } = await supabase
    .from('months')
    .select('*')
    .eq('year', body.year)
    .eq('month', body.month)
    .single();
  if (existing) return c.json(existing);

  const { data, error } = await supabase
    .from('months')
    .insert({ year: body.year, month: body.month })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ─── ORDERS ───

app.get('/api/months/:monthId/orders', async (c) => {
  const monthId = c.req.param('monthId');
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('month_id', monthId)
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);

  const enriched = await Promise.all(
    (orders || []).map(async (order: any) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);
      const total = (items || []).reduce(
        (sum: number, item: any) => sum + Number(item.price) * Number(item.quantity),
        0
      );
      return { ...order, items: items || [], total };
    })
  );

  return c.json(enriched);
});

app.post('/api/orders', async (c) => {
  const body = await c.req.json();
  const { month_id, source, notes, items } = body;

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ month_id, source: source || 'manual', notes })
    .select()
    .single();
  if (orderError) return c.json({ error: orderError.message }, 500);

  // Insert items and update product prices
  for (const item of items) {
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: item.product_id || null,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || 'unit',
      price: item.price,
    });

    // Adaptive Price Memory: update product price if product_id exists
    if (item.product_id) {
      await supabase
        .from('products')
        .update({ price: item.price, updated_at: new Date().toISOString() })
        .eq('id', item.product_id);
    }
  }

  return c.json(order);
});

app.delete('/api/orders/:id', async (c) => {
  const id = c.req.param('id');
  await supabase.from('order_items').delete().eq('order_id', id);
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// ─── ANALYTICS ───

app.get('/api/months/:monthId/analytics', async (c) => {
  const monthId = c.req.param('monthId');

  const { data: orders } = await supabase
    .from('orders')
    .select('id')
    .eq('month_id', monthId);
  const orderIds = (orders || []).map((o: any) => o.id);

  if (orderIds.length === 0) {
    return c.json({ total: 0, order_count: 0, items: [], top_items: [], by_category: [] });
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*, products(category)')
    .in('order_id', orderIds);

  let total = 0;
  const itemMap: Record<string, { name: string; category: string; quantity: number; total: number; count: number }> = {};

  (items || []).forEach((item: any) => {
    const subtotal = Number(item.price) * Number(item.quantity);
    total += subtotal;
    const key = item.name.toLowerCase();
    if (!itemMap[key]) {
      itemMap[key] = {
        name: item.name,
        category: (item.products as any)?.category || 'Other',
        quantity: 0,
        total: 0,
        count: 0,
      };
    }
    itemMap[key].quantity += Number(item.quantity);
    itemMap[key].total += subtotal;
    itemMap[key].count += 1;
  });

  const itemList = Object.values(itemMap).sort((a, b) => b.total - a.total);
  const byCategory: Record<string, number> = {};
  itemList.forEach((i) => {
    byCategory[i.category] = (byCategory[i.category] || 0) + i.total;
  });

  return c.json({
    total,
    order_count: orderIds.length,
    items: itemList,
    top_items: itemList.slice(0, 5),
    by_category: Object.entries(byCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  });
});

app.get('/api/analytics/comparison', async (c) => {
  const { data: months } = await supabase
    .from('months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(6);

  const comparison = await Promise.all(
    (months || []).map(async (m: any) => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('month_id', m.id);
      const orderIds = (orders || []).map((o: any) => o.id);
      let total = 0;
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('price, quantity')
          .in('order_id', orderIds);
        (items || []).forEach((item: any) => {
          total += Number(item.price) * Number(item.quantity);
        });
      }
      return { year: m.year, month: m.month, total, order_count: orderIds.length };
    })
  );

  return c.json(comparison);
});

// ─── IMAGE PROCESSING WITH GEMINI ───

app.post('/api/scan', async (c) => {
  try {
    const body = await c.req.json();
    const { image, type } = body; // image: base64, type: 'receipt' | 'list' | 'groceries'

    if (!image) return c.json({ error: 'No image provided' }, 400);

    // Fetch all products for matching
    const { data: products } = await supabase
      .from('products')
      .select('*');

    const productList = (products || [])
      .map((p: any) => `${p.name} (${p.category}, ${p.unit}, ₹${p.price})`)
      .join('\n');

    let prompt = '';
    if (type === 'groceries') {
      prompt = `You are analyzing a photo of physical grocery items. Identify each visible grocery item, estimate the quantity of each, and match them with known products.

Known products database:
${productList}

Instructions:
- Identify each visible grocery item
- Count quantities of each item
- Match with known products when possible
- For matched items, use the database price
- For unmatched items, estimate a reasonable price
- Return ONLY valid JSON, no markdown`;
    } else {
      prompt = `You are analyzing a grocery receipt or shopping list image. Extract all items with their names, quantities, and prices.

Known products database:
${productList}

Instructions:
- Extract every item name from the image
- Extract quantities if visible
- Extract prices if visible
- Match with known products when possible
- For matched items without a visible price, use the database price
- Return ONLY valid JSON, no markdown`;
    }

    prompt += `

Return a JSON object with this exact structure:
{
  "items": [
    {
      "name": "Item Name",
      "quantity": 1,
      "unit": "kg",
      "price": 45.00,
      "matched_product": "Product Name from database or null",
      "matched_product_id": 1,
      "confidence": "high"
    }
  ],
  "source_type": "${type}",
  "notes": "any relevant notes about the scan"
}

For confidence, use: "high" if clearly readable/identifiable, "medium" if partially visible, "low" if uncertain.
If matched_product is null, set matched_product_id to null.
Return ONLY the JSON object, nothing else.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      },
    ]);

    const responseText = result.response.text();

    // Parse the JSON response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      return c.json({ error: 'Failed to parse AI response', raw: responseText }, 500);
    }

    // Enrich items with product database info for price comparison
    const enrichedItems = (parsed.items || []).map((item: any) => {
      const matchedProduct = (products || []).find(
        (p: any) => p.id === item.matched_product_id
      );
      return {
        ...item,
        database_price: matchedProduct ? Number(matchedProduct.price) : null,
        product_id: matchedProduct ? matchedProduct.id : null,
        price_difference: matchedProduct
          ? Number(item.price) - Number(matchedProduct.price)
          : null,
      };
    });

    return c.json({
      items: enrichedItems,
      source_type: parsed.source_type,
      notes: parsed.notes,
    });
  } catch (error: any) {
    console.error('Scan error:', error);
    return c.json({ error: error.message || 'Failed to process image' }, 500);
  }
});

export default {
  fetch: app.fetch,
  port: 3002,
};
