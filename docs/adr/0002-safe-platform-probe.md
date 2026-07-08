# ADR 0002: Safe Platform Probe

## Status

Accepted for M8.3.

## Context

M8.1 introduced a user-consented read-only probe flow, and M8.2 defined the permission policy. The next step needs a minimal real probe that is useful for Desktop readiness UI without crossing into local execution, path inspection, resource download, or installation behavior.

Even low-risk environment metadata can reveal user context. The probe must therefore require explicit user consent, remain local-only, and avoid persistence or upload.

## Decision

M8.3 allows a Level 2 Safe Platform Probe after explicit user consent.

Allowed data:

- OS/platform family;
- architecture hint;
- app version;
- Tauri runtime availability as a boolean.

Allowed operations:

- read browser/Tauri-safe platform metadata exposed to the already-running Desktop UI;
- assemble an environment report in memory;
- validate the report with shared safety checks;
- display the report in the current Desktop session.

Forbidden operations:

- filesystem reads or writes;
- shell or child process execution;
- Java version probing;
- PATH or environment variable inspection for sensitive data;
- home directory, AppData, or Minecraft directory inspection;
- disk scanning;
- network requests;
- report upload;
- localStorage, sessionStorage, indexedDB, or file persistence;
- download, install, or launch behavior.

The report must keep `probe.commandsExecuted=[]`, `probe.filesWritten=0`, `probe.networkRequests=0`, `privacy.localOnly=true`, and `privacy.uploadAllowed=false`.

## Why No Shell, Path, Or Java Probe

Shell commands and Java probing can expose command output, runtime paths, user directories, and machine-specific state. Directory probing can expose sensitive user paths. Those capabilities require separate policy review and future ADRs.

M8.3 deliberately keeps the probe smaller: platform metadata is enough to prove the consent flow, schema shape, in-memory reporting, and safety validation without enabling local executor behavior.

## Future Work

Level 3 user-selected directory checks and Level 4 Java checks require new ADRs. They must include explicit consent language, redaction rules, no recursive scanning guarantees, and tests that prove the probe does not write files, launch processes, download resources, or upload reports.
