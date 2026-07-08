# Desktop Executor Design

M6 defines the first Desktop Local Executor contract and dry-run preview loop. It does not implement real local execution.

## Responsibility

Desktop Local Executor is the only future component allowed to create local instances, download resources after user confirmation, verify hashes, write config, write lockfiles, launch Minecraft, capture logs, create snapshots, and rollback.

MCAgent Server and Web Playground may propose, explain, and preview actions. They must not mutate local files or execute local processes.

## M6 Scope

M6 only produces dry-run install previews:

```text
resource-plan -> install-action preview -> executor preview result
```

Every generated action defaults to:

- `dryRun=true`
- `requiresUserConfirmation=true`
- `confirmedByUser=false`
- `status=pending`

## Install Action Preview

An install-action preview is an auditable JSON contract describing what a future Desktop Local Executor would do after confirmation. It can include actions such as:

- `create_instance`
- `install_minecraft`
- `install_loader`
- `add_resource`
- `write_config`
- `create_snapshot`
- `launch_instance`

The preview intentionally avoids real user paths, downloaded file results, process IDs, or completed execution status.

## User Confirmation Model

User confirmation is mandatory before any future real execution. A preview may show risk, rollback support, resource references, target version, and warnings, but it is not permission to execute.

If an action is not `dryRun=true`, M6 executor preview blocks or warns about it.

## Future Execution Conditions

Before real execution can exist, the Desktop layer must verify:

- resource metadata and source rules;
- Minecraft and loader compatibility;
- hashes for files to be downloaded;
- license and policy checks;
- target instance location chosen by the user;
- snapshot or rollback strategy;
- explicit user confirmation.

## Why Web and MCAgent Cannot Execute

Web Playground is a Vercel/Web surface for API debugging and preview. It cannot access or mutate a user's Minecraft instance safely.

MCAgent Server is an independent planning endpoint. It must remain replaceable and self-hostable, and it must not write local files, execute shell commands, download Minecraft resources, or operate as a local installer.

## Auditability and Rollback

Actions must be auditable, traceable to a source plan, and designed for rollback. The dry-run preview makes these actions visible before any future executor receives permission to run.

M6 does not download resources, install resources, launch Minecraft, or write local instance files.
