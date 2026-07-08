import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import {
  loadAliasDb,
  matchAliasesInText,
  resolveAliasesForIntent,
} from "./aliasDb.ts";

const aliasRoot = resolve("../../packages/alias-db");

test("Chinese aliases match Sodium, Lithium, and AppleSkin", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("钠 锂 苹果皮", entries);
  const names = matches.map((match) => match.canonicalName);

  assert.ok(names.includes("Sodium"));
  assert.ok(names.includes("Lithium"));
  assert.ok(names.includes("AppleSkin"));
});

test("小地图 matches a minimap alias entry", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("我想要小地图", entries, { tags: ["minimap"] });
  const names = matches.map((match) => match.canonicalName);

  assert.ok(names.includes("Xaero's Minimap") || names.includes("JourneyMap"));
});

test("Iris 光影 matches Iris Shaders", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("Iris 光影", entries);

  assert.equal(matches.find((match) => match.canonicalName === "Iris Shaders")?.sourceIds.modrinthSlug, "iris");
});

test("English aliases are case-insensitive", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("please add sOdIuM and MOD MENU", entries);
  const names = matches.map((match) => match.canonicalName);

  assert.ok(names.includes("Sodium"));
  assert.ok(names.includes("Mod Menu"));
});

test("duplicate aliases return one entry per canonical resource", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("Sodium sodium 钠 钠优化", entries);
  const sodiumMatches = matches.filter((match) => match.canonicalName === "Sodium");

  assert.equal(sodiumMatches.length, 1);
  assert.ok(sodiumMatches[0].matchedAliases.length >= 2);
});

test("needsVerification is preserved from alias data", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("WorldEdit 创世神", entries);
  const worldEdit = matches.find((match) => match.canonicalName === "WorldEdit");

  assert.equal(worldEdit?.needsVerification, true);
  assert.equal(worldEdit?.sourceIds.modrinthProjectId, null);
});

test("tag filter limits matches", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = matchAliasesInText("Sodium AppleSkin 小地图", entries, { tags: ["performance"] });
  const names = matches.map((match) => match.canonicalName);

  assert.ok(names.includes("Sodium"));
  assert.equal(names.includes("AppleSkin"), false);
});

test("resolveAliasesForIntent reads rawText, requestedFeatures, mustInclude, and goals", async () => {
  const entries = await loadAliasDb({ rootDir: aliasRoot });
  const matches = resolveAliasesForIntent(
    {
      prompt: {
        rawText: "低配生存",
      },
      preferences: {
        requestedFeatures: ["Iris"],
      },
      mustInclude: ["苹果皮"],
      goals: ["小地图"],
    },
    entries,
  );
  const names = matches.map((match) => match.canonicalName);

  assert.ok(names.includes("Iris Shaders"));
  assert.ok(names.includes("AppleSkin"));
  assert.ok(names.includes("Xaero's Minimap") || names.includes("JourneyMap"));
});

test("alias matching performs no network request and exposes no download behavior", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("network should not be used by alias-db");
  }) as typeof fetch;

  try {
    const entries = await loadAliasDb({ rootDir: aliasRoot });
    const matches = matchAliasesInText("钠 苹果皮", entries);
    const serialized = JSON.stringify(matches).toLowerCase();

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
