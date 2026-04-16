from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime

from models import FaceVerifyRequest, FaceEnrollRequest
from services import trust_engine
from routers.auth import verify_token
from realtime import emit_trust_update, broadcast_account_compromised

router = APIRouter(prefix="/verify", tags=["verification"])


async def _emit_after_session(session_id: str):
    session = trust_engine.get_session(session_id)
    if not session:
        return
    await emit_trust_update(session)
    if session.is_compromised:
        await broadcast_account_compromised(session)


@router.post("/face")
async def verify_face(request: FaceVerifyRequest):
    session = trust_engine.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.last_updated = datetime.now().isoformat()

    if request.liveness_passed and request.match_confidence >= 0.6:
        result = trust_engine.add_trust_signal(request.session_id, "liveness_pass")
        session.face_verified_this_session = True
        session.camera_verified = True
        session.face_fail_attempts = 0
        session.pending_action = None
        session.needs_camera_after_passkey = False
        session.trust_score = max(session.trust_score, 90)
        session.access_level = "full"
        session.is_compromised = False
        if request.face_descriptor:
            trust_engine.update_user_face_enrollment(session.user_id, list(request.face_descriptor))
        result["face_passed"] = True
        await _emit_after_session(request.session_id)
        return result

    if request.match_confidence < 0.4:
        session.face_fail_attempts += 1
        if session.face_fail_attempts >= 3:
            result = trust_engine.add_trust_signal(request.session_id, "face_match_fail")
            session.pending_action = None
            await _emit_after_session(request.session_id)
            return {"error": "Face verification failed. Account is now restricted.", **result}
        session.pending_action = "camera_challenge"
        await _emit_after_session(request.session_id)
        return {
            "warning": "Face mismatch. Try again.",
            "attempts_used": session.face_fail_attempts,
            "attempts_left": 3 - session.face_fail_attempts,
        }

    if 0.4 <= request.match_confidence < 0.6:
        session.face_fail_attempts += 1
        if session.face_fail_attempts >= 3:
            result = trust_engine.add_trust_signal(request.session_id, "face_match_fail")
            session.pending_action = None
            await _emit_after_session(request.session_id)
            return {"error": "Face verification failed. Account is now restricted.", **result}
        session.pending_action = "camera_challenge"
        await _emit_after_session(request.session_id)
        return {
            "warning": "Uncertain face match. Try again.",
            "attempts_used": session.face_fail_attempts,
            "attempts_left": 3 - session.face_fail_attempts,
        }

    return {"success": True}


@router.post("/face/enroll")
async def enroll_face(request: FaceEnrollRequest):
    session = trust_engine.get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    trust_engine.update_user_face_enrollment(session.user_id, request.face_descriptor)
    return {"message": "Face enrolled successfully"}


@router.get("/face/status/{user_id}")
async def get_face_status(user_id: str, token_data: dict = Depends(verify_token)):
    if token_data.get("sub") != user_id and token_data.get("role") != "Administrator":
        raise HTTPException(status_code=403, detail="Forbidden")
    user = trust_engine.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "enrolled": user.face_enrolled,
        "last_enrollment": user.last_face_enrollment,
        "quality_score": 0.85 if user.face_enrolled else None,
        "has_descriptor": user.face_descriptor is not None and len(user.face_descriptor or []) > 0,
    }


@router.get("/face/descriptor/{user_id}")
async def get_face_descriptor_self(user_id: str, token_data: dict = Depends(verify_token)):
    if token_data.get("sub") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = trust_engine.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"descriptor": user.face_descriptor or None}
