import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ResourceCandidate } from "../../shared-types/src/resource.ts";
import type { ResolverQuery } from "../../shared-types/src/resolver.ts";

import { loadAliasDb } from "./aliasDb.ts";
import {
  PlanningPipelineError,
  buildPlanningPipelineInput,
  planResourcesFromIntent,
  type PlanningIntent,
  type PlanningResolver,
} from "./planningPipeline.ts";

const aliasRoot = resolve("../../packages/alias-db");
const resourcePlanSchema = JSON.parse(readFileSync(resolve("../../packages/schemas/resource-plan.schema.json"), "utf8"));

test("low-spec shader survival intent builds a plan containing Sodium, Iris, and AppleSkin", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const resolver = mockResolver();

  const result = await planResourcesFromIntent(
    intentFixture({
      prompt: { rawText: "我想玩 1.20.1，低配光影生存，要优化、小地图、苹果皮。", redacted: false },
      mustInclude: ["AppleSkin"],
      preferences: {
        requestedFeatures: ["performance", "shader", "survival"],
      },
    }),
    {
      aliasEntries,
      resolver,
    },
  );

  const names = result.plan.resources.map((resource) => resource.project.name);
  assert.ok(names.includes("Sodium"));
  assert.ok(names.includes("Iris Shaders"));
  assert.ok(names.includes("AppleSkin"));
  assert.equal(result.diagnostics.networkUsed, false);
  assert.deepEqual(validateSchema(resourcePlanSchema, result.plan, resourcePlanSchema), []);
});

test("alias to resolver query to candidates to plan works for Sodium, Lithium, and AppleSkin", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const result = await planResourcesFromIntent(
    intentFixture({
      prompt: { rawText: "钠 锂 苹果皮", redacted: false },
    }),
    {
      aliasEntries,
      resolver: mockResolver(),
    },
  );

  const names = result.plan.resources.map((resource) => resource.project.name);
  assert.ok(names.includes("Sodium"));
  assert.ok(names.includes("Lithium"));
  assert.ok(names.includes("AppleSkin"));
  assert.ok(result.diagnostics.aliasMatches.length >= 3);
  assert.ok(result.diagnostics.resolverQueries.length >= 3);
});

test("duplicate projectId is deduplicated by resource-plan builder", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const resolver: PlanningResolver = async (queries) => ({
    candidates: [
      candidateFixture("Sodium"),
      candidateFixture("Sodium", { versionId: "sodium-newer-version" }),
    ],
    results: queries.slice(0, 2).map((query, index) => ({
      query,
      candidate: index === 0 ? candidateFixture("Sodium") : candidateFixture("Sodium", { versionId: "sodium-newer-version" }),
      warnings: [],
      errors: [],
    })),
    warnings: [],
    errors: [],
  });

  const result = await planResourcesFromIntent(intentFixture({ prompt: { rawText: "钠", redacted: false } }), {
    aliasEntries,
    resolver,
  });

  assert.equal(result.plan.resources.length, 1);
  assert.ok(result.plan.ruleResults.warnings.some((warning) => warning.code === "DUPLICATE_PROJECT_SKIPPED"));
});

test("needsVerification warnings are preserved in diagnostics and plan", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const result = await planResourcesFromIntent(intentFixture({ prompt: { rawText: "钠", redacted: false } }), {
    aliasEntries,
    resolver: mockResolver(),
  });

  assert.ok(result.diagnostics.warnings.some((warning) => warning.code === "ALIAS_NEEDS_VERIFICATION"));
  assert.ok(result.plan.ruleResults.warnings.some((warning) => warning.code === "ALIAS_NEEDS_VERIFICATION"));
});

test("resolver errors are kept in diagnostics and plan rule results", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const resolver: PlanningResolver = async (queries) => ({
    candidates: [candidateFixture("Sodium")],
    results: [
      {
        query: queries[0],
        candidate: candidateFixture("Sodium"),
        warnings: [],
        errors: [
          {
            code: "LOADER_MISMATCH",
            message: "No returned Modrinth version lists loader fabric. Resource: Sodium.",
          },
        ],
      },
    ],
    warnings: [],
    errors: [
      {
        code: "LOADER_MISMATCH",
        message: "No returned Modrinth version lists loader fabric. Resource: Sodium.",
      },
    ],
  });

  const result = await planResourcesFromIntent(intentFixture({ prompt: { rawText: "钠", redacted: false } }), {
    aliasEntries,
    resolver,
  });

  assert.ok(result.diagnostics.errors.some((error) => error.code === "LOADER_MISMATCH"));
  assert.ok(result.plan.ruleResults.errors.some((error) => error.code === "LOADER_MISMATCH"));
  assert.equal(result.plan.summary.riskLevel, "high");
});

test("enableNetwork defaults to false and does not call fetch without explicit opt-in", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("network should not be used");
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => planResourcesFromIntent(intentFixture({ prompt: { rawText: "钠", redacted: false } }), { aliasEntries }),
      PlanningPipelineError,
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mock resolver is called by planning pipeline", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  let called = false;
  const resolver: PlanningResolver = async (queries, options) => {
    called = true;
    assert.equal(options.enableNetwork, false);
    assert.ok(queries.length > 0);
    return mockResolver()(queries, options);
  };

  await planResourcesFromIntent(intentFixture({ prompt: { rawText: "钠", redacted: false } }), {
    aliasEntries,
    resolver,
  });

  assert.equal(called, true);
});

test("pipeline input can be built separately for diagnostics", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const input = await buildPlanningPipelineInput(intentFixture({ prompt: { rawText: "钠 锂", redacted: false } }), {
    aliasEntries,
    minecraftVersion: "1.20.1",
    riskPreference: "stable",
  });

  assert.equal(input.networkAllowed, false);
  assert.equal(input.minecraftVersion, "1.20.1");
  assert.ok(input.aliasMatches.length >= 2);
  assert.ok(input.resolverQueries.length >= 2);
});

test("resource-plan output does not include download, install, or local execution behavior", async () => {
  const aliasEntries = await loadAliasDb({ rootDir: aliasRoot });
  const result = await planResourcesFromIntent(intentFixture({ prompt: { rawText: "钠 苹果皮", redacted: false } }), {
    aliasEntries,
    resolver: mockResolver(),
  });
  const serialized = JSON.stringify(result.plan).toLowerCase();

  assert.equal(serialized.includes("downloadurl"), false);
  assert.equal(serialized.includes("download_url"), false);
  assert.equal(serialized.includes("mods/"), false);
  assert.equal(serialized.includes("resourcepacks/"), false);
  assert.equal(serialized.includes("shaderpacks/"), false);
  assert.equal(serialized.includes("localpath"), false);
});

function intentFixture(overrides: Partial<PlanningIntent> = {}): PlanningIntent {
  return {
    schemaVersion: "0.1.0",
    intentId: "intent_pipeline_test",
    source: "test-fixture",
    locale: "zh-CN",
    prompt: {
      rawText: "钠 苹果皮",
      redacted: false,
    },
    game: {
      minecraftVersions: ["1.20.1"],
      loader: "fabric",
    },
    preferences: {
      playStyle: "survival",
      performanceProfile: "low-spec",
      resourceTypes: ["mod"],
      requestedFeatures: ["performance"],
      avoidFeatures: [],
    },
    constraints: {
      modLoaderRequired: true,
      maxMemoryMb: 4096,
      requireStableReleases: true,
      allowOptionalResources: true,
      privacy: {
        allowTelemetry: false,
        allowAnonymousCaseUpload: false,
      },
    },
    ...overrides,
  } as PlanningIntent;
}

function mockResolver(): PlanningResolver {
  return async (queries: ResolverQuery[]) => {
    const results = queries
      .map((query) => ({
        query,
        candidate: candidateForQuery(query),
        warnings: query.needsVerification
          ? [{ code: "NEEDS_VERIFICATION", message: `${query.canonicalName} needs verification.` }]
          : [],
        errors: [],
      }))
      .filter((result) => result.candidate);

    return {
      candidates: results.map((result) => result.candidate as ResourceCandidate),
      results: results.map((result) => ({
        ...result,
        candidate: result.candidate as ResourceCandidate,
      })),
      warnings: results.flatMap((result) => result.warnings),
      errors: [],
    };
  };
}

function candidateForQuery(query: ResolverQuery): ResourceCandidate | null {
  const key = query.canonicalName.toLowerCase();
  if (key.includes("sodium")) {
    return candidateFixture("Sodium");
  }
  if (key.includes("lithium")) {
    return candidateFixture("Lithium");
  }
  if (key.includes("appleskin")) {
    return candidateFixture("AppleSkin");
  }
  if (key.includes("iris")) {
    return candidateFixture("Iris Shaders");
  }
  return null;
}

function candidateFixture(name: string, overrides: Partial<ResourceCandidate> = {}): ResourceCandidate {
  const data = {
    Sodium: {
      projectId: "AANobbMI",
      slug: "sodium",
      versionId: "sodium-version",
      description: "Rendering optimization mod.",
      hash: "1111111111111111111111111111111111111111",
    },
    Lithium: {
      projectId: "gvQqBUqZ",
      slug: "lithium",
      versionId: "lithium-version",
      description: "Game logic optimization mod.",
      hash: "2222222222222222222222222222222222222222",
    },
    AppleSkin: {
      projectId: "EsAfCjCV",
      slug: "appleskin",
      versionId: "appleskin-version",
      description: "Food and saturation HUD mod.",
      hash: "3333333333333333333333333333333333333333",
    },
    "Iris Shaders": {
      projectId: "YL57xq9U",
      slug: "iris",
      versionId: "iris-version",
      description: "Shader support for Fabric.",
      hash: "4444444444444444444444444444444444444444",
    },
  }[name];

  assert.ok(data, `Unknown fixture ${name}`);

  return {
    source: "modrinth",
    projectId: data.projectId,
    versionId: data.versionId,
    slug: data.slug,
    title: name,
    description: data.description,
    resourceType: "mod",
    loaders: ["fabric"],
    gameVersions: ["1.20.1"],
    versionType: "release",
    files: [
      {
        filename: `${data.slug}.jar`,
        size: 100,
        primary: true,
        hashes: { sha1: data.hash },
        downloadUrl: `https://cdn.modrinth.com/data/${data.slug}.jar`,
      },
    ],
    dependencies: [],
    hashes: { sha1: data.hash },
    downloadUrl: `https://cdn.modrinth.com/data/${data.slug}.jar`,
    clientSide: "required",
    serverSide: "unsupported",
    metadataChecked: true,
    warnings: [],
    ...overrides,
  };
}

function validateSchema(schema: any, value: any, root: any, path = "$"): string[] {
  if (schema.$ref) {
    return validateSchema(resolveRef(root, schema.$ref), value, root, path);
  }

  const errors: string[] = [];
  if (schema.type && !matchesType(schema.type, value)) {
    return [`${path}: expected ${JSON.stringify(schema.type)}`];
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected const ${schema.const}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: expected enum value`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string too short`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path}: string too long`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: pattern mismatch`);
    }
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: below minimum`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: above maximum`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: too few items`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateSchema(schema.items, item, root, `${path}[${index}]`));
      });
    }
  }
  if (isRecord(value)) {
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in value)) {
        errors.push(`${path}.${key}: missing required property`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${path}.${key}: additional property`);
        }
      }
    }
    if (isRecord(schema.additionalProperties)) {
      for (const [key, childValue] of Object.entries(value)) {
        if (!(key in properties)) {
          errors.push(...validateSchema(schema.additionalProperties, childValue, root, `${path}.${key}`));
        }
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validateSchema(childSchema, value[key], root, `${path}.${key}`));
      }
    }
  }

  return errors;
}

function resolveRef(root: any, ref: string): any {
  assert.ok(ref.startsWith("#/"));
  return ref
    .slice(2)
    .split("/")
    .reduce((current, part) => current[part.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}

function matchesType(expected: string | string[], value: any): boolean {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "array") {
      return Array.isArray(value);
    }
    if (type === "integer") {
      return Number.isInteger(value);
    }
    if (type === "object") {
      return isRecord(value);
    }
    return typeof value === type;
  });
}

function isRecord(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
