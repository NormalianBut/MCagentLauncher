import assert from "node:assert/strict";
import test from "node:test";

import type { ResourceRequirement } from "../../../shared-types/src/resolverContract.ts";
import { resourceCandidateIdentity } from "../../../shared-types/src/resolverContract.ts";
import { createDefaultResourceResolver } from "../providerRegistry.ts";
import { ModrinthMetadataProvider } from "./modrinthMetadataProvider.ts";

const project = {
  project_id: "AANobbMI",
  slug: "sodium",
  title: "Sodium",
  description: "Rendering optimization mod.",
  project_type: "mod",
  client_side: "required",
  server_side: "unsupported",
};

const releaseVersion = {
  id: "release-version",
  project_id: "AANobbMI",
  name: "Sodium 0.5.11",
  version_number: "0.5.11",
  version_type: "release",
  loaders: ["fabric"],
  game_versions: ["1.20.1"],
  files: [{
    filename: "sodium.jar",
    size: 100,
    primary: true,
    url: "https://cdn.modrinth.com/data/AANobbMI/versions/release-version/sodium.jar",
    hashes: { sha1: "1".repeat(40), sha512: "a".repeat(128) },
  }],
  dependencies: [{
    project_id: "fabric-api",
    version_id: "fabric-api-version",
    dependency_type: "required",
  }],
};

test("Modrinth provider normalizes valid metadata into resolver contracts", async () => {
  const fetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: project },
    { match: "/v2/project/AANobbMI/version?", body: [releaseVersion] },
  ]);
  const provider = new ModrinthMetadataProvider({ fetch, baseUrl: "https://unit.test/v2" });

  const result = await provider.resolve(providerRequest());

  assert.equal(result.provider, "modrinth");
  assert.equal(result.networkUsed, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].compatibility, "compatible");
  assert.equal(result.matches[0].candidate.title, "Sodium");
  assert.equal(result.matches[0].candidate.versionId, "release-version");
  assert.deepEqual(result.matches[0].candidate.loaders, ["fabric"]);
  assert.deepEqual(result.matches[0].candidate.gameVersions, ["1.20.1"]);
  assert.equal(result.matches[0].candidate.hashes.sha1, "1".repeat(40));
  assert.equal(resourceCandidateIdentity(result.matches[0].candidate), "modrinth:AANobbMI:release-version");
  assert.equal(fetch.calls.length, 2);
  assert.ok(fetch.calls.every((call) => call.url.startsWith("https://unit.test/v2/")));
  assert.ok(fetch.calls.every((call) => !call.url.includes("cdn.modrinth.com")));
});

test("offline policy returns diagnostics without making a metadata request", async () => {
  const fetch = mockFetch([]);
  const provider = new ModrinthMetadataProvider({ fetch, baseUrl: "https://unit.test/v2" });

  const result = await provider.resolve(providerRequest({ networkPolicy: "offline" }));

  assert.equal(result.networkUsed, false);
  assert.equal(result.matches.length, 0);
  assert.equal(result.issues[0].code, "PROVIDER_UNAVAILABLE");
  assert.equal(fetch.calls.length, 0);
});

test("missing project metadata becomes INVALID_METADATA diagnostic", async () => {
  const fetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: { ...project, slug: undefined } },
  ]);
  const provider = new ModrinthMetadataProvider({ fetch, baseUrl: "https://unit.test/v2" });

  const result = await provider.resolve(providerRequest());

  assert.equal(result.matches.length, 0);
  assert.equal(result.issues[0].code, "INVALID_METADATA");
  assert.equal(result.issues[0].requirementId, "req-sodium");
});

test("invalid versions are rejected with structured diagnostics", async () => {
  const fetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: project },
    {
      match: "/v2/project/AANobbMI/version?",
      body: [{ ...releaseVersion, version_type: "snapshot" }],
    },
  ]);
  const provider = new ModrinthMetadataProvider({ fetch, baseUrl: "https://unit.test/v2" });

  const result = await provider.resolve(providerRequest());

  assert.equal(result.matches.length, 0);
  assert.equal(result.issues[0].code, "INVALID_METADATA");
  assert.match(result.issues[0].message, /version type/i);
});

test("missing file and hash metadata keeps candidate but marks it incomplete", async () => {
  const fetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: project },
    { match: "/v2/project/AANobbMI/version?", body: [{ ...releaseVersion, files: [] }] },
  ]);
  const provider = new ModrinthMetadataProvider({ fetch, baseUrl: "https://unit.test/v2" });

  const result = await provider.resolve(providerRequest());

  assert.equal(result.matches[0].compatibility, "incomplete");
  assert.equal(result.issues[0].code, "METADATA_INCOMPLETE");
});

test("loader and Minecraft mismatches remain explicit provider errors", async () => {
  const wrongGameFetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: project },
    {
      match: "/v2/project/AANobbMI/version?",
      body: [{ ...releaseVersion, game_versions: ["1.21.1"] }],
    },
  ]);
  const wrongGame = await new ModrinthMetadataProvider({
    fetch: wrongGameFetch,
    baseUrl: "https://unit.test/v2",
  }).resolve(providerRequest());
  assert.equal(wrongGame.issues[0].code, "MINECRAFT_VERSION_MISMATCH");

  const wrongLoaderFetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: project },
    {
      match: "/v2/project/AANobbMI/version?",
      body: [{ ...releaseVersion, loaders: ["quilt"] }],
    },
  ]);
  const wrongLoader = await new ModrinthMetadataProvider({
    fetch: wrongLoaderFetch,
    baseUrl: "https://unit.test/v2",
  }).resolve(providerRequest());
  assert.equal(wrongLoader.issues[0].code, "LOADER_MISMATCH");
});

test("rate limits become provider diagnostics", async () => {
  const fetch = mockFetch([
    {
      match: "/v2/project/AANobbMI",
      status: 429,
      headers: { "retry-after": "60" },
      body: { error: "rate limited" },
    },
  ]);
  const provider = new ModrinthMetadataProvider({ fetch, baseUrl: "https://unit.test/v2" });

  const result = await provider.resolve(providerRequest());

  assert.equal(result.issues[0].code, "RATE_LIMITED");
  assert.match(result.issues[0].message, /60 seconds/);
});

test("registered resolver uses Modrinth provider and preserves fixed safety diagnostics", async () => {
  const fetch = mockFetch([
    { match: "/v2/project/AANobbMI", body: project },
    { match: "/v2/project/AANobbMI/version?", body: [releaseVersion] },
  ]);
  const resolver = createDefaultResourceResolver({ modrinth: { fetch, baseUrl: "https://unit.test/v2" } });

  const result = await resolver.resolve({
    schemaVersion: "0.1.0",
    requirements: [requirement()],
    allowedProviders: ["modrinth", "github-releases"],
    riskPreference: "stable",
    networkPolicy: "metadata-only",
  });

  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.diagnostics.providersConsulted, ["modrinth"]);
  assert.ok(result.diagnostics.issues.some((item) => item.provider === "github-releases"));
  assert.equal(result.diagnostics.networkUsed, true);
  assert.equal(result.diagnostics.downloadPerformed, false);
  assert.equal(result.diagnostics.uploadPerformed, false);
  assert.equal(result.diagnostics.filesystemAccessed, false);
  assert.equal(result.diagnostics.executionPerformed, false);
  assert.equal(result.diagnostics.telemetryEmitted, false);
});

function requirement(): ResourceRequirement {
  return {
    requirementId: "req-sodium",
    canonicalName: "Sodium",
    resourceType: "mod",
    minecraftVersion: "1.20.1",
    loader: "fabric",
    required: true,
    tags: ["performance"],
    reason: "Performance requirement.",
    providerHints: [{
      provider: "modrinth",
      projectId: "AANobbMI",
      slug: "sodium",
      query: "sodium",
    }],
  };
}

function providerRequest(overrides: { networkPolicy?: "offline" | "metadata-only" } = {}) {
  return {
    schemaVersion: "0.1.0" as const,
    requirements: [requirement()],
    riskPreference: "stable" as const,
    networkPolicy: overrides.networkPolicy ?? "metadata-only",
  };
}

function mockFetch(routes: Array<{
  match: string;
  body: unknown;
  status?: number;
  headers?: Record<string, string>;
}>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const route = routes
      .filter((item) => url.includes(item.match))
      .sort((left, right) => right.match.length - left.match.length)[0];
    if (!route) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }
    return {
      ok: (route.status ?? 200) >= 200 && (route.status ?? 200) < 300,
      status: route.status ?? 200,
      headers: { get: (name: string) => route.headers?.[name.toLowerCase()] ?? null },
      json: async () => route.body,
    } as Response;
  };
  return Object.assign(fetch, { calls });
}
