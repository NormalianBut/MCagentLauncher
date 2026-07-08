# Environment Probe Design

M8 defines the local environment report contract for MCagentlauncher Desktop. It is still dry-run, read-only, and preview-only.

## M8 Scope

M8 can generate and display a mock environment report. The report helps design how a future Desktop Local Executor will explain local readiness before real installation work begins.

M8 does not:

- read real local paths;
- check real Java installations;
- scan disks;
- read a real Minecraft directory;
- upload environment reports;
- download resources;
- install resources;
- write local files;
- launch Minecraft;
- execute shell commands.

## Privacy Defaults

Environment reports are local by default:

- `privacy.localOnly=true`
- `privacy.uploadAllowed=false`
- `privacy.containsUserPath=false`
- `privacy.redacted=true`
- `source.uploaded=false`

Mock examples must not include real Windows user names, home directories, email addresses, server IPs, tokens, secrets, or API keys.

## Future Read-only Probe

A future read-only probe may inspect Java availability, platform details, candidate instance paths, available disk space, and memory. That probe must require explicit user consent before it runs.

The future probe must also redact sensitive paths before any optional user-approved export. Web and MCAgent Server must not read user-local environment information.

## Responsibility Boundary

Desktop Local Executor is the only future component allowed to perform read-only local environment probing. MCAgent Server may receive a redacted report only after explicit user consent in a later milestone.

The M8 Desktop Shell only calls `createMockEnvironmentReport` and displays the result. It does not call Tauri commands or system commands.

## M8.1 User-consented Read-only Probe

M8.1 adds a user-consented read-only probe flow to the Desktop Shell.

The purpose is to establish the safety workflow:

```text
Run Read-only Probe -> consent modal -> read-only report assembly -> redaction -> local display
```

Consent is required because even read-only environment details can reveal sensitive local information such as platform hints, runtime state, user paths, Java paths, or Minecraft directory candidates.

## M8.1 Allowed Scope

M8.1 may represent:

- OS, architecture, and platform family;
- Desktop runtime availability;
- Java status as `not_checked` or a future redacted hint;
- Minecraft directory status as `not_checked` or a redacted candidate;
- disk and memory status as `not_checked` or future redacted hints;
- readiness warnings and blockers.

The current implementation still uses a safe read-only preview adapter. It does not run real Java detection, disk probing, path lookup, or Tauri system commands.

## M8.1 Forbidden Scope

M8.1 must not:

- upload the environment report;
- persist the report to localStorage, sessionStorage, or files;
- send the report to MCAgent Server or Web Playground;
- execute shell commands;
- execute `java -version`;
- recursively scan user directories;
- write local files;
- download or install resources;
- launch Minecraft.

Environment report state is session-only unless a future milestone adds an explicit user export flow. M8.1 does not implement export.

## Redaction

Reports must be redacted before display or any future export. The shared redaction helper handles Windows user paths, Unix home paths, backslash paths, `.minecraft` paths, email-like values, and token-like strings.

If real Java detection is ever enabled, it needs a separate ADR and explicit permission review.
