import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createMockEnvironmentReport,
  redactEnvironmentReport,
  summarizeEnvironmentReport,
  type EnvironmentReport,
} from "./environment.ts";

const environmentSchema = JSON.parse(readFileSync(resolve("../../packages/schemas/environment-report.schema.json"), "utf8"));

test("createMockEnvironmentReport returns schema-shaped report", () => {
  const report = createMockEnvironmentReport({
    reportId: "env_mock_test_report",
    platform: {
      os: "windows",
      arch: "x64",
    },
  });

  assert.equal(report.schemaVersion, "0.1.0");
  assert.equal(report.source.mode, "mock");
  assert.equal(report.source.generatedBy, "desktop");
  assert.deepEqual(validateSchema(environmentSchema, report, environmentSchema), []);
});

test("mock report keeps privacy and permission gates closed", () => {
  const report = createMockEnvironmentReport();

  assert.equal(report.privacy.localOnly, true);
  assert.equal(report.privacy.uploadAllowed, false);
  assert.equal(report.permissions.canDownload, false);
  assert.equal(report.permissions.canLaunchProcess, false);
  assert.equal(report.permissions.canWriteInstanceDirectory, false);
  assert.equal(report.network.checked, false);
});

test("mock report readiness is preview oriented", () => {
  const report = createMockEnvironmentReport();

  assert.ok(report.readiness.level === "preview_ready" || report.readiness.level === "not_ready");
  assert.ok(report.readiness.warnings.some((warning) => warning.code === "MOCK_ENVIRONMENT_REPORT"));
  assert.ok(report.readiness.blockers.some((blocker) => blocker.code === "REAL_PROBE_DISABLED"));
});

test("mock report contains no real user path", () => {
  const report = createMockEnvironmentReport();
  const serialized = JSON.stringify(report).toLowerCase();

  assert.equal(serialized.includes("c:\\users"), false);
  assert.equal(serialized.includes("/users/"), false);
  assert.equal(serialized.includes("appdata"), false);
  assert.equal(serialized.includes("/home/"), false);
  assert.equal(serialized.includes(".minecraft"), false);
});

test("redactEnvironmentReport removes path-like values and keeps upload disabled", () => {
  const unsafeReport: EnvironmentReport = {
    ...createMockEnvironmentReport(),
    java: {
      status: "detected",
      version: "21",
      path: "C:\\Users\\Example\\.jdks\\java.exe",
      checkedBy: "future_probe",
    },
    minecraft: {
      directoryStatus: "candidate_only",
      candidateDirectories: [
        "C:\\Users\\Example\\AppData\\Roaming\\.minecraft",
        "/Users/example/Library/Application Support/minecraft",
      ],
      containsSensitivePath: true,
    },
    privacy: {
      localOnly: true,
      uploadAllowed: false,
      containsUserPath: true,
      redacted: false,
    },
  };

  const redacted = redactEnvironmentReport(unsafeReport);
  const serialized = JSON.stringify(redacted).toLowerCase();

  assert.equal(redacted.java.path, "<redacted-path>");
  assert.deepEqual(redacted.minecraft.candidateDirectories, ["<redacted-path>", "<redacted-path>"]);
  assert.equal(redacted.minecraft.containsSensitivePath, false);
  assert.equal(redacted.privacy.containsUserPath, false);
  assert.equal(redacted.privacy.redacted, true);
  assert.equal(redacted.privacy.uploadAllowed, false);
  assert.equal(serialized.includes("c:\\users"), false);
  assert.equal(serialized.includes("/users/"), false);
  assert.equal(serialized.includes("appdata"), false);
});

test("summarizeEnvironmentReport returns user-readable summary", () => {
  const summary = summarizeEnvironmentReport(createMockEnvironmentReport());

  assert.match(summary, /Environment report/);
  assert.match(summary, /local-only/);
  assert.match(summary, /No download, install, launch, shell command, disk scan, or upload was performed/);
});

test("environment report example passes schema validation", () => {
  const example = JSON.parse(
    readFileSync(resolve("../../examples/environment-reports/mock-windows-preview.environment-report.json"), "utf8"),
  );

  assert.deepEqual(validateSchema(environmentSchema, example, environmentSchema), []);
});

test("environment helpers do not perform file or network operations", () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error("network should not be used");
  }) as typeof fetch;

  try {
    const report = createMockEnvironmentReport();
    const redacted = redactEnvironmentReport(report);
    const summary = summarizeEnvironmentReport(redacted);

    assert.equal(fetchCalled, false);
    assert.equal(redacted.privacy.localOnly, true);
    assert.match(summary, /No download/);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${path}: date-time mismatch`);
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
