from datetime import datetime
import random
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from services import trust_engine
from realtime import broadcast_access_restored, emit_trust_update, broadcast_admin_recovery_update
from models import AdminRecoveryVoteRequest

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBearer()
SECRET_KEY = "trustnet-secret-key-demo-2024"
ALGORITHM = "HS256"


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/users")
async def list_users(token_data: dict = Depends(verify_token)):
    payload = token_data
    user = trust_engine.get_user_by_id(payload.get("sub"))
    if not user or user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")

    users = trust_engine.get_all_users()
    sessions = trust_engine.get_all_sessions()

    result = []
    for u in users:
        user_sessions = [s for s in sessions if s.user_id == u.id]
        row = u.model_dump()
        row["password"] = "***"
        row["active_sessions"] = len(user_sessions)
        row["trust_score"] = user_sessions[0].trust_score if user_sessions else None
        result.append(row)

    return result


@router.get("/sessions")
async def list_sessions(token_data: dict = Depends(verify_token)):
    payload = token_data
    user = trust_engine.get_user_by_id(payload.get("sub"))
    if not user or user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")

    sessions = trust_engine.get_all_sessions()
    return [s.model_dump() for s in sessions]


@router.delete("/sessions/{session_id}")
async def terminate_session(session_id: str, token_data: dict = Depends(verify_token)):
    payload = token_data
    user = trust_engine.get_user_by_id(payload.get("sub"))
    if not user or user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")

    if not trust_engine.get_session(session_id):
        raise HTTPException(status_code=404, detail="Session not found")

    trust_engine.terminate_session(session_id)
    return {"message": f"Session {session_id} terminated"}


@router.post("/restore/{user_id}")
async def restore_access(user_id: str, token_data: dict = Depends(verify_token)):
    payload = token_data
    admin = trust_engine.get_user_by_id(payload.get("sub"))
    if not admin or admin.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")

    count = trust_engine.restore_user_access(user_id)

    for s in trust_engine.get_all_sessions():
        if s.user_id == user_id:
            await emit_trust_update(s)

    await broadcast_access_restored(user_id, admin.name)
    return {"message": f"Access restored for {user_id} across {count} sessions"}


class FaceEnrollRequest(BaseModel):
    descriptor: Optional[List[float]] = None

@router.post("/users/{user_id}/face-enroll")
async def admin_face_enroll_user(user_id: str, request: FaceEnrollRequest, token_data: dict = Depends(verify_token)):
    payload = token_data
    admin = trust_engine.get_user_by_id(payload.get("sub"))
    if not admin or admin.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")

    target = trust_engine.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "Administrator":
        raise HTTPException(status_code=400, detail="Admin account does not require pre-enrollment")

    if request.descriptor:
        descriptor = request.descriptor
    else:
        descriptor = [round(random.uniform(-0.15, 0.15), 6) for _ in range(128)]
        
    trust_engine.update_user_face_enrollment(user_id, descriptor)
    trust_engine.sync_session_user(user_id)
    return {"message": f"Face enrolled for {target.name}", "user_id": user_id}


@router.delete("/users/{user_id}/face-enroll")
async def admin_face_reset_user(user_id: str, token_data: dict = Depends(verify_token)):
    payload = token_data
    admin = trust_engine.get_user_by_id(payload.get("sub"))
    if not admin or admin.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin access required")

    target = trust_engine.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    trust_engine.clear_user_face_enrollment(user_id)
    return {"message": f"Face enrollment reset for {target.name}", "user_id": user_id}


@router.get("/notifications")
async def get_notifications(token_data: dict = Depends(verify_token)):
    current_user = trust_engine.get_user_by_id(token_data.get("sub"))
    sessions = trust_engine.get_all_sessions()

    notifications = []
    for session in sessions:
        if session.is_compromised:
            notifications.append({
                "id": f"comp_{session.session_id}",
                "severity": "critical",
                "message": f"Account {session.user.name if session.user else session.user_id} flagged as compromised",
                "timestamp": session.last_updated,
                "user_id": session.user_id
            })
        elif session.trust_score < 60:
            notifications.append({
                "id": f"warn_{session.session_id}",
                "severity": "warning",
                "message": f"Trust score dropped below 60 for {session.user.name if session.user else session.user_id}",
                "timestamp": session.last_updated,
                "user_id": session.user_id
            })

    if current_user and current_user.role != "Administrator":
        request = trust_engine.get_admin_recovery_request_for_user("usr_001")
        if request and request["status"] == "pending":
            notifications.append({
                "id": f"admin_recovery_{request['request_id']}",
                "severity": "critical",
                "message": "Administrator account recovery requires your approval vote.",
                "timestamp": request["created_at"],
                "user_id": "usr_001",
                "request_id": request["request_id"],
                "vote_status": request["votes"].get(current_user.id),
            })

    return notifications


@router.post("/recovery/vote")
async def vote_on_admin_recovery(body: AdminRecoveryVoteRequest, token_data: dict = Depends(verify_token)):
    voter = trust_engine.get_user_by_id(token_data.get("sub"))
    if not voter or voter.role == "Administrator":
        raise HTTPException(status_code=403, detail="Only non-admin employees can vote")

    request = trust_engine.cast_admin_recovery_vote(body.request_id, voter.id, body.approve)
    if not request:
        raise HTTPException(status_code=404, detail="Recovery request not found")

    if request["status"] == "approved":
        sessions = trust_engine.get_all_sessions()
        for session in sessions:
            if session.user_id == request["user_id"]:
                session.trust_score = 100
                session.is_compromised = False
                session.anomalies = []
                trust_engine.clear_session_restrictions(session)
                session.access_level = "full"
                await emit_trust_update(session)
        await broadcast_access_restored(request["user_id"], voter.name)
    else:
        for session in trust_engine.get_all_sessions():
            if session.user_id == request["user_id"]:
                session.admin_recovery_status = request["status"]
                await emit_trust_update(session)

    await broadcast_admin_recovery_update(
        {
            "request_id": request["request_id"],
            "user_id": request["user_id"],
            "status": request["status"],
            "votes": request["votes"],
            "eligible_voters": request["eligible_voters"],
        }
    )
    return request
