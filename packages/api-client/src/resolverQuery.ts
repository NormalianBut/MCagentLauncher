import type { AliasEntry } from "../../shared-types/src/alias.ts";
import {
  buildResolverQueriesFromAliases,
  type ResolverQuery,
  type ResolverQueryContext,
} from "../../shared-types/src/resolver.ts";

import {
  resolveAliasesForIntent,
  type IntentLikeForAliases,
} from "./aliasDb.ts";

export interface IntentLikeForResolverQueries extends IntentLikeForAliases {
  game?: {
    minecraftVersions?: string[];
    loader?: string;
  };
  constraints?: {
    requireStableReleases?: boolean;
  };
}

export function buildResolverQueriesForIntent(
  intent: IntentLikeForResolverQueries,
  aliasEntries: AliasEntry[],
): ResolverQuery[] {
  const context = contextFromIntent(intent);
  const matches = resolveAliasesForIntent(intent, aliasEntries);
  const queries = buildResolverQueriesFromAliases(matches, context);
  return addGoalSeedQueries(queries, context);
}

function contextFromIntent(intent: IntentLikeForResolverQueries): ResolverQueryContext {
  const minecraftVersion = intent.game?.minecraftVersions?.[0] ?? "1.20.1";
  const loader = intent.game?.loader === "fabric" ? "fabric" : "fabric";
  const riskPreference = intent.constraints?.requireStableReleases === false ? "experimental" : "stable";
  const goals = [
    ...(intent.preferences?.requestedFeatures ?? []),
    ...(intent.goals ?? []),
  ];

  return {
    minecraftVersion,
    loader,
    riskPreference,
    goals,
  };
}

function addGoalSeedQueries(queries: ResolverQuery[], context: ResolverQueryContext): ResolverQuery[] {
  const result = [...queries];
  const keys = new Set(result.map((query) => query.slug ?? query.projectId ?? query.canonicalName.toLowerCase()));

  const seeds: ResolverQuery[] = [];
  if (context.goals.includes("performance")) {
    seeds.push(goalSeed("Sodium", "sodium", "performance", context));
  }
  if (context.goals.includes("shader")) {
    seeds.push(goalSeed("Iris Shaders", "iris", "shader", context));
  }

  for (const seed of seeds) {
    const key = seed.slug ?? seed.canonicalName.toLowerCase();
    if (!keys.has(key)) {
      keys.add(key);
      result.push(seed);
    }
  }

  return result;
}

function goalSeed(
  canonicalName: string,
  slug: string,
  goal: string,
  context: ResolverQueryContext,
): ResolverQuery {
  return {
    source: "modrinth",
    canonicalName,
    query: slug,
    projectId: null,
    slug,
    resourceType: "mod",
    loaders: [context.loader],
    gameVersions: [context.minecraftVersion],
    tags: [goal],
    required: false,
    reason: `Seeded resolver query for ${goal} goal.`,
    needsVerification: true,
    sourceAlias: goal,
  };
}
