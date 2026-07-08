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
