from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models import SessionTrustState
from services import trust_engine
from realtime import emit_trust_update, broadcast_account_compromised

router = APIRouter(prefix="/trust", tags=["trust"])


@router.get("/session/{session_id}")
async def get_session_trust(session_id: str):
    session = trust_engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session


class SignalRequest(BaseModel):
    session_id: str
    signal_type: str


class ScenarioRequest(BaseModel):
    session_id: str
    scenario: str


async def _emit_session_trust(session_id: str, result: dict):
    if "error" in result:
        return
    session = trust_engine.get_session(session_id)
    if not session:
        return
    await emit_trust_update(session)
    if result.get("is_compromised"):
        await broadcast_account_compromised(session)


@router.post("/signal")
async def add_signal(request: SignalRequest):
    result = trust_engine.add_trust_signal(request.session_id, request.signal_type)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    await _emit_session_trust(request.session_id, result)
    return result


@router.get("/history/{session_id}")
async def get_trust_history(session_id: str):
    state = trust_engine.get_trust_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    return state


@router.post("/demo/inject")
async def inject_demo_scenario(request: ScenarioRequest):
    result = trust_engine.inject_demo_scenario(request.session_id, request.scenario)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    await _emit_session_trust(request.session_id, result)
    return result


@router.post("/demo/reset")
async def reset_all_scores():
    trust_engine.reset_trust_scores()
    for session in trust_engine.get_all_sessions():
        await emit_trust_update(session)
    return {"message": "All trust scores reset"}


@router.put("/session/{session_id}/ip")
async def update_session_ip(
    session_id: str,
    ip_address: str,
    ip_status: str = "CLEAN",
):
    trust_engine.update_session_ip(session_id, ip_address, ip_status)
    session = trust_engine.get_session(session_id)
    if session:
        await emit_trust_update(session)
    return session


@router.put("/session/{session_id}/location")
async def update_session_location(
    session_id: str,
    city: str,
    country: str,
    lat: float,
    lon: float,
):
    session = trust_engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.location = {"city": city, "country": country, "lat": lat, "lon": lon}
    session.last_updated = datetime.now().isoformat()
    await emit_trust_update(session)
    return session
