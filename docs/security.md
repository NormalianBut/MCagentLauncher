# Security

MCagentlauncher must keep execution authority narrow and auditable.

## Execution Boundary

MCAgent may generate plans, explanations, and diagnostics. It must not execute commands or mutate local files.

Desktop Local Executor performs local actions only after user confirmation and after validating the plan, source metadata, and hashes.

## Resource Safety

- Use source metadata and rule checks before installation.
- Verify hashes for downloaded files.
- Avoid bypassing upstream platform rules.
- Avoid private mirrors unless explicitly supported by policy and user configuration.
- Preserve rollback information where possible.

## Secret Handling

Secrets, tokens, private keys, and API keys must not be committed. Example environment files may list variable names but must not contain real secret values.

## Local Environment Probe Safety

Local environment probing must follow these principles:

- explicit consent before any read-only probe;
- least privilege;
- read-only behavior only;
- local-only results by default;
- redaction before display or export;
- no background probe;
- no upload by default;
- no persistence without a future explicit user export flow.

MCAgent Server and Web Playground must not read or receive local environment reports by default.

The read-only probe security model also forbids:

- background probes;
- arbitrary shell commands;
- user-controlled commands;
- recursive home directory scans;
- automatic `.minecraft` discovery;
- execution capabilities before an explicit executor milestone.

Real platform, directory, Java, or network probes must pass a permission policy gate. Java detection and directory access require separate future ADRs.

## Endpoint Trust

An endpoint is not trusted merely because it responds. M11 clients validate `GET /v1/meta`, require compatible API/schema versions and planning capabilities, and reject server declarations that include local execution, file access, download, environment probe, or process-launch authority.

Metadata requests contain no environment report, local path, token, API key, or user information. CORS uses an exact origin allowlist rather than a wildcard.

## Security Feedback

Public issues must not contain exploits, credentials, private paths, or sensitive environment data. Contributors should use GitHub private vulnerability reporting only when the repository UI shows that it is available, or another maintainer-published private contact. The project does not automatically collect telemetry, logs, or environment reports.

## M12 Packaging Controls

The Native Desktop Preview exposes only Tauri `core:default` capability to the main window. A repository check rejects filesystem, shell, process, updater, and autostart plugins, command handlers, and sidecars. The explicit CSP allows application resources and HTTP(S) requests to the configured MCAgent endpoint; endpoint URLs containing credentials are rejected.

The Windows artifact is unsigned, current-user scoped, and for manual testing. No certificate, signing password, token, telemetry, updater, Python runtime, or server is included. Artifact checksums and a non-sensitive manifest are generated after the native build. These build-time file operations are not linked into Desktop runtime behavior.

## M13 Resolver Controls

Resource Resolver contracts are metadata-only and remain in the Planner Plane. Every declared provider capability fixes download, upload, filesystem access, execution, and telemetry to `false`. Resolver requests contain requirements and public source hints only; they must not contain environment reports, local paths, tokens, or user credentials.

M13 adds no network implementation. Future metadata-only access must be explicit, capability-negotiated, rate-limit aware, and must preserve incomplete or ambiguous metadata rather than fabricating trusted values. CurseForge remains an unimplemented future provider.

## M14 Modrinth Provider Controls

The Modrinth adapter permits metadata requests only under explicit `networkPolicy="metadata-only"`; offline policy makes zero fetch calls. Its API surface covers search, project, and version JSON metadata only. Returned file URLs are recorded but never requested.

Strict parsing rejects malformed project/version records and preserves missing hashes as incomplete metadata. HTTP and rate-limit failures become diagnostics without automatic retry. The provider imports no filesystem, shell, child-process, download, installer, Java, launcher, telemetry, or paid AI dependency.

MCAgent Server remains offline and declares `liveResourceResolver=false`, so packaged clients do not gain an implicit live-network capability in M14.

## M15 Compatibility Analysis Controls

Compatibility analysis consumes normalized metadata only and imports no provider client. It performs exact, deterministic checks without fetch, filesystem access, environment inspection, persistence, telemetry, or process execution.

Unknown metadata is not treated as compatible. Conflict findings require explicit version-controlled rules or provider-normalized incompatible dependency metadata; names never create conflicts. Plan integration only copies structured diagnostics and risk state. It cannot replace, download, install, write, repair, or launch resources.

Python MCAgent Server continues to declare `liveResourceResolver=false`. M15 introduces no CurseForge implementation or commercial model API.

## Autonomous Development Controls

Repository work is classified as AUTO, REVIEW, or GATED in `docs/autonomy-policy.md`. Filesystem writes, downloads, shell/process execution, Java, Minecraft directory access, OAuth and secrets, instance mutation, updater/sidecar behavior, production dependencies, merge, tag, and Release operations require an explicit gate before implementation or action.

The non-destructive `scripts/check-autonomy-boundaries.mjs` scan:

- reads only files inside the repository;
- performs no network access and writes no file;
- distinguishes runtime/manifests from tests, documentation, examples, and tooling;
- returns non-zero only for clear runtime capability patterns;
- emits structured JSON suitable for local or CI inspection.

Pattern scanning is defense in depth, not a security proof. Every checkpoint still requires diff inspection, dependency review, threat modeling appropriate to its privileges, secret review, and confirmation that `docs/platform-boundaries.md` has no unauthorized change.

M16 remains architecture-only. A contract describing a future write, download, OAuth, or process action must not expose an implementation handle for that action.
