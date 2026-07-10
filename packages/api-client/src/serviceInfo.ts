import {
  DEFAULT_CLIENT_SUPPORT,
  evaluateServiceCompatibility,
  type ClientCompatibility,
  type ClientSupport,
  type CompatibilityIssueCode,
  type ServiceInfo,
} from "../../shared-types/src/serviceInfo.ts";

export type ServiceConnectionErrorCode =
  | "SERVER_UNREACHABLE"
  | "CORS_REJECTED_OR_NETWORK_BLOCKED"
  | "HTTP_ERROR"
  | "INVALID_SERVICE_INFO";

export type ServiceCompatibilityErrorCode = Extract<
  CompatibilityIssueCode,
  | "API_VERSION_INCOMPATIBLE"
  | "SCHEMA_VERSION_INCOMPATIBLE"
  | "REQUIRED_CAPABILITY_MISSING"
  | "UNSAFE_CAPABILITY_DECLARED"
>;

export interface ServiceInfoRequestOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export interface ServiceCompatibilityOptions extends ServiceInfoRequestOptions {
  clientSupport?: ClientSupport;
}

export interface ServiceCompatibilityResult {
  serviceInfo: ServiceInfo;
  compatibility: ClientCompatibility;
}

export class ServiceConnectionError extends Error {
  readonly code: ServiceConnectionErrorCode;
  readonly status?: number;

  constructor(code: ServiceConnectionErrorCode, message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "ServiceConnectionError";
    this.code = code;
    this.status = options.status;
  }
}

export class ServiceCompatibilityError extends Error {
  readonly code: ServiceCompatibilityErrorCode;
  readonly serviceInfo: ServiceInfo;
  readonly compatibility: ClientCompatibility;

  constructor(code: ServiceCompatibilityErrorCode, message: string, result: ServiceCompatibilityResult) {
    super(message);
    this.name = "ServiceCompatibilityError";
    this.code = code;
    this.serviceInfo = result.serviceInfo;
    this.compatibility = result.compatibility;
  }
}

export async function getServiceInfo(options: ServiceInfoRequestOptions): Promise<ServiceInfo> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  let response: Response;

  try {
    response = await fetchImpl(`${baseUrl}/v1/meta`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: options.signal,
    });
  } catch (cause) {
    const unreachable = hasConnectionRefusedCode(cause);
    throw new ServiceConnectionError(
      unreachable ? "SERVER_UNREACHABLE" : "CORS_REJECTED_OR_NETWORK_BLOCKED",
      unreachable
        ? "MCAgent Server is unreachable. Check that the configured endpoint is running."
        : "MCAgent metadata request was blocked or could not reach the endpoint. Check the server, network, and CORS configuration.",
      { cause },
    );
  }

  if (!response.ok) {
    throw new ServiceConnectionError(
      "HTTP_ERROR",
      `MCAgent metadata request failed with HTTP ${response.status}.`,
      { status: response.status },
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new ServiceConnectionError(
      "INVALID_SERVICE_INFO",
      "MCAgent metadata response was not valid JSON.",
      { cause },
    );
  }

  try {
    return parseServiceInfo(payload);
  } catch (cause) {
    throw new ServiceConnectionError(
      "INVALID_SERVICE_INFO",
      cause instanceof Error ? cause.message : "MCAgent metadata response has an invalid structure.",
      { cause },
    );
  }
}

export async function checkServiceCompatibility(
  options: ServiceCompatibilityOptions,
): Promise<ServiceCompatibilityResult> {
  const serviceInfo = await getServiceInfo(options);
  const compatibility = evaluateServiceCompatibility(
    serviceInfo,
    options.clientSupport ?? DEFAULT_CLIENT_SUPPORT,
  );
  const result = { serviceInfo, compatibility };

  if (compatibility.status === "incompatible") {
    const blocker = compatibility.issues.find((issue) => issue.severity === "blocker");
    const code = blocker?.code;
    if (
      code === "API_VERSION_INCOMPATIBLE"
      || code === "SCHEMA_VERSION_INCOMPATIBLE"
      || code === "REQUIRED_CAPABILITY_MISSING"
      || code === "UNSAFE_CAPABILITY_DECLARED"
    ) {
      throw new ServiceCompatibilityError(
        code,
        blocker?.message ?? "MCAgent endpoint is incompatible with this client.",
        result,
      );
    }
    throw new ServiceCompatibilityError(
      "REQUIRED_CAPABILITY_MISSING",
      "MCAgent endpoint is incompatible with this client.",
      result,
    );
  }

  return result;
}

function parseServiceInfo(value: unknown): ServiceInfo {
  const root = requireRecord(value, "service-info");
  requireExactKeys(root, ["schemaVersion", "service", "api", "mode", "capabilities", "safety"], "service-info");
  const service = requireRecord(root.service, "service");
  const api = requireRecord(root.api, "api");
  const mode = requireRecord(root.mode, "mode");
  const capabilities = requireRecord(root.capabilities, "capabilities");
  const safety = requireRecord(root.safety, "safety");

  requireExactKeys(service, ["name", "version", "environment"], "service");
  requireExactKeys(api, ["version", "supportedSchemaVersions"], "api");
  requireExactKeys(mode, ["planning", "networkEnabledByDefault"], "mode");
  requireExactKeys(capabilities, [
    "intentParse", "resourcePlan", "planExplanation", "liveResourceResolver",
    "installExecution", "localFileAccess", "environmentProbe", "minecraftLaunch",
  ], "capabilities");
  requireExactKeys(safety, ["plannerOnly", "canDownload", "canWriteLocalFiles", "canLaunchProcesses"], "safety");

  requireString(root.schemaVersion, "schemaVersion");
  requireString(service.name, "service.name");
  requireString(service.version, "service.version");
  requireEnum(service.environment, ["development", "test", "production", "self-hosted"], "service.environment");
  requireString(api.version, "api.version");
  if (!Array.isArray(api.supportedSchemaVersions) || api.supportedSchemaVersions.length === 0) {
    throw new Error("MCAgent metadata api.supportedSchemaVersions must be a non-empty array.");
  }
  api.supportedSchemaVersions.forEach((version) => requireString(version, "api.supportedSchemaVersions"));
  requireEnum(mode.planning, ["offline", "live", "hybrid"], "mode.planning");
  requireBoolean(mode.networkEnabledByDefault, "mode.networkEnabledByDefault");
  Object.entries(capabilities).forEach(([key, item]) => requireBoolean(item, `capabilities.${key}`));
  Object.entries(safety).forEach(([key, item]) => requireBoolean(item, `safety.${key}`));

  return root as unknown as ServiceInfo;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`MCAgent metadata ${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(value: Record<string, unknown>, keys: string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`MCAgent metadata ${path} has missing or additional properties.`);
  }
}

function requireString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`MCAgent metadata ${path} must be a non-empty string.`);
  }
}

function requireBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`MCAgent metadata ${path} must be a boolean.`);
  }
}

function requireEnum<T extends string>(value: unknown, options: T[], path: string): asserts value is T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    throw new Error(`MCAgent metadata ${path} is not supported.`);
  }
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new ServiceConnectionError("INVALID_SERVICE_INFO", "MCAgent endpoint URL is empty.");
  }
  return normalized;
}

function hasConnectionRefusedCode(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const value = error as { code?: unknown; cause?: unknown };
  return value.code === "ECONNREFUSED" || hasConnectionRefusedCode(value.cause);
}
