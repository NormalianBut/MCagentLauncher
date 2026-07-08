export type ProbePermissionLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type ProbeMilestone = "M8.2" | "M8.3";

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
  milestone: ProbeMilestone;
  capabilities: ProbeCapability[];
}

export interface ProbePolicyDecision {
  allowed: boolean;
  capability: ProbeCapability;
  reason: string;
}

type ProbeCapabilityTemplate = Omit<ProbeCapability, "allowedInCurrentMilestone" | "notes"> & {
  allowedMilestones: ProbeMilestone[];
  notesByMilestone: Record<ProbeMilestone, string>;
};

const capabilityTemplates: ProbeCapabilityTemplate[] = [
  {
    id: "mock_environment_report",
    level: 0,
    label: "Mock environment report",
    allowedMilestones: ["M8.2", "M8.3"],
    requiresConsent: false,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: false,
    notesByMilestone: {
      "M8.2": "Allowed in M8.2 because it only constructs mock data in memory.",
      "M8.3": "Allowed in M8.3 because it only constructs mock data in memory.",
    },
  },
  {
    id: "consented_read_only_preview",
    level: 1,
    label: "Consented read-only preview",
    allowedMilestones: ["M8.2", "M8.3"],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: false,
    notesByMilestone: {
      "M8.2": "Allowed in M8.2 after consent; still no real system probing.",
      "M8.3": "Allowed in M8.3 as a consented in-memory preview capability.",
    },
  },
  {
    id: "read_os_arch",
    level: 2,
    label: "Read OS and architecture",
    allowedMilestones: ["M8.3"],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Future safe platform probe capability; not enabled in M8.2.",
      "M8.3": "Allowed in M8.3 only after consent and only from browser-safe platform metadata.",
    },
  },
  {
    id: "read_app_version",
    level: 2,
    label: "Read app version",
    allowedMilestones: ["M8.3"],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Future safe platform metadata capability.",
      "M8.3": "Allowed in M8.3 only for the Desktop app version value.",
    },
  },
  {
    id: "check_tauri_runtime",
    level: 2,
    label: "Check Tauri runtime",
    allowedMilestones: ["M8.3"],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Future fixed Desktop runtime capability.",
      "M8.3": "Allowed in M8.3 as a boolean runtime availability check.",
    },
  },
  {
    id: "user_selected_directory_exists",
    level: 3,
    label: "Check selected directory existence",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Requires explicit user-selected directory and a future policy gate.",
      "M8.3": "Still forbidden in M8.3; safe platform probe must not inspect directories.",
    },
  },
  {
    id: "user_selected_directory_disk_space",
    level: 3,
    label: "Check selected directory disk space",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Requires explicit user-selected directory and no recursive scanning.",
      "M8.3": "Still forbidden in M8.3; safe platform probe must not check disk state.",
    },
  },
  {
    id: "java_version_probe",
    level: 4,
    label: "Java version probe",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Requires a separate ADR; arbitrary shell is forbidden.",
      "M8.3": "Still forbidden in M8.3; no runtime binary probe is allowed.",
    },
  },
  {
    id: "network_connectivity_probe",
    level: 4,
    label: "Network connectivity probe",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Future capability only after explicit consent and no report upload.",
      "M8.3": "Still forbidden in M8.3; safe platform probe must not make network requests.",
    },
  },
  {
    id: "environment_report_upload",
    level: 5,
    label: "Environment report upload",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: false,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Forbidden in M8.2; future export/upload requires a separate design.",
      "M8.3": "Forbidden in M8.3; reports remain local and in memory.",
    },
  },
  {
    id: "file_write",
    level: 5,
    label: "File write",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Execution capability, not read-only probing.",
      "M8.3": "Execution capability, not safe platform probing.",
    },
  },
  {
    id: "process_launch",
    level: 5,
    label: "Process launch",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Execution capability, not read-only probing.",
      "M8.3": "Execution capability, not safe platform probing.",
    },
  },
  {
    id: "resource_download",
    level: 5,
    label: "Resource download",
    allowedMilestones: [],
    requiresConsent: true,
    localOnly: true,
    uploadAllowed: false,
    persistenceAllowed: false,
    redactionRequired: true,
    forbiddenByDefault: true,
    notesByMilestone: {
      "M8.2": "Execution capability reserved for a future Desktop Local Executor milestone.",
      "M8.3": "Execution capability reserved for a future Desktop Local Executor milestone.",
    },
  },
];

export function getProbePolicyForMilestone(milestone: ProbeMilestone = "M8.2"): ProbePolicy {
  return {
    milestone,
    capabilities: capabilityTemplates.map(({ allowedMilestones, notesByMilestone, ...capability }) => ({
      ...capability,
      allowedInCurrentMilestone: allowedMilestones.includes(milestone),
      notes: notesByMilestone[milestone],
    })),
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
