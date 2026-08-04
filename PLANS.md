# Long-running Execution Plans

Use an execution plan for work that spans multiple modules, checkpoints, approval gates, or sessions. The plan is a durable control document, not a promise to implement gated capabilities.

## Required Format

Every plan must contain these sections:

1. **Objective**: one concrete outcome.
2. **Verifiable stopping condition**: observable evidence that ends the plan.
3. **Current baseline**: branch, commit, tag, worktree state, enabled capabilities, and verified tests.
4. **Scope**: files, contracts, components, and behavior included.
5. **Non-goals**: behavior deliberately excluded.
6. **Architecture impact**: affected planes, ownership boundaries, contracts, and ADR needs.
7. **Security impact**: privileges, data, trust boundaries, threats, and whether the work is AUTO, REVIEW, or GATED.
8. **Implementation checkpoints**: ordered, independently verifiable increments with status.
9. **Tests**: exact commands and expected evidence for each checkpoint.
10. **Boundary scan**: prohibited patterns and manual inspections required.
11. **Rollback**: how to abandon or reverse the change without corrupting user or repository state.
12. **Approval gates**: capability, decision owner, required evidence, and the exact point where work must stop.
13. **Progress log requirements**: when and where state, commands, results, regressions, and next actions are recorded.
14. **Completion report**: changed files, architecture/security summary, test results, limitations, decisions, and handoff.

## Execution Rules

- Keep exactly one active checkpoint and mark completed checkpoints as evidence is gathered.
- Re-read current repository state after interruption; never infer completion from an old plan entry.
- A failed check is a result to investigate, not a passed checkpoint.
- Do not cross a GATED checkpoint while waiting for approval. Continue only independent, non-gated work.
- Update the plan when evidence changes the best next action; preserve the original objective and stopping condition.
- Append material progress to `docs/execution/progress-log.md` and synchronize `docs/project-state.md` after each checkpoint.
- Close a plan only after a requirement-by-requirement audit proves the stopping condition.
- Treat interruption and usage-limit exhaustion as normal: every bounded unit records its exact next action in runtime state and `docs/execution/resume-packet.md`.
- A work package should normally checkpoint within 20-30 minutes; use small coherent WIP commits when they materially improve recovery.
- After interruption, run the Autonomy Lab doctor and inspect Git, leases, registered processes, transactions, logs, and temporary publications before cleanup or continuation.
- Never encode an arbitrary recorded next action as an automatically executed command. A new coordinator validates and starts it deliberately.
