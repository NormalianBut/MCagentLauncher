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


def test_plan_contains_sodium_iris_and_appleskin() -> None:
    intent = client.post(
        "/v1/intent/parse",
        json={"text": "我想玩 1.20.1，低配光影生存，要优化、小地图、苹果皮。"},
    ).json()
    response = client.post("/v1/resources/plan", json=intent)
    assert response.status_code == 200
    plan = response.json()
    names = {item["project"]["name"] for item in plan["resources"]}
    assert {"Sodium", "Iris Shaders", "AppleSkin"}.issubset(names)
    assert plan["userConfirmation"] == {"required": True, "confirmed": False}
    assert plan["ruleResults"]["warnings"][0]["code"] == "MOCK_PLAN_NOT_RESOLVED"
    assert validate_response("resource-plan", plan) == plan


def test_explain_returns_chinese_summary() -> None:
    intent = client.post("/v1/intent/parse", json={"text": "低配光影生存 苹果皮"}).json()
    plan = client.post("/v1/resources/plan", json=intent).json()
    response = client.post("/v1/explain/plan", json=plan)
    assert response.status_code == 200
    body = response.json()
    assert "这是一个" in body["summary"]
    assert body["details"]
    assert body["warnings"]


def test_no_commercial_api_or_download_behavior() -> None:
    intent = client.post("/v1/intent/parse", json={"text": "低配光影生存 苹果皮"}).json()
    plan = client.post("/v1/resources/plan", json=intent).json()
    assert "download_url" not in str(plan).lower()
    assert "openai" not in str(plan).lower()
    assert "anthropic" not in str(plan).lower()
    assert "gemini" not in str(plan).lower()
    assert all(item["verification"]["hashKnown"] is False for item in plan["resources"])


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
    def invalid_plan(_: dict) -> dict:
        return {
            "schemaVersion": "0.1.0",
            "planId": "plan_invalid_mock",
        }

    monkeypatch.setattr(plan_router, "generate_plan", invalid_plan)

    response = client.post("/v1/resources/plan", json={"schemaVersion": "0.1.0"})

    assert response.status_code == 500
    body = response.json()
    assert body["detail"]["error"] == "schema_validation_failed"
    assert body["detail"]["schema"] == "resource-plan.schema.json"
    assert body["detail"]["details"]
