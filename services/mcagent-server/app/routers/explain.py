from fastapi import APIRouter

from app.services.explainer import explain_plan

router = APIRouter()


@router.post("/plan")
def explain(plan: dict) -> dict:
    return explain_plan(plan)

