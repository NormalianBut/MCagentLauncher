# ADR 0003: Post-alpha Runtime Topology

## Status

Accepted for M11 post-alpha stabilization.

## Context

The v0.1 alpha runs the Desktop Shell, Web Playground, and MCAgent Server as separate development processes. Before native packaging or live resource planning, Desktop needs a formal way to locate an MCAgent endpoint, verify its API and schema versions, inspect its capabilities, and block incompatible planning operations.

M11 defines that runtime contract. It does not enable the Desktop Local Executor.

## Candidate Topologies

### Option A: Desktop plus an independent local MCAgent Server

This keeps planning local and is straightforward for contributors, but a packaged Desktop cannot silently assume that Python and a compatible server are installed and running.

### Option B: Desktop plus a remote MCAgent Endpoint

This simplifies client setup but introduces availability, privacy, hosting, and trust concerns. A remote planner must never receive local execution authority or an environment report by default.

### Option C: Configurable local or remote endpoint

Desktop connects to an explicitly configured compatible MCAgent endpoint. Development defaults to `http://127.0.0.1:8000`; packaged builds must not assume that this local process exists.

## Decision

Adopt Option C.

- Desktop uses a configurable MCAgent endpoint.
- The local development fallback is `http://127.0.0.1:8000`.
- A user or distributor may explicitly configure another compatible endpoint.
- Desktop calls `GET /v1/meta` before enabling server-dependent planning actions.
- API, schema, required capability, and safety incompatibilities block planning.
- Desktop never silently falls back to a different or incompatible endpoint.
- M11 does not bundle a Python sidecar or create an installer.

## Planner Plane

MCAgent Server belongs to the Planner Plane. It may parse intent, produce resource plans, explain plans, and declare whether live metadata resolution is available. Its metadata must reflect its real current behavior.

The Planner Plane cannot download files, write local files, inspect the local environment, install Minecraft or loaders, or launch processes.

## Execution Plane

The future Desktop Local Executor belongs to the Execution Plane. Any future download, hash verification, instance write, rollback, installation, or launch behavior remains in Desktop and requires separate policy, user confirmation, and implementation milestones.

Execution is disabled in M11. Install and executor objects remain previews only.

## Trust Boundary

An MCAgent endpoint is not trusted merely because it responds. Desktop must validate the `service-info` response and evaluate compatibility before using planning APIs. A server that declares unsafe execution, local file access, or process launch capabilities is incompatible with the current client.

Environment reports remain local to Desktop and are never sent during endpoint discovery, compatibility checks, or planning.

## Endpoint Configuration

`VITE_MCAGENT_API_URL` remains the Desktop development configuration input. `NEXT_PUBLIC_MCAGENT_API_URL` serves the Web Playground. Neither client contains a hard-coded production endpoint, token, or API key.

Endpoint configuration is session/configuration state only in M11. It is not persisted to browser storage.

## Version Negotiation

`GET /v1/meta` returns the service version, API version, service-info schema version, and supported planning schema versions. Desktop compares these values with explicit client support. An API or schema mismatch is incompatible and blocks planning.

## Capability Negotiation

The current client requires intent parsing, resource planning, and plan explanation. Live resource resolution is optional; when absent, the service remains compatible but reports an offline limitation.

Execution, local file access, environment probing, and Minecraft launch are forbidden server capabilities for the current client.

## Failure Behaviour

- Unreachable or network-blocked endpoint: show the configured endpoint and a readable connection error; keep Desktop-local previews available.
- Invalid metadata: mark the service incompatible and block server-dependent actions.
- Missing required capability or version mismatch: mark incompatible and do not call planning APIs.
- Missing optional capability: show a degraded warning when the client explicitly requests that optional capability.
- No automatic retry loop is allowed. The user can retry explicitly.

## Security Consequences

The metadata endpoint is a fixed, non-sensitive capability declaration. It must not include secrets, tokens, hostnames, usernames, IP addresses, user paths, or environment reports. CORS remains an exact allowlist.

## Packaging Consequences

M11 source development still requires starting MCAgent Server separately. Packaged Desktop does not contain or launch a Python sidecar. M12 may investigate native packaging, but packaging must preserve endpoint negotiation and the Planner/Execution boundary.

## Future Sidecar Decision

Any bundled or managed sidecar requires a separate ADR covering lifecycle, signing, updates, ports, crash handling, and security. This ADR does not authorize one.

## Future Executor Decision

The real Desktop Local Executor requires a separate ADR and milestone covering consent, download verification, file writes, rollback, installation, launch, and failure recovery. This ADR does not authorize execution.
