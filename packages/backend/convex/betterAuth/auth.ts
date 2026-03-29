import type { BetterAuthOptions } from 'better-auth';

import { createAuthOptionsForSchema } from '../authOptions';

// This module is referenced by generated component typings.
// Avoid importing the app-level auth client (which depends on `components.*`)
// from within the Better Auth component.
export const authOptions = createAuthOptionsForSchema() satisfies BetterAuthOptions;

// Backwards-compatible shape for any tooling expecting `auth.options`.
export const auth = { options: authOptions };
