"""Socket.IO server and broadcast helpers for TrustNet."""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict
from urllib.parse import parse_qs

import socketio

from services import trust_engine

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

_sid_to_session: Dict[str, str] = {}


def _session_payload(session) -> Dict[str, Any]:
    return {
        "session_id": session.session_id,
        "user_id": session.user_id,
        "trust_score": session.trust_score,
        "delta": 0,
        "access_level": session.access_level,
        "is_compromised": session.is_compromised,
        "ip_status": session.ip_status,
        "location": session.location,
        "pending_action": session.pending_action,
        "needs_passkey": session.needs_passkey,
        "needs_camera_after_passkey": session.needs_camera_after_passkey,
        "passkey_verified": session.passkey_verified,
        "camera_verified": session.camera_verified,
        "passkey_due_at": session.passkey_due_at,
        "face_fail_attempts": session.face_fail_attempts,
        "anomalies": session.anomalies,
        "login_time": session.login_time,
        "face_verified_this_session": session.face_verified_this_session,
    }


async def emit_trust_update(session) -> None:
    if not session:
        return
    await sio.emit("trust_update", _session_payload(session), room=session.session_id)


async def emit_anomaly(session, signal_type: str, message: str) -> None:
    cfg = trust_engine.TRUST_SIGNALS.get(signal_type, {})
    action = cfg.get("action", "flag_monitor")
    sev = "high" if "block" in str(action) or signal_type in ("datacenter_ip", "tor_exit_node") else "medium"
    await sio.emit(
        "anomaly_detected",
        {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "type": signal_type,
            "severity": sev,
            "action_required": action,
            "message": message,
        },
        room=session.session_id,
    )


async def broadcast_account_compromised(session) -> None:
    if not session or not session.user:
        return
    u = session.user
    await sio.emit(
        "account_compromised",
        {
            "user_id": u.id,
            "name": u.name,
            "role": u.role,
            "privilege_score": u.privilege_score,
            "trust_score": session.trust_score,
            "is_admin": u.role == "Administrator",
        },
    )


async def broadcast_access_restored(user_id: str, restored_by: str) -> None:
    await sio.emit(
        "access_restored",
        {"user_id": user_id, "restored_by": restored_by, "timestamp": datetime.now().isoformat()},
    )


async def broadcast_remediation_applied(payload: Dict[str, Any]) -> None:
    await sio.emit("remediation_applied", payload)


@sio.event
async def connect(sid, environ, auth):
    qs = parse_qs(environ.get("QUERY_STRING", ""))
    raw = (qs.get("session_id") or [None])[0]
    session_id = raw
    if session_id:
        _sid_to_session[sid] = session_id
        await sio.enter_room(sid, session_id)


@sio.event
async def disconnect(sid):
    _sid_to_session.pop(sid, None)


@sio.event
async def session_heartbeat(sid, data):
    session_id = (data or {}).get("session_id") or _sid_to_session.get(sid)
    if not session_id:
        return
    scenario = (data or {}).get("simulated_ip_scenario")
    if scenario:
        result = trust_engine.inject_demo_scenario(session_id, scenario)
        session = trust_engine.get_session(session_id)
        if session:
            await emit_trust_update(session)
            if result.get("is_compromised"):
                await broadcast_account_compromised(session)
    else:
        session = trust_engine.get_session(session_id)
        if session:
            await emit_trust_update(session)


async def trust_broadcast_loop():
    """Periodic trust_update for active sessions (demo / judges)."""
    while True:
        await asyncio.sleep(5)
        for session in trust_engine.get_all_sessions():
            try:
                await emit_trust_update(session)
            except Exception:
                pass


def register_lifespan_handlers(app):
    @app.on_event("startup")
    async def _startup():
        asyncio.create_task(trust_broadcast_loop())
