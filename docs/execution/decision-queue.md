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

## Open Decisions

### DQ-001 - Controlled Instance Workspace

- **Status:** open.
- **Decision:** choose the future Executor-owned instance root and containment policy.
- **Background:** Desktop must never mutate arbitrary or existing user instances.
- **Options:** app-data managed root; user-selected empty directory with containment proof; both under one normalized workspace contract.
- **Recommendation:** an app-managed root first, with canonical containment and no symlink/reparse traversal.
- **Risk:** unsafe path handling could corrupt unrelated user data.
- **Blocking work:** first filesystem write and local instance creation.
- **User response:** not provided.

### DQ-002 - Manifest And Transaction Representation

- **Status:** open.
- **Decision:** choose durable manifest, journal, commit, and recovery semantics.
- **Background:** interrupted installation must be detectable, idempotent, and recoverable.
- **Options:** append-only journal plus immutable manifest; staged manifest with atomic replace; embedded local database.
- **Recommendation:** begin with versioned JSON manifest plus append-only transaction journal; validate platform atomicity before implementation.
- **Risk:** ambiguous state can cause partial installs or failed rollback.
- **Blocking work:** transaction persistence and instance mutation.
- **User response:** not provided.

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
