import type { ResourceCandidate } from "./resource.ts";
import {
  mapResourceCandidateToPlanResource,
  type ResourcePlanResource,
} from "./resource-plan.ts";

export interface BuildResourcePlanContext {
  intentId: string;
  minecraftVersion: string;
  loader: "fabric";
  loaderVersion: string;
  javaMajorVersion: 17 | 21;
  title: string;
  explanation: string;
  estimatedMemoryMb: number;
}

export interface BuildResourcePlanOptions {
  requiredProjectIds?: string[];
  dependencyProjectIds?: string[];
}

export interface ResourcePlan {
  schemaVersion: "0.1.0";
  planId: string;
  intentId: string;
  status: "draft" | "needs-user-confirmation" | "rejected";
  target: {
    minecraftVersion: string;
    loader: "fabric";
    loaderVersion: string;
    javaMajorVersion: 17 | 21;
  };
  summary: {
    title: string;
    description: string;
    riskLevel: "low" | "medium" | "high";
    estimatedMemoryMb: number;
  };
  resources: ResourcePlanResource[];
  ruleResults: {
    accepted: string[];
    rejected: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
    errors: Array<{ code: string; message: string }>;
  };
  installActionRef: {
    actionId: string;
    schema: "install-action.schema.json";
  };
  userConfirmation: {
    required: true;
    confirmed: false;
  };
}

export function buildResourcePlan(
  context: BuildResourcePlanContext,
  candidates: ResourceCandidate[],
  options: BuildResourcePlanOptions = {},
): ResourcePlan {
  const warnings: ResourcePlan["ruleResults"]["warnings"] = [];
  const seenProjectIds = new Set<string>();
  const requiredProjectIds = new Set(options.requiredProjectIds ?? []);
  const dependencyProjectIds = new Set(options.dependencyProjectIds ?? []);
  const resources: ResourcePlanResource[] = [];

  for (const candidate of candidates) {
    if (seenProjectIds.has(candidate.projectId)) {
      warnings.push({
        code: "DUPLICATE_PROJECT_SKIPPED",
        message: `Duplicate project ${candidate.projectId} was skipped while building the resource plan.`,
      });
      continue;
    }

    seenProjectIds.add(candidate.projectId);

    const required = requiredProjectIds.has(candidate.projectId) || dependencyProjectIds.has(candidate.projectId);
    const planResource = mapResourceCandidateToPlanResource(candidate, {
      required,
      reason: required
        ? "Required by resolver output or dependency metadata."
        : "Selected by resolver output for the requested plan.",
    });

    if (!planResource.verification.metadataChecked) {
      warnings.push({
        code: "METADATA_NOT_CHECKED",
        message: `${planResource.project.name} has not completed metadata verification.`,
      });
    }

    if (!planResource.verification.hashKnown) {
      warnings.push({
        code: "HASH_NOT_KNOWN",
        message: `${planResource.project.name} has no known file hash in resolver output.`,
      });
    }

    for (const warning of candidate.warnings) {
      warnings.push({
        code: "RESOLVER_WARNING",
        message: warning,
      });
    }

    resources.push(planResource);
  }

  if (resources.length === 0) {
    warnings.push({
      code: "NO_RESOURCES_SELECTED",
      message: "Resolver output did not contain any unique resources.",
    });
  }

  return {
    schemaVersion: "0.1.0",
    planId: `plan_${stableId(`${context.intentId}_${context.minecraftVersion}_${resources.length}`)}`,
    intentId: context.intentId,
    status: "needs-user-confirmation",
    target: {
      minecraftVersion: context.minecraftVersion,
      loader: context.loader,
      loaderVersion: context.loaderVersion,
      javaMajorVersion: context.javaMajorVersion,
    },
    summary: {
      title: context.title,
      description: context.explanation,
      riskLevel: warnings.length > 0 ? "medium" : "low",
      estimatedMemoryMb: context.estimatedMemoryMb,
    },
    resources,
    ruleResults: {
      accepted: [
        "resolver_candidates_mapped",
        "project_id_deduplicated",
        "user_confirmation_required",
      ],
      rejected: [],
      warnings,
      errors: [],
    },
    installActionRef: {
      actionId: `install_${stableId(`${context.intentId}_${context.minecraftVersion}`)}`,
      schema: "install-action.schema.json",
    },
    userConfirmation: {
      required: true,
      confirmed: false,
    },
  };
}

function stableId(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `resolver_${Math.abs(hash).toString(36).padStart(8, "0")}`;
}
