from fastapi.testclient import TestClient

import app.routers.intent as intent_router
import app.routers.plan as plan_router
from app.main import app
from app.schemas.validation import validate_response

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "mcagent-server",
        "version": "0.1.0",
    }


def test_parse_low_spec_shader_survival() -> None:
    response = client.post(
        "/v1/intent/parse",
        json={"text": "我想玩 1.20.1，低配光影生存，要优化、小地图、苹果皮，别太复杂。"},
    )
    assert response.status_code == 200
    intent = response.json()
    features = intent["preferences"]["requestedFeatures"]
    assert intent["game"]["minecraftVersions"] == ["1.20.1"]
    assert intent["game"]["loader"] == "fabric"
    assert "performance" in features
    assert "shader" in features
    assert "survival" in features
    assert "minimap" in features
    assert validate_response("intent", intent) == intent


def test_appleskin_enters_required_features() -> None:
    response = client.post("/v1/intent/parse", json={"text": "生存要苹果皮，不要魔法。"})
    assert response.status_code == 200
    intent = response.json()
    assert "AppleSkin" in intent["preferences"]["requestedFeatures"]
    assert "magic" in intent["preferences"]["avoidFeatures"]
    assert intent["constraints"]["requireStableReleases"] is True


def test_old_format_intent_request_still_returns_plan() -> None:
    intent = low_spec_intent()
    response = client.post("/v1/resources/plan", json=intent)
    assert response.status_code == 200
    plan = response.json()
    names = {item["project"]["name"] for item in plan["resources"]}
    assert {"Sodium", "Iris Shaders", "AppleSkin"}.issubset(names)
    assert plan["userConfirmation"] == {"required": True, "confirmed": False}
    assert plan["ruleResults"]["warnings"][0]["code"] == "PIPELINE_OFFLINE_MOCK_RESOLVER"
    assert validate_response("resource-plan", plan) == plan


def test_new_wrapper_request_returns_plan_and_diagnostics() -> None:
    response = client.post(
        "/v1/resources/plan",
        json={
            "intent": low_spec_intent(),
            "options": {
                "mode": "pipeline",
                "enableNetwork": False,
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"schemaVersion", "plan", "diagnostics"}
    assert body["schemaVersion"] == "0.1.0"
    assert body["diagnostics"]["networkUsed"] is False
    assert isinstance(body["diagnostics"]["warnings"], list)
    assert isinstance(body["diagnostics"]["errors"], list)
    assert body["diagnostics"]["candidatesResolved"] >= 3
    assert body["diagnostics"]["aliasMatches"]
    assert body["diagnostics"]["resolverQueries"]
    assert validate_response("resource-plan", body["plan"]) == body["plan"]
    assert validate_response("plan-response", body) == body


def test_default_enable_network_false_for_wrapper() -> None:
    response = client.post(
        "/v1/resources/plan",
        json={
            "intent": low_spec_intent(),
            "options": {
                "mode": "pipeline",
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["diagnostics"]["networkUsed"] is False


def test_enable_network_true_does_not_download_install_or_use_network_in_m4() -> None:
    response = client.post(
        "/v1/resources/plan",
        json={
            "intent": low_spec_intent(),
            "options": {
                "mode": "pipeline",
                "enableNetwork": True,
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    serialized = str(body).lower()
    assert body["diagnostics"]["networkUsed"] is False
    assert validate_response("plan-response", body) == body
    assert "ENABLE_NETWORK_IGNORED" in {warning["code"] for warning in body["plan"]["ruleResults"]["warnings"]}
    assert "download_url" not in serialized
    assert "downloadurl" not in serialized
    assert "installpath" not in serialized
    assert "localpath" not in serialized
    assert "mods/" not in serialized
    assert "resourcepacks/" not in serialized
    assert "shaderpacks/" not in serialized


def test_mock_mode_remains_available_with_wrapper() -> None:
    response = client.post(
        "/v1/resources/plan",
        json={
            "intent": low_spec_intent(),
            "options": {
                "mode": "mock",
                "enableNetwork": False,
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["diagnostics"]["networkUsed"] is False
    assert validate_response("resource-plan", body["plan"]) == body["plan"]
    assert validate_response("plan-response", body) == body


def test_explain_accepts_wrapper_and_returns_chinese_pipeline_summary() -> None:
    body = client.post(
        "/v1/resources/plan",
        json={
            "intent": low_spec_intent(),
            "options": {
                "mode": "pipeline",
                "enableNetwork": False,
            },
        },
    ).json()
    response = client.post("/v1/explain/plan", json=body)
    assert response.status_code == 200
    explanation = response.json()
    assert "离线资源规划" in explanation["summary"]
    assert any("不下载资源" in detail for detail in explanation["details"])
    assert any("networkUsed=false" in warning for warning in explanation["warnings"])


def test_explain_accepts_direct_plan() -> None:
    plan = client.post("/v1/resources/plan", json=low_spec_intent()).json()
    response = client.post("/v1/explain/plan", json=plan)
    assert response.status_code == 200
    assert "离线资源规划" in response.json()["summary"]


def test_no_commercial_api_or_download_behavior() -> None:
    body = client.post(
        "/v1/resources/plan",
        json={
            "intent": low_spec_intent(),
            "options": {
                "mode": "pipeline",
                "enableNetwork": False,
            },
        },
    ).json()
    serialized = str(body).lower()
    assert "download_url" not in serialized
    assert "openai" not in serialized
    assert "anthropic" not in serialized
    assert "gemini" not in serialized
    assert all(item["verification"]["hashKnown"] is False for item in body["plan"]["resources"])


def test_intent_schema_validation_failure_is_explicit(monkeypatch) -> None:
    def invalid_intent(_: str) -> dict:
        return {
            "schemaVersion": "0.1.0",
            "intentId": "intent_invalid_mock",
        }

    monkeypatch.setattr(intent_router, "parse_intent", invalid_intent)

    response = client.post("/v1/intent/parse", json={"text": "低配生存"})

    assert response.status_code == 500
    body = response.json()
    assert body["detail"]["error"] == "schema_validation_failed"
    assert body["detail"]["schema"] == "intent.schema.json"
    assert body["detail"]["details"]


def test_plan_schema_validation_failure_is_explicit(monkeypatch) -> None:
    def invalid_pipeline_plan(_: dict, __: dict | None = None) -> dict:
        return {
            "plan": {
                "schemaVersion": "0.1.0",
                "planId": "plan_invalid_mock",
            },
            "diagnostics": {},
        }

    monkeypatch.setattr(plan_router, "generate_pipeline_plan", invalid_pipeline_plan)

    response = client.post("/v1/resources/plan", json={"schemaVersion": "0.1.0"})

    assert response.status_code == 500
    body = response.json()
    assert body["detail"]["error"] == "schema_validation_failed"
    assert body["detail"]["schema"] == "resource-plan.schema.json"
    assert body["detail"]["details"]


def low_spec_intent() -> dict:
    return {
        "schemaVersion": "0.1.0",
        "intentId": "intent_low_spec_pipeline",
        "source": "test-fixture",
        "locale": "zh-CN",
        "prompt": {
            "rawText": "我想玩 1.20.1，低配光影生存，要优化、小地图、苹果皮。",
            "redacted": True,
        },
        "game": {
            "edition": "java",
            "minecraftVersions": ["1.20.1"],
            "loader": "fabric",
        },
        "preferences": {
            "playStyle": "visual",
            "performanceProfile": "low-spec",
            "resourceTypes": ["mod", "shaderpack"],
            "requestedFeatures": ["performance", "shader", "survival", "minimap", "AppleSkin"],
            "avoidFeatures": [],
        },
        "constraints": {
            "modLoaderRequired": True,
            "maxMemoryMb": 4096,
            "requireStableReleases": True,
            "allowOptionalResources": True,
            "privacy": {
                "allowTelemetry": False,
                "allowAnonymousCaseUpload": False,
            },
        },
    }
