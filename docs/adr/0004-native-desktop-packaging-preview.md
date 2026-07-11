# ADR 0004: Native Desktop Packaging Preview

## Status

Accepted for M12.

## Context

M11 established endpoint discovery and compatibility negotiation. M12 must make the dry-run Desktop Shell repeatably buildable as a native Windows preview without expanding its execution authority.

## Options

### A. Keep the source-only Vite shell

This has the smallest build surface, but cannot validate installation, packaged origins, native identity, or artifact handling.

### B. Package Tauri and depend on an independent MCAgent Endpoint

This produces a real native application while preserving the M11 Planner Plane / Execution Plane boundary. The endpoint may be local or remote, but must pass `GET /v1/meta` compatibility checks.

### C. Package Tauri with a Python sidecar

This simplifies local startup but adds process lifecycle, port allocation, signing, updating, crash recovery, and supply-chain concerns. Those concerns require a separate ADR.

## Decision

Adopt Option B. M12 builds a real Tauri Native Desktop Preview. It does not bundle or start MCAgent Server. A user or developer runs a compatible endpoint independently. An unreachable endpoint is reported clearly; an incompatible endpoint blocks planning. Desktop-local Environment Preview and the consented Safe Platform Probe remain available.

The Windows x64 NSIS artifact is an unsigned preview, not a stable release and not a Minecraft installer. It requests current-user installation and contains no Minecraft, Java, resource files, Python runtime, sidecar, updater, or Local Executor.

## Rationale

Python is not bundled because its lifecycle and update trust model are unresolved. No background server is started because packaged Desktop must not create hidden processes or imply that planning is available. Windows is first because it is the locally testable target; macOS notarization and Linux distribution are separate platform work, not rejected future platforms.

Packaging does not justify future permissions. The application has only Tauri core window capability. Filesystem, shell, process, updater, autostart, Java detection, path scanning, downloads, installation, instance writes, and launch remain disabled.

## Consequences

- `VITE_MCAGENT_API_URL` remains an explicit build-time endpoint override; the development fallback is `http://127.0.0.1:8000`.
- Desktop performs one startup compatibility check and only retries on user action.
- Future sidecar, updater, signing/notarization, and Local Executor work each requires independent design and permission review.
- CI may upload an unsigned workflow artifact, but does not create a GitHub Release.
