import type { ResourceProviderId } from "./resource.ts";

export const COMPATIBILITY_STATUSES = [
  "compatible",
  "compatible_with_warnings",
  "incompatible",
  "unknown",
] as const;
export const COMPATIBILITY_SEVERITIES = ["info", "warning", "error", "blocker"] as const;
export const COMPATIBILITY_TARGET_SIDES = ["client", "server", "both", "unknown"] as const;

export type CompatibilityStatus = (typeof COMPATIBILITY_STATUSES)[number];
export type CompatibilitySeverity = (typeof COMPATIBILITY_SEVERITIES)[number];
export type CompatibilityTargetSide = (typeof COMPATIBILITY_TARGET_SIDES)[number];
export type CompatibilityCheckStatus = "pass" | "warning" | "fail" | "unknown" | "not_applicable";

export type CompatibilityIssueCode =
  | "MINECRAFT_VERSION_MISMATCH"
  | "LOADER_MISMATCH"
  | "SIDE_MISMATCH"
  | "REQUIRED_DEPENDENCY_MISSING"
  | "REQUIRED_DEPENDENCY_UNRESOLVED"
  | "DEPENDENCY_VERSION_UNKNOWN"
  | "DEPENDENCY_CYCLE"
  | "EXPLICIT_CONFLICT"
  | "DUPLICATE_PROJECT"
  | "DUPLICATE_CANDIDATE"
  | "METADATA_INCOMPLETE"
  | "METADATA_UNCHECKED"
  | "PROVIDER_UNSUPPORTED"
  | "COMPATIBILITY_UNKNOWN";

export type CompatibilityDetailValue =
  | string
  | number
  | boolean
  | null
  | CompatibilityDetailValue[]
  | { [key: string]: CompatibilityDetailValue };

export interface CompatibilityTarget {
  minecraftVersion: string;
  loader: string;
  side: CompatibilityTargetSide;
}

export interface CompatibilityIssue {
  code: CompatibilityIssueCode;
  severity: CompatibilitySeverity;
  message: string;
  resourceId?: string;
  relatedResourceIds?: string[];
  dependencyProjectId?: string;
  ruleId?: string;
  details?: Record<string, CompatibilityDetailValue>;
}

export interface ResourceCompatibilityChecks {
  minecraftVersion: CompatibilityCheckStatus;
  loader: CompatibilityCheckStatus;
  side: CompatibilityCheckStatus;
  dependencies: CompatibilityCheckStatus;
  conflicts: CompatibilityCheckStatus;
  metadata: CompatibilityCheckStatus;
}

export interface ResourceCompatibilityResult {
  resourceId: string;
  projectId: string;
  status: CompatibilityStatus;
  issues: CompatibilityIssue[];
  checks: ResourceCompatibilityChecks;
  blocking: boolean;
}

export interface CompatibilitySummary {
  compatible: number;
  warnings: number;
  incompatible: number;
  unknown: number;
  blockers: number;
}

export interface CompatibilityAnalysisResult {
  status: CompatibilityStatus;
  target: CompatibilityTarget;
  resourceResults: ResourceCompatibilityResult[];
  issues: CompatibilityIssue[];
  summary: CompatibilitySummary;
  blockingResourceIds: string[];
  analyzedResourceCount: number;
  deterministic: true;
  metadataOnly: true;
}

export type CompatibilityRuleType =
  | "conflict"
  | "requires"
  | "excludes_loader"
  | "excludes_minecraft_version"
  | "side_constraint";

export interface CompatibilityResourceSelector {
  provider?: ResourceProviderId;
  projectId?: string;
  slug?: string;
  versionId?: string;
}

export interface CompatibilityTargetConstraints {
  minecraftVersions?: string[];
  loaders?: string[];
  sides?: CompatibilityTargetSide[];
}

export interface CompatibilityRule {
  ruleId: string;
  type: CompatibilityRuleType;
  resourceSelectors: CompatibilityResourceSelector[];
  targetConstraints?: CompatibilityTargetConstraints;
  severity: CompatibilitySeverity;
  message: string;
  source: string;
  enabled: boolean;
}

const SEVERITY_ORDER: Record<CompatibilitySeverity, number> = {
  blocker: 0,
  error: 1,
  warning: 2,
  info: 3,
};

const UNKNOWN_CODES = new Set<CompatibilityIssueCode>([
  "DEPENDENCY_VERSION_UNKNOWN",
  "METADATA_INCOMPLETE",
  "METADATA_UNCHECKED",
  "PROVIDER_UNSUPPORTED",
  "COMPATIBILITY_UNKNOWN",
]);

export function createCompatibilityIssue(issue: CompatibilityIssue): CompatibilityIssue {
  if (!issue.message.trim()) {
    throw new Error("Compatibility issue message must not be empty.");
  }
  return {
    ...issue,
    message: issue.message.trim(),
    ...(issue.relatedResourceIds
      ? { relatedResourceIds: [...new Set(issue.relatedResourceIds)].sort() }
      : {}),
    ...(issue.details ? { details: cloneDetails(issue.details) } : {}),
  };
}

export function deriveCompatibilityStatus(issues: readonly CompatibilityIssue[]): CompatibilityStatus {
  if (issues.some((issue) => issue.severity === "blocker" || issue.severity === "error")) {
    return "incompatible";
  }
  if (issues.some((issue) => UNKNOWN_CODES.has(issue.code))) {
    return "unknown";
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return "compatible_with_warnings";
  }
  return "compatible";
}

export function summarizeCompatibilityResults(
  results: readonly ResourceCompatibilityResult[],
  issues: readonly CompatibilityIssue[] = results.flatMap((result) => result.issues),
): CompatibilitySummary {
  return {
    compatible: results.filter((result) =>
      result.status === "compatible" || result.status === "compatible_with_warnings").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
    incompatible: results.filter((result) => result.status === "incompatible").length,
    unknown: results.filter((result) => result.status === "unknown").length,
    blockers: issues.filter((issue) => issue.severity === "blocker").length,
  };
}

export function stableCompatibilityIssueKey(issue: CompatibilityIssue): string {
  return [
    issue.code,
    issue.severity,
    issue.resourceId ?? "",
    [...(issue.relatedResourceIds ?? [])].sort().join(","),
    issue.dependencyProjectId ?? "",
    issue.ruleId ?? "",
    issue.message,
    stableSerialize(issue.details ?? {}),
  ].join("|");
}

export function sortCompatibilityIssues(issues: readonly CompatibilityIssue[]): CompatibilityIssue[] {
  return [...issues].sort((left, right) =>
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.code.localeCompare(right.code)
    || (left.resourceId ?? "").localeCompare(right.resourceId ?? "")
    || stableCompatibilityIssueKey(left).localeCompare(stableCompatibilityIssueKey(right))
  );
}

export function validateCompatibilityTarget(target: CompatibilityTarget): CompatibilityTarget {
  const minecraftVersion = target.minecraftVersion.trim();
  const loader = target.loader.trim();
  if (!minecraftVersion) {
    throw new Error("Compatibility target minecraftVersion must not be empty.");
  }
  if (!loader) {
    throw new Error("Compatibility target loader must not be empty.");
  }
  if (!COMPATIBILITY_TARGET_SIDES.includes(target.side)) {
    throw new Error(`Unsupported compatibility target side: ${String(target.side)}`);
  }
  return { minecraftVersion, loader, side: target.side };
}

function cloneDetails(value: Record<string, CompatibilityDetailValue>): Record<string, CompatibilityDetailValue> {
  return JSON.parse(JSON.stringify(value)) as Record<string, CompatibilityDetailValue>;
}

function stableSerialize(value: CompatibilityDetailValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
