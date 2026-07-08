import test from "node:test";
import assert from "node:assert/strict";

import { RESOURCE_TYPES, SIDE_SUPPORT, VERSION_TYPES } from "./resource.ts";
import type { ResourceCandidate } from "./resource.ts";
import { mapResourceCandidateToPlanResource } from "./resource-plan.ts";

test("resource constants expose v0.1 supported values", () => {
  assert.deepEqual(RESOURCE_TYPES, ["mod", "resourcepack", "shaderpack"]);
  assert.deepEqual(VERSION_TYPES, ["release", "beta", "alpha"]);
  assert.ok(SIDE_SUPPORT.includes("unknown"));
});

test("ResourceCandidate maps to resource-plan resources shape", () => {
  const candidate = candidateFixture();

  const planResource = mapResourceCandidateToPlanResource(candidate, {
    required: false,
    reason: "Selected by resolver for performance goals.",
  });

  assert.equal(planResource.source, "modrinth");
  assert.equal(planResource.project.projectId, "AANobbMI");
  assert.equal(planResource.version.versionId, "version-sodium-1");
  assert.equal(planResource.project.name, "Sodium");
  assert.equal(planResource.type, "mod");
  assert.equal(planResource.compatibility.side, "client");
  assert.equal(planResource.verification.metadataChecked, true);
  assert.equal(planResource.verification.hashKnown, true);
  assert.deepEqual(planResource.hashes, {
    sha1: "1111111111111111111111111111111111111111",
    sha512: "a".repeat(128),
  });
});

test("required dependency candidates map with required=true", () => {
  const dependency = candidateFixture({
    projectId: "P7dR8mSH",
    versionId: "fabric-api-version",
    slug: "fabric-api",
    title: "Fabric API",
    clientSide: "required",
    serverSide: "required",
  });

  const planResource = mapResourceCandidateToPlanResource(dependency, {
    required: true,
    reason: "Required dependency declared by Modrinth metadata.",
  });

  assert.equal(planResource.required, true);
  assert.equal(planResource.compatibility.side, "both");
});

test("mapped resources do not expose download or installation fields", () => {
  const planResource = mapResourceCandidateToPlanResource(candidateFixture(), {
    required: true,
    reason: "Selected by resolver.",
  });
  const serialized = JSON.stringify(planResource).toLowerCase();

  assert.equal(serialized.includes("downloadurl"), false);
  assert.equal(serialized.includes("install"), false);
  assert.equal(serialized.includes("mods/"), false);
  assert.equal(serialized.includes("resourcepacks/"), false);
  assert.equal(serialized.includes("shaderpacks/"), false);
});

function candidateFixture(overrides: Partial<ResourceCandidate> = {}): ResourceCandidate {
  return {
    source: "modrinth",
    projectId: "AANobbMI",
    versionId: "version-sodium-1",
    slug: "sodium",
    title: "Sodium",
    description: "Rendering optimization mod.",
    resourceType: "mod",
    loaders: ["fabric"],
    gameVersions: ["1.20.1"],
    versionType: "release",
    files: [
      {
        filename: "sodium.jar",
        size: 100,
        primary: true,
        hashes: {
          sha1: "1111111111111111111111111111111111111111",
          sha512: "a".repeat(128),
        },
        downloadUrl: "https://cdn.modrinth.com/data/sodium.jar",
      },
    ],
    dependencies: [],
    hashes: {
      sha1: "1111111111111111111111111111111111111111",
      sha512: "a".repeat(128),
    },
    downloadUrl: "https://cdn.modrinth.com/data/sodium.jar",
    clientSide: "required",
    serverSide: "unsupported",
    metadataChecked: true,
    warnings: [],
    ...overrides,
  };
}
