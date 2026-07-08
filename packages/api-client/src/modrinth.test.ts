import test from "node:test";
import assert from "node:assert/strict";

import {
  MODRINTH_USER_AGENT,
  ModrinthApiError,
  ModrinthNotFoundError,
  getProjectVersions,
  getRequiredDependencies,
  normalizeModrinthProjectToCandidate,
  normalizeModrinthVersionToCandidate,
  resolveProjectVersion,
  searchProjects,
} from "./modrinth.ts";

const project = {
  project_id: "AANobbMI",
  slug: "sodium",
  title: "Sodium",
  description: "Rendering optimization mod.",
  project_type: "mod",
  client_side: "required",
  server_side: "unsupported",
  versions: ["1.20.1", "1.21.1"],
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
        sha512: "a".repeat(128),
      },
    },
  ],
  dependencies: [
    {
      project_id: "fabric-api",
      version_id: "fabric-api-version",
      dependency_type: "required",
    },
    {
      project_id: "optional-helper",
      version_id: "optional-helper-version",
      dependency_type: "optional",
    },
  ],
};

const betaVersion = {
  ...releaseVersion,
  id: "beta-version",
  version_type: "beta",
  game_versions: ["1.20.1"],
};

const wrongLoaderVersion = {
  ...releaseVersion,
  id: "quilt-version",
  loaders: ["quilt"],
};

const alphaVersion = {
  ...releaseVersion,
  id: "alpha-version",
  version_type: "alpha",
  game_versions: ["1.20.1"],
};

test("normalizes Modrinth project and version responses to ResourceCandidate", () => {
  const projectCandidate = normalizeModrinthProjectToCandidate(project);
  assert.equal(projectCandidate.source, "modrinth");
  assert.equal(projectCandidate.projectId, "AANobbMI");
  assert.equal(projectCandidate.versionId, null);
  assert.equal(projectCandidate.metadataChecked, true);

  const versionCandidate = normalizeModrinthVersionToCandidate(releaseVersion, project);
  assert.equal(versionCandidate.projectId, "AANobbMI");
  assert.equal(versionCandidate.versionId, "release-version");
  assert.equal(versionCandidate.slug, "sodium");
  assert.equal(versionCandidate.resourceType, "mod");
  assert.deepEqual(versionCandidate.loaders, ["fabric"]);
  assert.deepEqual(versionCandidate.gameVersions, ["1.20.1"]);
  assert.equal(versionCandidate.downloadUrl, "https://cdn.modrinth.com/data/sodium.jar");
  assert.equal(versionCandidate.hashes.sha1, "1111111111111111111111111111111111111111");
});

test("resolveProjectVersion filters by minecraftVersion and loader", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [wrongLoaderVersion, releaseVersion],
    },
  ]);

  const candidate = await resolveProjectVersion("sodium", "1.20.1", "fabric", {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(candidate.versionId, "release-version");
  assert.deepEqual(fetch.calls[0].headers["User-Agent"], MODRINTH_USER_AGENT);
});

test("stable preference chooses release before beta", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [betaVersion, releaseVersion],
    },
  ]);

  const candidate = await resolveProjectVersion("sodium", "1.20.1", "fabric", {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(candidate.versionType, "release");
  assert.equal(candidate.versionId, "release-version");
});

test("stable preference can return beta with warning when release is unavailable", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [betaVersion],
    },
  ]);

  const candidate = await resolveProjectVersion("sodium", "1.20.1", "fabric", {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(candidate.versionType, "beta");
  assert.match(candidate.warnings[0], /selected beta/i);
});

test("alpha is skipped by default and selected only with experimental preference", async () => {
  const stableFetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [alphaVersion],
    },
  ]);

  await assert.rejects(
    () =>
      resolveProjectVersion("sodium", "1.20.1", "fabric", {
        fetch: stableFetch,
        baseUrl: "https://unit.test/v2",
      }),
    ModrinthNotFoundError,
  );

  const experimentalFetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [alphaVersion],
    },
  ]);

  const candidate = await resolveProjectVersion("sodium", "1.20.1", "fabric", {
    fetch: experimentalFetch,
    baseUrl: "https://unit.test/v2",
    preference: "experimental",
  });

  assert.equal(candidate.versionType, "alpha");
  assert.match(candidate.warnings[0], /experimental/i);
});

test("required dependencies are identified and deduplicated", () => {
  const candidate = normalizeModrinthVersionToCandidate(
    {
      ...releaseVersion,
      dependencies: [
        ...releaseVersion.dependencies,
        {
          project_id: "fabric-api",
          version_id: "duplicate-version",
          dependency_type: "required",
        },
      ],
    },
    project,
  );

  const dependencies = getRequiredDependencies(candidate);
  assert.deepEqual(dependencies, [
    {
      projectId: "fabric-api",
      versionId: "fabric-api-version",
      dependencyType: "required",
    },
  ]);
});

test("empty search and version results return clear errors", async () => {
  const fetch = mockFetch([
    {
      match: "/search",
      body: { hits: [] },
    },
    {
      match: "/project/empty/version",
      body: [],
    },
  ]);

  await assert.rejects(
    () => searchProjects("missing", [], { fetch, baseUrl: "https://unit.test/v2" }),
    ModrinthNotFoundError,
  );
  await assert.rejects(
    () => getProjectVersions("empty", { fetch, baseUrl: "https://unit.test/v2" }),
    ModrinthNotFoundError,
  );
});

test("rate limit response exposes retry-after", async () => {
  const fetch = mockFetch([
    {
      match: "/search",
      status: 429,
      headers: { "retry-after": "60" },
      body: { error: "rate limited" },
    },
  ]);

  await assert.rejects(
    () => searchProjects("sodium", [], { fetch, baseUrl: "https://unit.test/v2" }),
    (error: unknown) => error instanceof ModrinthApiError && error.status === 429 && error.retryAfter === "60",
  );
});

test("client records downloadUrl metadata but never fetches resource files", async () => {
  const fetch = mockFetch([
    {
      match: "/project/sodium/version",
      body: [releaseVersion],
    },
  ]);

  const candidate = await resolveProjectVersion("sodium", "1.20.1", "fabric", {
    fetch,
    baseUrl: "https://unit.test/v2",
  });

  assert.equal(candidate.downloadUrl, "https://cdn.modrinth.com/data/sodium.jar");
  assert.equal(fetch.calls.length, 1);
  assert.match(fetch.calls[0].url, /\/project\/sodium\/version/);
});

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
