import type { CompatibilityAnalysisResult, CompatibilityTarget } from "../../shared-types/src/compatibility.ts";
import type { ResourceResolutionRequest, ResourceResolutionResult, ResourceResolver } from "../../shared-types/src/resolverContract.ts";
import { analyzeCompatibility, type CompatibilityAnalyzerOptions } from "./compatibilityAnalyzer.ts";

export interface ResolveAndAnalyzeMetadataResult {
  resolution: ResourceResolutionResult;
  compatibility: CompatibilityAnalysisResult;
}

export async function resolveAndAnalyzeMetadata(
  resolver: ResourceResolver,
  request: ResourceResolutionRequest,
  target: CompatibilityTarget,
  analyzerOptions: CompatibilityAnalyzerOptions = {},
): Promise<ResolveAndAnalyzeMetadataResult> {
  const resolution = await resolver.resolve(request);
  const candidates = resolution.matches.map((match) => match.candidate);
  return {
    resolution,
    compatibility: analyzeCompatibility(candidates, target, analyzerOptions),
  };
}
