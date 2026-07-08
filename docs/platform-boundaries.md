# Platform Boundaries

This document defines the required GitHub-Vercel-Supabase-MCAgent-Desktop responsibility boundaries.

## GitHub = Collaboration / CI / Release

GitHub owns:

- code hosting
- Issues
- Pull Requests
- GitHub Actions CI
- Releases
- project boards
- contributor collaboration

GitHub does not own model inference, community data storage as the primary database, Minecraft resource mirroring, or user-local instance operations.

## Vercel = Web / Docs / Console / Preview

Vercel owns:

- `apps/web`
- official website
- documentation site
- Web console
- contribution entry points
- Preview deployments
- lightweight Web APIs for the Web layer

Vercel must not become the long-term GPU or model inference layer. It must not proxy Minecraft resource downloads, run long installation jobs, operate user local files, or replace the Desktop Local Executor.

## Supabase = Community Data / Auth / Rules / Aliases / Anonymous Cases

Supabase owns:

- Postgres community tables
- Auth
- Storage when appropriate for community metadata
- Edge Functions for community workflows
- rule library
- alias library
- anonymous cases
- model evaluation case indexes
- review and moderation status

Supabase must not be used as a Minecraft resource mirror, GPU inference service, installer, local executor, or storage for unredacted full logs, local paths, access tokens, or secrets.

## MCAgent = Independent Inference Endpoint

MCAgent owns:

- intent parsing
- resource planning
- plan explanation
- later log diagnosis
- later repair planning
- replaceable and self-hostable inference behavior

MCAgent must not write local files, download resource files, delete files, execute shell commands, bypass the rule engine, or store unredacted private data.

## Desktop = Local Executor

Desktop owns:

- user confirmation
- local instance creation
- Minecraft and Fabric installation
- resource download after confirmation
- hash verification
- config writing
- lockfile writing
- launch attempts
- log capture
- snapshots and rollback

Desktop is the only component allowed to perform real local instance creation, download, hash verification, installation, launch, and rollback.

