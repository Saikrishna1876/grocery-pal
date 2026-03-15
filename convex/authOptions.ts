import { expo } from '@better-auth/expo';
import { convex } from '@convex-dev/better-auth/plugins';
import type { BetterAuthOptions } from 'better-auth';

import authConfig from './auth.config';

export const AUTH_BASE_PATH = '/api/auth';
export const APP_SCHEME = 'app://';
export const EXPO_GO_SCHEME = 'exp://';

export function buildAuthOptions(opts: {
  secret: string;
  baseURL: string;
  jwks?: string;
}): BetterAuthOptions {
  return {
    secret: opts.secret,
    baseURL: opts.baseURL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: [APP_SCHEME, EXPO_GO_SCHEME],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    plugins: [
      expo(),
      convex({
        authConfig,
        jwks: opts.jwks,
        options: {
          basePath: AUTH_BASE_PATH,
        },
      }),
    ],
  };
}

// Used by the Better Auth component adapter at module init time to derive table
// definitions. Avoid reading deployment env vars here to prevent misleading
// warnings and to keep schema derivation deterministic.
export const createAuthOptionsForSchema = (_ctx: any) =>
  buildAuthOptions({
    secret: 'schema-only-secret',
    baseURL: 'http://127.0.0.1',
  });
