import type {
  ResourceCandidate,
  ResourceDependency,
  ResourceFile,
  ResourceType,
  SideSupport,
  VersionType,
} from "../../shared-types/src/resource.ts";

export const MODRINTH_USER_AGENT =
  "MCagentlauncher/0.1.0 (https://github.com/NormalianBut/MCagentLauncher)";

const DEFAULT_BASE_URL = "https://api.modrinth.com/v2";

export interface ModrinthClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  userAgent?: string;
}

export interface VersionQueryOptions {
  minecraftVersion?: string;
  loader?: string;
  featured?: boolean;
}

export interface ResolveProjectVersionOptions extends ModrinthClientOptions {
  preference?: "stable" | "experimental";
}

export class ModrinthApiError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(message: string, status: number, retryAfter: string | null = null) {
    super(message);
    this.name = "ModrinthApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export class ModrinthNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModrinthNotFoundError";
  }
}

export async function searchProjects(
  query: string,
  facets: unknown[] = [],
  options: ModrinthClientOptions = {},
): Promise<unknown[]> {
  const params = new URLSearchParams({ query });
  if (facets.length > 0) {
    params.set("facets", JSON.stringify(facets));
  }

  const body = await requestJson(`/search?${params.toString()}`, options);
  const hits = readArray(body, "hits");
  if (hits.length === 0) {
    throw new ModrinthNotFoundError(`No Modrinth projects found for query: ${query}`);
  }
  return hits;
}

export async function getProjectVersions(
  projectId: string,
  options: VersionQueryOptions & ModrinthClientOptions = {},
): Promise<unknown[]> {
  const params = new URLSearchParams();
  if (options.minecraftVersion) {
    params.set("game_versions", JSON.stringify([options.minecraftVersion]));
  }
  if (options.loader) {
    params.set("loaders", JSON.stringify([options.loader]));
  }
  if (options.featured !== undefined) {
    params.set("featured", String(options.featured));
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const versions = await requestJson(`/project/${encodeURIComponent(projectId)}/version${suffix}`, options);
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new ModrinthNotFoundError(`No Modrinth versions found for project: ${projectId}`);
  }
  return versions;
}

export async function resolveProjectVersion(
  projectId: string,
  minecraftVersion: string,
  loader: string,
  options: ResolveProjectVersionOptions = {},
): Promise<ResourceCandidate> {
  const versions = await getProjectVersions(projectId, {
    ...options,
    minecraftVersion,
    loader,
  });
  const version = selectBestVersion(versions, minecraftVersion, loader, options.preference ?? "stable");
  return normalizeModrinthVersionToCandidate(version);
}

export function normalizeModrinthProjectToCandidate(project: any): ResourceCandidate {
  return {
    source: "modrinth",
    projectId: String(project.project_id ?? project.id ?? ""),
    versionId: null,
    slug: String(project.slug ?? ""),
    title: String(project.title ?? ""),
    description: String(project.description ?? ""),
    resourceType: normalizeResourceType(project.project_type),
    loaders: readStringArray(project, "loaders"),
    gameVersions: readStringArray(project, "game_versions", "versions"),
    versionType: "release",
    files: [],
    dependencies: [],
    hashes: {},
    downloadUrl: null,
    clientSide: normalizeSide(project.client_side),
    serverSide: normalizeSide(project.server_side),
    metadataChecked: true,
    warnings: ["Project metadata has no concrete version or file hash until a version is resolved."],
  };
}

export function normalizeModrinthVersionToCandidate(version: any, project?: any): ResourceCandidate {
  const files = normalizeFiles(version.files);
  const primaryFile = files.find((file) => file.primary) ?? files[0] ?? null;

  return {
    source: "modrinth",
    projectId: String(version.project_id ?? project?.project_id ?? project?.id ?? ""),
    versionId: String(version.id ?? ""),
    slug: String(project?.slug ?? version.project_id ?? ""),
    title: String(project?.title ?? version.name ?? version.version_number ?? ""),
    description: String(version.changelog ?? project?.description ?? ""),
    resourceType: normalizeResourceType(project?.project_type ?? version.project_type ?? "mod"),
    loaders: readStringArray(version, "loaders"),
    gameVersions: readStringArray(version, "game_versions"),
    versionType: normalizeVersionType(version.version_type),
    files,
    dependencies: normalizeDependencies(version.dependencies),
    hashes: primaryFile?.hashes ?? {},
    downloadUrl: primaryFile?.downloadUrl ?? null,
    clientSide: normalizeSide(project?.client_side),
    serverSide: normalizeSide(project?.server_side),
    metadataChecked: true,
    warnings: Array.isArray(version.__mcagentlauncherWarnings) ? version.__mcagentlauncherWarnings : [],
  };
}

export function selectBestVersion(
  versions: unknown[],
  minecraftVersion: string,
  loader: string,
  preference: "stable" | "experimental" = "stable",
): any {
  const compatible = versions
    .filter((version: any) => readStringArray(version, "game_versions").includes(minecraftVersion))
    .filter((version: any) => readStringArray(version, "loaders").includes(loader));

  if (compatible.length === 0) {
    throw new ModrinthNotFoundError(
      `No compatible Modrinth version found for Minecraft ${minecraftVersion} and loader ${loader}`,
    );
  }

  const release = compatible.find((version: any) => version.version_type === "release");
  if (release) {
    return release;
  }

  const beta = compatible.find((version: any) => version.version_type === "beta");
  if (beta) {
    return {
      ...beta,
      __mcagentlauncherWarnings: [
        ...(beta.__mcagentlauncherWarnings ?? []),
        "No release version matched; selected beta for stable preference.",
      ],
    };
  }

  if (preference === "experimental") {
    const alpha = compatible.find((version: any) => version.version_type === "alpha");
    if (alpha) {
      return {
        ...alpha,
        __mcagentlauncherWarnings: [
          ...(alpha.__mcagentlauncherWarnings ?? []),
          "Selected alpha because experimental preference was explicit.",
        ],
      };
    }
  }

  throw new ModrinthNotFoundError("Only alpha versions matched; stable resolution does not select alpha by default");
}

export function getRequiredDependencies(candidate: ResourceCandidate): ResourceDependency[] {
  const seen = new Set<string>();
  const required: ResourceDependency[] = [];

  for (const dependency of candidate.dependencies) {
    if (dependency.dependencyType !== "required") {
      continue;
    }
    const key = dependency.projectId ?? dependency.versionId;
    if (key && seen.has(key)) {
      continue;
    }
    if (key) {
      seen.add(key);
    }
    required.push(dependency);
  }

  return required;
}

async function requestJson(path: string, options: ModrinthClientOptions): Promise<unknown> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new ModrinthApiError("No fetch implementation available", 0);
  }

  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const response = await fetchImpl(new URL(path, baseUrl), {
    headers: {
      "User-Agent": options.userAgent ?? MODRINTH_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (response.status === 429) {
    throw new ModrinthApiError("Modrinth rate limit exceeded", 429, response.headers.get("retry-after"));
  }
  if (!response.ok) {
    throw new ModrinthApiError(`Modrinth API request failed with status ${response.status}`, response.status);
  }

  return response.json();
}

function normalizeFiles(files: unknown): ResourceFile[] {
  if (!Array.isArray(files)) {
    return [];
  }
  return files.map((file: any) => ({
    filename: String(file.filename ?? ""),
    size: typeof file.size === "number" ? file.size : null,
    primary: Boolean(file.primary),
    hashes: isRecord(file.hashes) ? { ...file.hashes } : {},
    downloadUrl: typeof file.url === "string" ? file.url : null,
  }));
}

function normalizeDependencies(dependencies: unknown): ResourceDependency[] {
  if (!Array.isArray(dependencies)) {
    return [];
  }
  return dependencies.map((dependency: any) => ({
    projectId: typeof dependency.project_id === "string" ? dependency.project_id : null,
    versionId: typeof dependency.version_id === "string" ? dependency.version_id : null,
    dependencyType: String(dependency.dependency_type ?? "unknown"),
  }));
}

function normalizeResourceType(value: unknown): ResourceType {
  if (value === "resourcepack" || value === "shaderpack") {
    return value;
  }
  return "mod";
}

function normalizeVersionType(value: unknown): VersionType | string {
  if (value === "release" || value === "beta" || value === "alpha") {
    return value;
  }
  return String(value ?? "unknown");
}

function normalizeSide(value: unknown): SideSupport {
  if (value === "required" || value === "optional" || value === "unsupported") {
    return value;
  }
  return "unknown";
}

function readArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return [];
  }
  return value[key];
}

function readStringArray(value: unknown, ...keys: string[]): string[] {
  if (!isRecord(value)) {
    return [];
  }
  for (const key of keys) {
    if (Array.isArray(value[key])) {
      return value[key].filter((item): item is string => typeof item === "string");
    }
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
