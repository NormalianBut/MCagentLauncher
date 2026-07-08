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
