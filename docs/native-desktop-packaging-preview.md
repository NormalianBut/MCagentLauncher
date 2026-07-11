# Native Desktop Packaging Preview

M12 produces a Windows x64 Tauri NSIS **unsigned preview** for project testing. Windows may show an unknown-publisher or security warning. Do not bypass organizational security policy. This artifact is not signed, production-ready, or a stable GitHub Release.

## Contents And Boundaries

The preview contains the MCagentlauncher Desktop UI only. It does not contain Minecraft, Java, resource files, MCAgent Python Server, an updater, or a Local Executor. It requests current-user installation and must not write a Minecraft directory. Removing it does not affect Minecraft files.

## Build

Prerequisites are Node.js 22+, pnpm 11.10.0, Rust 1.96.0 with the Windows MSVC x64 target, and Windows native build tools. System prerequisites are not installed by project scripts.

```powershell
pnpm install --frozen-lockfile
pnpm check:desktop-version
pnpm check:desktop-security
pnpm package:desktop:windows
```

Generated review files are placed in `artifacts/desktop-preview/`:

- `MCagentlauncher-0.1.0-windows-x64-unsigned-preview.exe`
- `desktop-preview-manifest.json`
- `SHA256SUMS.txt`

Verify the SHA-256 value with:

```powershell
Get-FileHash artifacts/desktop-preview/MCagentlauncher-0.1.0-windows-x64-unsigned-preview.exe -Algorithm SHA256
```

Compare it with `SHA256SUMS.txt` from the same workflow artifact. Confirm artifact provenance from the expected repository and workflow run before launching it.

## Endpoint

MCAgent Server is independent and must be started separately:

```powershell
pnpm dev:server
```

Desktop uses `VITE_MCAGENT_API_URL` at build time, with the source-development fallback `http://127.0.0.1:8000`. It calls `/v1/meta`; planning remains disabled until API, schema, required capabilities, and planner-only safety declarations are compatible. The endpoint URL must be HTTP(S) and cannot embed credentials.

## Removal

Close the application and remove it through Windows Installed Apps when installed through NSIS. A directly launched preview executable can simply be closed and removed. M12 creates no autostart entry, background server, environment-report persistence, or Minecraft files.

macOS and Linux packaging are not validated in M12. Future sidecar, signing, notarization, updater, and executor work require separate decisions.
