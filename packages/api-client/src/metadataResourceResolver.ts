import {
  resourceCandidateIdentity,
  type ResourceResolutionRequest,
  type ResourceResolutionResult,
  type ResourceResolver,
  type ResolvedResourceMatch,
  type ResolverIssue,
} from "../../shared-types/src/resolverContract.ts";
import type { MetadataProviderRegistry } from "./providerRegistry.ts";

export class MetadataResourceResolver implements ResourceResolver {
  readonly #registry: MetadataProviderRegistry;

  constructor(registry: MetadataProviderRegistry) {
    this.#registry = registry;
  }

  async resolve(request: ResourceResolutionRequest): Promise<ResourceResolutionResult> {
    const matches: ResolvedResourceMatch[] = [];
    const issues: ResolverIssue[] = [];
    const providersConsulted: ResourceResolutionRequest["allowedProviders"][number][] = [];
    let networkUsed = false;

    for (const providerId of request.allowedProviders) {
      const provider = this.#registry.get(providerId);
      if (!provider) {
        issues.push({
          code: "PROVIDER_UNAVAILABLE",
          severity: "warning",
          message: `No metadata provider adapter is registered for ${providerId}.`,
          provider: providerId,
          requirementId: null,
        });
        continue;
      }

      providersConsulted.push(providerId);
      const result = await provider.resolve({
        schemaVersion: request.schemaVersion,
        requirements: request.requirements,
        riskPreference: request.riskPreference,
        networkPolicy: request.networkPolicy,
      });
      matches.push(...result.matches);
      issues.push(...result.issues);
      networkUsed ||= result.networkUsed;
    }

    return {
      schemaVersion: "0.1.0",
      matches: sortAndDedupeMatches(matches, request),
      diagnostics: {
        providersConsulted,
        issues,
        networkUsed,
        downloadPerformed: false,
        uploadPerformed: false,
        filesystemAccessed: false,
        executionPerformed: false,
        telemetryEmitted: false,
      },
    };
  }
}

function sortAndDedupeMatches(
  matches: ResolvedResourceMatch[],
  request: ResourceResolutionRequest,
): ResolvedResourceMatch[] {
  const requirementOrder = new Map(request.requirements.map((requirement, index) => [requirement.requirementId, index]));
  const providerOrder = new Map(request.allowedProviders.map((provider, index) => [provider, index]));
  const compatibilityOrder = { compatible: 0, incomplete: 1, incompatible: 2 } as const;
  const sorted = [...matches].sort((left, right) =>
    (requirementOrder.get(left.requirementId) ?? Number.MAX_SAFE_INTEGER)
      - (requirementOrder.get(right.requirementId) ?? Number.MAX_SAFE_INTEGER)
    || compatibilityOrder[left.compatibility] - compatibilityOrder[right.compatibility]
    || right.confidence - left.confidence
    || (providerOrder.get(left.candidate.source) ?? Number.MAX_SAFE_INTEGER)
      - (providerOrder.get(right.candidate.source) ?? Number.MAX_SAFE_INTEGER)
    || resourceCandidateIdentity(left.candidate).localeCompare(resourceCandidateIdentity(right.candidate))
  );

  const seen = new Set<string>();
  return sorted.filter((match) => {
    const identity = `${match.requirementId}:${resourceCandidateIdentity(match.candidate)}`;
    if (seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
}
