import type { ResourceCandidate } from "../../../shared-types/src/resource.ts";
import {
  getProviderCapability,
  type MetadataProvider,
  type ProviderCapability,
  type ProviderResolutionRequest,
  type ProviderResolutionResult,
  type ResolvedResourceMatch,
  type ResolverIssue,
  type ResourceRequirement,
} from "../../../shared-types/src/resolverContract.ts";
import {
  getProject,
  getProjectVersions,
  ModrinthApiError,
  ModrinthNotFoundError,
  normalizeModrinthVersionToCandidate,
  searchProjects,
  selectBestVersion,
  type ModrinthClientOptions,
} from "../modrinth.ts";
import {
  ModrinthMetadataValidationError,
  parseModrinthProjectMetadata,
  parseModrinthVersionMetadata,
  type ModrinthProjectMetadata,
  type ModrinthVersionMetadata,
} from "./modrinthContracts.ts";

export interface ModrinthMetadataProviderOptions extends ModrinthClientOptions {}

interface RequirementResolution {
  match: ResolvedResourceMatch | null;
  issues: ResolverIssue[];
}

export class ModrinthMetadataProvider implements MetadataProvider {
  readonly capability: ProviderCapability;
  readonly #options: ModrinthMetadataProviderOptions;

  constructor(options: ModrinthMetadataProviderOptions = {}) {
    const capability = getProviderCapability("modrinth");
    if (!capability) {
      throw new Error("Modrinth provider capability is not registered in shared contracts.");
    }
    this.capability = capability;
    this.#options = options;
  }

  async resolve(request: ProviderResolutionRequest): Promise<ProviderResolutionResult> {
    if (request.networkPolicy !== "metadata-only") {
      return {
        provider: "modrinth",
        matches: [],
        issues: [{
          code: "PROVIDER_UNAVAILABLE",
          severity: "warning",
          message: "Modrinth metadata access is disabled by the offline network policy.",
          provider: "modrinth",
          requirementId: null,
        }],
        networkUsed: false,
      };
    }

    const matches: ResolvedResourceMatch[] = [];
    const issues: ResolverIssue[] = [];
    let networkUsed = false;

    for (const requirement of request.requirements) {
      networkUsed = true;
      const resolution = await this.#resolveRequirement(requirement, request.riskPreference);
      issues.push(...resolution.issues);
      if (resolution.match) {
        matches.push(resolution.match);
      }
    }

    return {
      provider: "modrinth",
      matches,
      issues,
      networkUsed,
    };
  }

  async #resolveRequirement(
    requirement: ResourceRequirement,
    riskPreference: "stable" | "experimental",
  ): Promise<RequirementResolution> {
    const issues: ResolverIssue[] = [];
    let project: ModrinthProjectMetadata;
    let confidence: number;

    try {
      const selected = await this.#resolveProject(requirement);
      project = selected.project;
      confidence = selected.confidence;
      issues.push(...selected.issues);
    } catch (error) {
      return { match: null, issues: [issueFromError(error, requirement.requirementId, "project")] };
    }

    let rawVersions: unknown[];
    try {
      rawVersions = await getProjectVersions(project.project_id, {
        ...this.#options,
        minecraftVersion: requirement.minecraftVersion,
        loader: requirement.loader,
      });
    } catch (error) {
      return { match: null, issues: [...issues, issueFromError(error, requirement.requirementId, "version")] };
    }

    const versions: ModrinthVersionMetadata[] = [];
    for (const rawVersion of rawVersions) {
      try {
        versions.push(parseModrinthVersionMetadata(rawVersion));
      } catch (error) {
        issues.push(issueFromError(error, requirement.requirementId, "version"));
      }
    }
    if (versions.length === 0) {
      return { match: null, issues };
    }

    const gameCompatible = versions.filter((version) => version.game_versions.includes(requirement.minecraftVersion));
    if (gameCompatible.length === 0) {
      issues.push(issue(
        "MINECRAFT_VERSION_MISMATCH",
        "error",
        `No valid Modrinth version declares Minecraft ${requirement.minecraftVersion}.`,
        requirement.requirementId,
      ));
      return { match: null, issues };
    }

    const loaderCompatible = gameCompatible.filter((version) => version.loaders.includes(requirement.loader));
    if (loaderCompatible.length === 0) {
      issues.push(issue(
        "LOADER_MISMATCH",
        "error",
        `No valid Modrinth version declares loader ${requirement.loader}.`,
        requirement.requirementId,
      ));
      return { match: null, issues };
    }

    let selectedVersion: ModrinthVersionMetadata;
    try {
      selectedVersion = selectBestVersion(
        loaderCompatible,
        requirement.minecraftVersion,
        requirement.loader,
        riskPreference,
      ) as ModrinthVersionMetadata;
    } catch (error) {
      issues.push(issueFromError(error, requirement.requirementId, "version"));
      return { match: null, issues };
    }

    const candidate = normalizeModrinthVersionToCandidate(selectedVersion, project);
    candidate.resolver = {
      query: modrinthHint(requirement)?.query ?? requirement.canonicalName,
      reason: requirement.reason,
      needsVerification: false,
      sourceAlias: requirement.canonicalName,
    };

    const metadataIncomplete = candidate.files.length === 0 || Object.keys(candidate.hashes).length === 0;
    if (metadataIncomplete) {
      issues.push(issue(
        "METADATA_INCOMPLETE",
        "warning",
        `Modrinth metadata for ${requirement.canonicalName} has no selectable file or known primary-file hash.`,
        requirement.requirementId,
      ));
    }

    return {
      match: {
        requirementId: requirement.requirementId,
        candidate: candidate as ResourceCandidate<"modrinth">,
        confidence,
        compatibility: metadataIncomplete ? "incomplete" : "compatible",
      },
      issues,
    };
  }

  async #resolveProject(requirement: ResourceRequirement): Promise<{
    project: ModrinthProjectMetadata;
    confidence: number;
    issues: ResolverIssue[];
  }> {
    const hint = modrinthHint(requirement);
    const identifier = hint?.projectId ?? hint?.slug;
    if (identifier) {
      return {
        project: parseModrinthProjectMetadata(await getProject(identifier, this.#options)),
        confidence: 1,
        issues: [],
      };
    }

    const query = hint?.query || requirement.canonicalName;
    const hits = await searchProjects(query, [[`project_type:${requirement.resourceType}`]], this.#options);
    const projects = hits.map(parseModrinthProjectMetadata);
    const normalizedQuery = normalizeText(query);
    const sorted = [...projects].sort((left, right) => {
      const leftExact = isExactProjectMatch(left, normalizedQuery) ? 0 : 1;
      const rightExact = isExactProjectMatch(right, normalizedQuery) ? 0 : 1;
      return leftExact - rightExact || left.project_id.localeCompare(right.project_id);
    });
    const project = sorted[0];
    if (!project) {
      throw new ModrinthNotFoundError(`No valid Modrinth project metadata found for ${query}.`);
    }
    const exact = isExactProjectMatch(project, normalizedQuery);
    return {
      project,
      confidence: exact ? 0.95 : 0.65,
      issues: sorted.length > 1 ? [issue(
        "AMBIGUOUS_MATCH",
        "warning",
        `Multiple Modrinth projects matched ${query}; selected a deterministic ${exact ? "exact" : "fallback"} match.`,
        requirement.requirementId,
      )] : [],
    };
  }
}

function modrinthHint(requirement: ResourceRequirement) {
  return requirement.providerHints.find((hint) => hint.provider === "modrinth");
}

function isExactProjectMatch(project: ModrinthProjectMetadata, normalizedQuery: string): boolean {
  return [project.project_id, project.slug, project.title]
    .some((value) => normalizeText(value) === normalizedQuery);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function issueFromError(
  error: unknown,
  requirementId: string,
  stage: "project" | "version",
): ResolverIssue {
  if (error instanceof ModrinthMetadataValidationError) {
    return issue("INVALID_METADATA", "error", error.message, requirementId);
  }
  if (error instanceof ModrinthApiError) {
    if (error.status === 429) {
      const retry = error.retryAfter ? ` Retry after ${error.retryAfter} seconds.` : "";
      return issue("RATE_LIMITED", "error", `Modrinth rate limit exceeded.${retry}`, requirementId);
    }
    if (error.status === 404) {
      return issue(
        stage === "project" ? "PROJECT_NOT_FOUND" : "VERSION_NOT_FOUND",
        "error",
        error.message,
        requirementId,
      );
    }
    return issue("PROVIDER_UNAVAILABLE", "error", error.message, requirementId);
  }
  if (error instanceof ModrinthNotFoundError) {
    return issue(
      stage === "project" ? "PROJECT_NOT_FOUND" : "VERSION_NOT_FOUND",
      "error",
      error.message,
      requirementId,
    );
  }
  return issue(
    "PROVIDER_UNAVAILABLE",
    "error",
    error instanceof Error ? error.message : "Unknown Modrinth provider failure.",
    requirementId,
  );
}

function issue(
  code: ResolverIssue["code"],
  severity: ResolverIssue["severity"],
  message: string,
  requirementId: string | null,
): ResolverIssue {
  return { code, severity, message, provider: "modrinth", requirementId };
}
