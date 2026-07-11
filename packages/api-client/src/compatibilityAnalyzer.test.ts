import assert from "node:assert/strict";
import test from "node:test";

import type { CompatibilityRule, CompatibilityTarget } from "../../shared-types/src/compatibility.ts";
import { buildResourcePlan } from "../../shared-types/src/plan.ts";
import type { ResourceCandidate } from "../../shared-types/src/resource.ts";
import type { ResourceResolutionRequest, ResourceResolver } from "../../shared-types/src/resolverContract.ts";
import { analyzeCompatibility, analyzeResourceCompatibility } from "./compatibilityAnalyzer.ts";
import { applyCompatibilityToResourcePlan } from "./compatibilityPlanning.ts";
import { createDefaultResourceResolver } from "./providerRegistry.ts";
import { resolveAndAnalyzeMetadata } from "./resolveAndAnalyzeMetadata.ts";

const target: CompatibilityTarget = {
  minecraftVersion: "1.20.1",
  loader: "fabric",
  side: "client",
};

test("fully compatible candidate passes all resource checks", () => {
  const result = analyzeResourceCompatibility(candidate(), target);
  assert.equal(result.status, "compatible");
  assert.equal(result.blocking, false);
  assert.deepEqual(result.checks, {
    minecraftVersion: "pass",
    loader: "pass",
    side: "pass",
    dependencies: "pass",
    conflicts: "pass",
    metadata: "pass",
  });
});

test("Minecraft version mismatch is a blocker with exact matching only", () => {
  const result = analyzeCompatibility([candidate({ gameVersions: ["1.20"] })], target);
  assertIssue(result, "MINECRAFT_VERSION_MISMATCH", "blocker");
  assert.equal(result.status, "incompatible");
});

test("loader mismatch does not equate Fabric with another loader", () => {
  const result = analyzeCompatibility([candidate({ loaders: ["quilt"] })], target);
  assertIssue(result, "LOADER_MISMATCH", "blocker");
});

test("client-only resource is blocked for a server target", () => {
  const result = analyzeCompatibility(
    [candidate({ clientSide: "required", serverSide: "unsupported" })],
    { ...target, side: "server" },
  );
  assertIssue(result, "SIDE_MISMATCH", "blocker");
});

test("missing required dependency is a blocker", () => {
  const result = analyzeCompatibility([candidate({
    dependencies: [{ projectId: "fabric-api", versionId: null, dependencyType: "required" }],
  })], target);
  assertIssue(result, "REQUIRED_DEPENDENCY_MISSING", "blocker");
});

test("required dependency without project or version identity is unresolved", () => {
  const result = analyzeCompatibility([candidate({
    dependencies: [{ projectId: null, versionId: null, dependencyType: "required" }],
  })], target);
  assertIssue(result, "REQUIRED_DEPENDENCY_UNRESOLVED", "blocker");
});

test("optional missing dependency does not block or warn", () => {
  const result = analyzeCompatibility([candidate({
    dependencies: [{ projectId: "optional-helper", versionId: null, dependencyType: "optional" }],
  })], target);
  assert.equal(result.status, "compatible");
  assert.equal(result.issues.some((issue) => issue.code.includes("DEPENDENCY")), false);
});

test("dependency version that cannot be verified remains unknown", () => {
  const dependent = candidate({
    dependencies: [{ projectId: "fabric-api", versionId: "required-version", dependencyType: "required" }],
  });
  const dependency = candidate({
    projectId: "fabric-api",
    slug: "fabric-api",
    versionId: "different-version",
    title: "Fabric API",
  });
  const result = analyzeCompatibility([dependent, dependency], target);
  assertIssue(result, "DEPENDENCY_VERSION_UNKNOWN", "warning");
  assert.equal(result.status, "unknown");
});

test("required dependency can match a normalized candidate slug", () => {
  const dependent = candidate({
    dependencies: [{ projectId: "fabric-api", versionId: null, dependencyType: "required" }],
  });
  const dependency = candidate({
    projectId: "provider-specific-fabric-api-id",
    slug: "fabric-api",
    versionId: "fabric-api-v1",
    title: "Fabric API",
  });
  const result = analyzeCompatibility([dependent, dependency], target);
  assert.equal(result.issues.some((issue) => issue.code === "REQUIRED_DEPENDENCY_MISSING"), false);
});

test("provider-normalized incompatible dependency creates an explicit blocker", () => {
  const first = candidate({
    projectId: "project-a",
    slug: "project-a",
    versionId: "a-v1",
    dependencies: [{ projectId: "project-b", versionId: null, dependencyType: "incompatible" }],
  });
  const second = candidate({ projectId: "project-b", slug: "project-b", versionId: "b-v1" });
  const result = analyzeCompatibility([first, second], target);
  const conflict = result.issues.find((issue) => issue.code === "EXPLICIT_CONFLICT");
  assert.equal(conflict?.severity, "blocker");
  assert.equal(conflict?.details?.source, "provider-metadata");
});

test("required dependency cycle is reported once without recursion failure", () => {
  const first = candidate({
    projectId: "project-a",
    slug: "project-a",
    versionId: "a-v1",
    dependencies: [{ projectId: "project-b", versionId: null, dependencyType: "required" }],
  });
  const second = candidate({
    projectId: "project-b",
    slug: "project-b",
    versionId: "b-v1",
    dependencies: [{ projectId: "project-a", versionId: null, dependencyType: "required" }],
  });
  const result = analyzeCompatibility([first, second], target);
  assert.equal(result.issues.filter((issue) => issue.code === "DEPENDENCY_CYCLE").length, 1);
});

test("explicit conflict rule emits one sourced conflict", () => {
  const first = candidate({ projectId: "project-a", slug: "project-a", versionId: "a-v1" });
  const second = candidate({ projectId: "project-b", slug: "project-b", versionId: "b-v1" });
  const rule: CompatibilityRule = {
    ruleId: "fixture-a-b-conflict",
    type: "conflict",
    resourceSelectors: [{ projectId: "project-a" }, { projectId: "project-b" }],
    targetConstraints: { loaders: ["fabric"], minecraftVersions: ["1.20.1"] },
    severity: "blocker",
    message: "Fixture resources conflict.",
    source: "version-controlled-test-fixture",
    enabled: true,
  };
  const result = analyzeCompatibility([second, first], target, { rules: [rule] });
  const conflict = result.issues.find((issue) => issue.code === "EXPLICIT_CONFLICT");
  assert.equal(conflict?.ruleId, "fixture-a-b-conflict");
  assert.equal(conflict?.details?.source, "version-controlled-test-fixture");
  assert.equal(result.issues.filter((issue) => issue.code === "EXPLICIT_CONFLICT").length, 1);
});

test("same project with distinct versions reports duplicate project", () => {
  const result = analyzeCompatibility([
    candidate({ versionId: "version-a" }),
    candidate({ versionId: "version-b" }),
  ], target);
  assertIssue(result, "DUPLICATE_PROJECT", "warning");
});

test("same stable candidate identity reports duplicate candidate", () => {
  const fixture = candidate();
  const result = analyzeCompatibility([fixture, { ...fixture }], target);
  assertIssue(result, "DUPLICATE_CANDIDATE", "warning");
  assert.equal(result.analyzedResourceCount, 2);
});

test("unchecked metadata is unknown rather than compatible", () => {
  const result = analyzeCompatibility([candidate({ metadataChecked: false })], target);
  assertIssue(result, "METADATA_UNCHECKED", "warning");
  assert.equal(result.status, "unknown");
});

test("unknown side metadata stays unknown and does not silently pass", () => {
  const result = analyzeCompatibility([candidate({ clientSide: "unknown" })], target);
  assert.equal(result.resourceResults[0].checks.side, "unknown");
  assert.equal(result.status, "unknown");
});

test("missing compatibility metadata is preserved as unknown", () => {
  const result = analyzeCompatibility([candidate({ gameVersions: [], loaders: [], files: [], hashes: {} })], target);
  assertIssue(result, "METADATA_INCOMPLETE", "warning");
  assertIssue(result, "COMPATIBILITY_UNKNOWN", "warning");
  assert.equal(result.status, "unknown");
});

test("analysis ordering is stable and input arrays are not modified", () => {
  const first = candidate({ projectId: "z-project", slug: "z-project", versionId: "z-version", loaders: ["quilt"] });
  const second = candidate({ projectId: "a-project", slug: "a-project", versionId: "a-version", gameVersions: ["1.21"] });
  const input = [first, second];
  const snapshot = [...input];
  const forward = analyzeCompatibility(input, target);
  const reverse = analyzeCompatibility([...input].reverse(), target);
  assert.deepEqual(forward, reverse);
  assert.deepEqual(input, snapshot);
  assert.equal(input[0], first);
});

test("pure analyzer never calls fetch", () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (() => {
    called = true;
    throw new Error("compatibility analyzer must not fetch");
  }) as typeof fetch;
  try {
    analyzeCompatibility([candidate()], target);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("offline resolver composition performs zero fetch and keeps M14 API usable", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  const fetch = (() => {
    called = true;
    throw new Error("offline resolver must not fetch");
  }) as typeof globalThis.fetch;
  const resolver = createDefaultResourceResolver({ modrinth: { fetch } });
  try {
    const result = await resolveAndAnalyzeMetadata(resolver, resolutionRequest("offline"), target);
    assert.equal(called, false);
    assert.equal(result.resolution.diagnostics.networkUsed, false);
    assert.equal(result.compatibility.analyzedResourceCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider resolution result can be analyzed through the composition entry", async () => {
  const fixture = candidate();
  const resolver: ResourceResolver = {
    async resolve() {
      return {
        schemaVersion: "0.1.0",
        matches: [{ requirementId: "req-sodium", candidate: fixture, confidence: 1, compatibility: "compatible" }],
        diagnostics: {
          providersConsulted: ["modrinth"],
          issues: [],
          networkUsed: false,
          downloadPerformed: false,
          uploadPerformed: false,
          filesystemAccessed: false,
          executionPerformed: false,
          telemetryEmitted: false,
        },
      };
    },
  };
  const result = await resolveAndAnalyzeMetadata(resolver, resolutionRequest("offline"), target);
  assert.equal(result.resolution.matches.length, 1);
  assert.equal(result.compatibility.status, "compatible");
});

test("mocked M14 Modrinth provider output flows through compatibility analysis", async () => {
  const calls: string[] = [];
  const fetch = (async (input: URL | RequestInfo) => {
    const url = input instanceof URL ? input.toString() : String(input);
    calls.push(url);
    const body = url.includes("/version?")
      ? [{
          id: "sodium-v1",
          project_id: "sodium",
          name: "Sodium fixture",
          version_number: "1.0.0",
          version_type: "release",
          loaders: ["fabric"],
          game_versions: ["1.20.1"],
          files: [{
            filename: "sodium.jar",
            size: 100,
            primary: true,
            url: "https://cdn.modrinth.com/metadata-only/sodium.jar",
            hashes: { sha1: "1".repeat(40) },
          }],
          dependencies: [],
        }]
      : {
          project_id: "sodium",
          slug: "sodium",
          title: "Sodium",
          description: "Fixture.",
          project_type: "mod",
          client_side: "required",
          server_side: "unsupported",
        };
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => body,
    } as Response;
  }) as typeof globalThis.fetch;
  const resolver = createDefaultResourceResolver({ modrinth: { fetch, baseUrl: "https://unit.test/v2" } });

  const result = await resolveAndAnalyzeMetadata(resolver, resolutionRequest("metadata-only"), target);

  assert.equal(result.resolution.matches.length, 1);
  assert.equal(result.compatibility.status, "compatible");
  assert.equal(result.compatibility.resourceResults[0].projectId, "sodium");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((url) => url.startsWith("https://unit.test/v2/")));
  assert.ok(calls.every((url) => !url.includes("cdn.modrinth.com")));
});

test("compatibility blocker enters plan errors and elevates risk", () => {
  const fixture = candidate({ loaders: ["quilt"] });
  const compatibility = analyzeCompatibility([fixture], target);
  const original = plan([fixture]);
  const integrated = applyCompatibilityToResourcePlan(original, compatibility);
  assert.equal(integrated.summary.riskLevel, "high");
  assert.equal(integrated.status, "rejected");
  assert.ok(integrated.ruleResults.errors.some((error) => error.code === "COMPATIBILITY_LOADER_MISMATCH"));
  assert.equal(original.ruleResults.errors.length, 0);
});

test("compatibility warning remains visible and raises low risk to medium", () => {
  const first = candidate({ versionId: "version-a" });
  const second = candidate({ versionId: "version-b" });
  const compatibility = analyzeCompatibility([first, second], target);
  const integrated = applyCompatibilityToResourcePlan(plan([first]), compatibility);
  assert.equal(integrated.summary.riskLevel, "medium");
  assert.ok(integrated.ruleResults.warnings.some((warning) => warning.code === "COMPATIBILITY_DUPLICATE_PROJECT"));
});

test("warning rule produces compatible-with-warnings rather than silent success", () => {
  const fixture = candidate();
  const rule: CompatibilityRule = {
    ruleId: "fixture-loader-warning",
    type: "excludes_loader",
    resourceSelectors: [{ projectId: "sodium" }],
    targetConstraints: { loaders: ["fabric"] },
    severity: "warning",
    message: "Fixture loader warning.",
    source: "version-controlled-test-fixture",
    enabled: true,
  };
  const result = analyzeCompatibility([fixture], target, { rules: [rule] });
  assert.equal(result.status, "compatible_with_warnings");
  assertIssue(result, "LOADER_MISMATCH", "warning");
});

test("resource names alone never invent an OptiFine and Sodium conflict", () => {
  const optifine = candidate({ projectId: "optifine", slug: "optifine", versionId: "optifine-v1", title: "OptiFine" });
  const sodium = candidate({ projectId: "sodium", slug: "sodium", versionId: "sodium-v1", title: "Sodium" });
  const result = analyzeCompatibility([optifine, sodium], target);
  assert.equal(result.issues.some((issue) => issue.code === "EXPLICIT_CONFLICT"), false);
});

function candidate(overrides: Partial<ResourceCandidate> = {}): ResourceCandidate {
  return {
    source: "modrinth",
    projectId: "sodium",
    versionId: "sodium-v1",
    slug: "sodium",
    title: "Sodium",
    description: "Fixture resource.",
    resourceType: "mod",
    loaders: ["fabric"],
    gameVersions: ["1.20.1"],
    versionType: "release",
    files: [{
      filename: "resource.jar",
      size: 100,
      primary: true,
      hashes: { sha1: "1".repeat(40) },
      downloadUrl: "https://metadata.invalid/resource.jar",
    }],
    dependencies: [],
    hashes: { sha1: "1".repeat(40) },
    downloadUrl: "https://metadata.invalid/resource.jar",
    clientSide: "required",
    serverSide: "unsupported",
    metadataChecked: true,
    warnings: [],
    ...overrides,
  };
}

function assertIssue(
  result: ReturnType<typeof analyzeCompatibility>,
  code: ReturnType<typeof analyzeCompatibility>["issues"][number]["code"],
  severity: ReturnType<typeof analyzeCompatibility>["issues"][number]["severity"],
) {
  assert.ok(result.issues.some((issue) => issue.code === code && issue.severity === severity));
}

function resolutionRequest(networkPolicy: "offline" | "metadata-only"): ResourceResolutionRequest {
  return {
    schemaVersion: "0.1.0",
    requirements: [{
      requirementId: "req-sodium",
      canonicalName: "Sodium",
      resourceType: "mod",
      minecraftVersion: "1.20.1",
      loader: "fabric",
      required: true,
      tags: ["performance"],
      reason: "Fixture requirement.",
      providerHints: [{ provider: "modrinth", projectId: "sodium", slug: "sodium", query: "sodium" }],
    }],
    allowedProviders: ["modrinth"],
    riskPreference: "stable",
    networkPolicy,
  };
}

function plan(candidates: ResourceCandidate[]) {
  return buildResourcePlan({
    intentId: "intent-compatibility-test",
    minecraftVersion: "1.20.1",
    loader: "fabric",
    loaderVersion: "0.15.0",
    javaMajorVersion: 17,
    title: "Compatibility fixture plan",
    explanation: "Fixture.",
    estimatedMemoryMb: 4096,
  }, candidates);
}
