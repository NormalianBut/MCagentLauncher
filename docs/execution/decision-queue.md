# Decision Queue

Only record decisions grounded in the roadmap, architecture, or First Playable plan. An open entry is not approval.

## Entry Format

- **ID:** stable identifier.
- **Status:** `open`, `awaiting-user`, `decided`, or `superseded`.
- **Decision:** exact choice required.
- **Background:** why it is required.
- **Options:** concrete alternatives.
- **Recommendation:** current evidence-based preference, not approval.
- **Risk:** primary consequences.
- **Blocking work:** work that cannot cross implementation without the decision.
- **User response:** verbatim or linked response; `not provided` until received.

## Decided For M17

### DQ-001 - Controlled Instance Workspace

- **Status:** decided.
- **Decision:** choose the future Executor-owned instance root and containment policy.
- **Background:** Desktop must never mutate arbitrary or existing user instances.
- **Options:** app-data managed root; separately gated user-selected empty directory; both as distinct trust classes behind one policy vocabulary.
- **Recommendation:** implement an app-managed root first. Keep user-selected locations as opaque picker selections behind `GATE-USER-PATH-01`; do not normalize the two choices into equivalent authority.
- **Risk:** unsafe path handling could corrupt unrelated user data.
- **Blocking work:** first filesystem write and local instance creation.
- **User response:** On 2026-08-04: "Approved with restrictions. The implementation may create and manage only an application-controlled, isolated test workspace under the MCagentlauncher application data boundary. It must not access or modify: an existing .minecraft directory; third-party launcher instances; arbitrary user-selected directories; unrelated user files; paths outside the controlled workspace. All paths must be canonicalized and validated before use. The implementation must prevent traversal, symlink, junction, and Windows reparse-point escape from the controlled workspace."

### DQ-002 - Manifest And Transaction Representation

- **Status:** decided.
- **Decision:** choose durable manifest, journal, commit, and recovery semantics.
- **Background:** interrupted installation must be detectable, idempotent, and recoverable.
- **Options:** immutable versioned manifest plus append-only digest-chained journal; staged manifest with atomic replace; embedded local database.
- **Recommendation:** begin with an immutable versioned JSON desired-state manifest and separate append-only transaction journal. Do not store mutable progress in the manifest; validate platform atomicity before implementation.
- **Risk:** ambiguous state can cause partial installs or failed rollback.
- **Blocking work:** transaction persistence and instance mutation.
- **User response:** On 2026-08-04: "Approved with restrictions. The implementation may persist only versioned manifest, transaction journal, operation state, checksums, rollback metadata, and records of artifacts created by MCagentlauncher. Persistence must remain inside the approved controlled workspace. Requirements: atomic replacement where practical; crash-recoverable transaction state; deterministic and idempotent recovery; unique transaction identity; explicit schema version; no secrets, OAuth tokens, telemetry, or unrelated environment data; rollback may remove only artifacts created by the current transaction."

## Remaining Open Decisions

### DQ-003 - Download Trust And Integrity Policy

- **Status:** open.
- **Decision:** define allowed sources, redirects, required hashes, staging, limits, and mismatch behavior.
- **Background:** M14 records metadata URLs but intentionally never downloads bytes.
- **Options:** provider URL allowlist with mandatory hashes; provider plus reviewed mirror policy; manual resource import as a separate flow.
- **Recommendation:** provider-origin allowlist, HTTPS, bounded redirects/size/time, staged bytes, and mandatory supported hash before commit.
- **Risk:** malicious metadata, dependency confusion, partial downloads, and hash mismatch.
- **Blocking work:** first network download.
- **User response:** not provided.

### DQ-004 - Java Runtime Ownership

- **Status:** open.
- **Decision:** determine whether Java is user-provided, consent-discovered, or project-provisioned.
- **Background:** version and executable provenance affect security, support, and licensing.
- **Options:** explicit user path; consented known-location discovery; verified managed runtime; phased combination.
- **Recommendation:** decide in a dedicated ADR after workspace/transaction design; keep discovery and provisioning separately gated.
- **Risk:** executing an untrusted binary or unsupported runtime.
- **Blocking work:** Java detection, provisioning, and process launch.
- **User response:** not provided.

### DQ-005 - Microsoft Authentication And Token Storage

- **Status:** open.
- **Decision:** choose OAuth application ownership, redirect flow, scopes, and OS-backed token storage.
- **Background:** playable Minecraft requires account authentication while tokens must remain outside Planner and logs.
- **Options:** system browser plus loopback redirect; custom URI callback; device-code flow where policy permits.
- **Recommendation:** conduct a dedicated auth/privacy ADR and prefer system browser with least scopes and OS credential storage.
- **Risk:** token disclosure, redirect interception, account confusion, or policy noncompliance.
- **Blocking work:** first OAuth use and authenticated launch.
- **User response:** not provided.

### DQ-006 - Process Lifecycle And Recovery Ownership

- **Status:** open.
- **Decision:** define launch arguments, child ownership, cancellation, output redaction, crash cleanup, and transaction interaction.
- **Background:** future Java/Minecraft launch introduces persistent external process state.
- **Options:** direct child process owned by Desktop; constrained helper sidecar; separate supervised launcher service.
- **Recommendation:** design direct, no-shell child ownership first; a sidecar requires a separate gate and stronger justification.
- **Risk:** argument injection, orphaned processes, leaked logs, or rollback during active execution.
- **Blocking work:** first process launch and first playable validation.
- **User response:** not provided.

## Decided Implementation Package

### DQ-008 - Autonomy Lab Interruption-Recovery Tooling

- **Status:** decided.
- **Decision:** permit a repository-only runtime checkpoint and bounded process supervisor for interruption-resilient engineering work.
- **Background:** model/thread/app/machine interruptions must not strand processes, evidence, Git work, or the exact next action.
- **Options:** conversation-only recovery; Git-only checkpoints; external runtime state plus Git work-package checkpoints and verified integration.
- **Recommendation:** use all three layers with fail-closed recovery and exact tooling allowlists.
- **Risk:** stale PID reuse, unrelated-process termination, arbitrary shell authority, loss of uncommitted work, or control-path escape.
- **Blocking work:** M18 Autonomy Lab runtime implementation.
- **User response:** On 2026-08-04 the user requested implementation of the external runtime files, single-coordinator lease, pause/resume/doctor/cleanup commands, harmless process-supervisor tests, resource-aware modes, durable checkpoints, pushed branch, and Draft PR, while explicitly prohibiting Java, Minecraft, downloads, existing user data, administrator requirements, product capability expansion, merge, tag, and Release.

### DQ-007 - First Privileged Local Executor Implementation Package

- **Status:** decided.
- **Decision:** approve or reject the first scoped runtime implementation package after M16, including its exact capabilities and workspace trust class.
- **Background:** ADR 0008 defines data contracts but deliberately provides no privileged adapter. Runtime work must begin with a narrow package and cannot infer approval from the M16 design review.
- **Options:** app-managed workspace inspection/containment only; app-managed workspace plus first controlled writes; defer all runtime implementation; propose a narrower alternative backed by new evidence.
- **Recommendation:** after M16 review, request `GATE-EXEC-01` and `GATE-FS-01` only for an app-managed workspace containment package with no network, Java, OAuth, process, user-selected path, or existing-instance access. Split first read/validation evidence from mutation if implementation planning can preserve a useful checkpoint.
- **Risk:** an over-broad first package could collapse independent permissions and make rollback or review evidence ambiguous.
- **Blocking work:** any privileged Local Executor adapter, filesystem access, workspace creation, manifest/journal persistence, or instance mutation.
- **User response:** On 2026-08-04: "Approved only for the controlled workspace and transaction foundation. Allowed: create an isolated application-managed test workspace; write a versioned manifest; write and update a transaction journal; validate containment; simulate commit, interruption, recovery, and rollback; remove test artifacts created by the current transaction; expose dry-run preview and explicit user confirmation. Not approved: network download; installation of Minecraft, loaders, mods, resource packs, or shaders; Java discovery or execution; shell or process execution; Microsoft OAuth; Minecraft directory access; mutation of real user instances; Minecraft launch; updater, sidecar, telemetry, or commercial model integration. This approval crosses only the minimum filesystem gate required for the controlled workspace vertical slice. Continue to treat all later gates as unapproved."
