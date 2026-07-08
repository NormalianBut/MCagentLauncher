import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResolverQueriesFromAliases,
  mapAliasMatchToResolverQuery,
} from "./resolver.ts";

test("shared resolver mapper preserves alias source and query context", () => {
  const query = mapAliasMatchToResolverQuery(
    {
      canonicalName: "AppleSkin",
      aliases: ["AppleSkin", "苹果皮"],
      type: "mod",
      tags: ["qol", "survival"],
      loaders: ["fabric"],
      sourceIds: {
        modrinthProjectId: null,
        modrinthSlug: "appleskin",
        curseforgeId: null,
      },
      needsVerification: true,
      notes: "Food HUD.",
      matchedAliases: ["苹果皮"],
    },
    {
      minecraftVersion: "1.20.1",
      loader: "fabric",
      riskPreference: "stable",
      goals: ["survival"],
    },
  );

  assert.equal(query.query, "appleskin");
  assert.equal(query.sourceAlias, "苹果皮");
  assert.equal(query.required, true);
  assert.deepEqual(query.gameVersions, ["1.20.1"]);
});

test("shared resolver query builder deduplicates by slug", () => {
  const matches = [
    {
      canonicalName: "AppleSkin",
      aliases: ["AppleSkin"],
      type: "mod" as const,
      tags: ["qol"],
      loaders: ["fabric"],
      sourceIds: {
        modrinthProjectId: null,
        modrinthSlug: "appleskin",
        curseforgeId: null,
      },
      needsVerification: true,
      notes: "Food HUD.",
      matchedAliases: ["AppleSkin"],
    },
    {
      canonicalName: "AppleSkin",
      aliases: ["苹果皮"],
      type: "mod" as const,
      tags: ["qol"],
      loaders: ["fabric"],
      sourceIds: {
        modrinthProjectId: null,
        modrinthSlug: "appleskin",
        curseforgeId: null,
      },
      needsVerification: true,
      notes: "Food HUD.",
      matchedAliases: ["苹果皮"],
    },
  ];

  const queries = buildResolverQueriesFromAliases(matches, {
    minecraftVersion: "1.20.1",
    loader: "fabric",
    riskPreference: "stable",
    goals: [],
  });

  assert.equal(queries.length, 1);
});
