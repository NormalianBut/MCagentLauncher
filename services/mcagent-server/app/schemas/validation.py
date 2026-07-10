from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

SCHEMA_ROOT = Path(__file__).resolve().parents[4] / "packages" / "schemas"

SCHEMA_FILES = {
    "intent": "intent.schema.json",
    "resource-plan": "resource-plan.schema.json",
    "plan-response": "plan-response.schema.json",
    "install-action": "install-action.schema.json",
    "instance-lock": "instance-lock.schema.json",
    "service-info": "service-info.schema.json",
}


def validate_response(schema_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Validate an API response payload before it leaves the mock server."""
    validator = _validator(schema_name)
    errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.path))
    if errors:
        raise _validation_exception(schema_name, errors)
    return payload


@lru_cache(maxsize=len(SCHEMA_FILES))
def _validator(schema_name: str) -> Draft202012Validator:
    if schema_name not in SCHEMA_FILES:
        raise ValueError(f"Unknown schema: {schema_name}")

    schema_path = SCHEMA_ROOT / SCHEMA_FILES[schema_name]
    with schema_path.open("r", encoding="utf-8") as file:
        schema = json.load(file)

    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def _validation_exception(schema_name: str, errors: list[ValidationError]) -> HTTPException:
    details = [
        {
            "path": _format_path(error),
            "message": error.message,
        }
        for error in errors[:10]
    ]
    return HTTPException(
        status_code=500,
        detail={
            "error": "schema_validation_failed",
            "schema": SCHEMA_FILES[schema_name],
            "details": details,
        },
    )


def _format_path(error: ValidationError) -> str:
    if not error.path:
        return "$"
    parts = [str(part) for part in error.path]
    return "$." + ".".join(parts)
