import type { InstallAction, InstallActionMessage } from "./installActions.ts";

export type ExecutorMode = "dry-run" | "confirmed" | "execute";
export type ExecutorActionStatus = "pending" | "preview" | "blocked" | "completed" | "failed";

export interface ExecutorPreviewResult {
  dryRun: boolean;
  actions: Array<InstallAction & { executorStatus: ExecutorActionStatus }>;
  blockedActions: Array<InstallAction & { executorStatus: "blocked" }>;
  warnings: InstallActionMessage[];
  errors: InstallActionMessage[];
  requiresUserConfirmation: boolean;
  canExecute: boolean;
  summary: string;
}

export interface PreviewInstallActionsOptions {
  mode?: ExecutorMode;
}

export function previewInstallActions(
  actions: InstallAction[],
  options: PreviewInstallActionsOptions = {},
): ExecutorPreviewResult {
  const mode = options.mode ?? "dry-run";
  const warnings: InstallActionMessage[] = [
    {
      code: "EXECUTOR_PREVIEW_ONLY",
      message: "M6 only previews Desktop Executor actions and does not execute them.",
    },
  ];
  const errors: InstallActionMessage[] = [];
  const requiresUserConfirmation = actions.some((action) => action.requiresUserConfirmation);

  if (mode === "execute") {
    warnings.push({
      code: "EXECUTE_MODE_NOT_IMPLEMENTED",
      message: "Real execute mode is reserved for a future Desktop Local Executor and is blocked in M6.",
    });
  }

  const previewedActions = actions.map((action) => {
    const blocked = mode === "execute" || action.dryRun !== true;
    if (action.dryRun !== true) {
      warnings.push({
        code: "NON_DRY_RUN_ACTION_BLOCKED",
        message: `${action.actionId} is not dry-run and is blocked by the M6 executor preview.`,
      });
    }
    return {
      ...action,
      executorStatus: blocked ? "blocked" as const : "preview" as const,
    };
  });

  const blockedActions = previewedActions.filter(
    (action): action is InstallAction & { executorStatus: "blocked" } => action.executorStatus === "blocked",
  );

  const summaryParts = [
    `${actions.length} action(s) analyzed in ${mode} mode.`,
    "No files were written, no resources were downloaded, and no process was launched.",
  ];
  if (requiresUserConfirmation) {
    summaryParts.push("User confirmation is required before any future Desktop Local Executor can execute these actions.");
  }
  if (blockedActions.length > 0) {
    summaryParts.push(`${blockedActions.length} action(s) are blocked in this preview.`);
  }

  return {
    dryRun: true,
    actions: previewedActions,
    blockedActions,
    warnings,
    errors,
    requiresUserConfirmation,
    canExecute: false,
    summary: summaryParts.join(" "),
  };
}
