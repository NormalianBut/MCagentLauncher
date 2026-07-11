# M12 Native Desktop Preview Manual Checklist

Only check an item after direct manual verification.

## Build

- [x] Version check passes.
- [x] Frontend build passes.
- [x] Cargo/Tauri native build passes.
- [x] Bundle artifact exists.
- [x] Checksum exists and matches.
- [x] Artifact filename identifies version, Windows x64, and unsigned preview.
- [x] Artifact metadata contains no absolute development path.

## Installation And Launch

- [x] Application installs or launches.
- [x] Window title is correct.
- [x] Alpha and unsigned status are visible.
- [x] No unexpected administrator privilege is requested.
- [x] No Python sidecar or background server starts.
- [x] No updater process starts.

## Runtime Contract

- [x] Configured endpoint and server-not-bundled notice are visible.
- [x] Compatible server connects and displays server/API/schema versions.
- [x] `plannerOnly=true` is visible.
- [ ] Incompatible server blocks planning.
- [x] Stopped server shows unreachable without infinite retry.

## Functional Flow

- [x] Parse Intent works with a compatible server.
- [x] Generate Plan works.
- [x] Explain Plan works.
- [x] Install Preview remains dry-run.
- [x] Environment Preview works while server is unavailable.
- [x] Safe Platform Probe requires consent.
- [x] Confirm Install remains blocked and preview-only.

## Safety

- [x] No resource download or Minecraft installation occurs.
- [x] No local instance write or Minecraft launch occurs.
- [x] No Java probe, path scan, or disk scan occurs.
- [x] No environment report upload or persistence occurs.
- [x] No shell/process permission, updater, sidecar, or autostart exists.

## Removal

- [x] Preview application can be closed and removed.
- [x] Project source and Minecraft files remain unaffected.

## NSIS Uninstall Verification

Status: PASS

Verified on Windows 11:

- Preview application installed successfully.
- Application launched successfully.
- NSIS uninstall completed successfully.
- Application entry was removed from Windows Installed Apps.
- No MCagentlauncher process remained after uninstall.
- Project source repository remained unaffected.
- No Minecraft files were modified.
- No Python sidecar, updater, Java process, or background server remained.

Note:
Direct Minecraft directory inspection was not performed because M12 intentionally grants no filesystem or path-scanning capability.
