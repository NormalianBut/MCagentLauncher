from fastapi import APIRouter

from app.services.plan_generator import generate_plan

router = APIRouter()


@router.post("/plan")
def plan(intent: dict) -> dict:
    return generate_plan(intent)

