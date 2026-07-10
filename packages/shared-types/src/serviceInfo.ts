export interface ServiceInfo {
  schemaVersion: string;
  service: {
    name: string;
    version: string;
    environment: "development" | "test" | "production" | "self-hosted";
  };
  api: {
    version: string;
    supportedSchemaVersions: string[];
  };
  mode: ServiceMode;
  capabilities: ServiceCapabilities;
  safety: ServiceSafety;
}

export interface ServiceMode {
  planning: "offline" | "live" | "hybrid";
  networkEnabledByDefault: boolean;
}

export interface ServiceCapabilities {
  intentParse: boolean;
  resourcePlan: boolean;
  planExplanation: boolean;
  liveResourceResolver: boolean;
  installExecution: boolean;
  localFileAccess: boolean;
  environmentProbe: boolean;
  minecraftLaunch: boolean;
}

export interface ServiceSafety {
  plannerOnly: boolean;
  canDownload: boolean;
  canWriteLocalFiles: boolean;
  canLaunchProcesses: boolean;
}

export type ServiceCapabilityName = keyof ServiceCapabilities;
export type CompatibilityStatus = "compatible" | "degraded" | "incompatible";

export interface ClientSupport {
  apiVersions: string[];
  schemaVersions: string[];
  requiredCapabilities: ServiceCapabilityName[];
  optionalCapabilities: ServiceCapabilityName[];
}

export type CompatibilityIssueCode =
  | "API_VERSION_INCOMPATIBLE"
  | "SCHEMA_VERSION_INCOMPATIBLE"
  | "REQUIRED_CAPABILITY_MISSING"
  | "OPTIONAL_CAPABILITY_MISSING"
  | "UNSAFE_CAPABILITY_DECLARED"
  | "OFFLINE_RESOLVER_LIMITATION";

export interface CompatibilityIssue {
  code: CompatibilityIssueCode;
  severity: "warning" | "blocker";
  message: string;
  capability?: ServiceCapabilityName | keyof ServiceSafety;
}

export interface ClientCompatibility {
  status: CompatibilityStatus;
  issues: CompatibilityIssue[];
  requiredCapabilities: ServiceCapabilityName[];
  optionalCapabilities: ServiceCapabilityName[];
}

export const DEFAULT_CLIENT_SUPPORT: ClientSupport = {
  apiVersions: ["v1"],
  schemaVersions: ["0.1.0"],
  requiredCapabilities: ["intentParse", "resourcePlan", "planExplanation"],
  optionalCapabilities: [],
};

const unsafeCapabilityClaims: ServiceCapabilityName[] = [
  "installExecution",
  "localFileAccess",
  "environmentProbe",
  "minecraftLaunch",
];

const unsafeSafetyClaims: Array<keyof ServiceSafety> = [
  "canDownload",
  "canWriteLocalFiles",
  "canLaunchProcesses",
];

export function evaluateServiceCompatibility(
  serviceInfo: ServiceInfo,
  clientSupport: ClientSupport = DEFAULT_CLIENT_SUPPORT,
): ClientCompatibility {
  const issues: CompatibilityIssue[] = [];

  if (!clientSupport.apiVersions.includes(serviceInfo.api.version)) {
    issues.push({
      code: "API_VERSION_INCOMPATIBLE",
      severity: "blocker",
      message: `Server API ${serviceInfo.api.version} is not supported by this client.`,
    });
  }

  const schemaCompatible = clientSupport.schemaVersions.includes(serviceInfo.schemaVersion)
    && serviceInfo.api.supportedSchemaVersions.some((version) => clientSupport.schemaVersions.includes(version));
  if (!schemaCompatible) {
    issues.push({
      code: "SCHEMA_VERSION_INCOMPATIBLE",
      severity: "blocker",
      message: `Server schema ${serviceInfo.schemaVersion} is not compatible with this client.`,
    });
  }

  for (const capability of clientSupport.requiredCapabilities) {
    if (serviceInfo.capabilities[capability] !== true) {
      issues.push({
        code: "REQUIRED_CAPABILITY_MISSING",
        severity: "blocker",
        capability,
        message: `Required server capability ${capability} is unavailable.`,
      });
    }
  }

  for (const capability of clientSupport.optionalCapabilities) {
    if (serviceInfo.capabilities[capability] !== true) {
      issues.push({
        code: "OPTIONAL_CAPABILITY_MISSING",
        severity: "warning",
        capability,
        message: `Optional server capability ${capability} is unavailable.`,
      });
    }
  }

  if (serviceInfo.safety.plannerOnly !== true) {
    issues.push({
      code: "UNSAFE_CAPABILITY_DECLARED",
      severity: "blocker",
      capability: "plannerOnly",
      message: "Server must declare plannerOnly=true for the current client.",
    });
  }

  for (const capability of unsafeCapabilityClaims) {
    if (serviceInfo.capabilities[capability] === true) {
      issues.push({
        code: "UNSAFE_CAPABILITY_DECLARED",
        severity: "blocker",
        capability,
        message: `Server declared unsafe capability ${capability}.`,
      });
    }
  }

  for (const capability of unsafeSafetyClaims) {
    if (serviceInfo.safety[capability] === true) {
      issues.push({
        code: "UNSAFE_CAPABILITY_DECLARED",
        severity: "blocker",
        capability,
        message: `Server declared unsafe safety capability ${capability}.`,
      });
    }
  }

  if (serviceInfo.capabilities.liveResourceResolver === false) {
    issues.push({
      code: "OFFLINE_RESOLVER_LIMITATION",
      severity: "warning",
      capability: "liveResourceResolver",
      message: "Live resource resolution is unavailable; planning uses offline metadata.",
    });
  }

  const status: CompatibilityStatus = issues.some((issue) => issue.severity === "blocker")
    ? "incompatible"
    : issues.some((issue) => issue.code === "OPTIONAL_CAPABILITY_MISSING")
      ? "degraded"
      : "compatible";

  return {
    status,
    issues,
    requiredCapabilities: [...clientSupport.requiredCapabilities],
    optionalCapabilities: [...clientSupport.optionalCapabilities],
  };
}

export function assertServiceCompatible(
  serviceInfo: ServiceInfo,
  clientSupport: ClientSupport = DEFAULT_CLIENT_SUPPORT,
): ClientCompatibility {
  const compatibility = evaluateServiceCompatibility(serviceInfo, clientSupport);
  if (compatibility.status === "incompatible") {
    const blockers = compatibility.issues
      .filter((issue) => issue.severity === "blocker")
      .map((issue) => issue.message)
      .join(" ");
    throw new Error(`MCAgent service is incompatible. ${blockers}`);
  }
  return compatibility;
}

export function summarizeServiceCapabilities(serviceInfo: ServiceInfo): string {
  const enabled = Object.entries(serviceInfo.capabilities)
    .filter(([, value]) => value)
    .map(([name]) => name);
  const resolver = serviceInfo.capabilities.liveResourceResolver ? "live resolver available" : "offline resolver only";
  return `${serviceInfo.service.name} ${serviceInfo.service.version} exposes ${enabled.join(", ") || "no capabilities"}; ${resolver}; plannerOnly=${serviceInfo.safety.plannerOnly}.`;
}

export function listUnsupportedCapabilities(serviceInfo: ServiceInfo): ServiceCapabilityName[] {
  return (Object.entries(serviceInfo.capabilities) as Array<[ServiceCapabilityName, boolean]>)
    .filter(([, enabled]) => !enabled)
    .map(([capability]) => capability);
}
