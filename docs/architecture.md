# Architecture

MCagentlauncher is split into five responsibility layers:

```text
GitHub -> Vercel -> Supabase -> MCAgent Endpoint -> Desktop Local Executor
```

The v0.1 instance creation flow is:

```text
User Prompt
  -> Desktop UI
  -> MCAgent /v1/intent/parse
  -> intent.json
  -> MCAgent /v1/resources/plan
  -> resource-plan.json
  -> Desktop Plan Review
  -> User Confirmation
  -> Desktop Local Executor
  -> instance-lock.json
  -> Minecraft launch attempt
```

## Key Contracts

- MCAgent output must be structured and schema-verifiable.
- Resource choices must pass rule and metadata checks.
- Desktop is the only layer that performs real local filesystem and process actions.
- User confirmation is required before installation.
- Logs and local paths must be redacted before any optional upload.

## Initial Modules

- `apps/desktop`: desktop UI and local executor integration.
- `apps/web`: website, docs, Web console, and Preview surface.
- `services/mcagent-server`: independent MCAgent endpoint.
- `crates/*`: Rust local core modules.
- `packages/*`: schemas, rules, aliases, clients, and shared types.
- `supabase/*`: community data schema and functions.

