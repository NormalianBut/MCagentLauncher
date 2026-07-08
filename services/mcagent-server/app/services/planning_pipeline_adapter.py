from __future__ import annotations

import hashlib
from typing import Any


OFFLINE_RESOURCES = {
    "Sodium": {
        "feature": "performance",
        "sourceAlias": "performance",
        "query": "sodium",
        "slug": "sodium",
        "projectId": "mock-sodium",
        "reason": "低配和优化需求匹配到 Sodium，用于提升客户端渲染性能。",
        "side": "client",
    },
    "Lithium": {
        "feature": "performance",
        "sourceAlias": "performance",
        "query": "lithium",
        "slug": "lithium",
        "projectId": "mock-lithium",
        "reason": "低配和优化需求匹配到 Lithium，用于优化游戏逻辑性能。",
        "side": "both",
    },
    "Entity Culling": {
        "feature": "performance",
        "sourceAlias": "performance",
        "query": "entityculling",
        "slug": "entityculling",
        "projectId": "mock-entity-culling",
        "reason": "低配需求匹配到 Entity Culling，用于减少不可见实体渲染开销。",
        "side": "client",
    },
    "Iris Shaders": {
        "feature": "shader",
        "sourceAlias": "shader",
        "query": "iris",
        "slug": "iris",
        "projectId": "mock-iris",
        "reason": "光影需求匹配到 Iris Shaders，用于 Fabric 光影支持。",
        "side": "client",
    },
    "AppleSkin": {
        "feature": "AppleSkin",
        "sourceAlias": "AppleSkin",
        "query": "appleskin",
        "slug": "appleskin",
        "projectId": "mock-appleskin",
        "reason": "苹果皮需求匹配到 AppleSkin，用于显示饥饿值和饱食度信息。",
        "side": "client",
    },
    "Xaero's Minimap": {
        "feature": "minimap",
        "sourceAlias": "minimap",
        "query": "xaeros-minimap",
        "slug": "xaeros-minimap",
        "projectId": "mock-xaeros-minimap",
        "reason": "小地图需求匹配到 Xaero's Minimap。",
        "side": "client",
    },
    "Litematica": {
        "feature": "building",
        "sourceAlias": "building",
        "query": "litematica",
        "slug": "litematica",
        "projectId": "mock-litematica",
        "reason": "建筑需求匹配到 Litematica，用于投影和蓝图辅助。",
        "side": "client",
    },
}


FEATURE_TO_RESOURCE_NAMES = {
    "performance": ["Sodium", "Lithium", "Entity Culling"],
    "shader": ["Iris Shaders"],
    "AppleSkin": ["AppleSkin"],
    "minimap": ["Xaero's Minimap"],
    "building": ["Litematica"],
}


def generate_pipeline_plan(intent: dict[str, Any], options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    enable_network = bool(options.get("enableNetwork", False))
    features = _requested_features(intent)
    target_version = _minecraft_version(intent)
    java_version = 21 if target_version.startswith("1.21") else 17
    alias_matches = _alias_matches(features)
    resolver_queries = _resolver_queries(alias_matches, target_version)
    resources = _resources_for_queries(resolver_queries, target_version)
    diagnostics = _diagnostics(alias_matches, resolver_queries, resources, enable_network)

    warnings = [
        {
            "code": "PIPELINE_OFFLINE_MOCK_RESOLVER",
            "message": "MCAgent Server 当前使用离线 mock resolver，尚未进行真实 Modrinth 元数据解析。",
        },
        {
            "code": "REAL_RESOLVER_REQUIRED_BEFORE_INSTALL",
            "message": "安装前必须进入 Resource Resolver 阶段校验真实版本、hash、许可证和兼容性。",
        },
    ]
    if enable_network:
        warnings.append(
            {
                "code": "ENABLE_NETWORK_IGNORED",
                "message": "本阶段即使请求 enableNetwork=true，MCAgent Server 仍不会真实联网。",
            }
        )
    warnings.extend(diagnostics["warnings"])

    plan = {
        "schemaVersion": "0.1.0",
        "planId": f"plan_{_stable_id(intent.get('intentId', 'pipeline'))}",
        "intentId": intent.get("intentId", "intent_mock_default"),
        "status": "needs-user-confirmation",
        "target": {
            "minecraftVersion": target_version,
            "loader": "fabric",
            "loaderVersion": "mock-fabric-loader",
            "javaMajorVersion": java_version,
        },
        "summary": {
            "title": "MCAgent v0.1 offline pipeline resource plan",
            "description": "该方案由离线 pipeline-compatible mock resolver 生成，用于预览资源规划；安装前仍需真实 resolver 校验。",
            "riskLevel": "medium",
            "estimatedMemoryMb": intent.get("constraints", {}).get("maxMemoryMb", 4096),
        },
        "resources": resources,
        "ruleResults": {
            "accepted": [
                "pipeline_compatible_output",
                "offline_mock_resolver_used",
                "user_confirmation_required",
            ],
            "rejected": [],
            "warnings": _dedupe_messages(warnings),
            "errors": diagnostics["errors"],
        },
        "installActionRef": {
            "actionId": f"install_{_stable_id(intent.get('intentId', 'pipeline_install'))}",
            "schema": "install-action.schema.json",
        },
        "userConfirmation": {
            "required": True,
            "confirmed": False,
        },
    }

    return {
        "plan": plan,
        "diagnostics": diagnostics,
    }


def _requested_features(intent: dict[str, Any]) -> list[str]:
    features = intent.get("preferences", {}).get("requestedFeatures", [])
    if not isinstance(features, list):
        return ["performance"]
    return [feature for feature in features if isinstance(feature, str)] or ["performance"]


def _minecraft_version(intent: dict[str, Any]) -> str:
    versions = intent.get("game", {}).get("minecraftVersions", [])
    if isinstance(versions, list) and versions and isinstance(versions[0], str):
        return versions[0]
    return "1.20.1"


def _alias_matches(features: list[str]) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    seen: set[str] = set()
    for feature in features:
        for name in FEATURE_TO_RESOURCE_NAMES.get(feature, []):
            if name in seen:
                continue
            seen.add(name)
            resource = OFFLINE_RESOURCES[name]
            matches.append(
                {
                    "canonicalName": name,
                    "matchedAliases": [resource["sourceAlias"]],
                    "type": "mod",
                    "tags": [resource["feature"]],
                    "loaders": ["fabric"],
                    "needsVerification": True,
                    "sourceIds": {
                        "modrinthProjectId": None,
                        "modrinthSlug": resource["slug"],
                        "curseforgeId": None,
                    },
                }
            )
    return matches


def _resolver_queries(alias_matches: list[dict[str, Any]], minecraft_version: str) -> list[dict[str, Any]]:
    queries: list[dict[str, Any]] = []
    for match in alias_matches:
        slug = match["sourceIds"]["modrinthSlug"]
        queries.append(
            {
                "source": "modrinth",
                "canonicalName": match["canonicalName"],
                "query": slug,
                "projectId": None,
                "slug": slug,
                "resourceType": "mod",
                "loaders": ["fabric"],
                "gameVersions": [minecraft_version],
                "tags": match["tags"],
                "required": "dependency" in match["tags"] or match["tags"][0] in {"performance", "shader"},
                "reason": f"Matched offline alias {match['matchedAliases'][0]} for pipeline planning.",
                "riskPreference": "stable",
                "needsVerification": True,
                "sourceAlias": match["matchedAliases"][0],
            }
        )
    return queries


def _resources_for_queries(queries: list[dict[str, Any]], minecraft_version: str) -> list[dict[str, Any]]:
    resources: list[dict[str, Any]] = []
    seen: set[str] = set()
    by_slug = {resource["slug"]: (name, resource) for name, resource in OFFLINE_RESOURCES.items()}

    for query in queries:
        entry = by_slug.get(query["slug"])
        if not entry:
            continue
        name, resource = entry
        if resource["projectId"] in seen:
            continue
        seen.add(resource["projectId"])
        resources.append(_resource_candidate(name, resource, query, minecraft_version))

    if not resources:
        fallback = OFFLINE_RESOURCES["Sodium"]
        fallback_query = {
            "required": True,
            "reason": "Fallback offline performance candidate.",
        }
        resources.append(_resource_candidate("Sodium", fallback, fallback_query, minecraft_version))

    return resources


def _resource_candidate(
    name: str,
    resource: dict[str, Any],
    query: dict[str, Any],
    minecraft_version: str,
) -> dict[str, Any]:
    slug_id = resource["slug"].replace("-", "_")
    return {
        "resourceId": f"res_{slug_id}_mock",
        "type": "mod",
        "source": "community-rule",
        "project": {
            "name": name,
            "slug": resource["slug"],
            "projectId": resource["projectId"],
        },
        "version": {
            "versionId": f"mock-{resource['slug']}-version",
            "versionNumber": "mock",
            "releaseType": "release",
        },
        "required": bool(query.get("required", True)),
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


def _diagnostics(
    alias_matches: list[dict[str, Any]],
    resolver_queries: list[dict[str, Any]],
    resources: list[dict[str, Any]],
    enable_network: bool,
) -> dict[str, Any]:
    warnings = [
        {
            "code": "ALIAS_NEEDS_VERIFICATION",
            "message": f"{match['canonicalName']} alias metadata requires resolver verification.",
        }
        for match in alias_matches
        if match.get("needsVerification")
    ]
    if enable_network:
        warnings.append(
            {
                "code": "NETWORK_REQUEST_DISABLED",
                "message": "enableNetwork=true was requested, but network access is disabled for M4 server integration.",
            }
        )

    return {
        "aliasMatches": alias_matches,
        "resolverQueries": resolver_queries,
        "candidatesResolved": len(resources),
        "warnings": warnings,
        "errors": [],
        "networkUsed": False,
    }


def _dedupe_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    result: list[dict[str, str]] = []
    for message in messages:
        key = (message["code"], message["message"])
        if key in seen:
            continue
        seen.add(key)
        result.append(message)
    return result


def _stable_id(value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]
    return f"pipeline_{digest}"
