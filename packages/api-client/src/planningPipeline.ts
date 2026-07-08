import type { AliasEntry, AliasMatch } from "../../shared-types/src/alias.ts";
import {
  buildResourcePlan,
  type ResourcePlan,
} from "../../shared-types/src/plan.ts";
import type { ResourceCandidate } from "../../shared-types/src/resource.ts";
import type { ResolverQuery } from "../../shared-types/src/resolver.ts";

import {
  loadAliasDb,
  resolveAliasesForIntent,
  type IntentLikeForAliases,
} from "./aliasDb.ts";
import {
  buildResolverQueriesForIntent,
  type IntentLikeForResolverQueries,
} from "./resolverQuery.ts";
import {
  resolveModrinthCandidates,
  type ResolvedResourceCandidates,
  type ResourceResolverMessage,
} from "./resourceResolver.ts";

export interface PlanningIntent extends IntentLikeForResolverQueries {
  schemaVersion?: string;
  intentId?: string;
  prompt?: {
    rawText?: string;
    redacted?: boolean;
  };
  locale?: string;
}

export interface PlanningPipelineOptions {
  aliasEntries?: AliasEntry[];
  aliasDbRoot?: string;
  resolver?: PlanningResolver;
  minecraftVersion?: string;
  loader?: "fabric";
  riskPreference?: "stable" | "experimental";
  loaderVersion?: string;
  javaMajorVersion?: 17 | 21;
  enableNetwork?: boolean;
}

export interface PlanningPipelineInput {
  intent: PlanningIntent;
  aliasEntries: AliasEntry[];
  aliasMatches: AliasMatch[];
  resolverQueries: ResolverQuery[];
  minecraftVersion: string;
  loader: "fabric";
  riskPreference: "stable" | "experimental";
  networkAllowed: boolean;
}

export interface PlanningPipelineDiagnostics {
  aliasMatches: AliasMatch[];
  resolverQueries: ResolverQuery[];
  candidatesResolved: number;
  warnings: ResourceResolverMessage[];
  errors: ResourceResolverMessage[];
  networkUsed: boolean;
}

export interface PlanningPipelineResult {
  plan: ResourcePlan;
  diagnostics: PlanningPipelineDiagnostics;
}

export type PlanningResolver = (
  queries: ResolverQuery[],
  options: {
    minecraftVersion: string;
    loader: "fabric";
    riskPreference: "stable" | "experimental";
    enableNetwork: boolean;
  },
) => Promise<ResolvedResourceCandidates>;

export class PlanningPipelineError extends Error {
  readonly diagnostics: PlanningPipelineDiagnostics;

  constructor(message: string, diagnostics: PlanningPipelineDiagnostics) {
    super(message);
    this.name = "PlanningPipelineError";
    this.diagnostics = diagnostics;
  }
}

export async function buildPlanningPipelineInput(
  intent: PlanningIntent,
  options: PlanningPipelineOptions = {},
): Promise<PlanningPipelineInput> {
  const aliasEntries = options.aliasEntries ?? await loadAliasDb({ rootDir: options.aliasDbRoot });
  const normalizedIntent = withPlanningOverrides(intent, options);
  const aliasMatches = resolveAliasesForIntent(normalizedIntent as IntentLikeForAliases, aliasEntries);
  const resolverQueries = buildResolverQueriesForIntent(normalizedIntent, aliasEntries);

  return {
    intent: normalizedIntent,
    aliasEntries,
    aliasMatches,
    resolverQueries,
    minecraftVersion: normalizedIntent.game?.minecraftVersions?.[0] ?? "1.20.1",
    loader: "fabric",
    riskPreference: normalizedIntent.constraints?.requireStableReleases === false ? "experimental" : "stable",
    networkAllowed: options.enableNetwork === true,
  };
}

export async function planResourcesFromIntent(
  intent: PlanningIntent,
  options: PlanningPipelineOptions = {},
): Promise<PlanningPipelineResult> {
  const input = await buildPlanningPipelineInput(intent, options);
  const networkAllowed = options.enableNetwork === true;
  const resolver = options.resolver ?? networkResolver(networkAllowed);
  const resolution = await resolver(input.resolverQueries, {
    minecraftVersion: input.minecraftVersion,
    loader: input.loader,
    riskPreference: input.riskPreference,
    enableNetwork: networkAllowed,
  });

  const diagnostics = buildDiagnostics(input, resolution, networkAllowed && !options.resolver);
  if (resolution.candidates.length === 0) {
    throw new PlanningPipelineError("Planning pipeline could not build a resource-plan without resolved candidates.", diagnostics);
  }

  const plan = buildResourcePlan(
    {
      intentId: input.intent.intentId ?? stableIntentId(input.intent.prompt?.rawText ?? "intent"),
      minecraftVersion: input.minecraftVersion,
      loader: input.loader,
      loaderVersion: options.loaderVersion ?? "unresolved-fabric-loader",
      javaMajorVersion: options.javaMajorVersion ?? defaultJavaMajorVersion(input.minecraftVersion),
      title: "Resolver generated resource plan",
      explanation: "Alias matches and resolver metadata were mapped into a user-reviewable resource plan.",
      estimatedMemoryMb: input.intent.constraints?.maxMemoryMb ?? 4096,
    },
    resolution.candidates,
    {
      requiredProjectIds: requiredProjectIds(resolution),
      dependencyProjectIds: dependencyProjectIds(resolution.candidates),
    },
  );

  mergeDiagnosticsIntoPlan(plan, diagnostics);
  return { plan, diagnostics };
}

function withPlanningOverrides(intent: PlanningIntent, options: PlanningPipelineOptions): PlanningIntent {
  const minecraftVersion = options.minecraftVersion ?? intent.game?.minecraftVersions?.[0] ?? "1.20.1";
  const loader = options.loader ?? "fabric";
  const requireStableReleases = options.riskPreference
    ? options.riskPreference === "stable"
    : intent.constraints?.requireStableReleases ?? true;

  return {
    ...intent,
    intentId: intent.intentId ?? stableIntentId(intent.prompt?.rawText ?? "intent"),
    game: {
      ...intent.game,
      minecraftVersions: [minecraftVersion],
      loader,
    },
    constraints: {
      ...intent.constraints,
      requireStableReleases,
    },
  };
}

function networkResolver(enableNetwork: boolean): PlanningResolver {
  return async (queries, options) => {
    if (!enableNetwork) {
      return {
        candidates: [],
        results: queries.map((query) => ({
          query,
          candidate: null,
          warnings: [
            {
              code: "NETWORK_DISABLED",
              message: "Real Modrinth metadata lookup is disabled by default; pass enableNetwork=true or inject a resolver.",
            },
          ],
          errors: [],
        })),
        warnings: [
          {
            code: "NETWORK_DISABLED",
            message: "Real Modrinth metadata lookup is disabled by default; pass enableNetwork=true or inject a resolver.",
          },
        ],
        errors: [],
      };
    }

    return resolveModrinthCandidates(queries, {
      preference: options.riskPreference,
    });
  };
}

function buildDiagnostics(
  input: PlanningPipelineInput,
  resolution: ResolvedResourceCandidates,
  networkUsed: boolean,
): PlanningPipelineDiagnostics {
  const noCandidateWarnings = resolution.results
    .filter((result) => !result.candidate && result.errors.length === 0)
    .map((result) => ({
      code: "NO_CANDIDATE_FOUND",
      message: `No resource candidate was resolved for ${result.query.canonicalName}.`,
    }));

  const aliasVerificationWarnings = input.aliasMatches
    .filter((match) => match.needsVerification)
    .map((match) => ({
      code: "ALIAS_NEEDS_VERIFICATION",
      message: `${match.canonicalName} alias metadata is marked as needing verification.`,
    }));

  return {
    aliasMatches: input.aliasMatches,
    resolverQueries: input.resolverQueries,
    candidatesResolved: resolution.candidates.length,
    warnings: [
      ...aliasVerificationWarnings,
      ...resolution.warnings,
      ...noCandidateWarnings,
    ],
    errors: resolution.errors,
    networkUsed,
  };
}

function mergeDiagnosticsIntoPlan(plan: ResourcePlan, diagnostics: PlanningPipelineDiagnostics): void {
  const existingWarnings = new Set(plan.ruleResults.warnings.map((warning) => `${warning.code}:${warning.message}`));
  for (const warning of diagnostics.warnings) {
    const key = `${warning.code}:${warning.message}`;
    if (!existingWarnings.has(key)) {
      plan.ruleResults.warnings.push(warning);
      existingWarnings.add(key);
    }
  }

  const existingErrors = new Set(plan.ruleResults.errors.map((error) => `${error.code}:${error.message}`));
  for (const error of diagnostics.errors) {
    const key = `${error.code}:${error.message}`;
    if (!existingErrors.has(key)) {
      plan.ruleResults.errors.push(error);
      existingErrors.add(key);
    }
  }

  if (plan.ruleResults.warnings.length > 0 || plan.ruleResults.errors.length > 0) {
    plan.summary.riskLevel = plan.ruleResults.errors.length > 0 ? "high" : "medium";
  }
}

function requiredProjectIds(resolution: ResolvedResourceCandidates): string[] {
  return resolution.results
    .filter((result) => result.query.required && result.candidate)
    .map((result) => result.candidate?.projectId)
    .filter((projectId): projectId is string => typeof projectId === "string");
}

function dependencyProjectIds(candidates: ResourceCandidate[]): string[] {
  const ids = new Set<string>();
  for (const candidate of candidates) {
    for (const dependency of candidate.dependencies) {
      if (dependency.dependencyType === "required" && dependency.projectId) {
        ids.add(dependency.projectId);
      }
    }
  }
  return [...ids];
}

function defaultJavaMajorVersion(minecraftVersion: string): 17 | 21 {
  const [, minorText, patchText = "0"] = minecraftVersion.match(/^1\.(\d+)(?:\.(\d+))?$/) ?? [];
  const minor = Number(minorText ?? 20);
  const patch = Number(patchText);
  return minor > 20 || (minor === 20 && patch >= 5) ? 21 : 17;
}

function stableIntentId(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `intent_${Math.abs(hash).toString(36).padStart(8, "0")}`;
}
