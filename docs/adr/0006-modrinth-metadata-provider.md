# ADR 0006: Modrinth Metadata Provider

## Status

Accepted for M14 metadata integration.

## Context

ADR 0005 established a provider-neutral Resource Resolver. M14 needs the first concrete `MetadataProvider` without moving provider logic into the Planner or granting download and execution authority.

An earlier Modrinth client already supported metadata search and version lookup. It was not a complete M13 provider adapter: it had no project metadata request, no strict upstream response boundary, no provider registry, and no `ProviderResolutionResult` diagnostics.

## Decision

Implement `ModrinthMetadataProvider` in `packages/api-client` and register it through `MetadataProviderRegistry`. `MetadataResourceResolver` invokes registered providers in the request's explicit provider order and returns the M13 `ResourceResolutionResult` contract.

The Python MCAgent Server remains offline in M14 and continues to declare `liveResourceResolver=false`. M14 does not add a Node subprocess, Python bridge, sidecar, or hidden network path. A future server integration milestone must explicitly change capability negotiation and add end-to-end API tests.

## Responsibility

The Modrinth provider may:

- resolve a project by known project ID or slug;
- search project metadata when no identifier is available;
- query versions filtered by Minecraft version and loader;
- parse and normalize project, version, file, dependency, side, and hash metadata;
- choose release before beta, and alpha only for explicit experimental preference;
- return structured warnings and errors.

It may not choose the final resource plan, download a file, install a mod, inspect a local instance, write a lockfile, execute a command, or launch Minecraft.

## API Boundary

The provider is limited to Modrinth v2 JSON metadata endpoints:

- `GET /v2/search`;
- `GET /v2/project/{project-id-or-slug}`;
- `GET /v2/project/{project-id}/version` with loader and game-version filters.

The client keeps the explicit MCagentlauncher User-Agent and accepts an injected `fetch` implementation and base URL for deterministic tests. URL construction preserves the configured `/v2` path.

File URLs returned by version metadata are recorded as untrusted metadata only. The provider never requests those URLs. It has no binary response handling API.

## Metadata Normalization

Provider-specific response contracts live beside the adapter. Shared `ResourceMetadata` remains provider-neutral and `ResourceCandidate` remains generic.

Normalization requires:

- a non-empty project identity, slug, title, and supported resource type;
- a non-empty version and project identity;
- recognized release channel;
- string arrays for loaders and game versions;
- a file array whose entries contain filename, URL, and structurally valid hashes;
- dependency records with explicit dependency type.

Unknown side declarations normalize to `unknown`. Additional upstream fields are ignored. Missing selectable files or primary-file hashes produce `METADATA_INCOMPLETE`; malformed required fields produce `INVALID_METADATA`. The provider never fabricates IDs, versions, loaders, URLs, or hashes.

## Compatibility And Determinism

Minecraft version and loader must both match before release-channel selection. Stable preference selects release, then beta with a warning. Alpha requires experimental preference.

Requirements are processed sequentially. Search results are ordered by exact identity match and then project ID. The aggregate Resolver sorts by requirement order, compatibility, confidence, provider order, and stable candidate identity. Response arrival timing, random values, and wall-clock time do not affect selection.

## Error Handling

Provider failures are returned as `ResolverIssue` records:

- `PROJECT_NOT_FOUND`;
- `VERSION_NOT_FOUND`;
- `MINECRAFT_VERSION_MISMATCH`;
- `LOADER_MISMATCH`;
- `AMBIGUOUS_MATCH`;
- `INVALID_METADATA`;
- `METADATA_INCOMPLETE`;
- `RATE_LIMITED`;
- `PROVIDER_UNAVAILABLE`.

One invalid requirement does not erase valid matches for other requirements. Errors are not converted into invented fallback metadata.

## Rate Limiting

HTTP 429 becomes a `RATE_LIMITED` diagnostic and preserves a readable `Retry-After` value when supplied. M14 does not automatically retry, sleep, queue, or bypass limits. Cache and retry policy require separate design because they affect determinism, freshness, and endpoint resource usage.

## Network Policy

`networkPolicy="offline"` returns a warning and performs zero fetch calls. The adapter may query metadata only when the caller explicitly sets `networkPolicy="metadata-only"`.

This policy is separate from Desktop user confirmation for future installation. Metadata permission never implies artifact download permission.

## Security Model

The provider contract fixes these capabilities to false:

- resource download;
- upload;
- filesystem and Minecraft-directory access;
- shell or process execution;
- Java or launcher execution;
- telemetry.

No API key, token, paid AI service, local path, environment report, or user credential is introduced. Provider code imports no filesystem, shell, child-process, installer, or launcher module.

The provider cannot execute actions because `MetadataProvider` exposes only `resolve(request) -> metadata result`; it receives requirements and public provider hints, not Desktop paths or execution handles.

## Consequences

- Modrinth is the first registered M13 provider implementation.
- Existing legacy Modrinth helper exports remain backward compatible.
- Existing offline planning and MCAgent Server behavior remain unchanged.
- GitHub Releases, MC百科, and CurseForge adapters remain unimplemented.
- File URL metadata remains untrusted until a future Executor independently validates user confirmation, source policy, and hashes.
