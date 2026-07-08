export type EnvironmentProbeMode = "mock" | "read_only_probe";
export type EnvironmentReadinessLevel = "unknown" | "not_ready" | "preview_ready" | "ready_later";

export interface EnvironmentWarning {
  code: string;
  message: string;
}

export interface EnvironmentBlocker {
  code: string;
  message: string;
}

export interface EnvironmentReport {
  schemaVersion: "0.1.0";
  reportId: string;
  createdAt: string;
  source: {
    mode: EnvironmentProbeMode;
    generatedBy: "desktop";
    uploaded: false;
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
  };
  java: {
    status: "unknown" | "not_checked" | "detected" | "missing";
    version: string | null;
    path: string | null;
    checkedBy: "mock" | "future_probe";
  };
  minecraft: {
    directoryStatus: "not_checked" | "candidate_only" | "missing" | "unknown";
    candidateDirectories: string[];
    containsSensitivePath: boolean;
  };
  disk: {
    status: "not_checked" | "estimated" | "unknown";
    freeSpaceGb: number | null;
  };
  memory: {
    status: "not_checked" | "estimated" | "unknown";
    totalGb: number | null;
  };
  network: {
    status: "not_checked" | "offline" | "online" | "unknown";
    checked: false;
  };
  permissions: {
    canWriteInstanceDirectory: false;
    canLaunchProcess: false;
    canDownload: false;
  };
  readiness: {
    level: EnvironmentReadinessLevel;
    warnings: EnvironmentWarning[];
    blockers: EnvironmentBlocker[];
  };
  privacy: {
    localOnly: true;
    uploadAllowed: false;
    containsUserPath: false;
    redacted: true;
  };
}

export interface CreateMockEnvironmentReportOptions {
  now?: string;
  reportId?: string;
  platform?: Partial<EnvironmentReport["platform"]>;
  runtime?: Partial<EnvironmentReport["runtime"]>;
}

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
    schemaVersion: "0.1.0",
    reportId: sanitizeReportId(options.reportId ?? "env_mock_desktop_preview"),
    createdAt: options.now ?? "2026-07-08T00:00:00.000Z",
    source: {
      mode: "mock",
      generatedBy: "desktop",
      uploaded: false,
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
    },
    java: {
      status: "not_checked",
      version: null,
      path: null,
      checkedBy: "mock",
    },
    minecraft: {
      directoryStatus: "not_checked",
      candidateDirectories: ["<minecraft-directory-not-checked>"],
      containsSensitivePath: false,
    },
    disk: {
      status: "not_checked",
      freeSpaceGb: null,
    },
    memory: {
      status: "not_checked",
      totalGb: null,
    },
    network: {
      status: "not_checked",
      checked: false,
    },
    permissions: {
      canWriteInstanceDirectory: false,
      canLaunchProcess: false,
      canDownload: false,
    },
    readiness: {
      level: "preview_ready",
      warnings: mockWarnings,
      blockers: [
        {
          code: "REAL_PROBE_DISABLED",
          message: "Read-only environment probing is reserved for a later milestone.",
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
}

export function summarizeEnvironmentReport(report: EnvironmentReport): string {
  const warningCount = report.readiness.warnings.length;
  const blockerCount = report.readiness.blockers.length;
  const javaStatus = report.java.status.replaceAll("_", " ");
  const directoryStatus = report.minecraft.directoryStatus.replaceAll("_", " ");

  return [
    `Environment report ${report.reportId} is ${report.source.mode} and ${report.privacy.localOnly ? "local-only" : "not local-only"}.`,
    `Readiness is ${report.readiness.level.replaceAll("_", " ")} with ${warningCount} warning(s) and ${blockerCount} blocker(s).`,
    `Java status is ${javaStatus}; Minecraft directory status is ${directoryStatus}.`,
    "No download, install, launch, shell command, disk scan, or upload was performed.",
  ].join(" ");
}

export function redactEnvironmentReport(report: EnvironmentReport): EnvironmentReport {
  const redacted: EnvironmentReport = {
    ...report,
    java: {
      ...report.java,
      path: redactPathLikeValue(report.java.path),
    },
    minecraft: {
      ...report.minecraft,
      candidateDirectories: report.minecraft.candidateDirectories.map((value) => redactPathLikeValue(value) ?? "<redacted-path>"),
      containsSensitivePath: false,
    },
    source: {
      ...report.source,
      uploaded: false,
    },
    permissions: {
      canWriteInstanceDirectory: false,
      canLaunchProcess: false,
      canDownload: false,
    },
    network: {
      ...report.network,
      checked: false,
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

function redactPathLikeValue(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (looksLikePath(value)) {
    return "<redacted-path>";
  }
  return value;
}

function looksLikePath(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    /^[a-z]:[\\/]/i.test(value)
    || normalized.includes("\\users\\")
    || normalized.includes("/users/")
    || normalized.includes("appdata")
    || normalized.includes("/home/")
    || normalized.includes("\\home\\")
    || normalized.includes(".minecraft")
  );
}

function sanitizeReportId(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  if (/^env_[a-z0-9][a-z0-9_-]{5,63}$/.test(normalized)) {
    return normalized;
  }
  return "env_mock_desktop_preview";
}
