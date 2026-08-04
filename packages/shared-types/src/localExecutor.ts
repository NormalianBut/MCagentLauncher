import type { CompatibilityStatus } from "./compatibility.ts";
import type { ResourcePlan } from "./plan.ts";

export const LOCAL_EXECUTOR_CONTRACT_VERSION = "0.1.0" as const;

export const EXECUTOR_CAPABILITIES = [
  "workspace-inspect",
  "workspace-mutate",
  "manifest-persist",
  "artifact-download",
  "artifact-verify",
  "java-discover",
  "java-provision",
  "oauth-token",
  "process-launch",
  "rollback-mutate",
  "audit-persist",
] as const;

export type ExecutorCapability = (typeof EXECUTOR_CAPABILITIES)[number];

export type ExecutorGateId =
  | "GATE-EXEC-01"
  | "GATE-FS-01"
  | "GATE-USER-PATH-01"
  | "GATE-NET-01"
  | "GATE-JAVA-01"
  | "GATE-OAUTH-01"
  | "GATE-PROC-01"
  | "GATE-DEP-01"
  | "GATE-UPDATER-01"
  | "GATE-SIDECAR-01"
  | "GATE-MC-DIR-01"
  | "GATE-REL-01";

export interface ExecutorDigest {
  algorithm: "sha256" | "sha512";
  value: string;
}

export interface CompatibilityReviewEvidence {
  status: CompatibilityStatus;
  analysisDigest: ExecutorDigest;
  blockerCount: number;
  unknownCount: number;
  issueCodes: string[];
}

export interface ReviewedPlanEnvelope {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  reviewId: string;
  presentationRevision: string;
  riskSummaryRevision: string;
  reviewedAt: string;
  immutable: true;
  planDigest: ExecutorDigest;
  plan: ResourcePlan;
  compatibility: CompatibilityReviewEvidence;
}

export interface AppManagedWorkspaceSelection {
  kind: "app-managed";
  workspaceId: string;
  policyVersion: string;
}

export interface UserSelectedWorkspaceSelection {
  kind: "user-selected";
  workspaceId: string;
  policyVersion: string;
  selectionId: string;
  selectionRevision: string;
  observedEmptyAtReview: true;
  existingContentPolicy: "reject-existing-content";
}

export type ExecutorWorkspaceSelection =
  | AppManagedWorkspaceSelection
  | UserSelectedWorkspaceSelection;

export type ExecutorAuthorizationScope = ExecutorCapability | "local-executor" | "user-selected-workspace";

export interface CapabilityAuthorizationEvidence {
  scope: ExecutorAuthorizationScope;
  gateId: ExecutorGateId;
  decisionId: string;
  decisionRevision: string;
  approvedScopeDigest: ExecutorDigest;
}

export interface ExecutionTransaction {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  transactionId: string;
  requestId: string;
  manifestDigest: ExecutorDigest;
  workspaceKind: ExecutorWorkspaceSelection["kind"];
  workspaceId: string;
  state: ExecutorTransactionState;
  journalSequence: number;
  journalHeadDigest: ExecutorDigest | null;
  activeFailure: ExecutorFailure | null;
}

export type ManifestOperationKind =
  | "prepare-workspace"
  | "stage-artifact"
  | "write-generated-file"
  | "create-snapshot"
  | "commit-owned-file"
  | "commit-instance-manifest";

export type ManifestRollbackStrategy = "remove-owned" | "restore-snapshot" | "none";

export interface ManifestArtifactExpectation {
  resourceId: string;
  provider: "modrinth" | "manual" | "community-rule" | "minecraft" | "fabric" | "managed-java";
  projectId: string;
  versionId: string;
  sourceIdentity: string;
  expectedSizeBytes: number | null;
  expectedHashes: Record<string, string>;
}

export interface ExecutionManifestOperation {
  operationId: string;
  kind: ManifestOperationKind;
  destinationSegments: string[];
  artifact: ManifestArtifactExpectation | null;
  rollbackStrategy: ManifestRollbackStrategy;
  rollbackRequired: boolean;
}

export interface ExecutionManifest {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  manifestId: string;
  requestId: string;
  reviewedPlanDigest: ExecutorDigest;
  workspace: Pick<ExecutorWorkspaceSelection, "kind" | "workspaceId" | "policyVersion">;
  target: ResourcePlan["target"];
  operations: ExecutionManifestOperation[];
}

export interface ExecutionRequest {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  requestId: string;
  reviewedPlan: ReviewedPlanEnvelope;
  workspace: ExecutorWorkspaceSelection;
  requestedCapabilities: ExecutorCapability[];
  authorizationEvidence: CapabilityAuthorizationEvidence[];
  manifest: ExecutionManifest;
  manifestDigest: ExecutorDigest;
  initialState: "proposed";
}

export interface ExecutionConfirmation {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  confirmationId: string;
  singleUseNonce: string;
  requestId: string;
  planDigest: ExecutorDigest;
  compatibilityAnalysisDigest: ExecutorDigest;
  manifestDigest: ExecutorDigest;
  workspaceKind: ExecutorWorkspaceSelection["kind"];
  workspaceId: string;
  workspaceRevision: string;
  capabilities: ExecutorCapability[];
  presentationRevision: string;
  riskSummaryRevision: string;
  issuedAt: string;
  expiresAt: string;
  consumed: boolean;
}

export const EXECUTOR_TRANSACTION_STATES = [
  "proposed",
  "awaiting_confirmation",
  "ready",
  "staging",
  "verifying",
  "committing",
  "committed",
  "rolling_back",
  "rolled_back",
  "recovery_required",
  "failed",
  "cancelled",
] as const;

export type ExecutorTransactionState = (typeof EXECUTOR_TRANSACTION_STATES)[number];

export const EXECUTOR_FAILURE_CATEGORIES = [
  "invalid-input",
  "stale-review",
  "permission-denied",
  "workspace-containment",
  "source-policy",
  "integrity",
  "staging",
  "commit",
  "cancelled",
  "interrupted",
  "rollback",
  "recovery",
  "java",
  "authentication",
  "process-lifecycle",
] as const;

export type ExecutorFailureCategory = (typeof EXECUTOR_FAILURE_CATEGORIES)[number];
export type ExecutorFailurePhase =
  | "review"
  | "confirmation"
  | "staging"
  | "verification"
  | "commit"
  | "rollback"
  | "recovery"
  | "launch";

export interface ExecutorFailure {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  failureId: string;
  code: string;
  phase: ExecutorFailurePhase;
  category: ExecutorFailureCategory;
  retryDisposition: "never" | "after-new-review" | "after-new-confirmation" | "after-recovery" | "manual-review";
  rollbackRequired: boolean;
  manualReviewRequired: boolean;
  userMessage: string;
  evidenceRefs: string[];
}

export interface RollbackObligation {
  operationId: string;
  strategy: Exclude<ManifestRollbackStrategy, "none">;
  ownedTargetRef: string;
  snapshotRef: string | null;
  status: "pending" | "satisfied" | "failed" | "manual-review";
}

export interface RecoveryRecord {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  recoveryId: string;
  transactionId: string;
  manifestDigest: ExecutorDigest;
  journalHeadDigest: ExecutorDigest;
  derivedState: ExecutorTransactionState;
  obligations: RollbackObligation[];
  nextAction: "resume-rollback" | "mark-rolled-back" | "manual-review";
  idempotencyKey: string;
}

export interface TransactionJournalEvent {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  journalEventId: string;
  sequence: number;
  occurredAt: string;
  transactionId: string;
  fromState: ExecutorTransactionState;
  toState: ExecutorTransactionState;
  operationId: string | null;
  result: "accepted" | "rejected" | "interrupted";
  failure: ExecutorFailure | null;
  previousEventDigest: ExecutorDigest | null;
  eventDigest: ExecutorDigest;
}

export type ExecutorAuditActor = "user" | "desktop-review" | "local-executor" | "recovery";

export interface ExecutorAuditEvent {
  schemaVersion: typeof LOCAL_EXECUTOR_CONTRACT_VERSION;
  eventId: string;
  sequence: number;
  occurredAt: string;
  actor: ExecutorAuditActor;
  transactionId: string;
  requestId: string;
  manifestId: string;
  fromState: ExecutorTransactionState | null;
  toState: ExecutorTransactionState;
  code: string;
  details: Record<string, string | number | boolean | null>;
  previousEventDigest: ExecutorDigest | null;
  eventDigest: ExecutorDigest;
}

export type ExecutorContractIssueCode =
  | "INVALID_ID"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "INVALID_DIGEST"
  | "PLAN_NOT_REVIEWABLE"
  | "PLAN_ALREADY_CONFIRMED"
  | "PLAN_HAS_ERRORS"
  | "COMPATIBILITY_BLOCKED"
  | "COMPATIBILITY_UNKNOWN"
  | "WORKSPACE_INVALID"
  | "CAPABILITIES_NOT_CANONICAL"
  | "AUTHORIZATION_EVIDENCE_NOT_CANONICAL"
  | "AUTHORIZATION_SCOPE_UNEXPECTED"
  | "CAPABILITY_EVIDENCE_MISSING"
  | "CAPABILITY_GATE_MISMATCH"
  | "MANIFEST_BINDING_MISMATCH"
  | "MANIFEST_OPERATIONS_NOT_CANONICAL"
  | "MANIFEST_OPERATION_INVALID"
  | "CONFIRMATION_MISMATCH"
  | "CONFIRMATION_EXPIRED"
  | "CONFIRMATION_CONSUMED";

export interface ExecutorContractIssue {
  code: ExecutorContractIssueCode;
  path: string;
  message: string;
}

const CAPABILITY_GATE: Record<ExecutorCapability, ExecutorGateId> = {
  "workspace-inspect": "GATE-FS-01",
  "workspace-mutate": "GATE-FS-01",
  "manifest-persist": "GATE-FS-01",
  "artifact-download": "GATE-NET-01",
  "artifact-verify": "GATE-NET-01",
  "java-discover": "GATE-JAVA-01",
  "java-provision": "GATE-JAVA-01",
  "oauth-token": "GATE-OAUTH-01",
  "process-launch": "GATE-PROC-01",
  "rollback-mutate": "GATE-FS-01",
  "audit-persist": "GATE-FS-01",
};

const TRANSITIONS: Record<ExecutorTransactionState, readonly ExecutorTransactionState[]> = {
  proposed: ["awaiting_confirmation"],
  awaiting_confirmation: ["ready", "cancelled"],
  ready: ["staging", "cancelled"],
  staging: ["verifying", "rolling_back", "failed", "recovery_required"],
  verifying: ["committing", "rolling_back", "failed", "recovery_required"],
  committing: ["committed", "rolling_back", "failed", "recovery_required"],
  committed: [],
  rolling_back: ["rolled_back", "recovery_required"],
  rolled_back: [],
  recovery_required: ["rolling_back"],
  failed: ["rolling_back", "recovery_required"],
  cancelled: [],
};

export function requiredGateForCapability(capability: ExecutorCapability): ExecutorGateId {
  return CAPABILITY_GATE[capability];
}

export function normalizeExecutorCapabilities(
  capabilities: readonly ExecutorCapability[],
): ExecutorCapability[] {
  return [...new Set(capabilities)].sort();
}

export function validateExecutionRequestStructure(request: ExecutionRequest): ExecutorContractIssue[] {
  const issues: ExecutorContractIssue[] = [];
  validateSchemaVersion(request.schemaVersion, "request.schemaVersion", issues);
  validateId(request.requestId, "request.requestId", issues);
  validateReviewedPlan(request.reviewedPlan, issues);
  validateWorkspace(request.workspace, issues);
  validateDigest(request.manifestDigest, "request.manifestDigest", issues);

  const canonicalCapabilities = normalizeExecutorCapabilities(request.requestedCapabilities);
  if (!arraysEqual(request.requestedCapabilities, canonicalCapabilities)) {
    addIssue(issues, "CAPABILITIES_NOT_CANONICAL", "request.requestedCapabilities", "Capabilities must be unique and sorted.");
  }

  const evidenceByCapability = new Map(
    request.authorizationEvidence.map((evidence) => [evidence.scope, evidence]),
  );
  const evidenceScopes = request.authorizationEvidence.map((evidence) => evidence.scope);
  if (!arraysEqual(evidenceScopes, [...new Set(evidenceScopes)].sort())) {
    addIssue(issues, "AUTHORIZATION_EVIDENCE_NOT_CANONICAL", "request.authorizationEvidence", "Authorization evidence must have unique, sorted scopes.");
  }
  const expectedScopes = new Set<ExecutorAuthorizationScope>(["local-executor", ...canonicalCapabilities]);
  if (request.workspace.kind === "user-selected") {
    expectedScopes.add("user-selected-workspace");
  }
  for (const evidence of request.authorizationEvidence) {
    validateReference(evidence.decisionId, `request.authorizationEvidence.${evidence.scope}.decisionId`, issues);
    if (!evidence.decisionRevision.trim()) {
      addIssue(issues, "INVALID_ID", `request.authorizationEvidence.${evidence.scope}.decisionRevision`, "Decision revision is required.");
    }
    validateDigest(evidence.approvedScopeDigest, `request.authorizationEvidence.${evidence.scope}.approvedScopeDigest`, issues);
    if (!expectedScopes.has(evidence.scope)) {
      addIssue(issues, "AUTHORIZATION_SCOPE_UNEXPECTED", `request.authorizationEvidence.${evidence.scope}`, "Authorization evidence scope was not requested.");
    }
    if (evidence.gateId !== requiredGateForAuthorizationScope(evidence.scope)) {
      addIssue(issues, "CAPABILITY_GATE_MISMATCH", `request.authorizationEvidence.${evidence.scope}.gateId`, "Authorization scope is bound to the wrong approval gate.");
    }
  }
  if (!evidenceByCapability.has("local-executor")) {
    addIssue(issues, "CAPABILITY_EVIDENCE_MISSING", "request.authorizationEvidence.local-executor", "Every future privileged request requires GATE-EXEC-01 evidence.");
  }
  for (const capability of canonicalCapabilities) {
    const evidence = evidenceByCapability.get(capability);
    if (!evidence) {
      addIssue(issues, "CAPABILITY_EVIDENCE_MISSING", `request.authorizationEvidence.${capability}`, "Capability authorization evidence is missing.");
      continue;
    }
  }
  if (request.workspace.kind === "user-selected" && !request.authorizationEvidence.some((item) =>
    item.scope === "user-selected-workspace" && item.gateId === "GATE-USER-PATH-01")) {
    addIssue(issues, "CAPABILITY_EVIDENCE_MISSING", "request.authorizationEvidence", "User-selected workspaces require GATE-USER-PATH-01 evidence.");
  }

  validateManifest(request, issues);
  return sortIssues(issues);
}

export function validateExecutionConfirmation(
  request: ExecutionRequest,
  confirmation: ExecutionConfirmation,
  evaluationTime: string,
): ExecutorContractIssue[] {
  const issues: ExecutorContractIssue[] = [];
  validateSchemaVersion(confirmation.schemaVersion, "confirmation.schemaVersion", issues);
  validateId(confirmation.confirmationId, "confirmation.confirmationId", issues);
  validateId(confirmation.singleUseNonce, "confirmation.singleUseNonce", issues);
  validateDigest(confirmation.planDigest, "confirmation.planDigest", issues);
  validateDigest(confirmation.compatibilityAnalysisDigest, "confirmation.compatibilityAnalysisDigest", issues);
  validateDigest(confirmation.manifestDigest, "confirmation.manifestDigest", issues);
  if (confirmation.consumed) {
    addIssue(issues, "CONFIRMATION_CONSUMED", "confirmation.consumed", "Confirmation is single-use and has already been consumed.");
  }
  const expiresAt = Date.parse(confirmation.expiresAt);
  const issuedAt = Date.parse(confirmation.issuedAt);
  const evaluatedAt = Date.parse(evaluationTime);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !Number.isFinite(evaluatedAt)
    || issuedAt >= expiresAt || evaluatedAt < issuedAt || evaluatedAt > expiresAt) {
    addIssue(issues, "CONFIRMATION_EXPIRED", "confirmation.expiresAt", "Confirmation is outside its valid, caller-supplied time window.");
  }

  const workspaceRevision = request.workspace.kind === "user-selected"
    ? request.workspace.selectionRevision
    : request.workspace.policyVersion;
  const bindings: Array<[boolean, string]> = [
    [confirmation.requestId === request.requestId, "requestId"],
    [digestsEqual(confirmation.planDigest, request.reviewedPlan.planDigest), "planDigest"],
    [digestsEqual(confirmation.compatibilityAnalysisDigest, request.reviewedPlan.compatibility.analysisDigest), "compatibilityAnalysisDigest"],
    [digestsEqual(confirmation.manifestDigest, request.manifestDigest), "manifestDigest"],
    [confirmation.workspaceKind === request.workspace.kind, "workspaceKind"],
    [confirmation.workspaceId === request.workspace.workspaceId, "workspaceId"],
    [confirmation.workspaceRevision === workspaceRevision, "workspaceRevision"],
    [arraysEqual(confirmation.capabilities, request.requestedCapabilities), "capabilities"],
    [confirmation.presentationRevision === request.reviewedPlan.presentationRevision, "presentationRevision"],
    [confirmation.riskSummaryRevision === request.reviewedPlan.riskSummaryRevision, "riskSummaryRevision"],
  ];
  for (const [matches, path] of bindings) {
    if (!matches) {
      addIssue(issues, "CONFIRMATION_MISMATCH", `confirmation.${path}`, "Confirmation does not match the reviewed execution request.");
    }
  }
  return sortIssues(issues);
}

export function canTransitionExecutorState(
  from: ExecutorTransactionState,
  to: ExecutorTransactionState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedExecutorTransitions(
  from: ExecutorTransactionState,
): ExecutorTransactionState[] {
  return [...TRANSITIONS[from]];
}

export function sortExecutorAuditEvents(
  events: readonly ExecutorAuditEvent[],
): ExecutorAuditEvent[] {
  return [...events].sort((left, right) => left.sequence - right.sequence || compareText(left.eventId, right.eventId));
}

export function validateAuditSequence(events: readonly ExecutorAuditEvent[]): string[] {
  const ordered = sortExecutorAuditEvents(events);
  const errors: string[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index].sequence !== index + 1) {
      errors.push(`Audit sequence must be contiguous at ${ordered[index].eventId}.`);
    }
    if (index === 0 && ordered[index].previousEventDigest !== null) {
      errors.push(`First audit event must not reference a previous digest at ${ordered[index].eventId}.`);
    }
    if (index > 0 && !digestsEqualOrNull(ordered[index].previousEventDigest, ordered[index - 1].eventDigest)) {
      errors.push(`Audit digest chain is broken at ${ordered[index].eventId}.`);
    }
    if (index > 0 && ordered[index].fromState !== ordered[index - 1].toState) {
      errors.push(`Audit state chain is broken at ${ordered[index].eventId}.`);
    }
    if (index > 0 && !canTransitionExecutorState(ordered[index].fromState ?? ordered[index - 1].toState, ordered[index].toState)) {
      errors.push(`Invalid audit transition at ${ordered[index].eventId}.`);
    }
  }
  return errors;
}

export function sortTransactionJournalEvents(
  events: readonly TransactionJournalEvent[],
): TransactionJournalEvent[] {
  return [...events].sort((left, right) => left.sequence - right.sequence || compareText(left.journalEventId, right.journalEventId));
}

export function validateTransactionJournal(events: readonly TransactionJournalEvent[]): string[] {
  const ordered = sortTransactionJournalEvents(events);
  const errors: string[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const event = ordered[index];
    if (event.sequence !== index + 1) {
      errors.push(`Journal sequence must be contiguous at ${event.journalEventId}.`);
    }
    if (!canTransitionExecutorState(event.fromState, event.toState)) {
      errors.push(`Invalid journal transition at ${event.journalEventId}.`);
    }
    if (index === 0 && event.previousEventDigest !== null) {
      errors.push(`First journal event must not reference a previous digest at ${event.journalEventId}.`);
    }
    if (index > 0) {
      if (event.fromState !== ordered[index - 1].toState) {
        errors.push(`Journal state chain is broken at ${event.journalEventId}.`);
      }
      if (!digestsEqualOrNull(event.previousEventDigest, ordered[index - 1].eventDigest)) {
        errors.push(`Journal digest chain is broken at ${event.journalEventId}.`);
      }
    }
  }
  return errors;
}

function validateReviewedPlan(envelope: ReviewedPlanEnvelope, issues: ExecutorContractIssue[]): void {
  validateSchemaVersion(envelope.schemaVersion, "request.reviewedPlan.schemaVersion", issues);
  validateId(envelope.reviewId, "request.reviewedPlan.reviewId", issues);
  validateDigest(envelope.planDigest, "request.reviewedPlan.planDigest", issues);
  validateDigest(envelope.compatibility.analysisDigest, "request.reviewedPlan.compatibility.analysisDigest", issues);
  if (envelope.plan.status !== "needs-user-confirmation") {
    addIssue(issues, "PLAN_NOT_REVIEWABLE", "request.reviewedPlan.plan.status", "Only a plan awaiting user confirmation can enter review handoff.");
  }
  if (envelope.plan.userConfirmation.confirmed) {
    addIssue(issues, "PLAN_ALREADY_CONFIRMED", "request.reviewedPlan.plan.userConfirmation.confirmed", "Planner confirmation is not execution authority.");
  }
  if (envelope.plan.ruleResults.errors.length > 0 || envelope.plan.ruleResults.rejected.length > 0) {
    addIssue(issues, "PLAN_HAS_ERRORS", "request.reviewedPlan.plan.ruleResults", "Plans with errors or rejected rules cannot enter execution review.");
  }
  if (envelope.compatibility.blockerCount > 0 || envelope.compatibility.status === "incompatible") {
    addIssue(issues, "COMPATIBILITY_BLOCKED", "request.reviewedPlan.compatibility", "Compatibility blockers prevent execution review.");
  }
  if (envelope.compatibility.unknownCount > 0 || envelope.compatibility.status === "unknown") {
    addIssue(issues, "COMPATIBILITY_UNKNOWN", "request.reviewedPlan.compatibility", "Unknown compatibility evidence fails closed for this contract.");
  }
}

function validateWorkspace(workspace: ExecutorWorkspaceSelection, issues: ExecutorContractIssue[]): void {
  validateId(workspace.workspaceId, "request.workspace.workspaceId", issues);
  if (!workspace.policyVersion.trim()) {
    addIssue(issues, "WORKSPACE_INVALID", "request.workspace.policyVersion", "Workspace policy version is required.");
  }
  if (workspace.kind === "user-selected") {
    validateId(workspace.selectionId, "request.workspace.selectionId", issues);
    if (!workspace.selectionRevision.trim() || !workspace.observedEmptyAtReview || workspace.existingContentPolicy !== "reject-existing-content") {
      addIssue(issues, "WORKSPACE_INVALID", "request.workspace", "User-selected workspace must bind a revision and reject existing content.");
    }
  }
}

function validateManifest(request: ExecutionRequest, issues: ExecutorContractIssue[]): void {
  const manifest = request.manifest;
  validateSchemaVersion(manifest.schemaVersion, "request.manifest.schemaVersion", issues);
  validateId(manifest.manifestId, "request.manifest.manifestId", issues);
  if (manifest.requestId !== request.requestId
    || !digestsEqual(manifest.reviewedPlanDigest, request.reviewedPlan.planDigest)
    || manifest.workspace.kind !== request.workspace.kind
    || manifest.workspace.workspaceId !== request.workspace.workspaceId
    || manifest.workspace.policyVersion !== request.workspace.policyVersion) {
    addIssue(issues, "MANIFEST_BINDING_MISMATCH", "request.manifest", "Manifest is not bound to the request, reviewed plan, and workspace.");
  }
  if (!targetsEqual(manifest.target, request.reviewedPlan.plan.target)) {
    addIssue(issues, "MANIFEST_BINDING_MISMATCH", "request.manifest.target", "Manifest target differs from the reviewed plan target.");
  }

  const operationIds = manifest.operations.map((operation) => operation.operationId);
  if (!arraysEqual(operationIds, [...new Set(operationIds)].sort())) {
    addIssue(issues, "MANIFEST_OPERATIONS_NOT_CANONICAL", "request.manifest.operations", "Manifest operations must have unique, sorted IDs.");
  }
  for (const [index, operation] of manifest.operations.entries()) {
    const path = `request.manifest.operations[${index}]`;
    validateId(operation.operationId, `${path}.operationId`, issues);
    if (operation.destinationSegments.length === 0 || operation.destinationSegments.some((segment) => !isSafeRelativeSegment(segment))) {
      addIssue(issues, "MANIFEST_OPERATION_INVALID", `${path}.destinationSegments`, "Destination must contain safe relative path segments only.");
    }
    if (operation.rollbackRequired && operation.rollbackStrategy === "none") {
      addIssue(issues, "MANIFEST_OPERATION_INVALID", `${path}.rollbackStrategy`, "Required rollback must declare an owned removal or snapshot strategy.");
    }
    if (operation.artifact) {
      const hashes = Object.entries(operation.artifact.expectedHashes);
      if (hashes.length === 0 || hashes.some(([algorithm, value]) => !isSupportedArtifactHash(algorithm, value))) {
        addIssue(issues, "MANIFEST_OPERATION_INVALID", `${path}.artifact.expectedHashes`, "Artifact must have at least one supported, well-formed expected hash.");
      }
      if (operation.artifact.expectedSizeBytes !== null && (!Number.isSafeInteger(operation.artifact.expectedSizeBytes) || operation.artifact.expectedSizeBytes < 0)) {
        addIssue(issues, "MANIFEST_OPERATION_INVALID", `${path}.artifact.expectedSizeBytes`, "Expected size must be null or a non-negative safe integer.");
      }
    }
  }
}

function validateDigest(digest: ExecutorDigest, path: string, issues: ExecutorContractIssue[]): void {
  const expectedLength = digest.algorithm === "sha256" ? 64 : 128;
  if (!new RegExp(`^[a-f0-9]{${expectedLength}}$`).test(digest.value)) {
    addIssue(issues, "INVALID_DIGEST", path, `Digest must be a lowercase ${digest.algorithm} value.`);
  }
}

function validateSchemaVersion(value: string, path: string, issues: ExecutorContractIssue[]): void {
  if (value !== LOCAL_EXECUTOR_CONTRACT_VERSION) {
    addIssue(issues, "UNSUPPORTED_SCHEMA_VERSION", path, `Expected Local Executor contract ${LOCAL_EXECUTOR_CONTRACT_VERSION}.`);
  }
}

function requiredGateForAuthorizationScope(scope: ExecutorAuthorizationScope): ExecutorGateId {
  if (scope === "local-executor") {
    return "GATE-EXEC-01";
  }
  if (scope === "user-selected-workspace") {
    return "GATE-USER-PATH-01";
  }
  return requiredGateForCapability(scope);
}

function validateId(value: string, path: string, issues: ExecutorContractIssue[]): void {
  if (!/^[a-z][a-z0-9_-]{5,127}$/.test(value)) {
    addIssue(issues, "INVALID_ID", path, "Identifier must be stable, lowercase, and namespaced.");
  }
}

function validateReference(value: string, path: string, issues: ExecutorContractIssue[]): void {
  if (!/^[A-Za-z][A-Za-z0-9_.:/-]{2,127}$/.test(value)) {
    addIssue(issues, "INVALID_ID", path, "Reference must be a stable, non-secret identifier.");
  }
}

function isSafeRelativeSegment(segment: string): boolean {
  return segment.length > 0
    && segment.length <= 120
    && segment !== "."
    && segment !== ".."
    && !/[\\/:\u0000-\u001f]/.test(segment)
    && segment.trim() === segment;
}

function isSupportedArtifactHash(algorithm: string, value: string): boolean {
  const lengths: Record<string, number> = { sha1: 40, sha256: 64, sha512: 128 };
  const length = lengths[algorithm];
  return length !== undefined && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
}

function digestsEqual(left: ExecutorDigest, right: ExecutorDigest): boolean {
  return left.algorithm === right.algorithm && left.value === right.value;
}

function digestsEqualOrNull(left: ExecutorDigest | null, right: ExecutorDigest | null): boolean {
  return left === null || right === null ? left === right : digestsEqual(left, right);
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function targetsEqual(left: ResourcePlan["target"], right: ResourcePlan["target"]): boolean {
  return left.minecraftVersion === right.minecraftVersion
    && left.loader === right.loader
    && left.loaderVersion === right.loaderVersion
    && left.javaMajorVersion === right.javaMajorVersion;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function addIssue(
  issues: ExecutorContractIssue[],
  code: ExecutorContractIssueCode,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function sortIssues(issues: ExecutorContractIssue[]): ExecutorContractIssue[] {
  return [...issues].sort((left, right) =>
    compareText(left.path, right.path) || compareText(left.code, right.code) || compareText(left.message, right.message)
  );
}
