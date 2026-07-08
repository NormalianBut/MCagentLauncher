export const RESOURCE_TYPES = ["mod", "resourcepack", "shaderpack"] as const;
export const VERSION_TYPES = ["release", "beta", "alpha"] as const;
export const SIDE_SUPPORT = ["required", "optional", "unsupported", "unknown"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type VersionType = (typeof VERSION_TYPES)[number];
export type SideSupport = (typeof SIDE_SUPPORT)[number];

export interface ResourceFile {
  filename: string;
  size: number | null;
  primary: boolean;
  hashes: Record<string, string>;
  downloadUrl: string | null;
}

export interface ResourceDependency {
  projectId: string | null;
  versionId: string | null;
  dependencyType: "required" | "optional" | "incompatible" | "embedded" | string;
}

export interface ResourceResolverMetadata {
  query: string;
  reason: string;
  needsVerification: boolean;
  sourceAlias: string;
}

export interface ResourceCandidate {
  source: "modrinth";
  projectId: string;
  versionId: string | null;
  slug: string;
  title: string;
  description: string;
  resourceType: ResourceType;
  loaders: string[];
  gameVersions: string[];
  versionType: VersionType | string;
  files: ResourceFile[];
  dependencies: ResourceDependency[];
  hashes: Record<string, string>;
  downloadUrl: string | null;
  clientSide: SideSupport;
  serverSide: SideSupport;
  metadataChecked: boolean;
  warnings: string[];
  resolver?: ResourceResolverMetadata;
}
