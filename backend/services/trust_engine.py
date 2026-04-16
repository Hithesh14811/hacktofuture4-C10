import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from models import (
    User, Session, TrustSignal, SessionTrustState,
)

USERS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "users.json")

TRUST_SIGNALS = {
    "datacenter_ip": {"impact": -100, "action": "block_immediately"},
    "tor_exit_node": {"impact": -80, "action": "block_immediately"},
    "known_vpn": {"impact": -15, "action": "flag_monitor"},
    "suspicious_asn": {"impact": -20, "action": "flag_monitor"},
    "ip_rotation_3x": {"impact": -25, "action": "flag_monitor"},
    "clean_residential_ip": {"impact": +5, "action": "none"},
    "impossible_travel": {"impact": -35, "action": "passkey_challenge"},
    "new_country": {"impact": -20, "action": "passkey_challenge"},
    "mid_session_geo_shift": {"impact": -25, "action": "passkey_challenge"},
    "unusual_city": {"impact": -10, "action": "flag_monitor"},
    "known_location": {"impact": +5, "action": "none"},
    "passkey_success": {"impact": +10, "action": "none"},
    "passkey_failure": {"impact": -30, "action": "camera_challenge"},
    "passkey_timeout": {"impact": -20, "action": "camera_challenge"},
    "face_match_high": {"impact": +20, "action": "none"},
    "face_match_uncertain": {"impact": -10, "action": "flag_monitor"},
    "face_match_fail": {"impact": -50, "action": "restrict_access"},
    "camera_unavailable": {"impact": -20, "action": "restrict_critical"},
    "liveness_pass": {"impact": +15, "action": "none"},
    "liveness_fail": {"impact": -40, "action": "restrict_access"},
    "unusual_hour_access": {"impact": -10, "action": "flag_monitor"},
    "rapid_api_calls": {"impact": -15, "action": "flag_monitor"},
    "new_resource_access": {"impact": -5, "action": "flag_monitor"},
    "role_assumption_attempt": {"impact": -20, "action": "flag_monitor"},
    "admin_override_face": {"impact": 0, "action": "none"},
}

_sessions: Dict[str, Session] = {}
_users_cache: Optional[List[User]] = None


def load_users() -> List[User]:
    global _users_cache
    if _users_cache is None:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            _users_cache = [User(**u) for u in data]
    return _users_cache


def save_users_to_disk() -> None:
    users = load_users()
    out = []
    for u in users:
        d = u.model_dump()
        out.append(d)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)


def invalidate_users_cache() -> None:
    global _users_cache
    _users_cache = None


def get_user_by_email(email: str) -> Optional[User]:
    users = load_users()
    for user in users:
        if user.email.lower() == email.lower():
            return user
    return None


def get_user_by_id(user_id: str) -> Optional[User]:
    users = load_users()
    for user in users:
        if user.id == user_id:
            return user
    return None


def create_session(
    session_id: str,
    user: User,
    ip: str = "127.0.0.1",
    location_override: Optional[dict] = None,
    ip_status: str = "CLEAN",
) -> Session:
    loc = location_override or user.registered_location or {}
    session = Session(
        session_id=session_id,
        user_id=user.id,
        user=user,
        ip_address=ip,
        ip_status=ip_status,
        trust_score=100,
        baseline_score=100,
        last_updated=datetime.now().isoformat(),
        login_time=datetime.now().isoformat(),
        location={
            "city": loc.get("city", "Unknown"),
            "country": loc.get("country", "Unknown"),
            "lat": float(loc.get("lat", 0.0)),
            "lon": float(loc.get("lon", 0.0)),
        },
        face_verified_this_session=user.face_enrolled,
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> Optional[Session]:
    return _sessions.get(session_id)


def get_all_sessions() -> List[Session]:
    return list(_sessions.values())


def terminate_session(session_id: str) -> bool:
    return _sessions.pop(session_id, None) is not None


def update_session_ip(session_id: str, ip: str, ip_status: str):
    if session_id in _sessions:
        _sessions[session_id].ip_address = ip
        _sessions[session_id].ip_status = ip_status


def compute_access_level(trust_score: int, privilege_score: int) -> str:
    if trust_score <= 0:
        return "blocked"
    elif trust_score < 20:
        return "blocked" if privilege_score >= 70 else "read_only"
    elif trust_score < 40:
        return "read_only" if privilege_score >= 70 else "limited"
    elif trust_score < 60:
        return "limited" if privilege_score >= 70 else "standard"
    else:
        return "full"


def is_compromised(trust_score: int, privilege_score: int, anomaly_count: int) -> bool:
    if trust_score < 40:
        return True
    if anomaly_count >= 3 and trust_score < 60:
        return True
    if privilege_score >= 90 and trust_score < 70:
        return True
    return False


def add_trust_signal(session_id: str, signal_type: str) -> Dict[str, Any]:
    if session_id not in _sessions:
        return {"error": "Session not found"}

    session = _sessions[session_id]
    signal_config = TRUST_SIGNALS.get(signal_type, {})

    if not signal_config:
        return {"error": "Unknown signal type"}

    impact = signal_config["impact"]
    action = signal_config["action"]

    new_score = max(0, min(100, session.trust_score + impact))
    delta = new_score - session.trust_score

    session.trust_score = new_score
    session.last_updated = datetime.now().isoformat()

    if impact < 0:
        session.anomalies.append(signal_type)

    session.access_level = compute_access_level(
        new_score, session.user.privilege_score if session.user else 70
    )
    session.is_compromised = is_compromised(
        new_score,
        session.user.privilege_score if session.user else 70,
        len(session.anomalies),
    )

    session.pending_action = None if action == "none" else action

    signal = TrustSignal(
        signal_type=signal_type,
        value=signal_config,
        impact=impact,
        description=f"Signal: {signal_type}",
        timestamp=datetime.now().isoformat(),
    )
    session.signals = [*session.signals, signal]

    return {
        "session_id": session_id,
        "trust_score": new_score,
        "delta": delta,
        "action": action,
        "signal_type": signal_type,
        "is_compromised": session.is_compromised,
        "anomalies": session.anomalies,
    }


def inject_demo_scenario(session_id: str, scenario: str) -> Dict[str, Any]:
    scenarios = {
        "datacenter_ip": "datacenter_ip",
        "vpn": "known_vpn",
        "known_vpn": "known_vpn",
        "tor": "tor_exit_node",
        "simulate_tor": "tor_exit_node",
        "clean_ip": "clean_residential_ip",
        "impossible_travel": "impossible_travel",
        "new_country": "new_country",
        "mid_session_shift": "mid_session_geo_shift",
        "mid_session_geo_shift": "mid_session_geo_shift",
        "normal_location": "known_location",
        "city_change": "unusual_city",
        "unusual_city": "unusual_city",
        "passkey_success": "passkey_success",
        "passkey_failure": "passkey_failure",
        "face_match_success": "face_match_high",
        "face_match_fail": "face_match_fail",
        "camera_unavailable": "camera_unavailable",
        "liveness_fail": "liveness_fail",
        "admin_compromise": "impossible_travel",
    }
    signal_type = scenarios.get(scenario, scenario)
    return add_trust_signal(session_id, signal_type)


def reset_trust_scores():
    for session in _sessions.values():
        session.trust_score = 100
        session.baseline_score = 100
        session.anomalies = []
        session.is_compromised = False
        session.access_level = "full"
        session.pending_action = None
        session.signals = []


def get_trust_state(session_id: str) -> Optional[SessionTrustState]:
    session = get_session(session_id)
    if not session:
        return None

    return SessionTrustState(
        session_id=session.session_id,
        user_id=session.user_id,
        current_score=session.trust_score,
        baseline_score=session.baseline_score,
        signals=session.signals,
        anomalies=session.anomalies,
        is_compromised=session.is_compromised,
        access_level=session.access_level,
        last_updated=session.last_updated,
    )


def update_user_face_enrollment(user_id: str, face_descriptor: List[float]):
    users = load_users()
    for user in users:
        if user.id == user_id:
            user.face_enrolled = True
            user.face_descriptor = face_descriptor
            user.last_face_enrollment = datetime.now().isoformat()
            break
    save_users_to_disk()
    # Refresh in-memory session user snapshots
    fresh = get_user_by_id(user_id)
    if fresh:
        for s in _sessions.values():
            if s.user_id == user_id:
                s.user = fresh


def get_all_users() -> List[User]:
    return load_users()


def sync_session_user(user_id: str):
    u = get_user_by_id(user_id)
    if not u:
        return
    for s in _sessions.values():
        if s.user_id == user_id:
            s.user = u
