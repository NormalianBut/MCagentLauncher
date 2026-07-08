export type EnvironmentProbeMode = "mock" | "read_only_probe";
export type EnvironmentReadinessLevel = "unknown" | "not_ready" | "preview_ready" | "ready_later";
export type EnvironmentProbeCapability =
  | "platform_metadata"
  | "runtime_metadata"
  | "java_presence_hint"
  | "minecraft_directory_candidate"
  | "disk_space_hint"
  | "memory_hint";

export interface EnvironmentWarning {
  code: string;
  message: string;
}

export interface EnvironmentBlocker {
  code: string;
  message: string;
}

export interface EnvironmentProbeConsent {
  required: boolean;
  granted: boolean;
  grantedAt: string | null;
  statementVersion: "0.1.0";
}

export interface EnvironmentProbeOptions {
  consent: EnvironmentProbeConsent;
  now?: string;
  reportId?: string;
  probeVersion?: string;
  capabilities?: EnvironmentProbeCapability[];
  platform?: Partial<EnvironmentReport["platform"]>;
  runtime?: Partial<EnvironmentReport["runtime"]>;
}

export interface ReadOnlyProbeDiagnostics {
  readOnly: true;
  commandsExecuted: Array<"mock_environment_preview" | "consented_read_only_probe_preview">;
  filesWritten: 0;
  networkRequests: 0;
}

export interface EnvironmentProbeResult {
  consent: EnvironmentProbeConsent;
  diagnostics: ReadOnlyProbeDiagnostics;
  platform?: Partial<EnvironmentReport["platform"]>;
  runtime?: Partial<EnvironmentReport["runtime"]>;
  java?: Partial<EnvironmentReport["java"]>;
  minecraft?: Partial<EnvironmentReport["minecraft"]>;
  disk?: Partial<EnvironmentReport["disk"]>;
  memory?: Partial<EnvironmentReport["memory"]>;
}

export interface SafePlatformProbeInput {
  consent: EnvironmentProbeConsent;
  now?: string;
  reportId?: string;
  probeVersion?: string;
  os: EnvironmentReport["platform"]["os"];
  arch: EnvironmentReport["platform"]["arch"];
  family?: EnvironmentReport["platform"]["family"];
  appVersion: string | null;
  tauriAvailable: boolean;
  nodeAvailable: boolean | null;
}

export interface SafePlatformProbeResult {
  consent: EnvironmentProbeConsent;
  diagnostics: ReadOnlyProbeDiagnostics;
  platform: EnvironmentReport["platform"];
  runtime: EnvironmentReport["runtime"];
}

export interface ReadOnlyProbeSafetyResult {
  accepted: boolean;
  warnings: EnvironmentWarning[];
  errors: EnvironmentBlocker[];
}

export interface EnvironmentReport {
  schemaVersion: "0.1.0";
  reportId: string;
  createdAt: string;
  source: {
    mode: EnvironmentProbeMode;
    generatedBy: "desktop";
    uploaded: false;
    consentRequired: boolean;
    consentGranted: boolean;
  };
  probe: {
    startedAt: string | null;
    completedAt: string | null;
    probeVersion: string;
    readOnly: true;
    commandsExecuted: Array<"mock_environment_preview" | "consented_read_only_probe_preview">;
    filesWritten: 0;
    networkRequests: 0;
  };
  platform: {
    os: "windows" | "macos" | "linux" | "unknown";
    arch: "x64" | "arm64" | "unknown";
    family: "desktop" | "unknown";
  };
  runtime: {
    app: string;
    tauriAvailable: boolean;
    nodeAvailable: boolean | null;
    appVersion?: string | null;
  };
  java: {
    status: "unknown" | "not_checked" | "detected" | "missing" | "error";
    version: string | null;
    path: string | null;
    checkedBy: "mock" | "future_probe" | "read_only_probe";
    detectionMethod: "not_checked" | "safe_path_lookup" | "tauri_plugin" | "manual_user_input";
  };
  minecraft: {
    directoryStatus: "not_checked" | "candidate_only" | "user_selected_candidate" | "missing" | "unknown";
    candidateDirectories: string[];
    containsSensitivePath: boolean;
    scannedRecursively: false;
  };
  disk: {
    status: "not_checked" | "estimated" | "checked" | "unknown";
    freeSpaceGb: number | null;
    checkedPath: string | null;
  };
  memory: {
    status: "not_checked" | "estimated" | "checked" | "unknown";
    totalGb: number | null;
  };
  network: {
    status: "not_checked" | "offline" | "online" | "unknown";
    checked: false;
    requestsMade: 0;
  };
  permissions: {
    canWriteInstanceDirectory: false;
    canLaunchProcess: false;
    canDownload: false;
    readOnlyProbeAllowed: boolean;
  };
  readiness: {
    level: EnvironmentReadinessLevel;
    warnings: EnvironmentWarning[];
    blockers: EnvironmentBlocker[];
  };
  privacy: {
    localOnly: true;
    uploadAllowed: false;
    containsUserPath: boolean;
    redacted: true;
  };
}

export interface CreateMockEnvironmentReportOptions {
  now?: string;
  reportId?: string;
  platform?: Partial<EnvironmentReport["platform"]>;
  runtime?: Partial<EnvironmentReport["runtime"]>;
}

const schemaVersion = "0.1.0" as const;

const mockWarnings: EnvironmentWarning[] = [
  {
    code: "MOCK_ENVIRONMENT_REPORT",
    message: "This report is mock data and does not reflect real local system state.",
  },
  {
    code: "JAVA_NOT_CHECKED",
    message: "Java was not checked in M8.",
  },
  {
    code: "MINECRAFT_DIRECTORY_NOT_CHECKED",
    message: "No real Minecraft directory was read or scanned.",
  },
  {
    code: "ENVIRONMENT_UPLOAD_DISABLED",
    message: "The environment report remains local and is not uploaded.",
  },
];

export function createMockEnvironmentReport(options: CreateMockEnvironmentReportOptions = {}): EnvironmentReport {
  return {
    ...baseEnvironmentReport(options.now ?? "2026-07-08T00:00:00.000Z", options.reportId ?? "env_mock_desktop_preview"),
    source: {
      mode: "mock",
      generatedBy: "desktop",
      uploaded: false,
      consentRequired: false,
      consentGranted: false,
    },
    probe: {
      startedAt: null,
      completedAt: null,
      probeVersion: schemaVersion,
      readOnly: true,
      commandsExecuted: ["mock_environment_preview"],
      filesWritten: 0,
      networkRequests: 0,
    },
    platform: {
      os: options.platform?.os ?? "unknown",
      arch: options.platform?.arch ?? "unknown",
      family: options.platform?.family ?? "desktop",
    },
    runtime: {
      app: options.runtime?.app ?? "MCagentlauncher Desktop Shell",
      tauriAvailable: options.runtime?.tauriAvailable ?? false,
      nodeAvailable: options.runtime?.nodeAvailable ?? null,
      appVersion: options.runtime?.appVersion ?? schemaVersion,
    },
    readiness: {
      level: "preview_ready",
      warnings: mockWarnings,
      blockers: [
        {
          code: "REAL_PROBE_DISABLED",
          message: "Read-only environment probing requires explicit consent and is represented separately.",
        },
      ],
    },
  };
}

export function createReadOnlyProbeReport(input: EnvironmentProbeOptions): EnvironmentReport {
  const now = input.now ?? "2026-07-08T00:00:00.000Z";
  const base = createMockEnvironmentReport({
    now,
    reportId: input.reportId ?? "env_read_only_probe_preview",
    platform: input.platform,
    runtime: input.runtime,
  });

  if (!input.consent.granted) {
    return redactEnvironmentReport({
      ...base,
      source: {
        mode: "read_only_probe",
        generatedBy: "desktop",
        uploaded: false,
        consentRequired: true,
        consentGranted: false,
      },
      probe: {
        startedAt: null,
        completedAt: null,
        probeVersion: input.probeVersion ?? schemaVersion,
        readOnly: true,
        commandsExecuted: [],
        filesWritten: 0,
        networkRequests: 0,
      },
      permissions: {
        ...base.permissions,
        readOnlyProbeAllowed: false,
      },
      readiness: {
        level: "not_ready",
        warnings: [
          {
            code: "CONSENT_NOT_GRANTED",
            message: "Read-only environment probe was not run because user consent was not granted.",
          },
        ],
        blockers: [
          {
            code: "USER_CONSENT_REQUIRED",
            message: "Explicit user consent is required before any read-only probe preview can be generated.",
          },
        ],
      },
    });
  }

  const result: EnvironmentProbeResult = {
    consent: input.consent,
    diagnostics: {
      readOnly: true,
      commandsExecuted: ["consented_read_only_probe_preview"],
      filesWritten: 0,
      networkRequests: 0,
    },
    platform: input.platform,
    runtime: input.runtime,
    java: {
      status: "not_checked",
      version: null,
      path: null,
      checkedBy: "read_only_probe",
      detectionMethod: "not_checked",
    },
    minecraft: {
      directoryStatus: "not_checked",
      candidateDirectories: ["<minecraft-directory-not-checked>"],
      containsSensitivePath: false,
      scannedRecursively: false,
    },
    disk: {
      status: "not_checked",
      freeSpaceGb: null,
      checkedPath: null,
    },
    memory: {
      status: "not_checked",
      totalGb: null,
    },
  };

  return redactEnvironmentReport(mergeProbeResultIntoEnvironmentReport(base, result, {
    now,
    probeVersion: input.probeVersion ?? schemaVersion,
  }));
}

export function createSafePlatformProbeReport(input: SafePlatformProbeInput): EnvironmentReport {
  const now = input.now ?? "2026-07-08T00:00:00.000Z";
  const result: SafePlatformProbeResult = {
    consent: input.consent,
    diagnostics: {
      readOnly: true,
      commandsExecuted: [],
      filesWritten: 0,
      networkRequests: 0,
    },
    platform: {
      os: input.os,
      arch: input.arch,
      family: input.family ?? "desktop",
    },
    runtime: {
      app: "MCagentlauncher Desktop Shell",
      tauriAvailable: input.tauriAvailable,
      nodeAvailable: input.nodeAvailable,
      appVersion: input.appVersion,
    },
  };
  const base = createMockEnvironmentReport({
    now,
    reportId: input.reportId ?? "env_safe_platform_probe",
  });

  return mergeSafePlatformProbeIntoEnvironmentReport(base, result, {
    now,
    probeVersion: input.probeVersion ?? schemaVersion,
  });
}

export function mergeSafePlatformProbeIntoEnvironmentReport(
  baseReport: EnvironmentReport,
  result: SafePlatformProbeResult,
  options: { now?: string; probeVersion?: string } = {},
): EnvironmentReport {
  const now = options.now ?? baseReport.createdAt;
  const consentGranted = result.consent.granted === true;
  const report: EnvironmentReport = {
    ...baseReport,
    source: {
      mode: "read_only_probe",
      generatedBy: "desktop",
      uploaded: false,
      consentRequired: result.consent.required,
      consentGranted,
    },
    probe: {
      startedAt: consentGranted ? result.consent.grantedAt ?? now : null,
      completedAt: consentGranted ? now : null,
      probeVersion: options.probeVersion ?? schemaVersion,
      readOnly: true,
      commandsExecuted: [],
      filesWritten: 0,
      networkRequests: 0,
    },
    platform: result.platform,
    runtime: result.runtime,
    java: {
      status: "not_checked",
      version: null,
      path: null,
      checkedBy: "read_only_probe",
      detectionMethod: "not_checked",
    },
    minecraft: {
      directoryStatus: "not_checked",
      candidateDirectories: ["<minecraft-directory-not-checked>"],
      containsSensitivePath: false,
      scannedRecursively: false,
    },
    disk: {
      status: "not_checked",
      freeSpaceGb: null,
      checkedPath: null,
    },
    memory: {
      status: "not_checked",
      totalGb: null,
    },
    network: {
      status: "not_checked",
      checked: false,
      requestsMade: 0,
    },
    permissions: {
      canWriteInstanceDirectory: false,
      canLaunchProcess: false,
      canDownload: false,
      readOnlyProbeAllowed: consentGranted,
    },
    readiness: consentGranted
      ? {
          level: "ready_later",
          warnings: [
            {
              code: "SAFE_PLATFORM_PROBE",
              message: "M8.3 collected only low-risk platform metadata after user consent.",
            },
            {
              code: "NO_LOCAL_ENVIRONMENT_SCAN",
              message: "No directory, runtime binary, disk, network, download, install, launch, or upload check was performed.",
            },
          ],
          blockers: [],
        }
      : {
          level: "not_ready",
          warnings: [
            {
              code: "CONSENT_NOT_GRANTED",
              message: "Safe platform probe was not run because user consent was not granted.",
            },
          ],
          blockers: [
            {
              code: "USER_CONSENT_REQUIRED",
              message: "Explicit user consent is required before safe platform metadata can be collected.",
            },
          ],
        },
    privacy: {
      localOnly: true,
      uploadAllowed: false,
      containsUserPath: false,
      redacted: true,
    },
  };

  return redactEnvironmentReport(report);
}

export function mergeProbeResultIntoEnvironmentReport(
  baseReport: EnvironmentReport,
  probeResult: EnvironmentProbeResult,
  options: { now?: string; probeVersion?: string } = {},
): EnvironmentReport {
  const now = options.now ?? baseReport.createdAt;
  const merged: EnvironmentReport = {
    ...baseReport,
    source: {
      mode: "read_only_probe",
      generatedBy: "desktop",
      uploaded: false,
      consentRequired: probeResult.consent.required,
      consentGranted: probeResult.consent.granted,
    },
    probe: {
      startedAt: probeResult.consent.grantedAt ?? now,
      completedAt: now,
      probeVersion: options.probeVersion ?? schemaVersion,
      readOnly: true,
      commandsExecuted: probeResult.diagnostics.commandsExecuted,
      filesWritten: 0,
      networkRequests: 0,
    },
    platform: {
      ...baseReport.platform,
      ...probeResult.platform,
    },
    runtime: {
      ...baseReport.runtime,
      ...probeResult.runtime,
    },
    java: {
      ...baseReport.java,
      ...probeResult.java,
      checkedBy: probeResult.java?.checkedBy ?? "read_only_probe",
      detectionMethod: probeResult.java?.detectionMethod ?? "not_checked",
    },
    minecraft: {
      ...baseReport.minecraft,
      ...probeResult.minecraft,
      scannedRecursively: false,
    },
    disk: {
      ...baseReport.disk,
      ...probeResult.disk,
    },
    memory: {
      ...baseReport.memory,
      ...probeResult.memory,
    },
    network: {
      status: "not_checked",
      checked: false,
      requestsMade: 0,
    },
    permissions: {
      canWriteInstanceDirectory: false,
      canLaunchProcess: false,
      canDownload: false,
      readOnlyProbeAllowed: probeResult.consent.granted,
    },
    readiness: {
      level: probeResult.consent.granted ? "ready_later" : "not_ready",
      warnings: [
        {
          code: "READ_ONLY_PROBE_PREVIEW",
          message: "This report was generated after user consent, but M8.1 still uses a safe read-only preview adapter.",
        },
        {
          code: "NO_SYSTEM_COMMANDS",
          message: "No shell command, Java command, disk scan, or Minecraft directory scan was executed.",
        },
        {
          code: "NO_UPLOAD",
          message: "The report remains local and was not uploaded.",
        },
      ],
      blockers: [],
    },
    privacy: {
      localOnly: true,
      uploadAllowed: false,
      containsUserPath: false,
      redacted: true,
    },
  };

  return merged;
}

export function validateReadOnlyProbeSafety(report: EnvironmentReport): ReadOnlyProbeSafetyResult {
  const errors: EnvironmentBlocker[] = [];
  const warnings: EnvironmentWarning[] = [];

  if (report.privacy.localOnly !== true) {
    errors.push({ code: "LOCAL_ONLY_REQUIRED", message: "Environment report must remain local-only." });
  }
  if (report.privacy.uploadAllowed !== false || report.source.uploaded !== false) {
    errors.push({ code: "UPLOAD_NOT_ALLOWED", message: "Environment report upload must be disabled." });
  }
  if (report.probe.readOnly !== true) {
    errors.push({ code: "READ_ONLY_REQUIRED", message: "Environment probe must be read-only." });
  }
  if (report.probe.filesWritten !== 0) {
    errors.push({ code: "FILES_WRITTEN_BLOCKED", message: "Read-only probe must not write files." });
  }
  if (report.probe.networkRequests !== 0 || report.network.requestsMade !== 0) {
    errors.push({ code: "NETWORK_REQUESTS_BLOCKED", message: "Read-only probe must not make network requests." });
  }
  if (report.permissions.canDownload !== false) {
    errors.push({ code: "DOWNLOAD_BLOCKED", message: "Environment probe must not download resources." });
  }
  if (report.permissions.canLaunchProcess !== false) {
    errors.push({ code: "PROCESS_LAUNCH_BLOCKED", message: "Environment probe must not launch processes." });
  }
  if (report.permissions.canWriteInstanceDirectory !== false) {
    errors.push({ code: "INSTANCE_WRITE_BLOCKED", message: "Environment probe must not write instance directories." });
  }
  if (report.minecraft.scannedRecursively !== false) {
    errors.push({ code: "RECURSIVE_SCAN_BLOCKED", message: "Environment probe must not recursively scan directories." });
  }
  if (JSON.stringify(report).match(/[A-Z]:\\Users\\|\/Users\/|\/home\/|AppData|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)) {
    errors.push({ code: "REDACTION_REQUIRED", message: "Environment report still contains path-like or email-like sensitive data." });
  }
  if (report.source.mode === "read_only_probe" && report.source.consentGranted !== true) {
    warnings.push({ code: "CONSENT_NOT_GRANTED", message: "Read-only probe report was not consent-granted." });
  }

  return {
    accepted: errors.length === 0,
    warnings,
    errors,
  };
}

export function validateSafePlatformProbeSafety(report: EnvironmentReport): ReadOnlyProbeSafetyResult {
  const result = validateReadOnlyProbeSafety(report);
  const errors = [...result.errors];
  const warnings = [...result.warnings];

  if (report.source.mode !== "read_only_probe") {
    errors.push({ code: "READ_ONLY_PROBE_MODE_REQUIRED", message: "Safe platform probe must use read_only_probe mode." });
  }
  if (report.source.consentGranted !== true || report.source.consentRequired !== true) {
    errors.push({ code: "CONSENT_REQUIRED", message: "Safe platform probe requires explicit granted consent." });
  }
  if (report.probe.commandsExecuted.length !== 0) {
    errors.push({ code: "COMMANDS_BLOCKED", message: "Safe platform probe must not execute or record commands." });
  }
  if (report.java.status !== "not_checked" || report.java.version !== null || report.java.path !== null) {
    errors.push({ code: "JAVA_CHECK_BLOCKED", message: "Safe platform probe must not detect Java." });
  }
  if (report.minecraft.directoryStatus !== "not_checked" || report.minecraft.candidateDirectories.length !== 1) {
    errors.push({ code: "MINECRAFT_PATH_CHECK_BLOCKED", message: "Safe platform probe must not inspect Minecraft directories." });
  }
  if (report.disk.status !== "not_checked" || report.disk.freeSpaceGb !== null || report.disk.checkedPath !== null) {
    errors.push({ code: "DISK_CHECK_BLOCKED", message: "Safe platform probe must not check disk state." });
  }
  if (report.network.checked !== false || report.network.status !== "not_checked") {
    errors.push({ code: "NETWORK_CHECK_BLOCKED", message: "Safe platform probe must not check network state." });
  }
  if (report.privacy.containsUserPath !== false || report.privacy.redacted !== true) {
    errors.push({ code: "PRIVACY_REDACTION_REQUIRED", message: "Safe platform probe must not contain user paths and must remain redacted." });
  }

  return {
    accepted: errors.length === 0,
    warnings,
    errors,
  };
}

export function summarizeEnvironmentReport(report: EnvironmentReport): string {
  const warningCount = report.readiness.warnings.length;
  const blockerCount = report.readiness.blockers.length;
  const javaStatus = report.java.status.replaceAll("_", " ");
  const directoryStatus = report.minecraft.directoryStatus.replaceAll("_", " ");
  const consent = report.source.consentRequired ? `consentGranted=${report.source.consentGranted}` : "consent not required";

  return [
    `Environment report ${report.reportId} is ${report.source.mode} and ${report.privacy.localOnly ? "local-only" : "not local-only"}.`,
    `${consent}; readiness is ${report.readiness.level.replaceAll("_", " ")} with ${warningCount} warning(s) and ${blockerCount} blocker(s).`,
    `Java status is ${javaStatus}; Minecraft directory status is ${directoryStatus}.`,
    "No download, install, launch, shell command, disk scan, upload, or persistence was performed.",
  ].join(" ");
}

export function redactEnvironmentReport(report: EnvironmentReport): EnvironmentReport {
  const redacted: EnvironmentReport = {
    ...report,
    source: {
      ...report.source,
      uploaded: false,
    },
    probe: {
      ...report.probe,
      readOnly: true,
      filesWritten: 0,
      networkRequests: 0,
    },
    java: {
      ...report.java,
      path: redactSensitiveValue(report.java.path),
    },
    minecraft: {
      ...report.minecraft,
      candidateDirectories: report.minecraft.candidateDirectories.map((value) => redactSensitiveValue(value) ?? "<redacted-value>"),
      containsSensitivePath: false,
      scannedRecursively: false,
    },
    disk: {
      ...report.disk,
      checkedPath: redactSensitiveValue(report.disk.checkedPath),
    },
    network: {
      status: report.network.status,
      checked: false,
      requestsMade: 0,
    },
    permissions: {
      canWriteInstanceDirectory: false,
      canLaunchProcess: false,
      canDownload: false,
      readOnlyProbeAllowed: report.permissions.readOnlyProbeAllowed,
    },
    privacy: {
      localOnly: true,
      uploadAllowed: false,
      containsUserPath: false,
      redacted: true,
    },
  };

  return redacted;
}

function baseEnvironmentReport(now: string, reportId: string): EnvironmentReport {
  return {
    schemaVersion,
    reportId: sanitizeReportId(reportId),
    createdAt: now,
    source: {
      mode: "mock",
      generatedBy: "desktop",
      uploaded: false,
      consentRequired: false,
      consentGranted: false,
    },
    probe: {
      startedAt: null,
      completedAt: null,
      probeVersion: schemaVersion,
      readOnly: true,
      commandsExecuted: ["mock_environment_preview"],
      filesWritten: 0,
      networkRequests: 0,
    },
    platform: {
      os: "unknown",
      arch: "unknown",
      family: "desktop",
    },
    runtime: {
      app: "MCagentlauncher Desktop Shell",
      tauriAvailable: false,
      nodeAvailable: null,
      appVersion: schemaVersion,
    },
    java: {
      status: "not_checked",
      version: null,
      path: null,
      checkedBy: "mock",
      detectionMethod: "not_checked",
    },
    minecraft: {
      directoryStatus: "not_checked",
      candidateDirectories: ["<minecraft-directory-not-checked>"],
      containsSensitivePath: false,
      scannedRecursively: false,
    },
    disk: {
      status: "not_checked",
      freeSpaceGb: null,
      checkedPath: null,
    },
    memory: {
      status: "not_checked",
      totalGb: null,
    },
    network: {
      status: "not_checked",
      checked: false,
      requestsMade: 0,
    },
    permissions: {
      canWriteInstanceDirectory: false,
      canLaunchProcess: false,
      canDownload: false,
      readOnlyProbeAllowed: false,
    },
    readiness: {
      level: "preview_ready",
      warnings: mockWarnings,
      blockers: [],
    },
    privacy: {
      localOnly: true,
      uploadAllowed: false,
      containsUserPath: false,
      redacted: true,
    },
  };
}

function redactSensitiveValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (looksSensitive(value)) {
    return "<redacted-value>";
  }
  return value;
}

function looksSensitive(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    /^[a-z]:[\\/]/i.test(value)
    || normalized.includes("\\users\\")
    || normalized.includes("/users/")
    || normalized.includes("appdata")
    || normalized.includes("/home/")
    || normalized.includes("\\home\\")
    || normalized.includes(".minecraft")
    || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value)
    || /\b(token|secret|apikey|api_key)[=:_-]?[a-z0-9]{8,}\b/i.test(value)
  );
}

function sanitizeReportId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  if (/^env_[a-z0-9][a-z0-9_-]{5,63}$/.test(normalized)) {
    return normalized;
  }
  return "env_mock_desktop_preview";
}
