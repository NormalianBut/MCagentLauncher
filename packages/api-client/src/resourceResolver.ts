import type { ResourceCandidate } from "../../shared-types/src/resource.ts";
import type { ResolverQuery } from "../../shared-types/src/resolver.ts";

import {
  ModrinthApiError,
  ModrinthNotFoundError,
  getProjectVersions,
  normalizeModrinthVersionToCandidate,
  searchProjects,
  selectBestVersion,
  type ModrinthClientOptions,
} from "./modrinth.ts";

export interface ResourceResolverMessage {
  code: string;
  message: string;
}

export interface ResolveModrinthCandidateOptions extends ModrinthClientOptions {
  preference?: "stable" | "experimental";
}

export interface ResolvedResourceCandidate {
  query: ResolverQuery;
  candidate: ResourceCandidate | null;
  warnings: ResourceResolverMessage[];
  errors: ResourceResolverMessage[];
}

export interface ResolvedResourceCandidates {
  candidates: ResourceCandidate[];
  results: ResolvedResourceCandidate[];
  warnings: ResourceResolverMessage[];
  errors: ResourceResolverMessage[];
}

export async function resolveModrinthCandidate(
  query: ResolverQuery,
  options: ResolveModrinthCandidateOptions = {},
): Promise<ResolvedResourceCandidate> {
  const warnings: ResourceResolverMessage[] = [];
  const errors: ResourceResolverMessage[] = [];

  if (query.source === "curseforge" || query.source === "github") {
    return {
      query,
      candidate: null,
      warnings: [
        {
          code: "UNSUPPORTED_SOURCE",
          message: `${query.source} resolver is not implemented in v0.1 metadata resolver.`,
        },
      ],
      errors,
    };
  }

  const minecraftVersion = query.gameVersions[0];
  const loader = query.loaders[0];
  if (!minecraftVersion || !loader) {
    return {
      query,
      candidate: null,
      warnings,
      errors: [
        {
          code: "MISSING_RESOLUTION_CONTEXT",
          message: "Resolver query must include at least one Minecraft version and one loader.",
        },
      ],
    };
  }

  if (query.needsVerification) {
    warnings.push({
      code: "NEEDS_VERIFICATION",
      message: `${query.canonicalName} came from alias data marked as needing verification.`,
    });
  }

  try {
    const preference = options.preference ?? query.riskPreference;
    const resolved = query.projectId || query.slug
      ? await resolveByKnownIdentifier(query, minecraftVersion, loader, preference, options)
      : await resolveBySearch(query, minecraftVersion, loader, preference, options, warnings);

    const candidate = attachResolverMetadata(resolved, query);
    warnings.push(
      ...candidate.warnings.map((message) => ({
        code: warningCodeFor(message),
        message,
      })),
    );

    return {
      query,
      candidate,
      warnings,
      errors,
    };
  } catch (error) {
    errors.push(classifyResolverError(error, query, minecraftVersion, loader));
    return {
      query,
      candidate: null,
      warnings,
      errors,
    };
  }
}

export async function resolveModrinthCandidates(
  queries: ResolverQuery[],
  options: ResolveModrinthCandidateOptions = {},
): Promise<ResolvedResourceCandidates> {
  const results: ResolvedResourceCandidate[] = [];
  const candidates: ResourceCandidate[] = [];

  for (const query of queries) {
    const result = await resolveModrinthCandidate(query, options);
    results.push(result);
    if (result.candidate) {
      candidates.push(result.candidate);
    }
  }

  return {
    candidates,
    results,
    warnings: results.flatMap((result) => result.warnings),
    errors: results.flatMap((result) => result.errors),
  };
}

async function resolveByKnownIdentifier(
  query: ResolverQuery,
  minecraftVersion: string,
  loader: string,
  preference: "stable" | "experimental",
  options: ResolveModrinthCandidateOptions,
): Promise<ResourceCandidate> {
  const identifier = query.projectId ?? query.slug;
  if (!identifier) {
    throw new ModrinthNotFoundError(`No Modrinth project id or slug is available for ${query.canonicalName}`);
  }

  const versions = await getProjectVersions(identifier, {
    ...options,
    minecraftVersion,
    loader,
  });
  const version = selectResolverVersion(versions, minecraftVersion, loader, preference);
  return normalizeModrinthVersionToCandidate(version);
}

async function resolveBySearch(
  query: ResolverQuery,
  minecraftVersion: string,
  loader: string,
  preference: "stable" | "experimental",
  options: ResolveModrinthCandidateOptions,
  warnings: ResourceResolverMessage[],
): Promise<ResourceCandidate> {
  const hits = await searchProjects(query.query, [[`project_type:${query.resourceType}`]], options);
  const project = selectSearchProject(hits, query, warnings);
  const projectId = readString(project, "project_id") ?? readString(project, "id") ?? readString(project, "slug");
  if (!projectId) {
    throw new ModrinthNotFoundError(`Search result for ${query.query} did not include a usable project identifier`);
  }

  const versions = await getProjectVersions(projectId, {
    ...options,
    minecraftVersion,
    loader,
  });
  const version = selectResolverVersion(versions, minecraftVersion, loader, preference);
  return normalizeModrinthVersionToCandidate(version, project);
}

class ResolverCompatibilityError extends Error {
  readonly code: "LOADER_MISMATCH" | "MINECRAFT_VERSION_MISMATCH";

  constructor(code: "LOADER_MISMATCH" | "MINECRAFT_VERSION_MISMATCH", message: string) {
    super(message);
    this.name = "ResolverCompatibilityError";
    this.code = code;
  }
}

function selectResolverVersion(
  versions: unknown[],
  minecraftVersion: string,
  loader: string,
  preference: "stable" | "experimental",
): any {
  const matchingMinecraftVersions = versions.filter((version) =>
    readStringArray(version, "game_versions").includes(minecraftVersion),
  );
  const hasMinecraftVersion = matchingMinecraftVersions.length > 0;
  if (!hasMinecraftVersion) {
    throw new ResolverCompatibilityError(
      "MINECRAFT_VERSION_MISMATCH",
      `No returned Modrinth version lists Minecraft ${minecraftVersion}.`,
    );
  }

  const hasLoader = matchingMinecraftVersions.some((version) => readStringArray(version, "loaders").includes(loader));
  if (!hasLoader) {
    throw new ResolverCompatibilityError(
      "LOADER_MISMATCH",
      `No returned Modrinth version lists loader ${loader}.`,
    );
  }

  return selectBestVersion(versions, minecraftVersion, loader, preference);
}

function selectSearchProject(
  hits: unknown[],
  query: ResolverQuery,
  warnings: ResourceResolverMessage[],
): any {
  const normalizedQuery = normalizeText(query.query);
  const exact = hits.find((hit) => {
    const slug = readString(hit, "slug");
    const title = readString(hit, "title");
    const projectId = readString(hit, "project_id") ?? readString(hit, "id");
    return [slug, title, projectId].some((value) => value && normalizeText(value) === normalizedQuery);
  });

  if (exact) {
    if (hits.length > 1) {
      warnings.push({
        code: "AMBIGUOUS_SEARCH_RESULT",
        message: `Multiple Modrinth projects matched ${query.query}; selected exact match.`,
      });
    }
    return exact;
  }

  if (hits.length > 1) {
    warnings.push({
      code: "AMBIGUOUS_SEARCH_RESULT",
      message: `Multiple Modrinth projects matched ${query.query}; selected the first search result.`,
    });
  } else {
    warnings.push({
      code: "SEARCH_FALLBACK_USED",
      message: `Resolved ${query.canonicalName} by Modrinth search because no project id or slug was provided.`,
    });
  }

  return hits[0];
}

function attachResolverMetadata(candidate: ResourceCandidate, query: ResolverQuery): ResourceCandidate {
  return {
    ...candidate,
    warnings: [...candidate.warnings],
    resolver: {
      query: query.query,
      reason: query.reason,
      needsVerification: query.needsVerification,
      sourceAlias: query.sourceAlias,
    },
  };
}

function classifyResolverError(
  error: unknown,
  query: ResolverQuery,
  minecraftVersion: string,
  loader: string,
): ResourceResolverMessage {
  if (error instanceof ModrinthApiError) {
    if (error.status === 429) {
      return {
        code: "RATE_LIMIT",
        message: error.retryAfter
          ? `Modrinth rate limit exceeded; retry after ${error.retryAfter} seconds.`
          : "Modrinth rate limit exceeded.",
      };
    }
    return {
      code: "MODRINTH_HTTP_ERROR",
      message: error.message,
    };
  }

  if (error instanceof ResolverCompatibilityError) {
    return {
      code: error.code,
      message: `${error.message} Resource: ${query.canonicalName}.`,
    };
  }

  if (error instanceof ModrinthNotFoundError) {
    const message = error.message.toLowerCase();
    if (message.includes("compatible") || message.includes("alpha versions")) {
      return {
        code: "VERSION_NOT_FOUND",
        message: `No compatible Modrinth version found for ${query.canonicalName} on Minecraft ${minecraftVersion} with ${loader}.`,
      };
    }
    if (message.includes("projects found")) {
      return {
        code: "PROJECT_NOT_FOUND",
        message: `No Modrinth project found for ${query.query}.`,
      };
    }
    return {
      code: "VERSION_NOT_FOUND",
      message: error.message,
    };
  }

  return {
    code: "RESOLVER_ERROR",
    message: error instanceof Error ? error.message : "Unknown resolver error.",
  };
}

function warningCodeFor(message: string): string {
  if (/beta/i.test(message)) {
    return "BETA_VERSION_SELECTED";
  }
  if (/alpha|experimental/i.test(message)) {
    return "ALPHA_VERSION_SELECTED";
  }
  return "MODRINTH_VERSION_WARNING";
}

function readString(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record[key] === "string" ? record[key] : null;
}

function readStringArray(value: unknown, key: string): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record[key]) ? record[key].filter((item): item is string => typeof item === "string") : [];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
