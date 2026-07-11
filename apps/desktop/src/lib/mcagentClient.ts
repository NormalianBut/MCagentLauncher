import type { JsonValue, PlanOptions } from "./types";
import {
  checkServiceCompatibility,
  ServiceCompatibilityError,
  ServiceConnectionError,
} from "../../../../packages/api-client/src/serviceInfo";
import type { ServiceCompatibilityResult } from "../../../../packages/api-client/src/serviceInfo";
import { validateConfiguredEndpoint } from "../../../../packages/shared-types/src/buildInfo";

export { ServiceCompatibilityError, ServiceConnectionError };

export function mcagentBaseUrl(): string {
  const configured = import.meta.env.VITE_MCAGENT_API_URL ?? "http://127.0.0.1:8000";
  return validateConfiguredEndpoint(configured).href.replace(/\/$/, "");
}

export function checkMcagentConnection(): Promise<ServiceCompatibilityResult> {
  return checkServiceCompatibility({ baseUrl: mcagentBaseUrl() });
}

export async function parseIntent(text: string): Promise<JsonValue> {
  return requestJson("/v1/intent/parse", { text });
}

export async function generatePlan(intent: JsonValue, options: PlanOptions = {}): Promise<JsonValue> {
  return requestJson("/v1/resources/plan", {
    intent,
    options: {
      mode: options.mode ?? "pipeline",
      enableNetwork: options.enableNetwork ?? false,
    },
  });
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
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new ServiceConnectionError(
      "CORS_REJECTED_OR_NETWORK_BLOCKED",
      "MCAgent request could not reach the configured endpoint. Check the connection status and confirm the server is running.",
      { cause },
    );
  }
  const text = await response.text();
  let payload: JsonValue | string = text;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as JsonValue;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}`);
  }

  return payload as JsonValue;
}
