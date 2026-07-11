import type { ResourceType, SideSupport, VersionType } from "../../../shared-types/src/resource.ts";

export interface ModrinthProjectMetadata {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  project_type: ResourceType;
  client_side: SideSupport;
  server_side: SideSupport;
}

export interface ModrinthFileMetadata {
  filename: string;
  size: number | null;
  primary: boolean;
  url: string;
  hashes: Record<string, string>;
}

export interface ModrinthDependencyMetadata {
  project_id: string | null;
  version_id: string | null;
  dependency_type: string;
}

export interface ModrinthVersionMetadata {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type: VersionType;
  loaders: string[];
  game_versions: string[];
  files: ModrinthFileMetadata[];
  dependencies: ModrinthDependencyMetadata[];
}

export class ModrinthMetadataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModrinthMetadataValidationError";
  }
}

export function parseModrinthProjectMetadata(value: unknown): ModrinthProjectMetadata {
  const record = requireRecord(value, "project");
  const projectId = readRequiredString(record, ["project_id", "id"], "project.project_id");
  const projectType = readRequiredString(record, ["project_type"], "project.project_type");
  if (!isResourceType(projectType)) {
    throw new ModrinthMetadataValidationError(`Unsupported Modrinth project type: ${projectType}`);
  }

  return {
    project_id: projectId,
    slug: readRequiredString(record, ["slug"], "project.slug"),
    title: readRequiredString(record, ["title"], "project.title"),
    description: readOptionalString(record.description),
    project_type: projectType,
    client_side: normalizeSide(record.client_side),
    server_side: normalizeSide(record.server_side),
  };
}

export function parseModrinthVersionMetadata(value: unknown): ModrinthVersionMetadata {
  const record = requireRecord(value, "version");
  const versionType = readRequiredString(record, ["version_type"], "version.version_type");
  if (!isVersionType(versionType)) {
    throw new ModrinthMetadataValidationError(`Unsupported Modrinth version type: ${versionType}`);
  }
  if (!Array.isArray(record.files)) {
    throw new ModrinthMetadataValidationError("Modrinth version.files must be an array.");
  }

  return {
    id: readRequiredString(record, ["id"], "version.id"),
    project_id: readRequiredString(record, ["project_id"], "version.project_id"),
    name: readOptionalString(record.name),
    version_number: readOptionalString(record.version_number),
    version_type: versionType,
    loaders: readStringArray(record.loaders, "version.loaders"),
    game_versions: readStringArray(record.game_versions, "version.game_versions"),
    files: record.files.map((file, index) => parseFile(file, index)),
    dependencies: Array.isArray(record.dependencies)
      ? record.dependencies.map((dependency, index) => parseDependency(dependency, index))
      : [],
  };
}

function parseFile(value: unknown, index: number): ModrinthFileMetadata {
  const record = requireRecord(value, `version.files[${index}]`);
  return {
    filename: readRequiredString(record, ["filename"], `version.files[${index}].filename`),
    size: typeof record.size === "number" && Number.isFinite(record.size) ? record.size : null,
    primary: record.primary === true,
    url: readRequiredString(record, ["url"], `version.files[${index}].url`),
    hashes: readHashes(record.hashes, `version.files[${index}].hashes`),
  };
}

function parseDependency(value: unknown, index: number): ModrinthDependencyMetadata {
  const record = requireRecord(value, `version.dependencies[${index}]`);
  return {
    project_id: readNullableString(record.project_id),
    version_id: readNullableString(record.version_id),
    dependency_type: readRequiredString(
      record,
      ["dependency_type"],
      `version.dependencies[${index}].dependency_type`,
    ),
  };
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ModrinthMetadataValidationError(`Modrinth ${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function readRequiredString(record: Record<string, unknown>, keys: string[], path: string): string {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key].trim().length > 0) {
      return record[key].trim();
    }
  }
  throw new ModrinthMetadataValidationError(`Modrinth ${path} must be a non-empty string.`);
}

function readOptionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ModrinthMetadataValidationError(`Modrinth ${path} must be a string array.`);
  }
  return [...value];
}

function readHashes(value: unknown, path: string): Record<string, string> {
  const record = requireRecord(value, path);
  const hashes: Record<string, string> = {};
  for (const [algorithm, hash] of Object.entries(record)) {
    if (typeof hash !== "string" || hash.length === 0) {
      throw new ModrinthMetadataValidationError(`Modrinth ${path}.${algorithm} must be a non-empty string.`);
    }
    hashes[algorithm] = hash;
  }
  return hashes;
}

function normalizeSide(value: unknown): SideSupport {
  return value === "required" || value === "optional" || value === "unsupported" ? value : "unknown";
}

function isResourceType(value: string): value is ResourceType {
  return value === "mod" || value === "resourcepack" || value === "shaderpack";
}

function isVersionType(value: string): value is VersionType {
  return value === "release" || value === "beta" || value === "alpha";
}
