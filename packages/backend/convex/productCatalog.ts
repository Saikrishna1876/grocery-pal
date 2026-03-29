import { ConvexError } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx, QueryCtx } from './_generated/server';

type ProductDoc = Doc<'products'> & { sourceProductId?: Id<'products'> };
type ProductValues = Pick<ProductDoc, 'name' | 'category' | 'unit' | 'price'>;
type ReaderCtx = Pick<QueryCtx, 'db'>;
type WriterCtx = Pick<MutationCtx, 'db'>;

export function sortProducts<T extends { category: string; name: string }>(products: T[]) {
  return products.sort((a, b) => {
    const categoryCompare = a.category.localeCompare(b.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return a.name.localeCompare(b.name);
  });
}

function getNewestProduct(products: ProductDoc[]) {
  return products.sort((a, b) => b._creationTime - a._creationTime)[0] ?? null;
}

async function listProductsForUser(ctx: ReaderCtx, userId: string | undefined) {
  return ctx.db
    .query('products')
    .withIndex('by_user_name', (q) => q.eq('userId', userId))
    .collect();
}

export async function listAccessibleProducts(ctx: ReaderCtx, userId: string) {
  const [sharedProducts, userProducts] = await Promise.all([
    listProductsForUser(ctx, undefined),
    listProductsForUser(ctx, userId),
  ]);

  return [...sharedProducts, ...userProducts];
}

export async function listCatalogProducts(ctx: ReaderCtx, userId: string) {
  const [sharedProducts, userProducts] = await Promise.all([
    listProductsForUser(ctx, undefined),
    listProductsForUser(ctx, userId),
  ]);
  const overriddenSourceIds = new Set(
    userProducts.flatMap((product: ProductDoc) =>
      product.sourceProductId ? [product.sourceProductId] : []
    )
  );

  return sortProducts([
    ...sharedProducts.filter((product: ProductDoc) => !overriddenSourceIds.has(product._id)),
    ...userProducts,
  ]);
}

export async function getAccessibleProduct(
  ctx: ReaderCtx,
  userId: string,
  productId: Id<'products'>
) {
  const product = await ctx.db.get(productId);
  if (!product || (product.userId && product.userId !== userId)) {
    throw new ConvexError('Product not found.');
  }

  return product as ProductDoc;
}

export async function getUserOverrideForSource(
  ctx: ReaderCtx,
  userId: string,
  sourceProductId: Id<'products'>
) {
  return getNewestProduct(
    await ctx.db
      .query('products')
      .withIndex('by_user_source_product', (q) =>
        q.eq('userId', userId).eq('sourceProductId', sourceProductId)
      )
      .collect()
  );
}

export async function findLatestUserProductByName(ctx: ReaderCtx, userId: string, name: string) {
  return getNewestProduct(
    await ctx.db
      .query('products')
      .withIndex('by_user_name', (q) => q.eq('userId', userId).eq('name', name))
      .collect()
  );
}

export async function findSharedProductByName(ctx: ReaderCtx, name: string) {
  return getNewestProduct(
    await ctx.db
      .query('products')
      .withIndex('by_user_name', (q) => q.eq('userId', undefined).eq('name', name))
      .collect()
  );
}

export function sameProductValues(product: ProductValues, values: ProductValues) {
  return (
    product.name === values.name &&
    product.category === values.category &&
    product.unit === values.unit &&
    product.price === values.price
  );
}

export async function upsertProductOverride(
  ctx: WriterCtx,
  userId: string,
  sourceProduct: ProductDoc,
  values: ProductValues
) {
  const existingOverride = await getUserOverrideForSource(ctx, userId, sourceProduct._id);
  const now = new Date().toISOString();

  if (existingOverride) {
    await ctx.db.patch(existingOverride._id, {
      ...values,
      updated_at: now,
    });
    return (await ctx.db.get(existingOverride._id)) ?? existingOverride;
  }

  const productId = await ctx.db.insert('products', {
    userId,
    sourceProductId: sourceProduct._id,
    ...values,
    updated_at: now,
  });

  return ctx.db.get(productId);
}
