from fastapi import APIRouter

from app.schemas.validation import validate_response

router = APIRouter()


def service_info() -> dict:
    return {
        "schemaVersion": "0.1.0",
        "service": {
            "name": "mcagent-server",
            "version": "0.1.0",
            "environment": "development",
        },
        "api": {
            "version": "v1",
            "supportedSchemaVersions": ["0.1.0"],
        },
        "mode": {
            "planning": "offline",
            "networkEnabledByDefault": False,
        },
        "capabilities": {
            "intentParse": True,
            "resourcePlan": True,
            "planExplanation": True,
            "liveResourceResolver": False,
            "installExecution": False,
            "localFileAccess": False,
            "environmentProbe": False,
            "minecraftLaunch": False,
        },
        "safety": {
            "plannerOnly": True,
            "canDownload": False,
            "canWriteLocalFiles": False,
            "canLaunchProcesses": False,
        },
    }


@router.get("/meta")
def meta() -> dict:
    return validate_response("service-info", service_info())
