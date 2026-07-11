import type { CompatibilityAnalysisResult, CompatibilityIssue } from "../../shared-types/src/compatibility.ts";
import type { ResourcePlan } from "../../shared-types/src/plan.ts";

export function applyCompatibilityToResourcePlan(
  plan: ResourcePlan,
  compatibility: CompatibilityAnalysisResult,
): ResourcePlan {
  const warnings = [...plan.ruleResults.warnings];
  const errors = [...plan.ruleResults.errors];
  const accepted = [...plan.ruleResults.accepted];
  const warningKeys = new Set(warnings.map(messageKey));
  const errorKeys = new Set(errors.map(messageKey));

  for (const issue of compatibility.issues) {
    const message = planMessage(issue);
    if (issue.severity === "blocker") {
      if (!errorKeys.has(messageKey(message))) {
        errors.push(message);
        errorKeys.add(messageKey(message));
      }
    } else if (issue.severity === "warning" || issue.severity === "error") {
      if (!warningKeys.has(messageKey(message))) {
        warnings.push(message);
        warningKeys.add(messageKey(message));
      }
    } else {
      const acceptedCode = `compatibility_info:${issue.code}`;
      if (!accepted.includes(acceptedCode)) {
        accepted.push(acceptedCode);
      }
    }
  }

  const hasBlocker = compatibility.issues.some((issue) => issue.severity === "blocker");
  const hasCompatibilityConcern = compatibility.issues.some((issue) => issue.severity !== "info");
  return {
    ...plan,
    status: hasBlocker ? "rejected" : plan.status,
    summary: {
      ...plan.summary,
      riskLevel: hasBlocker ? "high" : hasCompatibilityConcern ? "medium" : plan.summary.riskLevel,
    },
    ruleResults: {
      ...plan.ruleResults,
      accepted,
      warnings,
      errors,
    },
  };
}

function planMessage(issue: CompatibilityIssue): { code: string; message: string } {
  return {
    code: `COMPATIBILITY_${issue.code}`,
    message: issue.message,
  };
}

function messageKey(message: { code: string; message: string }): string {
  return `${message.code}:${message.message}`;
}
