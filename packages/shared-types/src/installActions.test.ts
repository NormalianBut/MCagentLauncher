import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ResourcePlan } from "./plan.ts";
import { previewInstallActions } from "./executor.ts";
import {
  buildInstallActionsFromPlan,
  type InstallAction,
} from "./installActions.ts";

const plan = JSON.parse(readFileSync(resolve("../../examples/plans/low-spec-survival.resource-plan.json"), "utf8")) as ResourcePlan;
const installActionSchema = JSON.parse(readFileSync(resolve("../../packages/schemas/install-action.schema.json"), "utf8"));

test("resource-plan converts to install-action preview", () => {
  const preview = buildInstallActionsFromPlan(plan);

  assert.equal(preview.schemaVersion, "0.1.0");
  assert.equal(preview.sourcePlanId, plan.planId);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.requiresUserConfirmation, true);
  assert.equal(preview.confirmedByUser, false);
  assert.ok(preview.actions.length >= plan.resources.length + 5);
});

test("each resource has a matching add_resource action", () => {
  const preview = buildInstallActionsFromPlan(plan);
  const addResourceActions = preview.actions.filter((action) => action.type === "add_resource");
  const actionResourceIds = new Set(addResourceActions.map((action) => action.resourceRef?.resourceId));

  assert.equal(addResourceActions.length, plan.resources.length);
  for (const resource of plan.resources) {
    assert.equal(actionResourceIds.has(resource.resourceId), true);
  }
});

test("required lifecycle actions are present", () => {
  const preview = buildInstallActionsFromPlan(plan);
  const types = new Set(preview.actions.map((action) => action.type));

  assert.equal(types.has("create_instance"), true);
  assert.equal(types.has("install_minecraft"), true);
  assert.equal(types.has("install_loader"), true);
  assert.equal(types.has("write_config"), true);
  assert.equal(types.has("create_snapshot"), true);
});

test("all generated actions default to dryRun and require user confirmation", () => {
  const preview = buildInstallActionsFromPlan(plan);

  assert.equal(preview.actions.every((action) => action.dryRun === true), true);
  assert.equal(preview.actions.every((action) => action.requiresUserConfirmation === true), true);
  assert.equal(preview.actions.every((action) => action.status === "pending"), true);
});

test("generated install actions do not contain real local paths or execution results", () => {
  const preview = buildInstallActionsFromPlan(plan);
  const serialized = JSON.stringify(preview).toLowerCase();

  assert.equal(serialized.includes("c:\\users"), false);
  assert.equal(serialized.includes("/users/"), false);
  assert.equal(serialized.includes("appdata"), false);
  assert.equal(serialized.includes("downloadurl"), false);
  assert.equal(serialized.includes("download_url"), false);
  assert.equal(serialized.includes('"completed"'), false);
  assert.equal(serialized.includes('"failed"'), false);
});

test("previewInstallActions analyzes only and does not call network APIs", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("network should not be used");
  }) as typeof fetch;

  try {
    const preview = buildInstallActionsFromPlan(plan);
    const result = previewInstallActions(preview.actions);

    assert.equal(fetchCalled, false);
    assert.equal(result.dryRun, true);
    assert.equal(result.canExecute, false);
    assert.equal(result.requiresUserConfirmation, true);
    assert.match(result.summary, /User confirmation is required/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("non-dry-run action is blocked in M6 preview", () => {
  const preview = buildInstallActionsFromPlan(plan);
  const unsafeAction: InstallAction = {
    ...preview.actions[0],
    dryRun: false,
  };
  const result = previewInstallActions([unsafeAction]);

  assert.equal(result.blockedActions.length, 1);
  assert.equal(result.blockedActions[0].actionId, unsafeAction.actionId);
  assert.ok(result.warnings.some((warning) => warning.code === "NON_DRY_RUN_ACTION_BLOCKED"));
});

test("generated install action preview passes install-action.schema.json", () => {
  const preview = buildInstallActionsFromPlan(plan, {
    targetInstanceName: "Low-spec Fabric survival",
  });

  assert.deepEqual(validateSchema(installActionSchema, preview, installActionSchema), []);
});

test("install-action example passes install-action.schema.json", () => {
  const example = JSON.parse(readFileSync(resolve("../../examples/actions/low-spec-survival.install-action.json"), "utf8"));

  assert.deepEqual(validateSchema(installActionSchema, example, installActionSchema), []);
});

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
    if (type === "null") {
      return value === null;
    }
    return typeof value === type;
  });
}

function isRecord(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
