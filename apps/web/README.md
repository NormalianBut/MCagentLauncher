# MCagentlauncher Web/API Playground

Lightweight Next.js playground for the v0.1 MCAgent API flow:

```text
Natural Language -> Intent -> Resource Plan -> Explanation
```

## Configure

Copy `.env.example` if you want a local env file:

```bash
NEXT_PUBLIC_MCAGENT_API_URL=http://127.0.0.1:8000
```

No secrets are required. Do not put tokens or private keys in `NEXT_PUBLIC_*` variables.

## Start MCAgent Server

From the repository root:

```bash
pnpm dev:server
```

The default MCAgent URL is `http://127.0.0.1:8000`.

## Start Web

Install the Web dependencies once:

```bash
cd apps/web
pnpm install
```

From the repository root:

```bash
pnpm dev:web
```

Or from `apps/web`:

```bash
pnpm dev
```

## Build

```bash
pnpm build:web
```

## Current Scope

This is only an API debugging interface. It calls:

- `POST /v1/intent/parse`
- `POST /v1/resources/plan`
- `POST /v1/explain/plan`

The Playground does not download resources, install resources, write local instances, launch Minecraft, or perform Desktop Local Executor work.

M9 polishes the Playground for the v0.1 alpha preview:

- title: `MCagentlauncher v0.1 - Natural Instance API Playground`;
- safety banner for Web limitations;
- visible API flow;
- diagnostics summary for `networkUsed`, warnings, errors, and candidates resolved;
- raw JSON retained for intent, plan response, explanation, install actions, and executor preview.

Web does not support:

- install execution;
- environment probe;
- local file access;
- Minecraft launch.

## Install Preview

The Playground can also generate an Install Preview from the current resource plan.

Install Preview is a browser-side dry run:

- `dryRun=true`
- `requiresUserConfirmation=true`
- no local file operations
- no resource downloads
- no Minecraft installation
- no Minecraft launch

The preview uses shared pure conversion logic and only displays JSON plus an executor preview summary. It does not call a real executor API.
