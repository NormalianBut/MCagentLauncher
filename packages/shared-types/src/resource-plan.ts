import type { ResourceCandidate, ResourceType, VersionType } from "./resource.ts";

export interface ResourcePlanResource {
  resourceId: string;
  type: ResourceType;
  source: "modrinth" | "manual" | "community-rule";
  project: {
    name: string;
    slug: string;
    projectId: string;
  };
  version: {
    versionId: string;
    versionNumber: string;
    releaseType: VersionType;
  };
  required: boolean;
  reason: string;
  compatibility: {
    minecraftVersions: string[];
    loaders: string[];
    side: "client" | "server" | "both";
  };
  verification: {
    metadataChecked: boolean;
    hashKnown: boolean;
    licenseChecked: boolean;
  };
  hashes?: Record<string, string>;
}

export interface ResourcePlanMappingOptions {
  required?: boolean;
  reason: string;
}

export function mapResourceCandidateToPlanResource(
  candidate: ResourceCandidate,
  options: ResourcePlanMappingOptions,
): ResourcePlanResource {
  const hashes = candidate.hashes;
  const hashKnown = Object.keys(hashes).length > 0;

  return {
    resourceId: `res_${sanitizeId(candidate.slug || candidate.projectId)}`,
    type: candidate.resourceType,
    source: candidate.source,
    project: {
      name: candidate.title,
      slug: candidate.slug,
      projectId: candidate.projectId,
    },
    version: {
      versionId: candidate.versionId ?? "unresolved-version",
      versionNumber: candidate.versionId ?? "unresolved",
      releaseType: normalizeReleaseType(candidate.versionType),
    },
    required: options.required ?? false,
    reason: options.reason,
    compatibility: {
      minecraftVersions: candidate.gameVersions,
      loaders: candidate.loaders,
      side: normalizeSide(candidate.clientSide, candidate.serverSide),
    },
    verification: {
      metadataChecked: candidate.metadataChecked,
      hashKnown,
      licenseChecked: false,
    },
    ...(hashKnown ? { hashes: { ...hashes } } : {}),
  };
}

function normalizeReleaseType(versionType: string): VersionType {
  if (versionType === "beta" || versionType === "alpha") {
    return versionType;
  }
  return "release";
}

function normalizeSide(
  clientSide: ResourceCandidate["clientSide"],
  serverSide: ResourceCandidate["serverSide"],
): "client" | "server" | "both" {
  const clientRequired = clientSide === "required" || clientSide === "optional";
  const serverRequired = serverSide === "required" || serverSide === "optional";
  if (clientRequired && serverRequired) {
    return "both";
  }
  if (serverRequired) {
    return "server";
  }
  return "client";
}

function sanitizeId(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  const stable = sanitized.length >= 6 ? sanitized : `${sanitized}_resource`;
  return stable.slice(0, 64);
}
