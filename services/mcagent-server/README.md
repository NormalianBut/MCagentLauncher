# MCAgent Mock Server

This service is the v0.1 MCAgent mock endpoint for MCagentlauncher.

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

## Run Tests

```bash
python -m pytest
```

## Endpoints

- `GET /health`
- `POST /v1/intent/parse`
- `POST /v1/resources/plan`
- `POST /v1/explain/plan`

## Current Scope

This is only an M2 mock server. It maps simple natural-language keywords to schema-compatible JSON so the Desktop and Web layers can test the v0.1 flow.

Before installation, every resource plan must still pass a later Resource Resolver stage that verifies real metadata, loader compatibility, version compatibility, licenses, and hashes.

