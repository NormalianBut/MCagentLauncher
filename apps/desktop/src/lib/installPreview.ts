import type { ExecutorPreviewResult } from "../../../../packages/shared-types/src/executor";
import { previewInstallActions } from "../../../../packages/shared-types/src/executor";
import {
  buildInstallActionsFromPlan,
  type InstallActionPreview,
} from "../../../../packages/shared-types/src/installActions";
import type { ResourcePlan } from "../../../../packages/shared-types/src/plan";
import type { JsonValue } from "./types";

export interface DesktopInstallPreview {
  installPreview: InstallActionPreview;
  executorPreview: ExecutorPreviewResult;
}

export function buildDesktopInstallPreview(planResponse: JsonValue): DesktopInstallPreview {
  const plan = extractPlan(planResponse);
  if (!plan) {
    throw new Error("Plan response does not contain a valid resource-plan object.");
  }

  const installPreview = buildInstallActionsFromPlan(plan, {
    dryRun: true,
    requireConfirmation: true,
    targetInstanceName: "MCagentlauncher Desktop Dry-run Preview",
    includeLaunchPreview: true,
  });
  const executorPreview = previewInstallActions(installPreview.actions, { mode: "dry-run" });

  return {
    installPreview,
    executorPreview,
  };
}

function extractPlan(value: JsonValue): ResourcePlan | null {
  if (isRecord(value) && isRecord(value.plan)) {
    return value.plan as unknown as ResourcePlan;
  }
  if (isRecord(value) && typeof value.planId === "string" && Array.isArray(value.resources)) {
    return value as unknown as ResourcePlan;
  }
  return null;
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
