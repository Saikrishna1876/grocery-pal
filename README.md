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

## EAS setup and commands

This workspace already includes EAS project metadata in `apps/mobile/app.json`.

```bash
# Verify Expo account auth
bun run eas:whoami

# Build Android preview APK (internal distribution)
bun run eas:build:preview:android

# Build production artifacts
bun run eas:build:prod:android
bun run eas:build:prod:ios

# Push OTA updates
bun run eas:update:preview
bun run eas:update:production

# Submit latest production builds
bun run eas:submit:android
bun run eas:submit:ios
```
