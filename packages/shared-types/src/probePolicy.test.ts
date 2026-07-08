import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCapabilityAllowed,
  getProbePolicyForMilestone,
  isCapabilityAllowed,
  listForbiddenCapabilities,
  type ProbeCapabilityId,
} from "./probePolicy.ts";

const policy = getProbePolicyForMilestone("M8.2");

test("M8.2 policy allows only mock and consented read-only preview", () => {
  assert.equal(isCapabilityAllowed("mock_environment_report", policy).allowed, true);
  assert.equal(isCapabilityAllowed("consented_read_only_preview", policy).allowed, true);
});

test("M8.2 policy forbids real probe and execution capabilities", () => {
  const forbidden: ProbeCapabilityId[] = [
    "java_version_probe",
    "environment_report_upload",
    "file_write",
    "process_launch",
    "resource_download",
    "read_os_arch",
    "network_connectivity_probe",
  ];

  for (const capability of forbidden) {
    assert.equal(isCapabilityAllowed(capability, policy).allowed, false, capability);
  }
});

test("upload and persistence are disabled for all current capabilities", () => {
  for (const capability of policy.capabilities) {
    assert.equal(capability.uploadAllowed, false, capability.id);
    assert.equal(capability.persistenceAllowed, false, capability.id);
  }
});

test("environment-report capabilities require redaction", () => {
  const reportCapabilities = policy.capabilities.filter((capability) => capability.id.includes("environment") || capability.id.includes("preview"));

  assert.ok(reportCapabilities.length >= 2);
  for (const capability of reportCapabilities) {
    assert.equal(capability.redactionRequired, true, capability.id);
  }
});

test("assertCapabilityAllowed throws clear error for forbidden capability", () => {
  assert.throws(
    () => assertCapabilityAllowed("java_version_probe", policy),
    /java_version_probe is forbidden by M8\.2/,
  );
});

test("listForbiddenCapabilities includes high-risk capabilities", () => {
  const ids = new Set(listForbiddenCapabilities(policy).map((capability) => capability.id));

  assert.equal(ids.has("java_version_probe"), true);
  assert.equal(ids.has("environment_report_upload"), true);
  assert.equal(ids.has("file_write"), true);
  assert.equal(ids.has("process_launch"), true);
  assert.equal(ids.has("resource_download"), true);
});
