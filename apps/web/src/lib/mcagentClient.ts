import {
  checkServiceCompatibility,
  ServiceCompatibilityError,
  ServiceConnectionError,
} from "../../../../packages/api-client/src/serviceInfo";
import type { ServiceCompatibilityResult } from "../../../../packages/api-client/src/serviceInfo";

export { ServiceCompatibilityError, ServiceConnectionError };

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

export interface PlanOptions {
  mode?: "mock" | "pipeline";
  enableNetwork?: boolean;
}

const defaultBaseUrl = "http://127.0.0.1:8000";

export function mcagentBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_MCAGENT_API_URL ?? defaultBaseUrl).replace(/\/+$/, "");
}

export function checkMcagentConnection(): Promise<ServiceCompatibilityResult> {
  return checkServiceCompatibility({ baseUrl: mcagentBaseUrl() });
}

export async function parseIntent(text: string): Promise<JsonValue> {
  return requestJson("/v1/intent/parse", {
    text,
  });
}

export async function generatePlan(
  intent: JsonValue,
  options: PlanOptions = {},
): Promise<JsonValue> {
  const planOptions: JsonObject = {
    mode: options.mode ?? "pipeline",
    enableNetwork: options.enableNetwork ?? false,
  };

  const body: JsonObject = {
    intent,
    options: planOptions,
  };

  return requestJson("/v1/resources/plan", body);
}

export async function explainPlan(plan: JsonValue): Promise<JsonValue> {
  return requestJson("/v1/explain/plan", plan);
}

async function requestJson(path: string, body: JsonValue): Promise<JsonValue> {
  let response: Response;
  try {
    response = await fetch(`${mcagentBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new ServiceConnectionError(
      "CORS_REJECTED_OR_NETWORK_BLOCKED",
      "MCAgent request could not reach the configured endpoint. Check Service Status and confirm the server is running.",
      { cause },
    );
  }

  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${formatPayload(payload ?? text)}`);
  }

  if (payload === null) {
    throw new Error("MCAgent response was empty or not valid JSON.");
  }

  return payload;
}

function parseJson(text: string): JsonValue | null {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return null;
  }
}

function formatPayload(value: JsonValue | string): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}
