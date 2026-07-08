export type ProbePermissionLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type ProbeCapabilityId =
  | "mock_environment_report"
  | "consented_read_only_preview"
  | "read_os_arch"
  | "read_app_version"
  | "check_tauri_runtime"
  | "user_selected_directory_exists"
  | "user_selected_directory_disk_space"
  | "java_version_probe"
  | "network_connectivity_probe"
  | "environment_report_upload"
  | "file_write"
  | "process_launch"
  | "resource_download";

export interface ProbeCapability {
  id: ProbeCapabilityId;
  level: ProbePermissionLevel;
  label: string;
  allowedInCurrentMilestone: boolean;
  requiresConsent: boolean;
  localOnly: boolean;
  uploadAllowed: boolean;
  persistenceAllowed: boolean;
  redactionRequired: boolean;
  forbiddenByDefault: boolean;
  notes: string;
}

export interface ProbePolicy {
  milestone: "M8.2";
  capabilities: ProbeCapability[];
}

export interface ProbePolicyDecision {
  allowed: boolean;
  capability: ProbeCapability;
  reason: string;
}

const capabilities: ProbeCapability[] = [
  {
    id: "mock_environment_report",
    level: 0,
    label: "Mock environment report",
    allowedInCurrentMilestone: true,
    requiresConsent: false,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: false,
    notes: "Allowed in M8.2 because it only constructs mock data in memory.",
  },
  {
    id: "consented_read_only_preview",
    level: 1,
    label: "Consented read-only preview",
    allowedInCurrentMilestone: true,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: false,
    notes: "Allowed in M8.2 after consent; still no real system probing.",
  },
  {
    id: "read_os_arch",
    level: 2,
    label: "Read OS and architecture",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Future safe platform probe capability; not enabled in M8.2.",
  },
  {
    id: "read_app_version",
    level: 2,
    label: "Read app version",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Future safe platform metadata capability.",
  },
  {
    id: "check_tauri_runtime",
    level: 2,
    label: "Check Tauri runtime",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Future fixed Desktop runtime capability.",
  },
  {
    id: "user_selected_directory_exists",
    level: 3,
    label: "Check selected directory existence",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Requires explicit user-selected directory and a future policy gate.",
  },
  {
    id: "user_selected_directory_disk_space",
    level: 3,
    label: "Check selected directory disk space",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Requires explicit user-selected directory and no recursive scanning.",
  },
  {
    id: "java_version_probe",
    level: 4,
    label: "Java version probe",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Requires a separate ADR; arbitrary shell is forbidden.",
  },
  {
    id: "network_connectivity_probe",
    level: 4,
    label: "Network connectivity probe",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Future capability only after explicit consent and no report upload.",
  },
  {
    id: "environment_report_upload",
    level: 5,
    label: "Environment report upload",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: false,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Forbidden in M8.2; future export/upload requires a separate design.",
  },
  {
    id: "file_write",
    level: 5,
    label: "File write",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Execution capability, not read-only probing.",
  },
  {
    id: "process_launch",
    level: 5,
    label: "Process launch",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Execution capability, not read-only probing.",
  },
  {
    id: "resource_download",
    level: 5,
    label: "Resource download",
    allowedInCurrentMilestone: false,
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notes: "Execution capability reserved for a future Desktop Local Executor milestone.",
  },
];

export function getProbePolicyForMilestone(milestone: "M8.2" = "M8.2"): ProbePolicy {
  return {
    milestone,
    capabilities,
  };
}

export function isCapabilityAllowed(capabilityId: ProbeCapabilityId, policy = getProbePolicyForMilestone()): ProbePolicyDecision {
  const capability = findCapability(capabilityId, policy);
  const allowed = capability.allowedInCurrentMilestone === true
    && capability.uploadAllowed === false
    && capability.persistenceAllowed === false
    && (capability.level < 5 || capability.forbiddenByDefault === false);

  return {
    allowed,
    capability,
    reason: allowed
      ? `${capabilityId} is allowed by ${policy.milestone}.`
      : `${capabilityId} is forbidden by ${policy.milestone}. ${capability.notes}`,
  };
}

export function assertCapabilityAllowed(capabilityId: ProbeCapabilityId, policy = getProbePolicyForMilestone()): ProbePolicyDecision {
  const decision = isCapabilityAllowed(capabilityId, policy);
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }
  return decision;
}

export function listForbiddenCapabilities(policy = getProbePolicyForMilestone()): ProbeCapability[] {
  return policy.capabilities.filter((capability) => !isCapabilityAllowed(capability.id, policy).allowed);
}

function findCapability(capabilityId: ProbeCapabilityId, policy: ProbePolicy): ProbeCapability {
  const capability = policy.capabilities.find((item) => item.id === capabilityId);
  if (!capability) {
    throw new Error(`Unknown probe capability: ${capabilityId}`);
  }
  return capability;
}
