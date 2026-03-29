import { createApi } from '@convex-dev/better-auth';

import { createAuthOptionsForSchema } from '../authOptions';
import schema from './schema';

export const { create, findOne, findMany, updateOne, updateMany, deleteOne, deleteMany } =
  createApi(schema, createAuthOptionsForSchema);
