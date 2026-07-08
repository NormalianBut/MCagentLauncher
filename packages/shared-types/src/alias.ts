import type { ResourceType } from "./resource.ts";

export interface AliasSourceIds {
  modrinthProjectId: string | null;
  modrinthSlug: string | null;
  curseforgeId: string | null;
}

export interface AliasEntry {
  canonicalName: string;
  aliases: string[];
  type: ResourceType;
  tags: string[];
  loaders: string[];
  sourceIds: AliasSourceIds;
  needsVerification: boolean;
  notes: string;
}

export interface AliasMatch extends AliasEntry {
  matchedAliases: string[];
}
