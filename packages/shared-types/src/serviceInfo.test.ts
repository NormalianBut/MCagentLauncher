import assert from "node:assert/strict";
import test from "node:test";

import {
  assertServiceCompatible,
  DEFAULT_CLIENT_SUPPORT,
  evaluateServiceCompatibility,
  listUnsupportedCapabilities,
  summarizeServiceCapabilities,
  type ServiceInfo,
} from "./serviceInfo.ts";

test("normal v0.1 planner service is compatible with an offline limitation", () => {
  const result = evaluateServiceCompatibility(serviceFixture());

  assert.equal(result.status, "compatible");
  assert.ok(result.issues.some((issue) => issue.code === "OFFLINE_RESOLVER_LIMITATION"));
});

test("API version mismatch is incompatible", () => {
  const result = evaluateServiceCompatibility(serviceFixture({ apiVersion: "v2" }));
  assert.equal(result.status, "incompatible");
  assert.ok(result.issues.some((issue) => issue.code === "API_VERSION_INCOMPATIBLE"));
});

test("service-info schema version mismatch is incompatible", () => {
  const result = evaluateServiceCompatibility(serviceFixture({ schemaVersion: "0.2.0" }));
  assert.equal(result.status, "incompatible");
  assert.ok(result.issues.some((issue) => issue.code === "SCHEMA_VERSION_INCOMPATIBLE"));
});

test("supported schema version mismatch is incompatible", () => {
  const result = evaluateServiceCompatibility(serviceFixture({ supportedSchemaVersions: ["0.2.0"] }));
  assert.equal(result.status, "incompatible");
});

test("missing resourcePlan is incompatible", () => {
  const info = serviceFixture();
  info.capabilities.resourcePlan = false;
  const result = evaluateServiceCompatibility(info);
  assert.equal(result.status, "incompatible");
  assert.equal(result.issues.find((issue) => issue.capability === "resourcePlan")?.code, "REQUIRED_CAPABILITY_MISSING");
});

test("missing planExplanation is incompatible under the explicit required policy", () => {
  const info = serviceFixture();
  info.capabilities.planExplanation = false;
  assert.equal(evaluateServiceCompatibility(info).status, "incompatible");
});

test("missing requested optional capability is degraded", () => {
  const result = evaluateServiceCompatibility(serviceFixture(), {
    ...DEFAULT_CLIENT_SUPPORT,
    optionalCapabilities: ["liveResourceResolver"],
  });
  assert.equal(result.status, "degraded");
});

for (const capability of ["installExecution", "localFileAccess", "minecraftLaunch"] as const) {
  test(`${capability}=true is rejected as unsafe`, () => {
    const info = serviceFixture();
    info.capabilities[capability] = true;
    const result = evaluateServiceCompatibility(info);
    assert.equal(result.status, "incompatible");
    assert.equal(result.issues.find((issue) => issue.capability === capability)?.code, "UNSAFE_CAPABILITY_DECLARED");
    assert.throws(() => assertServiceCompatible(info), /incompatible/);
  });
}

test("capability summary and unsupported list are readable", () => {
  const info = serviceFixture();
  assert.match(summarizeServiceCapabilities(info), /offline resolver only/);
  assert.ok(listUnsupportedCapabilities(info).includes("installExecution"));
});

function serviceFixture(overrides: {
  apiVersion?: string;
  schemaVersion?: string;
  supportedSchemaVersions?: string[];
} = {}): ServiceInfo {
  return {
    schemaVersion: overrides.schemaVersion ?? "0.1.0",
    service: { name: "mcagent-server", version: "0.1.0", environment: "development" },
    api: {
      version: overrides.apiVersion ?? "v1",
      supportedSchemaVersions: overrides.supportedSchemaVersions ?? ["0.1.0"],
    },
    mode: { planning: "offline", networkEnabledByDefault: false },
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
