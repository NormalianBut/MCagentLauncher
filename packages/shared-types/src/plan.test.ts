import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ResourceCandidate } from "./resource.ts";
import { buildResourcePlan } from "./plan.ts";

test("multiple ResourceCandidates build a complete resource-plan", () => {
  const plan = buildResourcePlan(contextFixture(), [
    candidateFixture(),
    candidateFixture({
      projectId: "gvQqBUqZ",
      versionId: "lithium-version",
      slug: "lithium",
      title: "Lithium",
      clientSide: "optional",
      serverSide: "required",
    }),
  ]);

  assert.equal(plan.schemaVersion, "0.1.0");
  assert.match(plan.planId, /^plan_[a-z0-9][a-z0-9_-]{5,63}$/);
  assert.equal(plan.intentId, "intent_resolver_test");
  assert.equal(plan.target.minecraftVersion, "1.20.1");
  assert.equal(plan.target.loader, "fabric");
  assert.equal(plan.resources.length, 2);
  assert.equal(plan.userConfirmation.required, true);
  assert.equal(plan.userConfirmation.confirmed, false);
});

test("duplicate projectId is deduplicated with warning", () => {
  const plan = buildResourcePlan(contextFixture(), [
    candidateFixture(),
    candidateFixture({ versionId: "newer-sodium-version" }),
  ]);

  assert.equal(plan.resources.length, 1);
  assert.equal(plan.resources[0].version.versionId, "version-sodium-1");
  assert.ok(plan.ruleResults.warnings.some((warning) => warning.code === "DUPLICATE_PROJECT_SKIPPED"));
});

test("required dependency candidate keeps required=true", () => {
  const plan = buildResourcePlan(
    contextFixture(),
    [
      candidateFixture(),
      candidateFixture({
        projectId: "P7dR8mSH",
        versionId: "fabric-api-version",
        slug: "fabric-api",
        title: "Fabric API",
      }),
    ],
    {
      dependencyProjectIds: ["P7dR8mSH"],
    },
  );

  const dependency = plan.resources.find((resource) => resource.project.projectId === "P7dR8mSH");
  assert.equal(dependency?.required, true);
});

test("missing hash and unchecked metadata become warnings and medium risk", () => {
  const plan = buildResourcePlan(contextFixture(), [
    candidateFixture({
      hashes: {},
      metadataChecked: false,
    }),
  ]);

  assert.equal(plan.summary.riskLevel, "medium");
  assert.ok(plan.ruleResults.warnings.some((warning) => warning.code === "HASH_NOT_KNOWN"));
  assert.ok(plan.ruleResults.warnings.some((warning) => warning.code === "METADATA_NOT_CHECKED"));
});

test("built resource-plan passes resource-plan.schema.json", () => {
  const schema = JSON.parse(readFileSync(resolve("../../packages/schemas/resource-plan.schema.json"), "utf8"));
  const plan = buildResourcePlan(contextFixture(), [candidateFixture()]);

  assert.deepEqual(validateSchema(schema, plan, schema), []);
  assert.equal(plan.resources[0].hashes?.sha1, "1111111111111111111111111111111111111111");
});

test("built resource-plan does not include download, install, or local execution fields", () => {
  const plan = buildResourcePlan(contextFixture(), [candidateFixture()]);
  const serialized = JSON.stringify(plan).toLowerCase();

  assert.equal(serialized.includes("downloadurl"), false);
  assert.equal(serialized.includes("download_url"), false);
  assert.equal(serialized.includes("mods/"), false);
  assert.equal(serialized.includes("resourcepacks/"), false);
  assert.equal(serialized.includes("shaderpacks/"), false);
  assert.equal(serialized.includes("localpath"), false);
});

function contextFixture() {
  return {
    intentId: "intent_resolver_test",
    minecraftVersion: "1.20.1",
    loader: "fabric" as const,
    loaderVersion: "0.15.11",
    javaMajorVersion: 17 as const,
    title: "Resolver generated plan",
    explanation: "Resolver output mapped into a user-reviewable resource plan.",
    estimatedMemoryMb: 4096,
  };
}

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
