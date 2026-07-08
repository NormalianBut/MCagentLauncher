import {
  createSafePlatformProbeReport,
  type EnvironmentReport,
  type SafePlatformProbeInput,
} from "../../../../packages/shared-types/src/environment";

type NavigatorWithData = Navigator & {
  userAgentData?: {
    platform?: string;
    architecture?: string;
  };
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function collectSafePlatformProbeInput(consentGranted: boolean): SafePlatformProbeInput {
  const nav = globalThis.navigator as NavigatorWithData | undefined;
  const userAgent = nav?.userAgent ?? "";
  const platformHint = nav?.userAgentData?.platform ?? nav?.platform ?? userAgent;
  const architectureHint = nav?.userAgentData?.architecture ?? userAgent;
  const now = new Date().toISOString();

  return {
    consent: {
      required: true,
      granted: consentGranted,
      grantedAt: consentGranted ? now : null,
      statementVersion: "0.1.0",
    },
    now,
    reportId: "env_safe_platform_probe",
    os: detectOs(platformHint),
    arch: detectArch(`${architectureHint} ${userAgent}`),
    family: "desktop",
    appVersion: import.meta.env.VITE_APP_VERSION ?? "0.1.0",
    tauriAvailable: typeof globalThis.window !== "undefined" && "__TAURI_INTERNALS__" in globalThis.window,
    nodeAvailable: null,
  };
}

export function runSafePlatformProbe(consentGranted: boolean): EnvironmentReport {
  return createSafePlatformProbeReport(collectSafePlatformProbeInput(consentGranted));
}

function detectOs(value: string): SafePlatformProbeInput["os"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("win")) {
    return "windows";
  }
  if (normalized.includes("mac")) {
    return "macos";
  }
  if (normalized.includes("linux") || normalized.includes("x11")) {
    return "linux";
  }
  return "unknown";
}

function detectArch(value: string): SafePlatformProbeInput["arch"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("arm64") || normalized.includes("aarch64")) {
    return "arm64";
  }
  if (normalized.includes("x86_64") || normalized.includes("x64") || normalized.includes("win64")) {
    return "x64";
  }
  return "unknown";
}
