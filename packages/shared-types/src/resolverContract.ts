import type {
  ResourceCandidate,
  ResourceProviderId,
  ResourceType,
} from "./resource.ts";

export const PROVIDER_OPERATIONS = [
  "search",
  "project-metadata",
  "version-metadata",
  "compatibility-metadata",
  "dependency-metadata",
  "file-hash-metadata",
] as const;

export type ProviderOperation = (typeof PROVIDER_OPERATIONS)[number];
export type ProviderStage = "initial" | "future";
export type ProviderImplementationStatus = "existing-adapter" | "contract-only" | "future";
export type ResolverNetworkPolicy = "offline" | "metadata-only";

export interface ProviderCapability {
  provider: ResourceProviderId;
  displayName: string;
  stage: ProviderStage;
  implementationStatus: ProviderImplementationStatus;
  operations: readonly ProviderOperation[];
  authentication: "none" | "optional" | "required";
  metadataOnly: true;
  canDownload: false;
  canUpload: false;
  canAccessFilesystem: false;
  canExecute: false;
  emitsTelemetry: false;
}

export const PROVIDER_CAPABILITIES: readonly ProviderCapability[] = [
  {
    provider: "modrinth",
    displayName: "Modrinth",
    stage: "initial",
    implementationStatus: "existing-adapter",
    operations: PROVIDER_OPERATIONS,
    authentication: "none",
    metadataOnly: true,
    canDownload: false,
    canUpload: false,
    canAccessFilesystem: false,
    canExecute: false,
    emitsTelemetry: false,
  },
  {
    provider: "github-releases",
    displayName: "GitHub Releases",
    stage: "initial",
    implementationStatus: "contract-only",
    operations: ["project-metadata", "version-metadata", "file-hash-metadata"],
    authentication: "optional",
    metadataOnly: true,
    canDownload: false,
    canUpload: false,
    canAccessFilesystem: false,
    canExecute: false,
    emitsTelemetry: false,
  },
  {
    provider: "mcmod",
    displayName: "MC百科 Metadata",
    stage: "initial",
    implementationStatus: "contract-only",
    operations: ["search", "project-metadata", "compatibility-metadata"],
    authentication: "none",
    metadataOnly: true,
    canDownload: false,
    canUpload: false,
    canAccessFilesystem: false,
    canExecute: false,
    emitsTelemetry: false,
  },
  {
    provider: "curseforge",
    displayName: "CurseForge",
    stage: "future",
    implementationStatus: "future",
    operations: [],
    authentication: "required",
    metadataOnly: true,
    canDownload: false,
    canUpload: false,
    canAccessFilesystem: false,
    canExecute: false,
    emitsTelemetry: false,
  },
];

export interface ResourceProviderHint {
  provider: ResourceProviderId;
  projectId: string | null;
  slug: string | null;
  query: string;
}

export interface ResourceRequirement {
  requirementId: string;
  canonicalName: string;
  resourceType: ResourceType;
  minecraftVersion: string;
  loader: string;
  required: boolean;
  tags: readonly string[];
  reason: string;
  providerHints: readonly ResourceProviderHint[];
}

export interface ResourceResolutionRequest {
  schemaVersion: "0.1.0";
  requirements: readonly ResourceRequirement[];
  allowedProviders: readonly ResourceProviderId[];
  riskPreference: "stable" | "experimental";
  networkPolicy: ResolverNetworkPolicy;
}

export type ResolverIssueCode =
  | "PROVIDER_UNAVAILABLE"
  | "UNSUPPORTED_OPERATION"
  | "PROJECT_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "MINECRAFT_VERSION_MISMATCH"
  | "LOADER_MISMATCH"
  | "AMBIGUOUS_MATCH"
  | "METADATA_INCOMPLETE"
  | "RATE_LIMITED";

export interface ResolverIssue {
  code: ResolverIssueCode;
  severity: "warning" | "error";
  message: string;
  provider: ResourceProviderId | null;
  requirementId: string | null;
}

export interface ResolvedResourceMatch {
  requirementId: string;
  candidate: ResourceCandidate<ResourceProviderId>;
  confidence: number;
  compatibility: "compatible" | "incomplete" | "incompatible";
}

export interface ResolverDiagnostics {
  providersConsulted: readonly ResourceProviderId[];
  issues: readonly ResolverIssue[];
  networkUsed: boolean;
  downloadPerformed: false;
  uploadPerformed: false;
  filesystemAccessed: false;
  executionPerformed: false;
  telemetryEmitted: false;
}

export interface ResourceResolutionResult {
  schemaVersion: "0.1.0";
  matches: readonly ResolvedResourceMatch[];
  diagnostics: ResolverDiagnostics;
}

export interface ProviderResolutionRequest {
  schemaVersion: "0.1.0";
  requirements: readonly ResourceRequirement[];
  riskPreference: "stable" | "experimental";
  networkPolicy: ResolverNetworkPolicy;
}

export interface ProviderResolutionResult {
  provider: ResourceProviderId;
  matches: readonly ResolvedResourceMatch[];
  issues: readonly ResolverIssue[];
  networkUsed: boolean;
}

export interface MetadataProvider {
  readonly capability: ProviderCapability;
  resolve(request: ProviderResolutionRequest): Promise<ProviderResolutionResult>;
}

export interface ResourceResolver {
  resolve(request: ResourceResolutionRequest): Promise<ResourceResolutionResult>;
}

export function getProviderCapability(provider: ResourceProviderId): ProviderCapability | null {
  return PROVIDER_CAPABILITIES.find((capability) => capability.provider === provider) ?? null;
}

export function resourceCandidateIdentity(
  candidate: Pick<ResourceCandidate<ResourceProviderId>, "source" | "projectId" | "versionId">,
): string {
  return [candidate.source, candidate.projectId, candidate.versionId ?? "unresolved"].join(":");
}
