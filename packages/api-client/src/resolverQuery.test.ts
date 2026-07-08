import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import type { AliasMatch } from "../../shared-types/src/alias.ts";
import {
  buildResolverQueriesFromAliases,
  mapAliasMatchToResolverQuery,
} from "../../shared-types/src/resolver.ts";

import { loadAliasDb } from "./aliasDb.ts";
import { buildResolverQueriesForIntent } from "./resolverQuery.ts";

const aliasRoot = resolve("../../packages/alias-db");
const context = {
  minecraftVersion: "1.20.1",
  loader: "fabric" as const,
  riskPreference: "stable" as const,
  goals: ["performance", "survival"],
};

test("钠 锂 苹果皮 generate Sodium, Lithium, and AppleSkin resolver queries", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const queries = buildResolverQueriesForIntent(
    {
      prompt: { rawText: "钠 锂 苹果皮" },
      game: { minecraftVersions: ["1.20.1"], loader: "fabric" },
      constraints: { requireStableReleases: true },
      preferences: { requestedFeatures: ["survival"] },
    },
    entries,
  );
  const names = queries.map((query) => query.canonicalName);

  assert.ok(names.includes("Sodium"));
  assert.ok(names.includes("Lithium"));
  assert.ok(names.includes("AppleSkin"));
});

test("modrinthProjectId is preferred over slug", () => {
  const query = mapAliasMatchToResolverQuery(
    matchFixture({
      sourceIds: {
        modrinthProjectId: "project-123",
        modrinthSlug: "sodium",
        curseforgeId: null,
      },
    }),
    context,
  );

  assert.equal(query.source, "modrinth");
  assert.equal(query.projectId, "project-123");
  assert.equal(query.slug, "sodium");
  assert.equal(query.query, "project-123");
});

test("slug is used when projectId is missing", () => {
  const query = mapAliasMatchToResolverQuery(matchFixture(), context);

  assert.equal(query.source, "modrinth");
  assert.equal(query.projectId, null);
  assert.equal(query.slug, "sodium");
  assert.equal(query.query, "sodium");
});

test("canonicalName is fallback when projectId and slug are missing", () => {
  const query = mapAliasMatchToResolverQuery(
    matchFixture({
      sourceIds: {
        modrinthProjectId: null,
        modrinthSlug: null,
        curseforgeId: null,
      },
    }),
    context,
  );

  assert.equal(query.source, "community-index");
  assert.equal(query.projectId, null);
  assert.equal(query.slug, null);
  assert.equal(query.query, "Sodium");
});

test("needsVerification and context values are preserved", () => {
  const query = mapAliasMatchToResolverQuery(matchFixture({ needsVerification: true }), context);

  assert.equal(query.needsVerification, true);
  assert.deepEqual(query.loaders, ["fabric"]);
  assert.deepEqual(query.gameVersions, ["1.20.1"]);
  assert.equal(query.required, true);
  assert.equal(query.reason.includes("performance"), true);
});

test("duplicate alias matches are deduplicated", () => {
  const queries = buildResolverQueriesFromAliases(
    [
      matchFixture({ matchedAliases: ["Sodium"] }),
      matchFixture({ matchedAliases: ["钠"] }),
    ],
    context,
  );

  assert.equal(queries.length, 1);
  assert.equal(queries[0].canonicalName, "Sodium");
});

test("intent goals add small resolver seeds without duplicating alias matches", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const queries = buildResolverQueriesForIntent(
    {
      prompt: { rawText: "苹果皮" },
      game: { minecraftVersions: ["1.21.1"], loader: "fabric" },
      preferences: { requestedFeatures: ["performance", "shader"] },
      constraints: { requireStableReleases: true },
    },
    entries,
  );
  const byName = new Map(queries.map((query) => [query.canonicalName, query]));

  assert.equal(byName.get("AppleSkin")?.gameVersions[0], "1.21.1");
  assert.equal(byName.get("Sodium")?.slug, "sodium");
  assert.equal(byName.get("Iris Shaders")?.slug, "iris");
});

test("resolver query construction performs no network request or download behavior", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("network should not be used");
  }) as typeof fetch;

  try {
    const entries = await loadAliasDb({ rootDir: aliasRoot });
    const queries = buildResolverQueriesForIntent(
      {
        prompt: { rawText: "钠 苹果皮" },
        game: { minecraftVersions: ["1.20.1"], loader: "fabric" },
      },
      entries,
    );
    const serialized = JSON.stringify(queries).toLowerCase();

    assert.equal(fetchCalled, false);
    assert.equal(serialized.includes("downloadurl"), false);
    assert.equal(serialized.includes("download_url"), false);
    assert.equal(serialized.includes("mods/"), false);
    assert.equal(serialized.includes("resourcepacks/"), false);
    assert.equal(serialized.includes("shaderpacks/"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function matchFixture(overrides: Partial<AliasMatch> = {}): AliasMatch {
  return {
    canonicalName: "Sodium",
    aliases: ["Sodium", "钠"],
    type: "mod",
    tags: ["performance", "client"],
    loaders: ["fabric"],
    sourceIds: {
      modrinthProjectId: null,
      modrinthSlug: "sodium",
      curseforgeId: null,
    },
    needsVerification: true,
    notes: "Test fixture.",
    matchedAliases: ["Sodium"],
    ...overrides,
  };
}
