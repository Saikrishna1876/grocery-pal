import { ConvexError, v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action } from './_generated/server';
import { requireCurrentUser } from './auth';

const scanType = v.string();

type CatalogProduct = {
  _id: Id<'products'>;
  name: string;
  category: string;
  unit: string;
  price: number;
};

type ScanItem = {
  name?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  matched_product?: string | null;
  matched_product_id?: string | null;
  confidence?: string;
};

function getGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ConvexError('GEMINI_API_KEY is not configured.');
  }

  return apiKey;
}

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new ConvexError('Gemini returned an invalid response.');
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    throw new ConvexError('Gemini returned invalid JSON.');
  }
}

function buildPrompt(products: CatalogProduct[], type: string) {
  const productList = products
    .map((product) => `${product.name} (${product.category}, ${product.unit}, ₹${product.price})`)
    .join('\n');
  const knownProducts = productList || 'No known products yet.';

  const baseInstructions =
    type === 'groceries'
      ? `You are analyzing a photo of physical grocery items. Identify each visible grocery item, estimate the quantity of each, and match them with known products.

Known products database:
${knownProducts}

Instructions:
- Identify each visible grocery item
- Count quantities of each item
- Match with known products when possible
- For matched items, use the database price
- For unmatched items, estimate a reasonable price
- Return ONLY valid JSON, no markdown`
      : `You are analyzing a grocery receipt or shopping list image. Extract all items with their names, quantities, and prices.

Known products database:
${knownProducts}

Instructions:
- Extract every item name from the image
- Extract quantities if visible
- Extract prices if visible
- Match with known products when possible
- For matched items without a visible price, use the database price
- Return ONLY valid JSON, no markdown`;

  return `${baseInstructions}

Return a JSON object with this exact structure:
{
  "items": [
    {
      "name": "Item Name",
      "quantity": 1,
      "unit": "kg",
      "price": 45.0,
      "matched_product": "Product Name from database or null",
      "matched_product_id": "Convex Product ID or null",
      "confidence": "high"
    }
  ],
  "source_type": "${type}",
  "notes": "any relevant notes about the scan"
}

For confidence, use: "high" if clearly readable/identifiable, "medium" if partially visible, "low" if uncertain.
If matched_product is null, set matched_product_id to null.
Return ONLY the JSON object, nothing else.`;
}

async function callGemini(apiKey: string, prompt: string, image: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: image,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new ConvexError(`Gemini request failed with status ${response.status}.`);
  }

  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new ConvexError('Gemini returned an empty response.');
  }

  return text;
}

export const processImage = action({
  args: {
    image: v.string(),
    type: scanType,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const trimmed = args.image.replace(/^data:image\/\w+;base64,/, '').trim();
    if (!trimmed) {
      throw new ConvexError('No image provided.');
    }

    const products = (await ctx.runQuery(internal.products.catalog, {
      userId: user._id,
    })) as CatalogProduct[];
    const prompt = buildPrompt(products, args.type);
    const responseText = await callGemini(getGeminiKey(), prompt, trimmed);
    const parsed = extractJson(responseText);
    const productsByName = new Map(
      products.map((product) => [product.name.toLowerCase(), product]),
    );
    const productsById = new Map(products.map((product) => [product._id, product]));

    const items = (Array.isArray(parsed.items) ? parsed.items : []).map((item: ScanItem) => {
      const matchedById =
        typeof item.matched_product_id === 'string'
          ? productsById.get(item.matched_product_id as Id<'products'>)
          : undefined;
      const matchedByName = item.matched_product
        ? productsByName.get(item.matched_product.toLowerCase())
        : undefined;
      const matchedProduct = matchedById ?? matchedByName ?? null;
      const price = Number(item.price) || matchedProduct?.price || 0;

      return {
        name: item.name?.trim() || 'Unknown Item',
        quantity: Number(item.quantity) || 1,
        unit: item.unit?.trim() || matchedProduct?.unit || 'unit',
        price,
        matched_product: matchedProduct?.name ?? null,
        matched_product_id: matchedProduct?._id ?? null,
        confidence: item.confidence || 'medium',
        database_price: matchedProduct ? matchedProduct.price : null,
        product_id: matchedProduct ? matchedProduct._id : null,
        price_difference: matchedProduct ? price - matchedProduct.price : null,
      };
    });

    return {
      items,
      source_type: parsed.source_type || args.type,
      notes: parsed.notes || '',
    };
  },
});
