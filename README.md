# MCagentlauncher

MCagentlauncher is an open-source, community-driven intelligent launcher project for Minecraft Java Edition.

Current status: **v0.1 alpha preview**. It demonstrates the Natural Instance planning flow, but it does **not** install or launch Minecraft.

The v0.1 Alpha Preview has been released. M11 is post-alpha stabilization: it adds a versioned runtime contract between Desktop/Web clients and the planner-only MCAgent endpoint.

```text
natural language -> intent -> resource plan -> explanation -> install dry-run -> executor dry-run -> environment preview
```

## v0.1 Alpha Preview

- Current tag: `v0.1-alpha-preview`
- Release notes: `docs/releases/v0.1-alpha-preview.md`
- GitHub Release draft: `docs/releases/v0.1-alpha-github-release-draft.md`
- Demo guide: `docs/demo/v0.1-alpha-demo-flow.md`
- Release candidate checklist: `docs/releases/v0.1-alpha-release-candidate-checklist.md`
- Known limitations: `docs/releases/v0.1-alpha-known-limitations.md`

This alpha preview does not download, install, write local instances, or launch Minecraft.

## What Works Now

- MCAgent mock/offline server.
- Runtime JSON Schema validation.
- Intent parsing.
- Resource planning and diagnostics.
- Resource resolver data structures and Modrinth metadata client.
- Alias DB and planning pipeline.
- Web/API Playground.
- Desktop Shell.
- Install action dry-run preview.
- Executor dry-run preview with `canExecute=false`.
- Environment preview.
- User-consented safe platform probe for OS, arch, app version, and Tauri availability.
- GitHub Actions for schema validation and server tests.
- `GET /v1/meta` service discovery and compatibility negotiation.
- Configurable MCAgent endpoint connection status in Desktop and Web.

## What Does Not Work Yet

- No Minecraft download.
- No resource download.
- No Fabric, Forge, or NeoForge install.
- No real instance creation.
- No local instance write.
- No `mods`, `resourcepacks`, or `shaderpacks` write.
- No Minecraft launch.
- No Java detection.
- No Minecraft directory scan.
- No environment report upload.
- No commercial model API requirement.

## Architecture

MCagentlauncher uses a five-layer responsibility model:

- **GitHub**: code, Issues, Pull Requests, Actions, Releases, and collaboration.
- **Vercel**: Web app, docs, console, and Preview deployments.
- **Supabase**: community data, Auth, rules, aliases, anonymous cases, and moderation status.
- **MCAgent Endpoint**: independent, replaceable, self-hostable intent parsing, planning, and explanation.
- **Desktop Local Executor**: the only future component allowed to create instances, download after confirmation, verify hashes, install, launch, snapshot, and rollback.

Vercel is not the long-term model inference layer. Supabase is not a Minecraft resource mirror. MCAgent does not execute local file operations. Desktop does not blindly trust AI output.

## Quick Start

Install dependencies:

```bash
pnpm install
```

Start MCAgent Server:

```bash
pnpm dev:server
```

Start Web/API Playground:

```bash
pnpm dev:web
```

Start Desktop Shell:

```bash
pnpm dev:desktop
```

Source development requires MCAgent Server to be started separately. The local `http://127.0.0.1:8000` fallback is for development; packaged Desktop does not yet include or launch a Python sidecar.

## Safety Boundaries

- AI does not directly execute files.
- MCAgent plans and explains; it does not download resources, write files, or run commands.
- Web Playground cannot access local files.
- Desktop Shell is dry-run only in v0.1 alpha.
- Install actions require user confirmation and are still preview-only.
- Environment reports are local-only and not uploaded.
- Safe Platform Probe only reads OS, arch, app version, and Tauri availability after user consent.
- Java, path, disk, and network probes remain disabled.

## Milestones Completed

- M0: monorepo skeleton.
- M1: JSON Schemas and examples.
- M2-M2.1: MCAgent mock server, runtime schema validation, and CI.
- M3-M3.6: resource resolver data model, alias DB, resolver query flow, and planning pipeline.
- M4-M4.1: MCAgent planning response wrapper and API preparation.
- M5: Web/API Playground.
- M6-M7: install action and Desktop Shell dry-run previews.
- M8-M8.3: environment report, read-only probe policy, ADRs, and safe platform probe.
- M9: alpha preview UI/UX polish and release preview docs.
- M10: release candidate preparation and alpha manual review.
- M11: post-alpha runtime contract, connection compatibility, and feedback infrastructure.

## Roadmap

- M12: Native Desktop Packaging Preview investigation.
- M13: live planning and resolver integration behind explicit capability negotiation.
- Future: Desktop Local Executor implementation after policy, confirmation, source verification, hash verification, rollback, and failure handling are complete.

## Contributing

Contributions should preserve the responsibility boundaries in `docs/platform-boundaries.md`. Do not add download, install, local write, launch, Java probe, path scan, upload, commercial model dependency, or secret handling behavior without an explicit milestone and ADR.

## License Draft

See `LICENSE-DRAFT.md`. Current direction:

- Desktop App: GPL-3.0-or-later leaning.
- MCAgent Server: AGPL-3.0-or-later leaning.
- Schema / Protocol: MIT or CC0 leaning, pending community ADR.
- Rules / Dataset / Models: separate discussion.
