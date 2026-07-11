export const DESKTOP_BUILD_CHANNEL = "Native Packaging Preview" as const;
export const DESKTOP_SIGNING_STATUS = "unsigned-preview" as const;

export interface BuildInfo {
  appName: "MCagentlauncher";
  appVersion: string;
  buildChannel: typeof DESKTOP_BUILD_CHANNEL;
  packaged: boolean;
  tauriAvailable: boolean;
  configuredEndpoint: string;
  endpointProtocol: "http:" | "https:";
  endpointHost: string;
  serverBundled: false;
  executorEnabled: false;
  updaterEnabled: false;
  signingStatus: typeof DESKTOP_SIGNING_STATUS;
}

export interface BuildInfoInput {
  appVersion: string;
  configuredEndpoint: string;
  tauriAvailable: boolean;
}

export function validateConfiguredEndpoint(value: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("MCAgent endpoint must be a valid absolute URL.");
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("MCAgent endpoint must use HTTP or HTTPS.");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("MCAgent endpoint must not contain credentials.");
  }
  return endpoint;
}

export function createBuildInfo(input: BuildInfoInput): BuildInfo {
  const endpoint = validateConfiguredEndpoint(input.configuredEndpoint);
  return {
    appName: "MCagentlauncher",
    appVersion: input.appVersion,
    buildChannel: DESKTOP_BUILD_CHANNEL,
    packaged: input.tauriAvailable,
    tauriAvailable: input.tauriAvailable,
    configuredEndpoint: endpoint.href.replace(/\/$/, ""),
    endpointProtocol: endpoint.protocol as "http:" | "https:",
    endpointHost: endpoint.host,
    serverBundled: false,
    executorEnabled: false,
    updaterEnabled: false,
    signingStatus: DESKTOP_SIGNING_STATUS,
  };
}
