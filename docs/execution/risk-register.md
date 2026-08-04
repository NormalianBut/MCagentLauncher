# Execution Risk Register

Likelihood and impact use `low`, `medium`, or `high`. Status is `identified`, `mitigating`, `accepted`, or `closed`. These risks describe future capabilities; they do not imply those capabilities are enabled.

| Risk ID | Capability | Likelihood | Impact | Mitigation | Detection | Rollback | Owner | Status |
|---|---|---:|---:|---|---|---|---|---|
| R-001 | Instance mutation | Medium | High | Project-owned root, canonical containment, transaction journal, no existing-instance mutation | Path-property tests, canary files, manual recovery review | Restore snapshot or remove only transaction-owned staged files | Desktop Executor maintainers | Identified |
| R-002 | Path handling | Medium | High | Reject traversal, symlinks/reparse escapes, reserved paths, roots, and ambiguous normalization | Cross-platform adversarial path tests and runtime containment assertions | Abort before mutation; quarantine owned staging area | Security maintainers | Identified |
| R-003 | Resource download | High | Medium | Temporary staging, size/time limits, cancellation, resumability policy, fsync/atomicity analysis | Interrupted-transfer and truncation tests | Delete owned partial staging artifact; preserve journal evidence | Downloader maintainers | Identified |
| R-004 | Integrity verification | Medium | High | Require provider-declared supported hash and verify before commit | Known-answer tests and forced mismatch integration tests | Reject and remove staged bytes; never update manifest | Security maintainers | Identified |
| R-005 | Metadata trust | Medium | High | Strict parsing, URL/source allowlists, no metadata-to-path trust, compatibility uncertainty | Malformed/adversarial provider fixtures and provenance diagnostics | Reject plan/artifact and keep prior state | Resolver maintainers | Mitigating |
| R-006 | Dependency resolution | Medium | High | Stable provider/project identities, provenance, explicit dependency graph, no package-name fallback across sources | Confusion fixtures, duplicate identity checks, source pinning tests | Reject transaction before download or commit | Resolver maintainers | Mitigating |
| R-007 | Java execution | Medium | High | Explicit runtime provenance/version policy, no shell, fixed argument schema, user confirmation | Binary provenance checks, argument-injection tests, launch audit event | Terminate owned process and mark transaction failed | Desktop Executor maintainers | Identified |
| R-008 | OAuth token handling | Medium | High | Least scopes, system browser, OS credential storage, redaction, revocation flow | Secret scanning, redirect tests, log review, token lifecycle tests | Revoke tokens, clear secure storage, invalidate session | Authentication maintainers | Identified |
| R-009 | Process lifecycle | Medium | High | Direct child ownership, cancellation, timeout, output bounds/redaction, shutdown cleanup | Orphan-process, crash, cancellation, and timeout tests | Terminate owned process tree and preserve failure report | Desktop Executor maintainers | Identified |
| R-010 | Rollback and recovery | Medium | High | Versioned journal, idempotent recovery, snapshots, state invariants, no out-of-root delete | Fault injection at every transition and restart recovery tests | Stop automated recovery, preserve evidence, require manual review | Desktop Executor maintainers | Identified |

## Review Rules

- Update a risk when its design, likelihood, mitigation, detection, owner, or status changes.
- A capability gate cannot rely on an `identified` mitigation as though it were implemented evidence.
- Any accepted high-impact residual risk requires an explicit recorded decision.
- Closing a risk requires test and review evidence, not milestone completion alone.
