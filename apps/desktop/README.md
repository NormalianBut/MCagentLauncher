# MCagentlauncher Native Desktop Preview

`apps/desktop` is the v0.1 alpha Desktop Shell for MCagentlauncher v0.1 - Natural Instance. M12 packages the React, TypeScript, and Vite UI as a Windows-first Tauri Native Desktop Preview.

The current desktop app is a dry-run preview surface. It can call the MCAgent Server API, display intent parsing, display resource planning, generate install-action previews, and show executor dry-run results. It does not perform real local execution.

The v0.1 Alpha Preview has been released. M11 adds post-alpha endpoint discovery and compatibility gating through `GET /v1/meta`. MCAgent Server remains planner-only and Desktop Local Executor remains disabled.

M9 polishes the Desktop Shell into an alpha preview UI with:

- workflow stepper;
- safety banner;
- intent, plan, install, executor, and environment summary cards;
- collapsible raw JSON panels;
- readable diagnostics and warning lists;
- explicit preview-only messaging.

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

If the variable is not set, the development fallback is `http://127.0.0.1:8000`.

The fallback is a source-development convenience, not a packaged-runtime guarantee. Packaged Desktop does not include a Python sidecar in M11 and must not assume a local server exists. A compatible local or remote endpoint may be configured explicitly; Desktop validates API/schema versions and capabilities before enabling planning.

The development UI uses the fixed origin `http://localhost:1420`. The local MCAgent Server explicitly allows that origin, its `127.0.0.1` equivalent, and the current Tauri v2 local origins. Start the server before using the API workflow buttons.

If MCAgent Server is unavailable or incompatible, Parse Intent, Generate Plan, and Explain Plan are blocked with a classified connection message. Environment Preview and Safe Platform Probe remain Desktop-local and available; the probe still requires explicit consent. Endpoint and last-check state remain in the current session and are not saved to browser storage.

## Build

```bash
pnpm --dir apps/desktop build
```

This validates the React/Vite Desktop Shell. The Tauri native build is intentionally not required for M7 because native packaging can require platform-specific toolchains.

## M12 Native Packaging Preview

The packaged Desktop remains dry-run and depends on an independently started compatible MCAgent endpoint. It does not bundle or automatically start Python, and it includes no Local Executor or updater.

```powershell
pnpm check:desktop-version
pnpm check:desktop-security
pnpm package:desktop:windows
```

The Windows x64 NSIS output is copied to `artifacts/desktop-preview/` with an unsigned-preview filename, SHA-256 checksum, and non-sensitive artifact manifest. It is a manual test artifact, not a stable Release. See `docs/native-desktop-packaging-preview.md`.

`VITE_MCAGENT_API_URL` remains a build-time override. The URL must use HTTP(S) and cannot contain credentials. The packaged app performs one startup `/v1/meta` check and only retries when the user requests it. It never stores endpoint or environment-report data in browser storage.

Tauri permissions remain core-only. There are no filesystem, shell, process, updater, autostart, sidecar, download, installation, instance-write, Java-probe, path-scan, or Minecraft-launch commands.

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

## Environment Preview

M8 adds a `Generate Environment Preview` control.

The current environment report is mock data generated in the Desktop UI. It is used to preview the shape of a future read-only local environment report.

The current Environment Preview:

- does not read a real Minecraft path;
- does not check a real Java installation;
- does not scan the disk;
- does not call a Tauri command;
- does not upload local environment information;
- keeps `localOnly=true`;
- keeps `uploadAllowed=false`;
- redacts path-like values in the shared helper contract.

Future real read-only probing will require explicit user consent and will remain a Desktop Local Executor responsibility.

## User-consented Read-only Probe

M8.1 adds `Run Read-only Probe`.

Current behavior:

- clicking the button opens a consent modal first;
- canceling does not generate a read-only report;
- confirming generates a local read-only preview report in React state;
- `source.mode=read_only_probe`;
- `source.consentGranted=true`;
- `privacy.localOnly=true`;
- `privacy.uploadAllowed=false`;
- `probe.filesWritten=0`;
- `probe.networkRequests=0`.

M8.1 still does not execute real system commands, does not run `java -version`, does not inspect a real Minecraft path, does not scan disks, does not upload reports, does not write reports to files, and does not persist reports in localStorage or sessionStorage.

Environment report is session-only unless a future user explicitly exports it. M8.1 does not implement export.

## M8.2 Probe Policy

M8.2 is still a preview and policy milestone.

Current policy allows only:

- `mock_environment_report`
- `consented_read_only_preview`

Current policy disables real Java probes, path probes, disk scans, network probes, uploads, persistence, file writes, process launch, and resource downloads.

Future real probes must pass `packages/shared-types/src/probePolicy.ts` and the ADR/permission policy before implementation.

## M8.3 Safe Platform Probe

M8.3 upgrades `Run Read-only Probe` from a pure preview to a minimal consented safe platform probe.

After the user confirms the modal, Desktop may read only:

- OS/platform family from browser-safe platform metadata;
- architecture hint from browser-safe platform metadata;
- app version from `VITE_APP_VERSION` or the local fallback;
- Tauri runtime availability as a boolean.

The generated report stays in React state only and keeps:

- `source.mode=read_only_probe`
- `source.consentGranted=true`
- `probe.commandsExecuted=[]`
- `probe.filesWritten=0`
- `probe.networkRequests=0`
- `privacy.localOnly=true`
- `privacy.uploadAllowed=false`

M8.3 still does not read Java, Minecraft paths, home directories, AppData, PATH, disk state, memory state, network state, browser storage, or filesystem data. It does not upload reports, write files, download resources, install resources, or launch processes.

## M9 Alpha Preview UI

M9 keeps the same safety boundary and only improves presentation.

The Desktop UI now makes these states explicit:

- `dryRun=true`
- `requiresUserConfirmation=true`
- `canExecute=false`
- `localOnly=true`
- `uploadAllowed=false`
- `filesWritten=0`
- `networkRequests=0`

Raw JSON remains available for review, but each module also has a human-readable summary. Confirm Install remains preview-only and only reports that the real Desktop Local Executor is not enabled.
