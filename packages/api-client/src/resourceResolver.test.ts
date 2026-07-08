import test from "node:test";
import assert from "node:assert/strict";

import type { ResolverQuery } from "../../shared-types/src/resolver.ts";

import {
  resolveModrinthCandidate,
  resolveModrinthCandidates,
} from "./resourceResolver.ts";

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
  name: "Sodium release",
  version_number: "0.5.11",
  version_type: "release",
  loaders: ["fabric"],
  game_versions: ["1.20.1"],
  files: [
    {
      filename: "sodium.jar",
      size: 100,
      primary: true,
      url: "https://cdn.modrinth.com/data/sodium.jar",
      hashes: {
        sha1: "1111111111111111111111111111111111111111",
      },
    },
  ],
  dependencies: [
    {
      project_id: "fabric-api",
      version_id: "fabric-api-version",
      dependency_type: "required",
    },
  ],
};

const betaVersion = {
  ...releaseVersion,
  id: "beta-version",
  version_type: "beta",
};

const alphaVersion = {
  ...releaseVersion,
  id: "alpha-version",
  version_type: "alpha",
};

test("resolves candidate by Modrinth projectId", async () => {
  const fetch = mockFetch([
    {
      match: "/project/AANobbMI/version",
      body: [releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: "AANobbMI" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.candidate?.projectId, "AANobbMI");
  assert.equal(result.candidate?.versionId, "release-version");
  assert.equal(result.candidate?.resolver?.sourceAlias, "钠");
});

test("resolves candidate by Modrinth slug", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.candidate?.versionId, "release-version");
  assert.match(fetch.calls[0].url, /\/project\/sodium\/version/);
});

test("falls back to search when no project id or slug is available", async () => {
  const fetch = mockFetch([
    {
      match: "/search",
      body: { hits: [project] },
    },
    {
      match: "/project/AANobbMI/version",
      body: [releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: null, query: "Sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.candidate?.title, "Sodium");
  assert.equal(fetch.calls.length, 2);
});

test("unsupported curseforge source returns warning without client call", async () => {
  const fetch = mockFetch([]);

  const result = await resolveModrinthCandidate({
    ...baseQuery(),
    source: "curseforge",
  }, {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.candidate, null);
  assert.equal(result.warnings[0].code, "UNSUPPORTED_SOURCE");
  assert.equal(fetch.calls.length, 0);
});

test("no compatible version returns clear error", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [{ ...releaseVersion, loaders: ["quilt"] }],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.candidate, null);
  assert.equal(result.errors[0].code, "LOADER_MISMATCH");
  assert.match(result.errors[0].message, /loader fabric/);
});

test("stable preference chooses release before beta", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [betaVersion, releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.candidate?.versionType, "release");
});

test("beta fallback produces warning", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [betaVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.candidate?.versionType, "beta");
  assert.ok(result.warnings.some((warning) => warning.code === "BETA_VERSION_SELECTED"));
});

test("alpha is skipped by default and selected for experimental preference", async () => {
  const stableFetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [alphaVersion],
    },
  ]);

  const stable = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch: stableFetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(stable.candidate, null);
  assert.equal(stable.errors[0].code, "VERSION_NOT_FOUND");

  const experimentalFetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [alphaVersion],
    },
  ]);

  const experimental = await resolveModrinthCandidate(
    baseQuery({ projectId: null, slug: "sodium", riskPreference: "experimental" }),
    {
      fetch: experimentalFetch,
      baseUrl: "https://unit.test/v2",
    },
  );

  assert.equal(experimental.candidate?.versionType, "alpha");
  assert.ok(experimental.warnings.some((warning) => warning.code === "ALPHA_VERSION_SELECTED"));
});

test("required dependencies are preserved in resolved candidate", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.deepEqual(result.candidate?.dependencies, [
    {
      projectId: "fabric-api",
      versionId: "fabric-api-version",
      dependencyType: "required",
    },
  ]);
});

test("batch resolver returns candidates and aggregate warnings/errors", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidates([
    baseQuery({ projectId: null, slug: "sodium" }),
    { ...baseQuery(), source: "github" },
  ], {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.candidates.length, 1);
  assert.ok(result.warnings.some((warning) => warning.code === "UNSUPPORTED_SOURCE"));
});

test("resolver records downloadUrl metadata but never fetches resource files", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [releaseVersion],
    },
  ]);

  const result = await resolveModrinthCandidate(baseQuery({ projectId: null, slug: "sodium" }), {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(result.candidate?.downloadUrl, "https://cdn.modrinth.com/data/sodium.jar");
  assert.equal(fetch.calls.length, 1);
  assert.match(fetch.calls[0].url, /\/project\/sodium\/version/);
});

function baseQuery(overrides: Partial<ResolverQuery> = {}): ResolverQuery {
  return {
    source: "modrinth",
    canonicalName: "Sodium",
    query: "sodium",
    projectId: "AANobbMI",
    slug: "sodium",
    resourceType: "mod",
    loaders: ["fabric"],
    gameVersions: ["1.20.1"],
    tags: ["performance"],
    required: false,
    reason: "Matched alias for performance goal.",
    riskPreference: "stable",
    needsVerification: true,
    sourceAlias: "钠",
    ...overrides,
  };
}

function mockFetch(routes: Array<{ match: string; body: unknown; status?: number; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const route = routes.find((item) => url.includes(item.match));
    if (!route) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }
    return {
      ok: (route.status ?? 200) >= 200 && (route.status ?? 200) < 300,
      status: route.status ?? 200,
      headers: {
        get(name: string) {
          return route.headers?.[name.toLowerCase()] ?? null;
        },
      },
      async json() {
        return route.body;
      },
    } as Response;
  };
  return Object.assign(fetch, { calls });
}
