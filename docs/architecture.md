# Architecture

MCagentlauncher is split into five responsibility layers:

```text
GitHub -> Vercel -> Supabase -> MCAgent Endpoint -> Desktop Local Executor
```

The v0.1 alpha preview flow is:

```text
User Prompt
  -> Desktop UI
  -> MCAgent /v1/intent/parse
  -> intent.json
  -> MCAgent /v1/resources/plan
  -> resource-plan.json
  -> Desktop Plan Review
  -> User Confirmation
  -> Desktop Install / Executor dry-run preview
```

Real local execution, instance-lock writing, and Minecraft launch are future Desktop responsibilities and are not enabled.

## M11 Runtime Contract

Desktop and Web use a configurable MCAgent endpoint. Development defaults to `http://127.0.0.1:8000`, but packaged Desktop must not assume a local Python process exists.

Before planning, clients request `GET /v1/meta` and validate:

- service-info schema version;
- API version and supported schema versions;
- required intent, plan, and explanation capabilities;
- planner-only safety declarations.

Incompatible endpoints block server-dependent planning. Desktop-local Environment Preview and consented Safe Platform Probe remain available when the server is offline. See [ADR 0003](./adr/0003-beta-runtime-topology.md).

MCAgent Server is the Planner Plane. The future Desktop Local Executor is the Execution Plane. M11 does not bundle a Python sidecar or enable execution. M12 investigates native packaging; M13 advances live planning/resolver capability negotiation.

## M12 Native Packaging

M12 packages the existing dry-run UI as a Windows-first Tauri Native Desktop Preview. The packaged application still depends on an independently operated, compatible MCAgent endpoint and does not bundle or start Python. Its Tauri capability is limited to core window behavior; no filesystem, shell, process, updater, autostart, download, installation, or launch capability is enabled.

The workflow artifact is unsigned and intended only for manual project review. macOS and Linux are not validated in M12. Sidecar, signing/notarization, updater, and Local Executor designs remain separate future decisions. See [ADR 0004](./adr/0004-native-desktop-packaging-preview.md).

## M13 Resource Resolver Architecture

M13 defines a provider-neutral metadata boundary inside the Planner Plane:

```text
Intent -> Planner -> ResourceRequirement[] -> Resource Resolver -> Metadata Providers
```

The Planner owns intent and requirements. The Resolver normalizes metadata, evaluates compatibility claims, ranks candidates deterministically, and returns diagnostics. Provider adapters translate Modrinth, GitHub Releases, and MC百科 metadata into shared contracts; CurseForge remains a future contract only.

The Resolver has no download, upload, filesystem, execution, telemetry, Java, path-scan, or launcher authority. Default network policy is offline. Future metadata-only networking requires explicit policy and capability negotiation. See [ADR 0005](./adr/0005-resource-resolver-architecture.md).

## M14 Modrinth Metadata Provider

M14 implements Modrinth as the first M13 `MetadataProvider` adapter:

```text
ResourceRequirement[]
  -> MetadataResourceResolver
  -> MetadataProviderRegistry
  -> ModrinthMetadataProvider
  -> normalized ResourceCandidate[] + ResolverIssue[]
```

The provider reads only Modrinth API metadata after an explicit `metadata-only` network policy. `offline` performs no request. Project, version, compatibility, dependency, file URL, and hash claims are strictly parsed and normalized; file URLs are never fetched.

The Python MCAgent Server remains on its offline adapter and continues to advertise `liveResourceResolver=false`. M14 adds no cross-language process bridge and does not change Desktop behavior. See [ADR 0006](./adr/0006-modrinth-metadata-provider.md).

## M15 Compatibility Analysis Engine

M15 adds a pure, provider-neutral analysis layer after resolution and before plan mapping:

```text
ResourceCandidate[]
  -> Compatibility Analysis Engine
  -> CompatibilityAnalysisResult
  -> compatibility-aware Resource Plan
```

Providers normalize metadata but do not decide final compatibility. The Analyzer uses exact Minecraft version, loader, side, dependency, duplicate, and explicit rule evidence. Unknown metadata remains unknown, and conflicts require a rule or normalized incompatible dependency source.

Resolver and Analyzer compose through an explicit wrapper; offline resolution remains zero-fetch. Compatibility blockers can be mapped to plan errors and high risk without changing the resource-plan schema. M15 does not repair choices, download resources, access local instances, or enable the Executor. See [ADR 0007](./adr/0007-compatibility-analysis-engine.md).

## Key Contracts

- MCAgent output must be structured and schema-verifiable.
- Resource choices must pass rule and metadata checks.
- Desktop is the only layer that performs real local filesystem and process actions.
- User confirmation is required before installation.
- Logs and local paths must be redacted before any optional upload.

## Initial Modules

- `apps/desktop`: desktop UI and local executor integration.
- `apps/web`: website, docs, Web console, and Preview surface.
- `services/mcagent-server`: independent MCAgent endpoint.
- `crates/*`: Rust local core modules.
- `packages/*`: schemas, rules, aliases, clients, and shared types.
- `supabase/*`: community data schema and functions.
