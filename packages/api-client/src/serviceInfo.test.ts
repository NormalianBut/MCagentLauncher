import assert from "node:assert/strict";
import test from "node:test";

import {
  checkServiceCompatibility,
  getServiceInfo,
  ServiceCompatibilityError,
  ServiceConnectionError,
} from "./serviceInfo.ts";

test("getServiceInfo returns strict service metadata", async () => {
  const info = await getServiceInfo({ baseUrl: "http://example.test/", fetchImpl: jsonFetch(serviceFixture()) });
  assert.equal(info.service.name, "mcagent-server");
  assert.equal(info.safety.plannerOnly, true);
});

test("server unreachable is classified without retrying", async () => {
  let calls = 0;
  const error = Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" });
  await assert.rejects(
    getServiceInfo({
      baseUrl: "http://127.0.0.1:8000",
      fetchImpl: async () => { calls += 1; throw error; },
    }),
    (caught: unknown) => caught instanceof ServiceConnectionError && caught.code === "SERVER_UNREACHABLE",
  );
  assert.equal(calls, 1);
});

test("ambiguous browser network failure is classified without claiming definite CORS", async () => {
  await assert.rejects(
    getServiceInfo({ baseUrl: "http://example.test", fetchImpl: async () => { throw new TypeError("Failed to fetch"); } }),
    (caught: unknown) => caught instanceof ServiceConnectionError
      && caught.code === "CORS_REJECTED_OR_NETWORK_BLOCKED"
      && caught.message.includes("blocked or could not reach"),
  );
});

test("invalid JSON is INVALID_SERVICE_INFO", async () => {
  await assert.rejects(
    getServiceInfo({ baseUrl: "http://example.test", fetchImpl: async () => new Response("not-json") }),
    (caught: unknown) => caught instanceof ServiceConnectionError && caught.code === "INVALID_SERVICE_INFO",
  );
});

test("additional metadata property is invalid", async () => {
  await assert.rejects(
    getServiceInfo({ baseUrl: "http://example.test", fetchImpl: jsonFetch({ ...serviceFixture(), token: "forbidden" }) }),
    (caught: unknown) => caught instanceof ServiceConnectionError && caught.code === "INVALID_SERVICE_INFO",
  );
});

test("HTTP 500 is HTTP_ERROR", async () => {
  await assert.rejects(
    getServiceInfo({ baseUrl: "http://example.test", fetchImpl: async () => new Response("error", { status: 500 }) }),
    (caught: unknown) => caught instanceof ServiceConnectionError && caught.code === "HTTP_ERROR" && caught.status === 500,
  );
});

test("API mismatch is a typed compatibility error", async () => {
  await assert.rejects(
    checkServiceCompatibility({ baseUrl: "http://example.test", fetchImpl: jsonFetch(serviceFixture({ apiVersion: "v2" })) }),
    (caught: unknown) => caught instanceof ServiceCompatibilityError && caught.code === "API_VERSION_INCOMPATIBLE",
  );
});

test("required capability missing is a typed compatibility error", async () => {
  const info = serviceFixture();
  info.capabilities.resourcePlan = false;
  await assert.rejects(
    checkServiceCompatibility({ baseUrl: "http://example.test", fetchImpl: jsonFetch(info) }),
    (caught: unknown) => caught instanceof ServiceCompatibilityError && caught.code === "REQUIRED_CAPABILITY_MISSING",
  );
});

test("unsafe server capability is rejected", async () => {
  const info = serviceFixture();
  info.capabilities.localFileAccess = true;
  await assert.rejects(
    checkServiceCompatibility({ baseUrl: "http://example.test", fetchImpl: jsonFetch(info) }),
    (caught: unknown) => caught instanceof ServiceCompatibilityError && caught.code === "UNSAFE_CAPABILITY_DECLARED",
  );
});

test("missing requested optional capability returns degraded", async () => {
  const result = await checkServiceCompatibility({
    baseUrl: "http://example.test",
    fetchImpl: jsonFetch(serviceFixture()),
    clientSupport: {
      apiVersions: ["v1"],
      schemaVersions: ["0.1.0"],
      requiredCapabilities: ["intentParse", "resourcePlan", "planExplanation"],
      optionalCapabilities: ["liveResourceResolver"],
    },
  });
  assert.equal(result.compatibility.status, "degraded");
});

function jsonFetch(value: unknown): typeof fetch {
  return async () => Response.json(value);
}

function serviceFixture(overrides: { apiVersion?: string } = {}) {
  return {
    schemaVersion: "0.1.0",
    service: { name: "mcagent-server", version: "0.1.0", environment: "development" as const },
    api: { version: overrides.apiVersion ?? "v1", supportedSchemaVersions: ["0.1.0"] },
    mode: { planning: "offline" as const, networkEnabledByDefault: false },
    capabilities: {
      intentParse: true,
      resourcePlan: true,
      planExplanation: true,
      liveResourceResolver: false,
      installExecution: false,
      localFileAccess: false,
      environmentProbe: false,
      minecraftLaunch: false,
    },
    safety: {
      plannerOnly: true,
      canDownload: false,
      canWriteLocalFiles: false,
      canLaunchProcesses: false,
    },
  };
}
