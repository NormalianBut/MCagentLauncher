from fastapi import APIRouter

from app.schemas.validation import validate_response
from app.services.plan_generator import generate_plan
from app.services.planning_pipeline_adapter import generate_pipeline_plan

router = APIRouter()


@router.post("/plan")
def plan(payload: dict) -> dict:
    intent, options, wrapped_request = _parse_plan_request(payload)
    mode = options.get("mode", "pipeline")

    if mode == "mock":
        generated_plan = validate_response("resource-plan", generate_plan(intent))
        if wrapped_request:
            return {
                "plan": generated_plan,
                "diagnostics": _mock_diagnostics(),
            }
        return generated_plan

    generated = generate_pipeline_plan(intent, options)
    validated_plan = validate_response("resource-plan", generated["plan"])
    if wrapped_request:
        return {
            "plan": validated_plan,
            "diagnostics": generated["diagnostics"],
        }
    return validated_plan


def _parse_plan_request(payload: dict) -> tuple[dict, dict, bool]:
    if "intent" in payload:
        intent = payload.get("intent")
        options = payload.get("options", {})
        return (
            intent if isinstance(intent, dict) else {},
            options if isinstance(options, dict) else {},
            True,
        )
    return payload, {"mode": "pipeline", "enableNetwork": False}, False


def _mock_diagnostics() -> dict:
    return {
        "aliasMatches": [],
        "resolverQueries": [],
        "candidatesResolved": 0,
        "warnings": [
            {
                "code": "MOCK_MODE_SELECTED",
                "message": "Request selected legacy mock mode instead of pipeline-compatible mode.",
            }
        ],
        "errors": [],
        "networkUsed": False,
    }
