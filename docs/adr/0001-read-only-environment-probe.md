# ADR 0001: Read-only Environment Probe

Status: Accepted for M8.2 policy design.

## Context

MCagentlauncher eventually needs local environment information before it can safely create a launchable Minecraft instance. The Desktop Local Executor must know whether the target platform, runtime, Java environment, selected instance directory, and available disk space are compatible with a future install flow.

The project cannot jump directly from planning into real execution. Local environment data can reveal usernames, home directories, Java installation paths, Minecraft paths, server details, and other private context. Even read-only access can create trust problems if it runs in the background or if results are uploaded without clear consent.

Before any real probe exists, MCagentlauncher needs explicit user consent, local-only defaults, redaction, no persistence, and a policy gate that prevents permission creep.

## Decision

Desktop Local Executor is the only component allowed to perform read-only local environment probing.

Web and MCAgent Server must never read the user's local environment directly. They may only receive a future redacted report if a later milestone defines an explicit export/upload flow and the user approves it.

Read-only probes:

- do not run automatically;
- must be triggered by an explicit user click;
- must show a consent UI before running;
- default to `localOnly=true`;
- default to `uploadAllowed=false`;
- are not persisted by default;
- must be redacted before display or future export;
- must pass the probe permission policy before implementation.

## Future Allowed Read-only Probes

Future milestones may allow:

- OS, architecture, and platform family;
- application version;
- Tauri runtime availability;
- Java version through a fixed safe API or fixed controlled mechanism;
- disk space after the user explicitly selects a directory;
- existence checks for a user-selected directory;
- network connectivity only after explicit consent and without uploading environment reports.

## Forbidden Operations

The read-only probe policy forbids:

- arbitrary shell commands;
- user-controlled commands;
- recursive home directory scans;
- automatic `.minecraft` scans;
- automatic report upload;
- saving reports to `localStorage` or `sessionStorage`;
- writing files;
- launching Minecraft;
- downloading resources;
- installing resources.

## Risks

Known risks include:

- local path leakage;
- username leakage;
- Java path leakage;
- install directory leakage;
- accidental upload of local environment data;
- permission expansion over time;
- background probing that damages user trust.

## Mitigations

Mitigations are mandatory:

- consent modal;
- read-only behavior;
- local-only result;
- redaction before display or export;
- no persistence by default;
- no background probe;
- explicit future ADR for real Java detection;
- explicit future ADR for user-selected directory access.

## Consequences

The project can design real probes incrementally without giving the Desktop layer broad unreviewed authority.

M8.2 does not implement real probing. It only establishes the ADR, permission levels, and capability policy.

## Follow-up Milestones

- M8.3 may implement the smallest real platform probe for OS, architecture, app version, and Tauri runtime state.
- M8.4 may implement user-selected directory existence and disk-space checks.
- Real Java detection requires a separate ADR and permission review.
