from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.intent_parser import parse_intent

router = APIRouter()


class ParseIntentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/parse")
def parse(request: ParseIntentRequest) -> dict:
    return parse_intent(request.text)

