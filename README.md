# Grocery Pal Workspace

This repository is now a Turborepo workspace.

## Structure

- `apps/mobile` - Expo React Native app
- `packages/backend` - Convex backend workspace (`convex` sources under `packages/backend/convex`)

## Setup

```bash
bun install
```

## Common commands

```bash
# Start Expo app
bun run dev

# Run all checks in the mobile app with Turborepo
bun run turbo:check

# Run tasks individually through Turborepo
bun run turbo:lint
bun run turbo:typecheck
bun run turbo:test
```
