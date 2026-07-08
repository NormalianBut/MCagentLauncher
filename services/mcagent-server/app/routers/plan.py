from fastapi import APIRouter

from app.schemas.validation import validate_response
from app.services.plan_generator import generate_plan

router = APIRouter()


@router.post("/plan")
def plan(intent: dict) -> dict:
    return validate_response("resource-plan", generate_plan(intent))
