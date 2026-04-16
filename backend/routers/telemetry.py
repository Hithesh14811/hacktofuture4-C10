from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from models import BehaviorTelemetryRequest, RuntimeAccessRequest
from realtime import broadcast_account_compromised, emit_trust_update
from services import rl_model_service, trust_engine
from services.graph_service import graph_service

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
security = HTTPBearer()
SECRET_KEY = "trustnet-secret-key-demo-2024"
ALGORITHM = "HS256"

USER_TO_GRAPH = {
    "usr_001": "sarah",
    "usr_002": "vikram",
    "usr_003": "priya",
    "usr_004": "rahul",
    "usr_005": "cicd",
}

RESOURCE_TO_GRAPH = {
    "iam": "admin_role",
    "services": "devops_role",
    "secrets": "secrets_res",
    "secret:prod/database/password": "secrets_res",
    "secret:prod/stripe/api_key": "secrets_res",
    "secret:prod/jwt/secret": "secrets_res",
    "secret:staging/database/password": "s3_res",
    "secret:prod/aws/access_key": "admin_policy",
    "ec2": "devops_role",
    "lambda": "lambda_res",
    "s3": "s3_res",
    "rds": "crown_db",
    "athena": "crown_db",
}


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def _emit_session(session_id: str) -> None:
    session = trust_engine.get_session(session_id)
    if not session:
        return
    await emit_trust_update(session)
    if session.is_compromised:
        await broadcast_account_compromised(session)


@router.post("/behavior")
async def ingest_behavior_telemetry(
    body: BehaviorTelemetryRequest,
    token_data: dict = Depends(verify_token),
):
    session_id = token_data.get("session_id")
    session = trust_engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if body.device_context:
        trust_engine.update_session_device_context(session_id, body.device_context.model_dump())

    resources = body.resources or ([body.resource] if body.resource else [])
    summary = dict(session.telemetry_state or {})
    prior_resources = set(summary.get("resources", []))
    summary.update(
        {
            "samples": int(summary.get("samples", 0)) + 1,
            "last_route": body.route,
            "last_resource": body.resource or (resources[-1] if resources else ""),
            "resources": list(dict.fromkeys([*(summary.get("resources", [])), *resources]))[-20:],
            "routes": list(dict.fromkeys([*(summary.get("routes", [])), body.route]))[-20:],
            "typing_speed_cpm": body.typing_speed_cpm,
            "key_hold_mean_ms": body.key_hold_mean_ms,
            "key_flight_mean_ms": body.key_flight_mean_ms,
            "mouse_velocity_mean": body.mouse_velocity_mean,
            "mouse_curve_ratio": body.mouse_curve_ratio,
            "click_count": body.click_count,
            "scroll_distance": body.scroll_distance,
            "api_calls": int(summary.get("api_calls", 0)) + body.api_calls,
            "privilege_escalation_attempts": int(summary.get("privilege_escalation_attempts", 0)) + body.privilege_escalation_attempts,
            "data_volume_read": round(float(summary.get("data_volume_read", 0.0)) + body.data_volume_read, 2),
            "data_volume_written": round(float(summary.get("data_volume_written", 0.0)) + body.data_volume_written, 2),
        }
    )

    assessment = rl_model_service.evaluate(session, body)
    trust_engine.apply_model_assessment(session_id, assessment, telemetry_summary=summary)

    if body.privilege_escalation_attempts:
        trust_engine.add_trust_signal(session_id, "role_assumption_attempt")
    if body.api_calls >= 8:
        trust_engine.add_trust_signal(session_id, "rapid_api_calls")
    if resources and any(resource not in prior_resources for resource in resources):
        trust_engine.add_trust_signal(session_id, "new_resource_access")

    await _emit_session(session_id)
    return {
        "session_id": session_id,
        "assessment": assessment,
        "trust_score": session.trust_score,
        "access_level": session.access_level,
        "is_compromised": session.is_compromised,
    }


@router.post("/access")
async def record_runtime_access(
    body: RuntimeAccessRequest,
    token_data: dict = Depends(verify_token),
):
    session_id = token_data.get("session_id")
    user_id = token_data.get("sub")
    session = trust_engine.record_runtime_access(
        session_id,
        body.route,
        body.resource,
        body.data_volume_read,
        body.data_volume_written,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    identity_node_id = USER_TO_GRAPH.get(user_id)
    resource_node_id = RESOURCE_TO_GRAPH.get(body.resource) or RESOURCE_TO_GRAPH.get(body.route.strip("/").split("/")[-1])
    if identity_node_id and resource_node_id:
        graph_service.record_access(identity_node_id, resource_node_id, body.action, session_id)

    if body.privileged and session.trust_score < 60:
        trust_engine.add_trust_signal(session_id, "role_assumption_attempt")

    await _emit_session(session_id)
    return {"ok": True, "recent_resources": session.recent_resources, "api_call_count": session.api_call_count}


@router.get("/model")
async def get_model_status(token_data: dict = Depends(verify_token)):
    return rl_model_service.get_model_status()


@router.put("/model")
async def set_model_path(body: dict, token_data: dict = Depends(verify_token)):
    user = trust_engine.get_user_by_id(token_data.get("sub"))
    if not user or user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")
    model_path = str(body.get("model_path", "")).strip()
    if not model_path:
        raise HTTPException(status_code=400, detail="model_path is required")
    return rl_model_service.configure_model_path(model_path)


@router.get("/runtime-log")
async def get_runtime_access_log(token_data: dict = Depends(verify_token)):
    user = trust_engine.get_user_by_id(token_data.get("sub"))
    if not user or user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"events": graph_service.get_runtime_access_log()}
