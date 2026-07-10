# Architecture

MCagentlauncher is split into five responsibility layers:

```text
GitHub -> Vercel -> Supabase -> MCAgent Endpoint -> Desktop Local Executor
```

The v0.1 alpha preview flow is:

```text
User Prompt
  -> Desktop UI
  -> MCAgent /v1/intent/parse
  -> intent.json
  -> MCAgent /v1/resources/plan
  -> resource-plan.json
  -> Desktop Plan Review
  -> User Confirmation
  -> Desktop Install / Executor dry-run preview
```

Real local execution, instance-lock writing, and Minecraft launch are future Desktop responsibilities and are not enabled.

## M11 Runtime Contract

Desktop and Web use a configurable MCAgent endpoint. Development defaults to `http://127.0.0.1:8000`, but packaged Desktop must not assume a local Python process exists.

Before planning, clients request `GET /v1/meta` and validate:

- service-info schema version;
- API version and supported schema versions;
- required intent, plan, and explanation capabilities;
- planner-only safety declarations.

Incompatible endpoints block server-dependent planning. Desktop-local Environment Preview and consented Safe Platform Probe remain available when the server is offline. See [ADR 0003](./adr/0003-beta-runtime-topology.md).

MCAgent Server is the Planner Plane. The future Desktop Local Executor is the Execution Plane. M11 does not bundle a Python sidecar or enable execution. M12 investigates native packaging; M13 advances live planning/resolver capability negotiation.

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
