from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import explain, health, intent, plan

app = FastAPI(
    title="MCagentlauncher MCAgent Mock Server",
    version="0.1.0",
    description="Rule-based v0.1 mock server. It does not call model APIs or download resources.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)

app.include_router(health.router)
app.include_router(intent.router, prefix="/v1/intent", tags=["intent"])
app.include_router(plan.router, prefix="/v1/resources", tags=["resources"])
app.include_router(explain.router, prefix="/v1/explain", tags=["explain"])
