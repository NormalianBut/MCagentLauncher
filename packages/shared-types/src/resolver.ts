import type { AliasMatch } from "./alias.ts";
import type { ResourceType } from "./resource.ts";

export type ResolverSource = "modrinth" | "curseforge" | "github" | "community-index";

export interface ResolverQueryContext {
  minecraftVersion: string;
  loader: "fabric";
  riskPreference: "stable" | "experimental";
  goals: string[];
}

export interface ResolverQuery {
  source: ResolverSource;
  canonicalName: string;
  query: string;
  projectId: string | null;
  slug: string | null;
  resourceType: ResourceType;
  loaders: string[];
  gameVersions: string[];
  tags: string[];
  required: boolean;
  reason: string;
  needsVerification: boolean;
  sourceAlias: string;
}

export function mapAliasMatchToResolverQuery(
  match: AliasMatch,
  context: ResolverQueryContext,
): ResolverQuery {
  const projectId = match.sourceIds.modrinthProjectId;
  const slug = match.sourceIds.modrinthSlug;
  const query = projectId ?? slug ?? match.canonicalName;

  return {
    source: projectId || slug ? "modrinth" : "community-index",
    canonicalName: match.canonicalName,
    query,
    projectId,
    slug,
    resourceType: match.type,
    loaders: match.loaders.length > 0 ? match.loaders : [context.loader],
    gameVersions: [context.minecraftVersion],
    tags: match.tags,
    required: isRequired(match, context),
    reason: reasonFor(match, context),
    needsVerification: match.needsVerification,
    sourceAlias: match.matchedAliases[0] ?? match.canonicalName,
  };
}

export function buildResolverQueriesFromAliases(
  matches: AliasMatch[],
  context: ResolverQueryContext,
): ResolverQuery[] {
  const queries = new Map<string, ResolverQuery>();

  for (const match of matches) {
    const query = mapAliasMatchToResolverQuery(match, context);
    const key = query.projectId ?? query.slug ?? query.canonicalName.toLowerCase();
    if (!queries.has(key)) {
      queries.set(key, query);
    }
  }

  return [...queries.values()];
}

function isRequired(match: AliasMatch, context: ResolverQueryContext): boolean {
  if (match.tags.includes("dependency")) {
    return true;
  }

  const normalizedGoals = new Set(context.goals.map((goal) => goal.toLowerCase()));
  return match.tags.some((tag) => normalizedGoals.has(tag.toLowerCase()));
}

function reasonFor(match: AliasMatch, context: ResolverQueryContext): string {
  const matchedGoal = match.tags.find((tag) => context.goals.includes(tag));
  if (matchedGoal) {
    return `Matched alias "${match.matchedAliases[0] ?? match.canonicalName}" for ${matchedGoal} goal.`;
  }
  if (match.tags.includes("dependency")) {
    return `Matched alias "${match.matchedAliases[0] ?? match.canonicalName}" as a required dependency candidate.`;
  }
  return `Matched alias "${match.matchedAliases[0] ?? match.canonicalName}" from intent text.`;
}
