/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adapter from '../adapter.js';
import type * as auth from '../auth.js';

import type { ApiFromModules, FilterApi, FunctionReference } from 'convex/server';
import { anyApi, componentsGeneric } from 'convex/server';

const fullApi: ApiFromModules<{
  adapter: typeof adapter;
  auth: typeof auth;
}> = anyApi as unknown as ApiFromModules<{
  adapter: typeof adapter;
  auth: typeof auth;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<'query' | 'mutation' | 'action', 'public'>
> = anyApi as unknown as FilterApi<
  typeof fullApi,
  FunctionReference<'query' | 'mutation' | 'action', 'public'>
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<'query' | 'mutation' | 'action', 'internal'>
> = anyApi as unknown as FilterApi<
  typeof fullApi,
  FunctionReference<'query' | 'mutation' | 'action', 'internal'>
>;

export const components = componentsGeneric() as unknown as {};
