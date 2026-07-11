import assert from "node:assert/strict";
import test from "node:test";

import {
  getProviderCapability,
  PROVIDER_CAPABILITIES,
  resourceCandidateIdentity,
  type ResourceResolutionRequest,
} from "./resolverContract.ts";

test("provider registry defines initial providers and future CurseForge without enabling integrations", () => {
  assert.deepEqual(
    PROVIDER_CAPABILITIES.map((capability) => [capability.provider, capability.stage]),
    [
      ["modrinth", "initial"],
      ["github-releases", "initial"],
      ["mcmod", "initial"],
      ["curseforge", "future"],
    ],
  );
  assert.equal(getProviderCapability("curseforge")?.implementationStatus, "future");
  assert.deepEqual(getProviderCapability("curseforge")?.operations, []);
});

test("all provider capabilities preserve metadata-only security boundaries", () => {
  for (const capability of PROVIDER_CAPABILITIES) {
    assert.equal(capability.metadataOnly, true);
    assert.equal(capability.canDownload, false);
    assert.equal(capability.canUpload, false);
    assert.equal(capability.canAccessFilesystem, false);
    assert.equal(capability.canExecute, false);
    assert.equal(capability.emitsTelemetry, false);
  }
});

test("resolution request requires explicit network policy and deterministic provider order", () => {
  const request: ResourceResolutionRequest = {
    schemaVersion: "0.1.0",
    requirements: [],
    allowedProviders: ["modrinth", "github-releases", "mcmod"],
    riskPreference: "stable",
    networkPolicy: "offline",
  };

  assert.equal(request.networkPolicy, "offline");
  assert.deepEqual(request.allowedProviders, ["modrinth", "github-releases", "mcmod"]);
});

test("candidate identity is stable across normalized providers", () => {
  const candidate = {
    source: "github-releases",
    projectId: "owner/repository",
    versionId: "v1.0.0",
  } as const;

  assert.equal(resourceCandidateIdentity(candidate), "github-releases:owner/repository:v1.0.0");
});
