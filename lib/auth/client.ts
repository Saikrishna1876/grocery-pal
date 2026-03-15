import { expoClient } from '@better-auth/expo/client';
import { convexClient } from '@convex-dev/better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { resolveRuntimeUrl } from '@/lib/runtime-url';

export const authBaseUrl = resolveRuntimeUrl(
  process.env.EXPO_PUBLIC_AUTH_URL ?? process.env.EXPO_PUBLIC_CONVEX_SITE_URL
);

if (!authBaseUrl) {
  throw new Error('EXPO_PUBLIC_AUTH_URL or EXPO_PUBLIC_CONVEX_SITE_URL must be configured.');
}

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
  basePath: '/api/auth',
  plugins: [
    expoClient({
      scheme: 'app',
      storage: SecureStore,
      storagePrefix: 'expense-tracking-app',
    }),
    convexClient(),
  ],
});

export const useSession = authClient.useSession;

function getAuthErrorMessage(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback;
}

export async function signInEmail({ email, password }: { email: string; password: string }) {
  const result = await authClient.signIn.email({
    email,
    password,
  });

  if (result.error) {
    throw new Error(getAuthErrorMessage(result.error, 'Failed to sign in.'));
  }

  return result.data;
}

export async function signUpEmail({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const result = await authClient.signUp.email({
    name,
    email,
    password,
  });

  if (result.error) {
    throw new Error(getAuthErrorMessage(result.error, 'Failed to sign up.'));
  }

  return result.data;
}

export async function signOut() {
  const result = await authClient.signOut();
  if (result.error) {
    throw new Error(getAuthErrorMessage(result.error, 'Failed to sign out.'));
  }

  return result.data;
}
