# Repository Operating Guide

## Architecture And Boundaries

MCagentlauncher separates the Planner Plane from the Execution Plane.

- Planner Plane: MCAgent, schemas, aliases, metadata providers, Resolver, compatibility analysis, explanations, and Web/API surfaces. It produces deterministic, reviewable data and has no local execution authority.
- Execution Plane: the future Desktop Local Executor. It is the only plane that may eventually mutate a controlled instance, download verified artifacts, run Java or Minecraft, and roll back, and only after approved gates and user confirmation.
- Platform ownership remains authoritative in `docs/platform-boundaries.md`. Do not modify that file without explicit approval.

Repository areas:

- `apps/web`: Vercel-compatible Web/API Playground.
- `apps/desktop`: Tauri shell and preview-only local UX.
- `services/mcagent-server`: independent planner endpoint.
- `packages`: schemas, shared contracts, rules, aliases, and metadata clients.
- `crates`: reserved Execution Plane modules; currently no enabled executor.
- `docs`: architecture, security, ADRs, releases, and durable handoff state.

## Required Reading Order

Before substantial work, read:

1. `docs/project-state.md`
2. `docs/platform-boundaries.md`
3. `docs/autonomy-policy.md`
4. `docs/execution/active-plan.md`
5. the relevant architecture, security, ADR, schema, and package files
6. `PLANS.md` when work spans multiple checkpoints

## Commands

```bash
pnpm validate:schemas
pnpm test:shared-types
pnpm test:api-client
pnpm --dir apps/web build
pnpm --dir apps/desktop build
cd services/mcagent-server && python -m pytest -q
pnpm check:autonomy-boundaries
pnpm verify:project
```

On Windows PowerShell environments that block `pnpm.ps1`, use `pnpm.cmd` with the same arguments.

## Git And Release Policy

- Codex may create a scoped feature branch or isolated worktree, modify code and documentation, run tests, commit to a feature branch, push that branch, and prepare a Pull Request when the current task permits those actions.
- Start from a synchronized, clean baseline and record the commit in `docs/project-state.md` or the active plan.
- Use a scoped feature branch or isolated worktree. Codex branches use `codex/<scope>` unless the task specifies another name.
- Keep commits focused and use Conventional Commit subjects.
- Never rewrite shared history or force push.
- Codex must not merge into `main`, create or move a tag, or create a GitHub Release.
- A PR must state scope, boundaries, tests, security impact, documentation changes, and approval gates.

## Documentation And State

- Update architecture, security, roadmap, ADR, and public README material when behavior or contracts change.
- After every checkpoint, update `docs/project-state.md`, `docs/execution/active-plan.md`, and append to `docs/execution/progress-log.md`.
- Record unresolved gated choices in `docs/execution/decision-queue.md` and material risks in `docs/execution/risk-register.md`.
- Never claim an approval, test result, release, or capability that is not evidenced.

## Determinism And Security

- Contracts and planning logic must be deterministic for equivalent inputs; sort outputs explicitly and avoid time or randomness unless the contract requires caller-supplied values.
- Validate untrusted structured input, preserve unknown metadata as unknown, and keep diagnostics auditable.
- Keep secrets, credentials, local paths, and unredacted environment data out of source, logs, fixtures, and uploads.
- Use least privilege, explicit capability negotiation, exact allowlists, and offline defaults.
- Run `pnpm check:autonomy-boundaries` before completion.

## Prohibited Capabilities

Without an approved gate, do not add or enable:

- filesystem writes or local instance mutation;
- resource or runtime downloads;
- shell, child-process, sidecar, Java, launcher, or Minecraft execution;
- Java discovery or Minecraft directory access;
- authentication, Microsoft OAuth, secret persistence, telemetry, or environment upload;
- updater behavior;
- production dependencies;
- commercial model APIs.

Preview objects and architecture contracts must remain non-executable and visibly marked as such.

## Approval Gates

Follow `docs/autonomy-policy.md`. Stop before implementation for every GATED capability. Approval must name the capability and scope; approval of a design document is not approval to implement it. User confirmation in a future product flow is separate from repository implementation approval.

## Definition Of Done

Work is done only when:

- the requested scope and stopping condition are met with no hidden runtime privilege;
- tests, builds, schema validation, boundary scan, and `git diff --check` required by the active plan pass;
- changed files are inspected and no secret is present;
- `docs/platform-boundaries.md` remains unchanged unless explicitly approved;
- architecture/security documentation and durable state are current;
- the progress log contains commands and actual outcomes;
- remaining limitations, decisions, regressions, and approval gates are explicit;
- no merge, tag, Release, or other gated action was performed without approval.
