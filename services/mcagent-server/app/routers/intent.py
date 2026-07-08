from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.schemas.validation import validate_response
from app.services.intent_parser import parse_intent

router = APIRouter()


class ParseIntentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@router.post("/parse")
def parse(request: ParseIntentRequest) -> dict:
    return validate_response("intent", parse_intent(request.text))
