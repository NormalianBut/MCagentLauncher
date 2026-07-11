import {
  createCompatibilityIssue,
  deriveCompatibilityStatus,
  sortCompatibilityIssues,
  stableCompatibilityIssueKey,
  summarizeCompatibilityResults,
  validateCompatibilityTarget,
  type CompatibilityAnalysisResult,
  type CompatibilityCheckStatus,
  type CompatibilityIssue,
  type CompatibilityRule,
  type CompatibilityResourceSelector,
  type CompatibilitySeverity,
  type CompatibilityTarget,
  type ResourceCompatibilityChecks,
  type ResourceCompatibilityResult,
} from "../../shared-types/src/compatibility.ts";
import type { ResourceCandidate, ResourceDependency, ResourceProviderId } from "../../shared-types/src/resource.ts";
import { getProviderCapability, resourceCandidateIdentity } from "../../shared-types/src/resolverContract.ts";

export interface CompatibilityAnalyzerOptions {
  rules?: readonly CompatibilityRule[];
  dependencyCandidates?: readonly AnyResourceCandidate[];
  treatUnknownAs?: "warning" | "blocker";
  requiredProjectIds?: readonly string[];
}

export interface ResourceCompatibilityContext extends CompatibilityAnalyzerOptions {
  candidates?: readonly AnyResourceCandidate[];
}

export type AnyResourceCandidate = ResourceCandidate<ResourceProviderId>;

interface CandidateRecord {
  candidate: AnyResourceCandidate;
  resourceId: string;
}

export function analyzeResourceCompatibility(
  candidate: AnyResourceCandidate,
  target: CompatibilityTarget,
  context: ResourceCompatibilityContext = {},
): ResourceCompatibilityResult {
  const candidates = context.candidates ?? [candidate];
  const analysis = analyzeCompatibility(candidates, target, context);
  const resourceId = resourceCandidateIdentity(candidate);
  return analysis.resourceResults.find((result) => result.resourceId === resourceId)
    ?? createResourceResult(candidate, [], validateCompatibilityTarget(target));
}

export function analyzeCompatibility(
  candidates: readonly AnyResourceCandidate[],
  target: CompatibilityTarget,
  options: CompatibilityAnalyzerOptions = {},
): CompatibilityAnalysisResult {
  const normalizedTarget = validateCompatibilityTarget(target);
  const primaryRecords = candidates.map(toCandidateRecord).sort(compareCandidateRecords);
  const dependencyRecords = (options.dependencyCandidates ?? []).map(toCandidateRecord).sort(compareCandidateRecords);
  const lookupRecords = [...primaryRecords, ...dependencyRecords];
  const unknownSeverity: CompatibilitySeverity = options.treatUnknownAs === "blocker" ? "blocker" : "warning";
  const issues: CompatibilityIssue[] = [];

  if (primaryRecords.length === 0) {
    issues.push(makeIssue(
      "COMPATIBILITY_UNKNOWN",
      unknownSeverity,
      "No resource candidates were available for compatibility analysis.",
      undefined,
      { check: "metadata" },
    ));
  }

  for (const record of primaryRecords) {
    issues.push(...analyzeCandidateMetadata(record, normalizedTarget, unknownSeverity));
    issues.push(...analyzeCandidateDependencies(record, lookupRecords, unknownSeverity));
  }

  issues.push(...analyzeRequiredProjects(options.requiredProjectIds ?? [], lookupRecords));
  issues.push(...analyzeDuplicates(primaryRecords));
  issues.push(...analyzeDependencyCycles(primaryRecords, lookupRecords));
  issues.push(...analyzeRules(primaryRecords, normalizedTarget, options.rules ?? []));

  const sortedIssues = dedupeIssues(issues);
  const resourceResults = primaryRecords.map((record) => {
    const resourceIssues = sortedIssues.filter((item) =>
      item.resourceId === record.resourceId || item.relatedResourceIds?.includes(record.resourceId));
    return createResourceResult(record.candidate, resourceIssues, normalizedTarget);
  });
  const blockingResourceIds = [...new Set(sortedIssues
    .filter((issue) => issue.severity === "blocker")
    .flatMap((issue) => [issue.resourceId, ...(issue.relatedResourceIds ?? [])])
    .filter((value): value is string => typeof value === "string"))].sort();
  const status = deriveCompatibilityStatus(sortedIssues);

  return {
    status,
    target: normalizedTarget,
    resourceResults,
    issues: sortedIssues,
    summary: summarizeCompatibilityResults(resourceResults, sortedIssues),
    blockingResourceIds,
    analyzedResourceCount: candidates.length,
    deterministic: true,
    metadataOnly: true,
  };
}

function analyzeCandidateMetadata(
  record: CandidateRecord,
  target: CompatibilityTarget,
  unknownSeverity: CompatibilitySeverity,
): CompatibilityIssue[] {
  const { candidate, resourceId } = record;
  const issues: CompatibilityIssue[] = [];
  const capability = getProviderCapability(candidate.source);
  if (!capability || capability.implementationStatus === "future") {
    issues.push(makeIssue(
      "PROVIDER_UNSUPPORTED",
      unknownSeverity,
      `Provider ${candidate.source} cannot supply trusted compatibility metadata in the current architecture.`,
      resourceId,
      { check: "metadata", provider: candidate.source },
    ));
  }

  if (!candidate.metadataChecked) {
    issues.push(makeIssue(
      "METADATA_UNCHECKED",
      unknownSeverity,
      `Metadata has not been checked for ${candidate.title || candidate.projectId}.`,
      resourceId,
      { check: "metadata" },
    ));
  }

  if (candidate.gameVersions.length === 0) {
    issues.push(makeIssue(
      "COMPATIBILITY_UNKNOWN",
      unknownSeverity,
      `Minecraft version metadata is missing for ${candidate.title || candidate.projectId}.`,
      resourceId,
      { check: "minecraftVersion", target: target.minecraftVersion },
    ));
  } else if (!candidate.gameVersions.includes(target.minecraftVersion)) {
    issues.push(makeIssue(
      "MINECRAFT_VERSION_MISMATCH",
      "blocker",
      `${candidate.title || candidate.projectId} does not declare Minecraft ${target.minecraftVersion}.`,
      resourceId,
      { check: "minecraftVersion", target: target.minecraftVersion, declared: [...candidate.gameVersions] },
    ));
  }

  if (candidate.loaders.length === 0) {
    issues.push(makeIssue(
      "COMPATIBILITY_UNKNOWN",
      unknownSeverity,
      `Loader metadata is missing for ${candidate.title || candidate.projectId}.`,
      resourceId,
      { check: "loader", target: target.loader },
    ));
  } else if (!candidate.loaders.includes(target.loader)) {
    issues.push(makeIssue(
      "LOADER_MISMATCH",
      "blocker",
      `${candidate.title || candidate.projectId} does not declare loader ${target.loader}.`,
      resourceId,
      { check: "loader", target: target.loader, declared: [...candidate.loaders] },
    ));
  }

  issues.push(...analyzeSide(record, target, unknownSeverity));
  if (
    candidate.gameVersions.length === 0
    || candidate.loaders.length === 0
    || candidate.files.length === 0
    || Object.keys(candidate.hashes).length === 0
  ) {
    issues.push(makeIssue(
      "METADATA_INCOMPLETE",
      unknownSeverity,
      `Compatibility metadata is incomplete for ${candidate.title || candidate.projectId}.`,
      resourceId,
      {
        check: "metadata",
        hasGameVersions: candidate.gameVersions.length > 0,
        hasLoaders: candidate.loaders.length > 0,
        hasFiles: candidate.files.length > 0,
        hasHashes: Object.keys(candidate.hashes).length > 0,
      },
    ));
  }
  return issues;
}

function analyzeSide(
  record: CandidateRecord,
  target: CompatibilityTarget,
  unknownSeverity: CompatibilitySeverity,
): CompatibilityIssue[] {
  const { candidate, resourceId } = record;
  if (target.side === "unknown") {
    return [makeIssue(
      "COMPATIBILITY_UNKNOWN",
      unknownSeverity,
      "Target side is unknown; side compatibility cannot be proven.",
      resourceId,
      { check: "side" },
    )];
  }

  const requiredSides = target.side === "both" ? ["client", "server"] as const : [target.side];
  const issues: CompatibilityIssue[] = [];
  for (const side of requiredSides) {
    const support = side === "client" ? candidate.clientSide : candidate.serverSide;
    if (support === "unsupported") {
      issues.push(makeIssue(
        "SIDE_MISMATCH",
        "blocker",
        `${candidate.title || candidate.projectId} is unsupported on the target ${side} side.`,
        resourceId,
        { check: "side", target: target.side, unsupportedSide: side },
      ));
    } else if (support === "unknown") {
      issues.push(makeIssue(
        "COMPATIBILITY_UNKNOWN",
        unknownSeverity,
        `${candidate.title || candidate.projectId} has unknown ${side}-side support.`,
        resourceId,
        { check: "side", target: target.side, unknownSide: side },
      ));
    }
  }
  return issues;
}

function analyzeCandidateDependencies(
  record: CandidateRecord,
  lookupRecords: readonly CandidateRecord[],
  unknownSeverity: CompatibilitySeverity,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  for (const dependency of record.candidate.dependencies) {
    const dependencyType = dependency.dependencyType.toLowerCase();
    const matches = findDependencyMatches(dependency, lookupRecords);
    if (dependencyType === "optional") {
      continue;
    }
    if (dependencyType === "required") {
      if (!dependency.projectId && !dependency.versionId) {
        issues.push(makeIssue(
          "REQUIRED_DEPENDENCY_UNRESOLVED",
          "blocker",
          `A required dependency for ${record.candidate.title || record.candidate.projectId} has no resolvable identity.`,
          record.resourceId,
          { check: "dependencies" },
        ));
        continue;
      }
      if (matches.length === 0) {
        issues.push({
          ...makeIssue(
            "REQUIRED_DEPENDENCY_MISSING",
            "blocker",
            `Required dependency ${dependency.projectId ?? dependency.versionId} is missing.`,
            record.resourceId,
            { check: "dependencies" },
          ),
          ...(dependency.projectId ? { dependencyProjectId: dependency.projectId } : {}),
        });
        continue;
      }
      if (dependency.versionId && !matches.some((match) => match.candidate.versionId === dependency.versionId)) {
        issues.push({
          ...makeIssue(
            "DEPENDENCY_VERSION_UNKNOWN",
            unknownSeverity,
            `Dependency ${dependency.projectId ?? dependency.versionId} is present, but version ${dependency.versionId} cannot be verified.`,
            record.resourceId,
            { check: "dependencies", expectedVersionId: dependency.versionId },
          ),
          ...(dependency.projectId ? { dependencyProjectId: dependency.projectId } : {}),
          relatedResourceIds: matches.map((match) => match.resourceId),
        });
      }
    }
    if (dependencyType === "incompatible" && matches.length > 0) {
      for (const match of matches) {
        const pair = [record.resourceId, match.resourceId].sort();
        issues.push({
          ...makeIssue(
            "EXPLICIT_CONFLICT",
            "blocker",
            `Provider metadata declares ${pair[0]} and ${pair[1]} incompatible.`,
            pair[0],
            { check: "conflicts", source: "provider-metadata" },
          ),
          relatedResourceIds: pair,
        });
      }
    }
  }
  return issues;
}

function analyzeRequiredProjects(
  requiredProjectIds: readonly string[],
  lookupRecords: readonly CandidateRecord[],
): CompatibilityIssue[] {
  const available = new Set(lookupRecords.flatMap((record) => [record.candidate.projectId, record.candidate.slug]));
  return [...new Set(requiredProjectIds)].sort()
    .filter((projectId) => !available.has(projectId))
    .map((projectId) => ({
      ...makeIssue(
        "REQUIRED_DEPENDENCY_MISSING",
        "blocker",
        `Required project ${projectId} is missing from compatibility inputs.`,
        undefined,
        { check: "dependencies" },
      ),
      dependencyProjectId: projectId,
    }));
}

function analyzeDuplicates(records: readonly CandidateRecord[]): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const identityGroups = groupBy(records, (record) => record.resourceId);
  for (const [identity, group] of [...identityGroups].sort(([left], [right]) => left.localeCompare(right))) {
    if (group.length > 1) {
      issues.push({
        ...makeIssue(
          "DUPLICATE_CANDIDATE",
          "warning",
          `Candidate ${identity} appears ${group.length} times.`,
          identity,
          { check: "metadata", count: group.length },
        ),
        relatedResourceIds: [identity],
      });
    }
  }

  const projectGroups = groupBy(records, (record) => record.candidate.projectId);
  for (const [projectId, group] of [...projectGroups].sort(([left], [right]) => left.localeCompare(right))) {
    const identities = [...new Set(group.map((record) => record.resourceId))].sort();
    if (projectId && identities.length > 1) {
      issues.push({
        ...makeIssue(
          "DUPLICATE_PROJECT",
          "warning",
          `Project ${projectId} has multiple distinct candidates.`,
          identities[0],
          { check: "metadata", matchBy: "projectId" },
        ),
        relatedResourceIds: identities,
      });
    }
  }

  const slugGroups = groupBy(records, (record) => record.candidate.slug);
  for (const [slug, group] of [...slugGroups].sort(([left], [right]) => left.localeCompare(right))) {
    const projectIds = [...new Set(group.map((record) => record.candidate.projectId))].sort();
    const identities = [...new Set(group.map((record) => record.resourceId))].sort();
    if (slug && projectIds.length > 1) {
      issues.push({
        ...makeIssue(
          "DUPLICATE_PROJECT",
          "warning",
          `Slug ${slug} maps to multiple project identities.`,
          identities[0],
          { check: "metadata", matchBy: "slug", slug },
        ),
        relatedResourceIds: identities,
      });
    }
  }
  return issues;
}

function analyzeDependencyCycles(
  primaryRecords: readonly CandidateRecord[],
  lookupRecords: readonly CandidateRecord[],
): CompatibilityIssue[] {
  const graph = new Map<string, string[]>();
  for (const record of primaryRecords) {
    const targets = record.candidate.dependencies
      .filter((dependency) => dependency.dependencyType.toLowerCase() === "required")
      .flatMap((dependency) => findDependencyMatches(dependency, lookupRecords).map((match) => match.resourceId));
    graph.set(record.resourceId, [...new Set(targets)].sort());
  }

  const cycles = new Set<string>();
  const visited = new Set<string>();
  const active = new Set<string>();
  const path: string[] = [];
  const visit = (node: string) => {
    if (active.has(node)) {
      const start = path.indexOf(node);
      if (start >= 0) {
        cycles.add(canonicalCycle(path.slice(start)));
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }
    active.add(node);
    path.push(node);
    for (const target of graph.get(node) ?? []) {
      if (graph.has(target)) {
        visit(target);
      }
    }
    path.pop();
    active.delete(node);
    visited.add(node);
  };
  for (const node of [...graph.keys()].sort()) {
    visit(node);
  }

  return [...cycles].sort().map((cycleKey) => {
    const resourceIds = cycleKey.split(" -> ");
    return {
      ...makeIssue(
        "DEPENDENCY_CYCLE",
        "warning",
        `Required dependency cycle detected: ${cycleKey}.`,
        resourceIds[0],
        { check: "dependencies" },
      ),
      relatedResourceIds: resourceIds,
    };
  });
}

function analyzeRules(
  records: readonly CandidateRecord[],
  target: CompatibilityTarget,
  rules: readonly CompatibilityRule[],
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const sortedRules = [...rules].filter((rule) => rule.enabled).sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  for (const rule of sortedRules) {
    if (!targetMatchesRule(target, rule)) {
      continue;
    }
    const selectorMatches = rule.resourceSelectors.map((selector) =>
      records.filter((record) => matchesSelector(record.candidate, selector)));
    if (rule.type === "conflict") {
      if (selectorMatches.length < 2 || selectorMatches.some((matches) => matches.length === 0)) {
        continue;
      }
      const resourceIds = [...new Set(selectorMatches.flat().map((record) => record.resourceId))].sort();
      if (resourceIds.length >= 2) {
        issues.push({
          ...makeIssue("EXPLICIT_CONFLICT", rule.severity, rule.message, resourceIds[0], {
            check: "conflicts",
            source: rule.source,
          }),
          relatedResourceIds: resourceIds,
          ruleId: rule.ruleId,
        });
      }
      continue;
    }

    const subjects = selectorMatches[0] ?? [];
    if (subjects.length === 0) {
      continue;
    }
    if (rule.type === "requires") {
      const missingSelector = selectorMatches.slice(1).findIndex((matches) => matches.length === 0);
      if (missingSelector >= 0) {
        for (const subject of subjects) {
          issues.push({
            ...makeIssue("REQUIRED_DEPENDENCY_MISSING", rule.severity, rule.message, subject.resourceId, {
              check: "dependencies",
              source: rule.source,
            }),
            ruleId: rule.ruleId,
          });
        }
      }
      continue;
    }

    const code = rule.type === "excludes_loader"
      ? "LOADER_MISMATCH"
      : rule.type === "excludes_minecraft_version"
        ? "MINECRAFT_VERSION_MISMATCH"
        : "SIDE_MISMATCH";
    for (const subject of subjects) {
      issues.push({
        ...makeIssue(code, rule.severity, rule.message, subject.resourceId, {
          check: rule.type === "excludes_loader"
            ? "loader"
            : rule.type === "excludes_minecraft_version" ? "minecraftVersion" : "side",
          source: rule.source,
        }),
        ruleId: rule.ruleId,
      });
    }
  }
  return issues;
}

function targetMatchesRule(target: CompatibilityTarget, rule: CompatibilityRule): boolean {
  const constraints = rule.targetConstraints;
  return !constraints
    || (!constraints.minecraftVersions || constraints.minecraftVersions.includes(target.minecraftVersion))
      && (!constraints.loaders || constraints.loaders.includes(target.loader))
      && (!constraints.sides || constraints.sides.includes(target.side));
}

function matchesSelector(candidate: AnyResourceCandidate, selector: CompatibilityResourceSelector): boolean {
  return (!selector.provider || candidate.source === selector.provider)
    && (!selector.projectId || candidate.projectId === selector.projectId)
    && (!selector.slug || candidate.slug === selector.slug)
    && (!selector.versionId || candidate.versionId === selector.versionId);
}

function findDependencyMatches(
  dependency: ResourceDependency,
  records: readonly CandidateRecord[],
): CandidateRecord[] {
  return records.filter((record) =>
    (dependency.projectId !== null
      && (record.candidate.projectId === dependency.projectId || record.candidate.slug === dependency.projectId))
    || (dependency.versionId !== null && record.candidate.versionId === dependency.versionId));
}

function createResourceResult(
  candidate: AnyResourceCandidate,
  issues: readonly CompatibilityIssue[],
  target: CompatibilityTarget,
): ResourceCompatibilityResult {
  const sortedIssues = sortCompatibilityIssues(issues);
  return {
    resourceId: resourceCandidateIdentity(candidate),
    projectId: candidate.projectId,
    status: deriveCompatibilityStatus(sortedIssues),
    issues: sortedIssues,
    checks: createChecks(sortedIssues, target),
    blocking: sortedIssues.some((issue) => issue.severity === "blocker"),
  };
}

function createChecks(
  issues: readonly CompatibilityIssue[],
  target: CompatibilityTarget,
): ResourceCompatibilityChecks {
  return {
    minecraftVersion: checkStatus(issues, "minecraftVersion"),
    loader: checkStatus(issues, "loader"),
    side: target.side === "unknown" ? "unknown" : checkStatus(issues, "side"),
    dependencies: checkStatus(issues, "dependencies"),
    conflicts: checkStatus(issues, "conflicts"),
    metadata: checkStatus(issues, "metadata"),
  };
}

function checkStatus(issues: readonly CompatibilityIssue[], check: string): CompatibilityCheckStatus {
  const relevant = issues.filter((issue) => issue.details?.check === check);
  if (relevant.some((issue) => issue.severity === "blocker" || issue.severity === "error")) {
    return "fail";
  }
  if (relevant.some((issue) =>
    issue.code === "COMPATIBILITY_UNKNOWN"
    || issue.code === "METADATA_INCOMPLETE"
    || issue.code === "METADATA_UNCHECKED"
    || issue.code === "DEPENDENCY_VERSION_UNKNOWN"
    || issue.code === "PROVIDER_UNSUPPORTED")) {
    return "unknown";
  }
  if (relevant.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  return "pass";
}

function makeIssue(
  code: CompatibilityIssue["code"],
  severity: CompatibilityIssue["severity"],
  message: string,
  resourceId: string | undefined,
  details: CompatibilityIssue["details"],
): CompatibilityIssue {
  return createCompatibilityIssue({ code, severity, message, ...(resourceId ? { resourceId } : {}), details });
}

function dedupeIssues(issues: readonly CompatibilityIssue[]): CompatibilityIssue[] {
  const byKey = new Map<string, CompatibilityIssue>();
  for (const issue of issues.map(createCompatibilityIssue)) {
    const key = stableCompatibilityIssueKey(issue);
    if (!byKey.has(key)) {
      byKey.set(key, issue);
    }
  }
  return sortCompatibilityIssues([...byKey.values()]);
}

function toCandidateRecord(candidate: AnyResourceCandidate): CandidateRecord {
  return { candidate, resourceId: resourceCandidateIdentity(candidate) };
}

function compareCandidateRecords(left: CandidateRecord, right: CandidateRecord): number {
  return left.resourceId.localeCompare(right.resourceId);
}

function groupBy<T>(values: readonly T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), value]);
  }
  return groups;
}

function canonicalCycle(cycle: string[]): string {
  if (cycle.length === 0) {
    return "";
  }
  const rotations = cycle.map((_, index) => [...cycle.slice(index), ...cycle.slice(0, index)]);
  rotations.sort((left, right) => left.join(" -> ").localeCompare(right.join(" -> ")));
  return rotations[0].join(" -> ");
}
