import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompatibilityIssue,
  deriveCompatibilityStatus,
  sortCompatibilityIssues,
  stableCompatibilityIssueKey,
  summarizeCompatibilityResults,
  validateCompatibilityTarget,
  type CompatibilityIssue,
  type CompatibilityRule,
  type ResourceCompatibilityResult,
} from "./compatibility.ts";

test("status derivation preserves incompatible, unknown, warning, and compatible states", () => {
  assert.equal(deriveCompatibilityStatus([issue("LOADER_MISMATCH", "blocker")]), "incompatible");
  assert.equal(deriveCompatibilityStatus([issue("METADATA_INCOMPLETE", "warning")]), "unknown");
  assert.equal(deriveCompatibilityStatus([issue("DUPLICATE_PROJECT", "warning")]), "compatible_with_warnings");
  assert.equal(deriveCompatibilityStatus([]), "compatible");
});

test("severity ordering is blocker, error, warning, then info", () => {
  const sorted = sortCompatibilityIssues([
    issue("COMPATIBILITY_UNKNOWN", "info"),
    issue("DUPLICATE_PROJECT", "warning"),
    issue("SIDE_MISMATCH", "blocker"),
    issue("EXPLICIT_CONFLICT", "error"),
  ]);
  assert.deepEqual(sorted.map((item) => item.severity), ["blocker", "error", "warning", "info"]);
});

test("stable issue key ignores related resource and detail object insertion order", () => {
  const left = issue("EXPLICIT_CONFLICT", "blocker", {
    relatedResourceIds: ["b", "a"],
    details: { source: "fixture", pair: ["a", "b"] },
  });
  const right = issue("EXPLICIT_CONFLICT", "blocker", {
    relatedResourceIds: ["a", "b"],
    details: { pair: ["a", "b"], source: "fixture" },
  });
  assert.equal(stableCompatibilityIssueKey(left), stableCompatibilityIssueKey(right));
});

test("issue sorting is deterministic and does not modify input", () => {
  const input = [issue("DUPLICATE_PROJECT", "warning", { resourceId: "z" }), issue("DUPLICATE_PROJECT", "warning", { resourceId: "a" })];
  const snapshot = [...input];
  const first = sortCompatibilityIssues(input);
  const second = sortCompatibilityIssues([...input].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(input, snapshot);
});

test("summary counts resource states, warning issues, and blockers", () => {
  const results: ResourceCompatibilityResult[] = [
    result("compatible", []),
    result("compatible_with_warnings", [issue("DUPLICATE_PROJECT", "warning")]),
    result("incompatible", [issue("LOADER_MISMATCH", "blocker")]),
    result("unknown", [issue("METADATA_UNCHECKED", "warning")]),
  ];
  assert.deepEqual(summarizeCompatibilityResults(results), {
    compatible: 2,
    warnings: 2,
    incompatible: 1,
    unknown: 1,
    blockers: 1,
  });
});

test("invalid compatibility targets are rejected", () => {
  assert.throws(() => validateCompatibilityTarget({ minecraftVersion: "", loader: "fabric", side: "client" }));
  assert.throws(() => validateCompatibilityTarget({ minecraftVersion: "1.20.1", loader: "", side: "client" }));
  assert.deepEqual(
    validateCompatibilityTarget({ minecraftVersion: " 1.20.1 ", loader: " fabric ", side: "both" }),
    { minecraftVersion: "1.20.1", loader: "fabric", side: "both" },
  );
});

test("explicit rule contract carries selectors, source, severity, and enabled state", () => {
  const rule: CompatibilityRule = {
    ruleId: "fixture-conflict",
    type: "conflict",
    resourceSelectors: [{ projectId: "project-a" }, { projectId: "project-b" }],
    targetConstraints: { loaders: ["fabric"] },
    severity: "blocker",
    message: "Fixture conflict.",
    source: "version-controlled-test-fixture",
    enabled: true,
  };
  assert.equal(rule.resourceSelectors.length, 2);
  assert.equal(rule.source, "version-controlled-test-fixture");
});

test("unknown metadata is never derived as compatible", () => {
  const unchecked = createCompatibilityIssue(issue("METADATA_UNCHECKED", "warning"));
  assert.equal(deriveCompatibilityStatus([unchecked]), "unknown");
});

function issue(
  code: CompatibilityIssue["code"],
  severity: CompatibilityIssue["severity"],
  overrides: Partial<CompatibilityIssue> = {},
): CompatibilityIssue {
  return { code, severity, message: `${code} fixture`, ...overrides };
}

function result(
  status: ResourceCompatibilityResult["status"],
  issues: CompatibilityIssue[],
): ResourceCompatibilityResult {
  return {
    resourceId: `resource-${status}`,
    projectId: `project-${status}`,
    status,
    issues,
    checks: {
      minecraftVersion: "pass",
      loader: "pass",
      side: "pass",
      dependencies: "pass",
      conflicts: "pass",
      metadata: "pass",
    },
    blocking: issues.some((item) => item.severity === "blocker"),
  };
}
