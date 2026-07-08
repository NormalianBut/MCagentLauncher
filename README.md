# MCagentlauncher

MCagentlauncher is an open-source, community-driven intelligent launcher project for Minecraft Java Edition. It is not a traditional launcher with an AI chat box attached. The v0.1 direction is a Natural Instance flow:

```text
natural language -> resource plan -> user confirmation -> local execution -> launchable Minecraft instance
```

The project is designed to reduce the need for players to know every mod, loader, version, dependency, and compatibility rule before they can create a playable instance.

## v0.1 - Natural Instance

The v0.1 goal is to let a user describe what they want to play, generate an auditable resource plan, ask the user to review and confirm it, and then let the Desktop Local Executor create a real launchable Minecraft Fabric instance.

The expected v0.1 chain is:

```text
user prompt
  -> intent.json
  -> resource-plan.json
  -> install-action.json
  -> Desktop Local Executor
  -> instance-lock.json
  -> Minecraft launch attempt
```

## Platform Boundaries

MCagentlauncher uses the full GitHub-Vercel-Supabase-MCAgent-Desktop chain:

- GitHub: code, Issues, Pull Requests, Actions, Release, and contributor collaboration.
- Vercel: website, documentation, Web console, contribution entry points, and Preview deployments.
- Supabase: community data, Auth, rule library, alias library, anonymous cases, and review status.
- MCAgent Endpoint: independent, replaceable, self-hostable inference endpoint for intent parsing, resource planning, and plan explanation.
- Desktop Local Executor: the only component allowed to perform real local instance creation, download, hash verification, installation, launch, snapshot, and rollback.

Vercel is not the long-term model inference layer. Supabase is not a Minecraft resource mirror. MCAgent does not execute local file operations. Desktop does not blindly trust AI output.

## Core Principles

AI does not directly execute. MCAgent can propose, explain, and diagnose plans, but it must not run shell commands, write files, delete files, or download resources directly.

Resources must be verifiable. Resource choices must be checked through metadata, rules, versions, loaders, dependencies, source information, and file hashes before installation.

Every install action requires user confirmation. The user must see what will be installed, why it is needed, where it comes from, what risks exist, whether it is required, and whether rollback is possible.

Privacy is a default constraint. Full logs, local paths, tokens, server addresses, and usernames must not be uploaded by default. Any community case upload must be consent-based and locally redacted first.

The project avoids hard dependency on commercial large models. Commercial models can be used as optional development aids or fallback experiments, but v0.1 must not require them to run.

The long-term goal is a community-built MCAgent: open rules, shared aliases, auditable schemas, anonymized cases, replaceable inference endpoints, and self-hostable community nodes.

## Repository Layout

```text
apps/desktop/              Desktop application and local executor integration
apps/web/                  Vercel website, docs, and Web console
crates/                    Rust local core crates
services/mcagent-server/   Independent MCAgent inference endpoint
packages/                  Schemas, rules, alias DB, client, shared types
supabase/                  Supabase migrations, functions, and seed data
datasets/                  Intent, planning, and redacted log datasets
docs/                      Project documentation
examples/                  Example inputs, plans, and lockfiles
.github/                   Issue and pull request templates
```

## Current Status

This repository is at the v0.1 bootstrap stage. The current contents define structure, responsibilities, contribution expectations, and licensing direction. Complex business logic, third-party resource downloading, model integrations, and local execution code are intentionally not implemented in this initial skeleton.

