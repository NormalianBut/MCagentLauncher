# MCAgent Mock Server

This service is the v0.1 MCAgent mock endpoint for MCagentlauncher.

The v0.1 Alpha Preview has been released. In M11 this service is explicitly a planner-only endpoint with a versioned service-info contract. It has no local execution authority.

It is intentionally rule-based. It does not call OpenAI, Claude, Gemini, or any commercial large model API. It does not call Modrinth. It does not download Minecraft resources. It does not execute local file operations or write user instances.

## Install

From this directory:

```bash
python -m pip install -e ".[dev]"
```

## Start Development Server

```bash
python -m uvicorn app.main:app --reload
```

The default local URL is `http://127.0.0.1:8000`.

Development CORS is restricted to the known Web Playground origins, the Desktop Vite origin on port `1420`, and the current Tauri v2 local origins. It does not use a wildcard origin.

## Run Tests

```bash
python -m pytest
```

## Endpoints

- `GET /health`
- `GET /v1/meta` for version and capability negotiation
- `POST /v1/intent/parse`
- `POST /v1/resources/plan`
- `POST /v1/explain/plan`

## Current Scope

This is a rule-based offline planning server. It maps simple natural-language keywords to schema-compatible JSON so the Desktop and Web layers can test the v0.1 flow. `/health` remains a lightweight liveness check; `/v1/meta` is runtime-schema validated and declares the real current planning and safety capabilities.

Source development starts this server separately. M11 does not package it as a Python sidecar. M12 investigates native packaging; M13 advances live planning/resolver support. The server cannot download, install, write local files, probe the Desktop environment, or launch Minecraft.

Before installation, every resource plan must still pass a later Resource Resolver stage that verifies real metadata, loader compatibility, version compatibility, licenses, and hashes.
