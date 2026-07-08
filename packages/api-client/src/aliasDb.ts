import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { AliasEntry, AliasMatch } from "../../shared-types/src/alias.ts";

export interface LoadAliasDbOptions {
  rootDir?: string;
}

export interface MatchAliasesOptions {
  tags?: string[];
}

export interface IntentLikeForAliases {
  prompt?: {
    rawText?: string;
  };
  preferences?: {
    requestedFeatures?: string[];
  };
  mustInclude?: string[];
  goals?: string[];
}

const DEFAULT_ALIAS_ROOT = resolve("../../packages/alias-db");

export async function loadAliasDb(options: LoadAliasDbOptions = {}): Promise<AliasEntry[]> {
  const rootDir = options.rootDir ?? DEFAULT_ALIAS_ROOT;
  const files = await listJsonFiles(rootDir);
  const entries: AliasEntry[] = [];

  for (const file of files) {
    const data = JSON.parse(await readFile(file, "utf8"));
    if (!Array.isArray(data)) {
      throw new Error(`Alias DB file must contain an array: ${file}`);
    }
    entries.push(...data.map(validateAliasEntry));
  }

  return entries;
}

export function matchAliasesInText(
  text: string,
  entries: AliasEntry[],
  options: MatchAliasesOptions = {},
): AliasMatch[] {
  const tagFilter = new Set(options.tags ?? []);
  const normalizedText = normalizeEnglish(text);
  const matches = new Map<string, AliasMatch>();

  for (const entry of entries) {
    if (tagFilter.size > 0 && !entry.tags.some((tag) => tagFilter.has(tag))) {
      continue;
    }

    const matchedAliases = entry.aliases.filter((alias) => aliasMatches(text, normalizedText, alias));
    if (matchedAliases.length === 0) {
      continue;
    }

    const existing = matches.get(entry.canonicalName);
    if (existing) {
      existing.matchedAliases.push(...matchedAliases.filter((alias) => !existing.matchedAliases.includes(alias)));
    } else {
      matches.set(entry.canonicalName, {
        ...entry,
        matchedAliases,
      });
    }
  }

  return [...matches.values()];
}

export function resolveAliasesForIntent(
  intent: IntentLikeForAliases,
  entries: AliasEntry[],
  options: MatchAliasesOptions = {},
): AliasMatch[] {
  const textParts = [
    intent.prompt?.rawText,
    ...(intent.preferences?.requestedFeatures ?? []),
    ...(intent.mustInclude ?? []),
    ...(intent.goals ?? []),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return matchAliasesInText(textParts.join(" "), entries, options);
}

async function listJsonFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJsonFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function aliasMatches(originalText: string, normalizedText: string, alias: string): boolean {
  if (containsCjk(alias)) {
    return originalText.includes(alias);
  }
  return normalizedText.includes(normalizeEnglish(alias));
}

function normalizeEnglish(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsCjk(value: string): boolean {
  return Array.from(value).some((char) => char >= "\u4e00" && char <= "\u9fff");
}

function validateAliasEntry(value: any): AliasEntry {
  const required = [
    "canonicalName",
    "aliases",
    "type",
    "tags",
    "loaders",
    "sourceIds",
    "needsVerification",
    "notes",
  ];
  for (const key of required) {
    if (!(key in value)) {
      throw new Error(`Alias entry is missing required field: ${key}`);
    }
  }
  return value as AliasEntry;
}
