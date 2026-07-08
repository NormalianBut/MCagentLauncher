# Read-only Probe Permission Policy

This policy defines permission levels for MCagentlauncher Desktop environment probing. M8.3 enables only a minimal safe platform metadata probe after explicit user consent.

## Level 0: Mock Only

- Current use: M8.
- requiredConsent: false
- allowedData: mock environment report data.
- forbiddenData: real paths, Java details, disk details, network details.
- allowedOperations: construct mock report in memory.
- forbiddenOperations: system reads, path reads, command execution, network access.
- uploadAllowed: false
- persistenceAllowed: false
- redactionRequired: true

## Level 1: User-consented Preview

- Current use: M8.1 and M8.2.
- requiredConsent: true
- allowedData: consented read-only preview report data.
- forbiddenData: real Java output, real Minecraft path, unredacted local path, token, secret, email.
- allowedOperations: show consent UI, construct local preview report in memory.
- forbiddenOperations: shell execution, file writes, network upload, persistence, real path scanning.
- uploadAllowed: false
- persistenceAllowed: false
- redactionRequired: true

## Level 2: Safe Platform Probe

- Current use: M8.3.
- requiredConsent: true
- allowedData: OS, architecture, app version, Tauri runtime availability.
- forbiddenData: user paths, home directory, Minecraft directory, Java path.
- allowedOperations: fixed browser/Tauri-safe platform metadata read.
- forbiddenOperations: shell execution, process launch, network access, path scanning, storage persistence, file writes.
- uploadAllowed: false
- persistenceAllowed: false
- redactionRequired: true

## Level 3: User-selected Directory Probe

- Future use: later milestone.
- requiredConsent: true
- allowedData: existence and optional disk-space information for a directory selected through a system picker.
- forbiddenData: recursive file listings, inferred sensitive directories, automatic `.minecraft` guesses.
- allowedOperations: non-recursive check on the selected directory only.
- forbiddenOperations: recursive scans, automatic home scans, automatic Minecraft path detection.
- uploadAllowed: false
- persistenceAllowed: false
- redactionRequired: true

## Level 4: Java Probe

- Future use: requires separate ADR.
- requiredConsent: true
- allowedData: Java version and runtime metadata from a fixed safe API or fixed controlled mechanism.
- forbiddenData: arbitrary command output, user-controlled command arguments, unredacted Java path.
- allowedOperations: only those approved by a future ADR.
- forbiddenOperations: arbitrary shell, user-controlled command execution.
- uploadAllowed: false
- persistenceAllowed: false
- redactionRequired: true

## Level 5: Execution

- Future use: Desktop Local Executor execution milestone, not read-only probing.
- requiredConsent: true
- allowedData: execution plan after user confirmation.
- forbiddenData: unreviewed environment data upload.
- allowedOperations: download, install, file writes, and launch only after future executor policy approval.
- forbiddenOperations: any execution hidden behind read-only probe.
- uploadAllowed: false by default
- persistenceAllowed: only after a future explicit design
- redactionRequired: true

## M8.2 Effective Policy

M8.2 allows only:

- `mock_environment_report`
- `consented_read_only_preview`

M8.2 forbids real Java probing, path scanning, upload, persistence, file writes, process launch, and resource download.

## M8.3 Effective Policy

M8.3 allows:

- `mock_environment_report`
- `consented_read_only_preview`
- `read_os_arch`
- `read_app_version`
- `check_tauri_runtime`

M8.3 still forbids:

- `user_selected_directory_exists`
- `user_selected_directory_disk_space`
- `java_version_probe`
- `network_connectivity_probe`
- `environment_report_upload`
- `file_write`
- `process_launch`
- `resource_download`

Safe platform probe reports must keep:

- `source.mode=read_only_probe`
- `source.consentGranted=true`
- `probe.readOnly=true`
- `probe.commandsExecuted=[]`
- `probe.filesWritten=0`
- `probe.networkRequests=0`
- `network.checked=false`
- `privacy.localOnly=true`
- `privacy.uploadAllowed=false`
- `privacy.containsUserPath=false`
- `privacy.redacted=true`

M8.3 does not authorize Java probing, directory probing, disk probing, network probing, report upload, persistence, download, install, or launch behavior.
