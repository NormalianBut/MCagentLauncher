import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ResourcePlan } from "./plan.ts";
import {
  allowedExecutorTransitions,
  canTransitionExecutorState,
  normalizeExecutorCapabilities,
  requiredGateForCapability,
  sortExecutorAuditEvents,
  sortTransactionJournalEvents,
  validateAuditSequence,
  validateExecutionConfirmation,
  validateExecutionRequestStructure,
  validateTransactionJournal,
  type ExecutionConfirmation,
  type ExecutionRequest,
  type ExecutorAuditEvent,
  type ExecutorDigest,
  type TransactionJournalEvent,
} from "./localExecutor.ts";

const plan = JSON.parse(readFileSync(resolve("../../examples/plans/low-spec-survival.resource-plan.json"), "utf8")) as ResourcePlan;
const sha256 = (character: string): ExecutorDigest => ({ algorithm: "sha256", value: character.repeat(64) });

function buildRequest(): ExecutionRequest {
  return {
    schemaVersion: "0.1.0",
    requestId: "request_m16_preview",
    reviewedPlan: {
      schemaVersion: "0.1.0",
      reviewId: "review_m16_preview",
      presentationRevision: "presentation-v1",
      riskSummaryRevision: "risk-v1",
      reviewedAt: "2026-08-04T00:00:00.000Z",
      immutable: true,
      planDigest: sha256("a"),
      plan,
      compatibility: {
        status: "compatible",
        analysisDigest: sha256("b"),
        blockerCount: 0,
        unknownCount: 0,
        issueCodes: [],
      },
    },
    workspace: {
      kind: "app-managed",
      workspaceId: "workspace_preview",
      policyVersion: "managed-v1",
    },
    requestedCapabilities: [
      "artifact-download",
      "artifact-verify",
      "manifest-persist",
      "rollback-mutate",
      "workspace-inspect",
      "workspace-mutate",
    ],
    authorizationEvidence: [
      evidence("artifact-download", "GATE-NET-01", "c"),
      evidence("artifact-verify", "GATE-NET-01", "c"),
      { ...evidence("local-executor", "GATE-EXEC-01", "0"), decisionId: "DQ-007" },
      evidence("manifest-persist", "GATE-FS-01", "d"),
      evidence("rollback-mutate", "GATE-FS-01", "d"),
      evidence("workspace-inspect", "GATE-FS-01", "d"),
      evidence("workspace-mutate", "GATE-FS-01", "d"),
    ],
    manifest: {
      schemaVersion: "0.1.0",
      manifestId: "manifest_m16_preview",
      requestId: "request_m16_preview",
      reviewedPlanDigest: sha256("a"),
      workspace: {
        kind: "app-managed",
        workspaceId: "workspace_preview",
        policyVersion: "managed-v1",
      },
      target: { ...plan.target },
      operations: [
        {
          operationId: "operation_stage_sodium",
          kind: "stage-artifact",
          destinationSegments: ["mods", "sodium.jar"],
          artifact: {
            resourceId: "res_sodium_core",
            provider: "modrinth",
            projectId: "AANobbMI",
            versionId: "sodium-1-20-1-example",
            sourceIdentity: "modrinth:AANobbMI:sodium-1-20-1-example",
            expectedSizeBytes: null,
            expectedHashes: { sha512: "a".repeat(128) },
          },
          rollbackStrategy: "remove-owned",
          rollbackRequired: true,
        },
      ],
    },
    manifestDigest: sha256("e"),
    initialState: "proposed",
  };
}

function evidence(scope: ExecutionRequest["authorizationEvidence"][number]["scope"], gateId: ExecutionRequest["authorizationEvidence"][number]["gateId"], digestCharacter: string) {
  return {
    scope,
    gateId,
    decisionId: `decision_${scope.replaceAll("-", "_")}`,
    decisionRevision: "decision-v1",
    approvedScopeDigest: sha256(digestCharacter),
  };
}

function buildConfirmation(request: ExecutionRequest): ExecutionConfirmation {
  return {
    schemaVersion: "0.1.0",
    confirmationId: "confirmation_m16_preview",
    singleUseNonce: "nonce_m16_preview",
    requestId: request.requestId,
    planDigest: request.reviewedPlan.planDigest,
    compatibilityAnalysisDigest: request.reviewedPlan.compatibility.analysisDigest,
    manifestDigest: request.manifestDigest,
    workspaceKind: request.workspace.kind,
    workspaceId: request.workspace.workspaceId,
    workspaceRevision: request.workspace.policyVersion,
    capabilities: [...request.requestedCapabilities],
    presentationRevision: request.reviewedPlan.presentationRevision,
    riskSummaryRevision: request.reviewedPlan.riskSummaryRevision,
    issuedAt: "2026-08-04T00:00:00.000Z",
    expiresAt: "2026-08-04T00:15:00.000Z",
    consumed: false,
  };
}

test("a canonical app-managed execution request satisfies pure contract invariants", () => {
  assert.deepEqual(validateExecutionRequestStructure(buildRequest()), []);
});

test("capabilities normalize deterministically and map to explicit gates", () => {
  assert.deepEqual(
    normalizeExecutorCapabilities(["workspace-mutate", "artifact-download", "workspace-mutate"]),
    ["artifact-download", "workspace-mutate"],
  );
  assert.equal(requiredGateForCapability("workspace-mutate"), "GATE-FS-01");
  assert.equal(requiredGateForCapability("artifact-download"), "GATE-NET-01");
  assert.equal(requiredGateForCapability("process-launch"), "GATE-PROC-01");
});

test("every privileged request requires explicit GATE-EXEC-01 evidence", () => {
  const request = buildRequest();
  request.authorizationEvidence = request.authorizationEvidence.filter((item) => item.scope !== "local-executor");

  assert.equal(
    validateExecutionRequestStructure(request).some((issue) => issue.message.includes("GATE-EXEC-01")),
    true,
  );
});

test("review handoff rejects Planner errors, blockers, and unknown compatibility", () => {
  const request = buildRequest();
  request.reviewedPlan.plan = {
    ...request.reviewedPlan.plan,
    ruleResults: {
      ...request.reviewedPlan.plan.ruleResults,
      errors: [{ code: "BLOCKED", message: "Blocked for contract test." }],
    },
  };
  request.reviewedPlan.compatibility = {
    ...request.reviewedPlan.compatibility,
    status: "unknown",
    blockerCount: 1,
    unknownCount: 1,
  };

  const codes = validateExecutionRequestStructure(request).map((issue) => issue.code);
  assert.equal(codes.includes("PLAN_HAS_ERRORS"), true);
  assert.equal(codes.includes("COMPATIBILITY_BLOCKED"), true);
  assert.equal(codes.includes("COMPATIBILITY_UNKNOWN"), true);
});

test("user-selected workspace remains a separate gated trust class", () => {
  const request = buildRequest();
  request.workspace = {
    kind: "user-selected",
    workspaceId: "workspace_selected",
    policyVersion: "selected-v1",
    selectionId: "selection_preview",
    selectionRevision: "selection-v1",
    observedEmptyAtReview: true,
    existingContentPolicy: "reject-existing-content",
  };
  request.manifest.workspace = {
    kind: "user-selected",
    workspaceId: "workspace_selected",
    policyVersion: "selected-v1",
  };

  assert.equal(
    validateExecutionRequestStructure(request).some((issue) => issue.message.includes("GATE-USER-PATH-01")),
    true,
  );

  request.authorizationEvidence.push({
    ...evidence("user-selected-workspace", "GATE-USER-PATH-01", "f"),
  });
  request.authorizationEvidence.sort((left, right) => left.scope.localeCompare(right.scope));
  assert.deepEqual(validateExecutionRequestStructure(request), []);
});

test("manifest rejects traversal, unsatisfied rollback, and malformed artifact hashes", () => {
  const request = buildRequest();
  request.manifest.operations[0] = {
    ...request.manifest.operations[0],
    destinationSegments: ["mods", "..", "outside.jar"],
    rollbackStrategy: "none",
    artifact: {
      ...request.manifest.operations[0].artifact!,
      expectedHashes: { sha512: "not-a-hash" },
    },
  };

  const operationIssues = validateExecutionRequestStructure(request).filter((issue) => issue.code === "MANIFEST_OPERATION_INVALID");
  assert.equal(operationIssues.length, 3);
});

test("manifest target comparison is independent of object insertion order", () => {
  const request = buildRequest();
  request.manifest.target = {
    javaMajorVersion: plan.target.javaMajorVersion,
    loaderVersion: plan.target.loaderVersion,
    loader: plan.target.loader,
    minecraftVersion: plan.target.minecraftVersion,
  };

  assert.deepEqual(validateExecutionRequestStructure(request), []);
});

test("confirmation is bound to exact request values and explicit evaluation time", () => {
  const request = buildRequest();
  const confirmation = buildConfirmation(request);

  assert.deepEqual(validateExecutionConfirmation(request, confirmation, "2026-08-04T00:10:00.000Z"), []);

  confirmation.workspaceId = "workspace_substituted";
  confirmation.consumed = true;
  const issues = validateExecutionConfirmation(request, confirmation, "2026-08-04T00:16:00.000Z");
  assert.deepEqual(issues.map((issue) => issue.code), [
    "CONFIRMATION_CONSUMED",
    "CONFIRMATION_EXPIRED",
    "CONFIRMATION_MISMATCH",
  ]);
});

test("transaction state machine blocks skipped verification and terminal-state reuse", () => {
  assert.equal(canTransitionExecutorState("staging", "verifying"), true);
  assert.equal(canTransitionExecutorState("verifying", "committing"), true);
  assert.equal(canTransitionExecutorState("staging", "committed"), false);
  assert.equal(canTransitionExecutorState("committed", "rolling_back"), false);
  assert.deepEqual(allowedExecutorTransitions("recovery_required"), ["rolling_back"]);
});

test("audit records sort deterministically and require contiguous valid transitions", () => {
  const events: ExecutorAuditEvent[] = [
    auditEvent(2, "event_ready", "awaiting_confirmation", "ready"),
    auditEvent(1, "event_awaiting", "proposed", "awaiting_confirmation"),
    auditEvent(3, "event_staging", "ready", "staging"),
  ];

  assert.deepEqual(sortExecutorAuditEvents(events).map((event) => event.eventId), [
    "event_awaiting",
    "event_ready",
    "event_staging",
  ]);
  assert.deepEqual(validateAuditSequence(events), []);

  events[2] = auditEvent(4, "event_committed", "staging", "committed");
  assert.equal(validateAuditSequence(events).length, 4);
});

test("transaction journal requires ordered state and digest chains", () => {
  const events: TransactionJournalEvent[] = [
    journalEvent(2, "journal_ready", "awaiting_confirmation", "ready", sha256("1"), sha256("2")),
    journalEvent(1, "journal_awaiting", "proposed", "awaiting_confirmation", null, sha256("1")),
  ];

  assert.deepEqual(sortTransactionJournalEvents(events).map((event) => event.journalEventId), [
    "journal_awaiting",
    "journal_ready",
  ]);
  assert.deepEqual(validateTransactionJournal(events), []);

  events[0] = journalEvent(2, "journal_skipped", "awaiting_confirmation", "committed", sha256("9"), sha256("2"));
  assert.equal(validateTransactionJournal(events).length, 2);
});

test("Local Executor contract module exposes no runtime I/O implementation", () => {
  const source = readFileSync(resolve("../../packages/shared-types/src/localExecutor.ts"), "utf8");
  assert.doesNotMatch(source, /node:fs|node:child_process|fetch\s*\(|Command::new|tauri-plugin|@azure\/msal|openid-client/i);
  assert.doesNotMatch(source, /Date\.now|new Date\s*\(|Math\.random/);
});

function auditEvent(
  sequence: number,
  eventId: string,
  fromState: ExecutorAuditEvent["fromState"],
  toState: ExecutorAuditEvent["toState"],
): ExecutorAuditEvent {
  return {
    schemaVersion: "0.1.0",
    eventId,
    sequence,
    occurredAt: "2026-08-04T00:00:00.000Z",
    actor: "local-executor",
    transactionId: "transaction_m16_preview",
    requestId: "request_m16_preview",
    manifestId: "manifest_m16_preview",
    fromState,
    toState,
    code: "STATE_TRANSITION",
    details: {},
    previousEventDigest: sequence === 1 ? null : sha256(String(sequence - 1)),
    eventDigest: sha256(String(sequence)),
  };
}

function journalEvent(
  sequence: number,
  journalEventId: string,
  fromState: TransactionJournalEvent["fromState"],
  toState: TransactionJournalEvent["toState"],
  previousEventDigest: ExecutorDigest | null,
  eventDigest: ExecutorDigest,
): TransactionJournalEvent {
  return {
    schemaVersion: "0.1.0",
    journalEventId,
    sequence,
    occurredAt: "2026-08-04T00:00:00.000Z",
    transactionId: "transaction_m16_preview",
    fromState,
    toState,
    operationId: null,
    result: "accepted",
    failure: null,
    previousEventDigest,
    eventDigest,
  };
}
