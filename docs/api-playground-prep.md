# API Playground Prep

This document captures the v0.1 MCAgent API shapes intended for the future Web/API Playground.

## Defaults and Boundaries

- MCAgent Server runs offline by default.
- `/v1/resources/plan` defaults to `enableNetwork=false`.
- `diagnostics.networkUsed=false` means the server did not perform real external metadata lookup.
- Current M4.1 server output is pipeline-compatible, but still uses offline mock resolver data.
- MCAgent Server does not download resources, install resources, write local instances, launch Minecraft, or execute local file operations.
- Desktop Local Executor remains the only component allowed to perform local instance creation, resource download after user confirmation, hash verification, installation, launch, and rollback.

## POST /v1/intent/parse

Input:

```json
{
  "text": "我想玩 1.20.1，低配光影生存，要优化、小地图、苹果皮。"
}
```

Output:

- JSON matching `packages/schemas/intent.schema.json`.
- Includes structured game target, requested features, avoid features, stability preference, and privacy defaults.

## POST /v1/resources/plan

Legacy input remains supported:

```json
{
  "...intent fields": "..."
}
```

Legacy output remains a direct `resource-plan` object matching `packages/schemas/resource-plan.schema.json`.

Preferred Playground input:

```json
{
  "intent": {
    "...intent fields": "..."
  },
  "options": {
    "mode": "pipeline",
    "enableNetwork": false
  }
}
```

Preferred Playground output:

```json
{
  "schemaVersion": "0.1.0",
  "plan": {
    "...resource-plan fields": "..."
  },
  "diagnostics": {
    "aliasMatches": [],
    "resolverQueries": [],
    "candidatesResolved": 0,
    "warnings": [],
    "errors": [],
    "networkUsed": false
  }
}
```

Validation:

- `response.plan` must validate against `resource-plan.schema.json`.
- The full wrapper response must validate against `plan-response.schema.json`.

## POST /v1/explain/plan

Input can be either a direct resource plan or the preferred wrapper response:

```json
{
  "schemaVersion": "0.1.0",
  "plan": {
    "...resource-plan fields": "..."
  },
  "diagnostics": {
    "networkUsed": false
  }
}
```

Output:

```json
{
  "summary": "中文概要说明",
  "details": [
    "为什么推荐这些资源",
    "当前是 mock/offline pipeline",
    "真实 resolver 校验仍未完成"
  ],
  "warnings": [
    "当前不会下载或安装资源",
    "安装动作必须由 Desktop Local Executor 在用户确认后执行"
  ]
}
```

## Playground Notes

The future Web Playground should:

- call `/v1/intent/parse` first;
- pass the returned intent to `/v1/resources/plan` using wrapper input;
- display `plan.resources`, `plan.ruleResults`, and `diagnostics`;
- call `/v1/explain/plan` with the wrapper response for beginner-readable explanation;
- clearly label output as offline planning preview while `networkUsed=false`;
- never present the preview as an installed state.
