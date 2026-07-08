from __future__ import annotations

import hashlib
import re


def parse_intent(text: str) -> dict:
    normalized = text.strip()
    lowered = normalized.lower()
    features = _requested_features(normalized, lowered)
    avoid = _avoid_features(normalized, lowered)
    minecraft_version = _minecraft_version(normalized)

    resource_types = ["mod"]
    if "shader" in features:
        resource_types.append("shaderpack")

    return {
        "schemaVersion": "0.1.0",
        "intentId": f"intent_{_stable_id(normalized)}",
        "source": "desktop",
        "locale": "zh-CN" if _contains_cjk(normalized) else "en-US",
        "prompt": {
            "rawText": normalized,
            "redacted": True,
        },
        "game": {
            "edition": "java",
            "minecraftVersions": [minecraft_version],
            "loader": "fabric",
        },
        "preferences": {
            "playStyle": _play_style(features),
            "performanceProfile": "low-spec" if "performance" in features else "balanced",
            "resourceTypes": resource_types,
            "requestedFeatures": features,
            "avoidFeatures": avoid,
        },
        "constraints": {
            "modLoaderRequired": True,
            "maxMemoryMb": 4096 if "performance" in features else 8192,
            "requireStableReleases": True,
            "allowOptionalResources": True,
            "privacy": {
                "allowTelemetry": False,
                "allowAnonymousCaseUpload": False,
            },
        },
    }


def _requested_features(text: str, lowered: str) -> list[str]:
    features: list[str] = []
    rules = [
        (("低配", "不想卡", "不卡", "优化", "performance"), "performance"),
        (("光影", "shader"), "shader"),
        (("生存", "survival"), "survival"),
        (("小地图", "地图", "minimap"), "minimap"),
        (("苹果皮", "appleskin"), "AppleSkin"),
        (("建筑", "building"), "building"),
        (("探索", "冒险", "exploration", "adventure"), "exploration"),
    ]
    for needles, feature in rules:
        if any(needle in text or needle in lowered for needle in needles):
            features.append(feature)
    return features or ["vanilla-plus"]


def _avoid_features(text: str, lowered: str) -> list[str]:
    avoid: list[str] = []
    if "不要魔法" in text or "no magic" in lowered:
        avoid.append("magic")
    if "不要科技" in text or "no technology" in lowered:
        avoid.append("technology")
    return avoid


def _minecraft_version(text: str) -> str:
    exact = re.search(r"1\.(20|21)(?:\.\d+)?", text)
    if exact:
        version = exact.group(0)
        if version == "1.21":
            return "1.21.1"
        return version
    return "1.20.1"


def _play_style(features: list[str]) -> str:
    if "building" in features:
        return "building"
    if "exploration" in features:
        return "exploration"
    if "shader" in features:
        return "visual"
    if "performance" in features:
        return "low-spec"
    if "survival" in features:
        return "survival"
    return "vanilla-plus"


def _stable_id(text: str) -> str:
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]
    return f"mock_{digest}"


def _contains_cjk(text: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in text)
