from __future__ import annotations

import hashlib

MOCK_RESOURCES = {
    "performance": [
        {
            "name": "Sodium",
            "slug": "sodium",
            "projectId": "mock-sodium",
            "reason": "提升客户端渲染性能，适合低配和优化需求。",
            "side": "client",
        },
        {
            "name": "Lithium",
            "slug": "lithium",
            "projectId": "mock-lithium",
            "reason": "优化游戏逻辑性能，尽量保持原版行为。",
            "side": "both",
        },
        {
            "name": "Entity Culling",
            "slug": "entityculling",
            "projectId": "mock-entity-culling",
            "reason": "减少不可见实体渲染开销。",
            "side": "client",
        },
    ],
    "shader": [
        {
            "name": "Iris Shaders",
            "slug": "iris",
            "projectId": "mock-iris",
            "reason": "为 Fabric 实例提供光影支持。",
            "side": "client",
        }
    ],
    "AppleSkin": [
        {
            "name": "AppleSkin",
            "slug": "appleskin",
            "projectId": "mock-appleskin",
            "reason": "显示饥饿值和饱食度信息，满足苹果皮需求。",
            "side": "client",
        }
    ],
    "minimap": [
        {
            "name": "Xaero's Minimap",
            "slug": "xaeros-minimap",
            "projectId": "mock-xaeros-minimap",
            "reason": "提供小地图能力。",
            "side": "client",
        }
    ],
    "building": [
        {
            "name": "Litematica",
            "slug": "litematica",
            "projectId": "mock-litematica",
            "reason": "辅助建筑蓝图和投影。",
            "side": "client",
        }
    ],
}


def generate_plan(intent: dict) -> dict:
    features = intent.get("preferences", {}).get("requestedFeatures", [])
    target_version = intent.get("game", {}).get("minecraftVersions", ["1.20.1"])[0]
    java_version = 21 if target_version.startswith("1.21") else 17
    resources = _resources_for_features(features, target_version)
    plan_id = f"plan_{_stable_id(intent.get('intentId', 'mock'))}"

    return {
        "schemaVersion": "0.1.0",
        "planId": plan_id,
        "intentId": intent.get("intentId", "intent_mock_default"),
        "status": "needs-user-confirmation",
        "target": {
            "minecraftVersion": target_version,
            "loader": "fabric",
            "loaderVersion": "mock-fabric-loader",
            "javaMajorVersion": java_version,
        },
        "summary": {
            "title": "MCAgent v0.1 mock resource plan",
            "description": "v0.1 mock plan 尚未经过真实资源 API 解析，安装前必须进入 Resource Resolver 阶段；当前结果只用于方案预览和接口联调。",
            "riskLevel": "medium",
            "estimatedMemoryMb": intent.get("constraints", {}).get("maxMemoryMb", 4096),
        },
        "resources": resources,
        "ruleResults": {
            "accepted": [
                "mock_rule_loader_fabric",
                "mock_rule_user_features_mapped",
            ],
            "rejected": [],
            "warnings": [
                {
                    "code": "MOCK_PLAN_NOT_RESOLVED",
                    "message": "v0.1 mock plan 尚未经过真实资源 API 解析，安装前必须进入 Resource Resolver 阶段。",
                }
            ],
            "errors": [],
        },
        "installActionRef": {
            "actionId": f"install_{_stable_id(plan_id)}",
            "schema": "install-action.schema.json",
        },
        "userConfirmation": {
            "required": True,
            "confirmed": False,
        },
    }


def _resources_for_features(features: list[str], minecraft_version: str) -> list[dict]:
    resources: list[dict] = []
    seen: set[str] = set()

    for feature in features:
        for resource in MOCK_RESOURCES.get(feature, []):
            if resource["slug"] in seen:
                continue
            seen.add(resource["slug"])
            resources.append(_resource_candidate(resource, minecraft_version))

    if not resources:
        resources.append(_resource_candidate(MOCK_RESOURCES["performance"][0], minecraft_version))

    return resources


def _resource_candidate(resource: dict, minecraft_version: str) -> dict:
    slug = resource["slug"].replace("-", "_")
    return {
        "resourceId": f"res_{slug}_mock",
        "type": "mod",
        "source": "community-rule",
        "project": {
            "name": resource["name"],
            "slug": resource["slug"],
            "projectId": resource["projectId"],
        },
        "version": {
            "versionId": f"mock-{resource['slug']}-version",
            "versionNumber": "mock",
            "releaseType": "release",
        },
        "required": True,
        "reason": resource["reason"],
        "compatibility": {
            "minecraftVersions": [minecraft_version],
            "loaders": ["fabric"],
            "side": resource["side"],
        },
        "verification": {
            "metadataChecked": False,
            "hashKnown": False,
            "licenseChecked": False,
        },
    }


def _stable_id(value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]
    return f"mock_{digest}"
