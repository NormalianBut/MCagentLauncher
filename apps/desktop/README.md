# MCagentlauncher Desktop Shell

`apps/desktop` is the M7 Desktop Shell for MCagentlauncher v0.1 - Natural Instance. It is a React, TypeScript, and Vite UI with a minimal Tauri native shell placeholder.

The current desktop app is a dry-run preview surface. It can call the MCAgent Server API, display intent parsing, display resource planning, generate install-action previews, and show executor dry-run results. It does not perform real local execution.

## Start MCAgent Server

From the repository root:

```bash
pnpm dev:server
```

Or from the server directory:

```bash
cd services/mcagent-server
python -m uvicorn app.main:app --reload
```

## Start Desktop Dev UI

From the repository root:

```bash
pnpm dev:desktop
```

Or from this directory:

```bash
pnpm dev
```

## Configure API URL

The Desktop Shell reads:

```bash
VITE_MCAGENT_API_URL=http://127.0.0.1:8000
```

If the variable is not set, the default is `http://127.0.0.1:8000`.

## Build

```bash
pnpm --dir apps/desktop build
```

This validates the React/Vite Desktop Shell. The Tauri native build is intentionally not required for M7 because native packaging can require platform-specific toolchains.

## Current Safety Boundary

M7 does not:

- download Minecraft or resource files;
- install Fabric, Forge, NeoForge, mods, resource packs, or shader packs;
- create or write a local instance;
- write `mods`, `resourcepacks`, or `shaderpacks`;
- launch Minecraft;
- execute shell commands;
- detect real Minecraft paths;
- store tokens, secrets, or API keys.

All generated install actions are dry-run previews with `dryRun=true` and `requiresUserConfirmation=true`.

The Confirm Install button is preview-only. Clicking it only shows that real execution is not enabled in M7. A real Desktop Local Executor will be introduced in a later milestone after explicit confirmation, rollback, hash verification, and local execution design are complete.
