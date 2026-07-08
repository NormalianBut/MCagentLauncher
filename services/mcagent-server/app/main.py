from fastapi import FastAPI

from app.routers import explain, health, intent, plan

app = FastAPI(
    title="MCagentlauncher MCAgent Mock Server",
    version="0.1.0",
    description="Rule-based v0.1 mock server. It does not call model APIs or download resources.",
)

app.include_router(health.router)
app.include_router(intent.router, prefix="/v1/intent", tags=["intent"])
app.include_router(plan.router, prefix="/v1/resources", tags=["resources"])
app.include_router(explain.router, prefix="/v1/explain", tags=["explain"])

