import type { ResourcePlan } from "./plan.ts";
import type { ResourcePlanResource } from "./resource-plan.ts";

export type InstallActionType =
  | "create_instance"
  | "install_minecraft"
  | "install_loader"
  | "add_resource"
  | "write_config"
  | "create_snapshot"
  | "launch_instance";

export type InstallActionRiskLevel = "low" | "medium" | "high";
export type InstallActionStatus = "pending" | "preview" | "blocked";

export interface InstallActionMessage {
  code: string;
  message: string;
}

export interface InstallActionTarget {
  instanceName: string;
  minecraftVersion: string;
  loader: "fabric";
  destination:
    | "instance-root"
    | "minecraft-runtime"
    | "loader-runtime"
    | "mods"
    | "resourcepacks"
    | "shaderpacks"
    | "config"
    | "snapshot"
    | "launcher";
}

export interface InstallActionResourceRef {
  resourceId: string;
  name: string;
  source: "modrinth" | "manual" | "community-rule";
  projectId: string;
  versionId: string;
  hashes: Record<string, string>;
}

export interface InstallAction {
  schemaVersion: "0.1.0";
  actionId: string;
  type: InstallActionType;
  title: string;
  description: string;
  sourcePlanId: string;
  target: InstallActionTarget;
  resourceRef: InstallActionResourceRef | null;
  riskLevel: InstallActionRiskLevel;
  requiresUserConfirmation: boolean;
  rollbackSupported: boolean;
  status: InstallActionStatus;
  dryRun: boolean;
  warnings: InstallActionMessage[];
}

export interface InstallActionPreview {
  schemaVersion: "0.1.0";
  actionId: string;
  sourcePlanId: string;
  dryRun: true;
  requiresUserConfirmation: true;
  confirmedByUser: false;
  target: {
    instanceName: string;
    minecraftVersion: string;
    loader: "fabric";
    loaderVersion: string;
    javaMajorVersion: 17 | 21;
    minecraftDirectory: string | null;
  };
  actions: InstallAction[];
  diagnostics: {
    warnings: InstallActionMessage[];
    errors: InstallActionMessage[];
  };
}

export interface BuildInstallActionsOptions {
  dryRun?: boolean;
  requireConfirmation?: boolean;
  targetInstanceName?: string;
  targetMinecraftDirectory?: string | null;
  includeLaunchPreview?: boolean;
}

const dryRunWarnings: InstallActionMessage[] = [
  {
    code: "DRY_RUN_PREVIEW_ONLY",
    message: "This action is a dry-run preview and will not be executed in M6.",
  },
  {
    code: "NO_RESOURCE_DOWNLOAD",
    message: "This preview does not download resource files.",
  },
  {
    code: "NO_LOCAL_INSTANCE_WRITE",
    message: "This preview does not write a local Minecraft instance.",
  },
  {
    code: "USER_CONFIRMATION_REQUIRED",
    message: "A future Desktop Local Executor must require user confirmation before execution.",
  },
];

export function buildInstallActionsFromPlan(
  plan: ResourcePlan,
  options: BuildInstallActionsOptions = {},
): InstallActionPreview {
  const dryRun = options.dryRun ?? true;
  const requiresUserConfirmation = options.requireConfirmation ?? true;
  const instanceName = options.targetInstanceName ?? sanitizeInstanceName(plan.summary.title);
  const target = {
    instanceName,
    minecraftVersion: plan.target.minecraftVersion,
    loader: plan.target.loader,
    loaderVersion: plan.target.loaderVersion,
    javaMajorVersion: plan.target.javaMajorVersion,
    minecraftDirectory: options.targetMinecraftDirectory ?? null,
  };
  const actions: InstallAction[] = [
    baseAction("create_instance", "Create instance", "Preview creating the target instance container.", plan, instanceName),
    baseAction(
      "install_minecraft",
      "Install Minecraft",
      `Preview installing Minecraft ${plan.target.minecraftVersion}.`,
      plan,
      instanceName,
    ),
    baseAction("install_loader", "Install Fabric loader", `Preview installing Fabric ${plan.target.loaderVersion}.`, plan, instanceName),
    ...plan.resources.map((resource) => resourceAction(resource, plan, instanceName)),
    baseAction("write_config", "Write configuration", "Preview writing generated instance configuration.", plan, instanceName),
    baseAction("create_snapshot", "Create rollback snapshot", "Preview creating a rollback snapshot before changes.", plan, instanceName),
  ];

  if (options.includeLaunchPreview ?? true) {
    actions.push(baseAction("launch_instance", "Launch instance", "Preview a future launch attempt after installation.", plan, instanceName));
  }

  const normalizedActions = actions.map((action) => ({
    ...action,
    dryRun,
    requiresUserConfirmation,
    status: dryRun && requiresUserConfirmation ? "pending" as const : "blocked" as const,
    warnings: [...action.warnings, ...dryRunWarnings],
  }));

  return {
    schemaVersion: "0.1.0",
    actionId: `install_${stableId(plan.planId)}`,
    sourcePlanId: plan.planId,
    dryRun: true,
    requiresUserConfirmation: true,
    confirmedByUser: false,
    target,
    actions: normalizedActions.map((action) => ({
      ...action,
      dryRun: true,
      requiresUserConfirmation: true,
      status: action.status === "blocked" ? "blocked" : "pending",
    })),
    diagnostics: {
      warnings: [
        ...dryRunWarnings,
        {
          code: "ROLLBACK_DESIGN_REQUIRED",
          message: "Rollback metadata is previewed here; real rollback implementation belongs to Desktop Local Executor.",
        },
      ],
      errors: [],
    },
  };
}

function baseAction(
  type: InstallActionType,
  title: string,
  description: string,
  plan: ResourcePlan,
  instanceName: string,
): InstallAction {
  return {
    schemaVersion: "0.1.0",
    actionId: `act_${stableId(`${plan.planId}_${type}`)}`,
    type,
    title,
    description,
    sourcePlanId: plan.planId,
    target: {
      instanceName,
      minecraftVersion: plan.target.minecraftVersion,
      loader: plan.target.loader,
      destination: destinationForAction(type),
    },
    resourceRef: null,
    riskLevel: riskForAction(type),
    requiresUserConfirmation: true,
    rollbackSupported: type !== "launch_instance",
    status: "pending",
    dryRun: true,
    warnings: [],
  };
}

function resourceAction(resource: ResourcePlanResource, plan: ResourcePlan, instanceName: string): InstallAction {
  const type: InstallActionType = "add_resource";
  return {
    ...baseAction(
      type,
      `Add ${resource.project.name}`,
      `Preview adding ${resource.project.name} from ${resource.source} to the target instance.`,
      plan,
      instanceName,
    ),
    actionId: `act_${stableId(`${plan.planId}_${resource.resourceId}`)}`,
    target: {
      instanceName,
      minecraftVersion: plan.target.minecraftVersion,
      loader: plan.target.loader,
      destination: destinationForResource(resource),
    },
    resourceRef: {
      resourceId: resource.resourceId,
      name: resource.project.name,
      source: resource.source,
      projectId: resource.project.projectId,
      versionId: resource.version.versionId,
      hashes: resource.hashes ?? {},
    },
  };
}

function destinationForAction(type: InstallActionType): InstallActionTarget["destination"] {
  if (type === "install_minecraft") {
    return "minecraft-runtime";
  }
  if (type === "install_loader") {
    return "loader-runtime";
  }
  if (type === "write_config") {
    return "config";
  }
  if (type === "create_snapshot") {
    return "snapshot";
  }
  if (type === "launch_instance") {
    return "launcher";
  }
  return "instance-root";
}

function destinationForResource(resource: ResourcePlanResource): InstallActionTarget["destination"] {
  if (resource.type === "resourcepack") {
    return "resourcepacks";
  }
  if (resource.type === "shaderpack") {
    return "shaderpacks";
  }
  return "mods";
}

function riskForAction(type: InstallActionType): InstallActionRiskLevel {
  if (type === "create_instance" || type === "create_snapshot") {
    return "low";
  }
  return "medium";
}

function sanitizeInstanceName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "MCagentlauncher Preview";
}

function stableId(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `preview_${Math.abs(hash).toString(36).padStart(8, "0")}`;
}
