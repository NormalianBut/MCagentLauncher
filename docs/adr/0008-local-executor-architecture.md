# ADR 0008: Local Executor Architecture and Authority Boundary

## Status

Accepted for M16 architecture review. This ADR defines contracts and future approval gates only. It does not approve or enable runtime implementation.

## Context

M13 through M15 produce provider-neutral metadata, deterministic compatibility analysis, and a compatibility-aware `ResourcePlan` in the Planner Plane. The current Desktop converts that plan into an M6 dry-run action preview. It cannot execute, and its preview booleans are deliberately not an authorization mechanism.

A First Playable Preview will eventually need a Desktop-owned Execution Plane that can acquire verified artifacts, create an isolated instance, prepare a runtime, authenticate, launch Minecraft, and recover from failure. Those operations cross trust boundaries and cannot be inferred from a plan, a preview, or a generic confirmation button.

M16 defines the future authority boundary before any runtime implementation exists.

## Decision Summary

The future Local Executor will be a Desktop-owned, deny-by-default transaction engine. It will accept only a locally constructed execution request that binds:

- an immutable snapshot of a reviewed, compatibility-aware Resource Plan;
- explicit review evidence and plan/analysis digests;
- one workspace selection with a declared trust class;
- a versioned execution manifest containing relative destinations only;
- the exact requested capabilities and their approval-gate evidence;
- a single-use confirmation record bound to the request, plan, manifest, workspace, capabilities, and review presentation;
- rollback and recovery obligations known before staging begins.

The contracts are data. They expose no filesystem, network, Java, authentication, process, updater, or sidecar handle. M16 adds no executor dispatcher or privileged adapter.

## Plane Ownership

### Planner Plane

The Planner Plane owns intent parsing, resolution, compatibility analysis, Resource Plan construction, diagnostics, and explanation. It produces reviewable evidence and cannot:

- choose or inspect a local workspace;
- turn a plan into local authority;
- suppress compatibility blockers;
- fetch artifact bytes for installation;
- write a manifest or journal;
- authenticate or launch a process.

### Desktop Review Boundary

Desktop validates the Planner response, presents the exact plan and compatibility disposition, lets the user choose a permitted workspace class, and constructs an execution request. The review boundary must reject:

- `draft` or `rejected` plans;
- plans whose confirmation fields claim prior confirmation;
- compatibility blockers or unknown evidence under the future gate's policy;
- missing plan, analysis, or manifest digests;
- resource identities or artifact expectations that changed after review.

The current M6 install-action preview remains display-only. It is never accepted as an execution request.

### Execution Plane

Only a future gated Desktop Local Executor may validate and consume an execution request. It must independently revalidate every invariant and must not trust Planner claims about paths, source allowlists, bytes, hashes, confirmation, or platform atomicity.

## Reviewed Resource Plan Handoff

The handoff uses a `ReviewedPlanEnvelope` rather than passing a live Planner client or provider adapter. The envelope contains:

- the complete `ResourcePlan` snapshot;
- a caller-supplied digest over the canonical plan representation;
- the compatibility disposition shown during review;
- a digest of the compatibility analysis;
- explicit blocker and unknown counts;
- a review identity and presentation revision;
- a declaration that the plan is immutable for this request.

The future canonicalization algorithm and supported digest suite require implementation evidence. A changed plan, changed analysis, changed resource set, changed workspace, changed capabilities, or changed manifest invalidates confirmation and requires a new review.

No execution request may resolve a resource by display name. Manifest artifacts use stable provider, project, version, resource, and expected-hash identities copied from reviewed evidence. Metadata URLs remain claims; they are not download permission or trusted bytes.

## Workspace Model

### Application-managed workspace

An application-managed workspace is created under a future platform-specific Desktop-owned root. Its contract carries an opaque workspace ID and policy version, not an absolute path. The future filesystem adapter owns resolution, containment, lifecycle, and cleanup.

This is the recommended first implementation because ownership and rollback scope can be narrow. It still requires `GATE-FS-01`; application ownership does not make path handling safe by default.

### User-selected location

A user-selected location is represented by an opaque selection ID and selection revision issued by a future consented picker. It is a separate trust class, not an alternate spelling of the managed root. The contract records whether the location was observed empty at review and requires a reject-existing-content policy for the First Playable scope.

Future code must re-resolve and revalidate the selection immediately before every mutation, defend against symlink/reparse substitution, reject roots and existing Minecraft instances, and never infer consent for parent or sibling paths. This scope requires both `GATE-FS-01` and `GATE-USER-PATH-01`.

The First Playable architecture does not support mutation of an existing `.minecraft` directory.

## Permission Model

Capabilities are exact string identifiers. Unknown capabilities are rejected, absence means denied, and a grant for one capability never implies another. The initial architecture distinguishes:

- workspace inspection;
- workspace mutation;
- manifest/journal persistence;
- artifact download;
- artifact integrity verification;
- Java discovery;
- Java provisioning;
- OAuth/token handling;
- process launch;
- rollback mutation;
- audit persistence.

Each permission record binds a capability to an approval-gate ID, scope, policy version, and decision evidence reference. A future implementation must compare the requested set with compiled capabilities and currently approved gates. Contracts cannot mark a gate approved by themselves.

The M16 `validateExecutionRequestStructure` helper checks deterministic relationships among already typed contract values. It neither parses arbitrary JSON nor authenticates a decision reference. A future gated adapter must first perform strict schema parsing and then resolve every decision reference against a trusted, local approval policy; a structurally valid request is still non-executable in M16.

## Confirmation Contract

Confirmation is an attestation over an exact review, not a reusable boolean. It binds:

- confirmation ID and single-use nonce;
- request ID;
- reviewed plan and compatibility-analysis digests;
- execution manifest digest;
- workspace kind, ID, and selection revision;
- sorted requested capability set;
- review presentation revision;
- user-confirmed risk summary revision;
- caller-supplied issue and expiry timestamps.

Validation receives the evaluation time as an explicit input; it never reads the clock. Expired, previously consumed, mismatched, incomplete, or superseded confirmation is invalid. Cancellation consumes the confirmation. Retry after any bound field changes requires a new confirmation.

Confirmation in the product flow is separate from repository implementation approval. Neither can substitute for the other.

## Manifest Contract

An `ExecutionManifest` is immutable desired-state intent. It contains:

- schema, manifest, request, plan, and workspace identities;
- target Minecraft, loader, and Java requirements copied from the reviewed plan;
- deterministically ordered operations and artifact expectations;
- relative, normalized destination segments under the selected workspace;
- provider/source identity, size policy, and supported expected hashes;
- rollback classification for each operation;
- the manifest digest supplied by the caller.

The manifest contains no absolute path, executable path, access token, process ID, downloaded-byte claim, or mutable completion status. Observed state belongs in transaction and audit records. Hash presence is necessary but does not prove that bytes were verified.

## Transaction State Machine

The future transaction journal records observed progress separately from the immutable manifest.

```text
proposed
  -> awaiting_confirmation
  -> ready
  -> staging
  -> verifying
  -> committing
  -> committed

awaiting_confirmation | ready -> cancelled
staging | verifying | committing -> rolling_back
rolling_back -> rolled_back | recovery_required
staging | verifying | committing -> failed | recovery_required
failed -> rolling_back | recovery_required
recovery_required -> rolling_back
```

Terminal states are `committed`, `rolled_back`, and `cancelled`. `failed` is not proof of cleanup. `recovery_required` blocks new execution against the workspace until a future recovery procedure reaches a known state or requires manual review.

State transitions are explicit and deterministic. Repeating the same journal event must be idempotent. Skipping verification, committing after a failure, or returning from a terminal state is invalid.

## Commit Boundary

Staging and verification do not change the declared installed state. Commit begins only after every required artifact and generated input has verified evidence and rollback obligations remain satisfiable. A future platform ADR must establish which transitions can be atomic and how directory metadata is synchronized; M16 does not claim cross-platform atomicity.

The durable instance manifest is updated only at commit. A journal record cannot claim `committed` until the future adapter has evidence that the manifest and owned files agree.

## Failure Contract

Failures carry a stable code, phase, category, retry disposition, rollback requirement, user-safe message, redacted evidence references, and whether manual review is required. Categories include:

- invalid input or stale review;
- permission or gate denial;
- workspace containment or ownership failure;
- source-policy or integrity failure;
- staging or commit failure;
- cancellation or interruption;
- rollback failure;
- recovery ambiguity;
- Java, authentication, or process lifecycle failure.

Failure records must not contain secrets, tokens, absolute local paths, raw command lines, or unbounded process output. Unknown failure codes fail closed.

## Rollback and Recovery

Before staging, every manifest operation declares whether it creates owned data, replaces owned data with a snapshot obligation, or is non-rollbackable. A transaction containing an unsatisfied rollback obligation cannot enter `ready`.

Rollback may touch only transaction-owned staging data and previously recorded application-owned targets inside the validated workspace. It never discovers deletion targets from the current filesystem, never follows a path outside the workspace, and never deletes pre-existing user data. Incomplete cleanup becomes `recovery_required`, preserves audit evidence, and blocks automatic retry.

Recovery consumes the immutable manifest plus a validated, ordered journal. It derives the next safe action from recorded evidence rather than guessing from directory contents. Corrupt, missing, reordered, or contradictory journal evidence requires manual review. Recovery is idempotent and cannot broaden permission scope.

## Audit Contract

Audit events are append-only logical records with caller-supplied timestamp, monotonic sequence number, transaction/request/manifest identity, state transition, event code, actor class, redacted details, and previous-event digest. Event order and detail keys are canonicalized for deterministic review.

Actors are limited to `user`, `desktop-review`, `local-executor`, and `recovery`. Planner endpoints and metadata providers cannot emit authoritative execution events. Audit persistence is itself filesystem authority and remains gated; M16 only defines records in memory.

## Threat Model

The architecture must fail closed against:

- malicious or compromised Planner responses;
- stale review or time-of-check/time-of-use substitution;
- digest, resource, source, version, or hash substitution;
- path traversal, alternate data streams, case/Unicode ambiguity, symlink/junction/reparse escape, and mount substitution;
- user-selected parent, root, non-empty, or existing-instance locations;
- partial downloads, oversized artifacts, redirect abuse, truncation, and hash mismatch;
- interrupted staging, torn journal records, partial commit, and rollback failure;
- confirmation replay or capability escalation;
- argument injection, shell interpolation, untrusted Java binaries, orphaned processes, and unredacted output;
- OAuth redirect interception, token disclosure, and cross-account confusion;
- audit forgery, reordering, secret leakage, and unbounded retention.

M16 mitigates these threats only by making required evidence and fail-closed states explicit. Runtime mitigations are not implemented evidence.

## Approval Gates

| Gate | Stops before | Required evidence in addition to explicit approval |
|---|---|---|
| `GATE-EXEC-01` | first privileged Local Executor adapter or dispatcher | accepted M16 ADR, reviewed pure contracts, capability inventory, threat-model review, rollback boundary, scoped branch/checkpoint |
| `GATE-FS-01` | first workspace read/write, manifest/journal persistence, snapshot, or instance mutation | platform path model, containment and reparse tests, atomicity analysis, recovery tests, dependency review |
| `GATE-USER-PATH-01` | first use of a user-selected location | approved picker/consent UX, emptiness and ownership policy, substitution defenses, adversarial path matrix, no existing-instance mutation proof |
| `GATE-NET-01` | first artifact, loader, Java, or game byte download | source/redirect allowlist, required-hash policy, size/time limits, staging cleanup, provider terms/license review, malicious-response tests |
| `GATE-JAVA-01` | Java discovery, selection, provisioning, or execution | Java ownership ADR, provenance/version/signature policy, executable-path handling, platform matrix, licensing review |
| `GATE-OAUTH-01` | OAuth request, credential use, token storage, refresh, or revocation | auth/privacy ADR, application ownership, least scopes, redirect threat model, OS secure-storage decision, redaction and revocation tests |
| `GATE-PROC-01` | shell, command, sidecar, Java, launcher, or Minecraft process start | no-shell argument contract, executable provenance, lifecycle ownership, cancellation/timeout/orphan tests, output bounds and redaction |
| `GATE-DEP-01` | production dependency addition or material privilege-expanding upgrade | necessity, provenance, maintenance, license, vulnerability, transitive-capability, and rollback review |
| `GATE-UPDATER-01` | updater or background update behavior | separate updater ADR, signing, channel, rollback, consent, and supply-chain evidence |
| `GATE-SIDECAR-01` | bundled helper or sidecar behavior | separate lifecycle/trust ADR, signing, port/IPC boundary, crash/update model, and necessity review |
| `GATE-MC-DIR-01` | reading, scanning, or mutating an existing Minecraft directory | separate scope approval and privacy/path threat model; excluded from First Playable |
| `GATE-REL-01` | merge declaring playable readiness, tag, GitHub Release, or public First Playable artifact | all applicable gates, supported-platform validation matrix, security/license/source audit, recovery demonstration, explicit release approval |

Repository approval of this ADR does not approve any row. Gates may be split further when implementation evidence reveals a narrower safe checkpoint.

## Determinism Rules

- IDs, digests, timestamps, nonces, and evaluation time are caller inputs; helpers do not use randomness or the wall clock.
- Capabilities, operations, hashes, failures, and audit detail keys use explicit stable ordering.
- Equivalent inputs produce equivalent validation results and transition decisions.
- Unknown enum values, gate IDs, transition states, digest algorithms, or manifest operations fail closed.

## Alternatives Considered

### Execute the M6 install-action preview

Rejected. The preview is presentation data, permits insufficient provenance, and intentionally has no confirmation, workspace, permission, journal, or recovery authority.

### Let the Planner call execution tools

Rejected. It violates platform ownership, makes remote or self-hosted planners locally privileged, and collapses review and execution into one trust domain.

### Use user-selected paths for every instance

Rejected for the first implementation. Arbitrary path ownership and rollback are harder to prove. Application-managed workspaces provide a narrower initial boundary.

### Store mutable status in the desired-state manifest

Rejected. Mixing intent and observations obscures provenance and makes interruption recovery ambiguous. Immutable manifest and append-only journal remain separate.

### Use an embedded database first

Deferred. It adds a production dependency and does not remove the need to define transaction semantics. DQ-002 remains open for platform evidence before persistence.

## Consequences

- M16 can add and test pure contracts without gaining runtime authority.
- Current Resource Plan and M6 preview schemas remain backward compatible.
- Pure validation establishes structural invariants only; it does not validate downloaded bytes, local paths, platform state, or the authenticity of approval evidence.
- Future capability work has smaller, explicit approval boundaries and cannot treat confirmation as blanket permission.
- User-selected locations remain designed but are not the recommended first filesystem implementation.
- Runtime implementation stops at `GATE-EXEC-01` and every applicable capability-specific gate.

## M16 Non-authorization Statement

No code or document in M16 authorizes filesystem access, downloads, Java, OAuth, credentials, process execution, Minecraft directory access, local mutation, updater, sidecar, merge, tag, or Release. Those capabilities remain unavailable until their exact gate, evidence, scope, and branch checkpoint receive explicit approval.
