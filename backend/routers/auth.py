import uuid
from datetime import datetime, timedelta
from typing import Optional
from math import radians, sin, cos, sqrt, atan2
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

from models import LoginRequest, LoginResponse
from services import trust_engine
from realtime import emit_trust_update, broadcast_account_compromised

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

SECRET_KEY = "trustnet-secret-key-demo-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

USER_IP_PROFILES = {
    "usr_001": { # Sarah (Admin)
        "trusted_ips": {"49.207.12.11", "223.190.82.14"},
        "blacklisted_ips": {"185.220.101.34"},
        "new_ips": {"191.101.210.20"}
    },
    "usr_002": { # Vikram
        "trusted_ips": {"106.51.89.12", "117.232.44.102"},
        "blacklisted_ips": {"193.32.162.72"},
        "new_ips": {"171.22.11.88"}
    },
    "usr_003": { # Priya
        "trusted_ips": {"49.43.91.9", "103.81.70.140"},
        "blacklisted_ips": {"190.2.145.26"},
        "new_ips": {"144.72.19.222"}
    },
    "usr_004": { # Rahul
        "trusted_ips": {"59.93.112.18", "27.59.221.10"},
        "blacklisted_ips": {"45.155.205.233"},
        "new_ips": {"121.15.41.9"}
    },
    "usr_005": { # CI/CD Bot
        "trusted_ips": {"10.0.0.9", "10.0.1.20"},
        "blacklisted_ips": {"104.244.74.11"},
        "new_ips": {"8.8.8.8"}
    },
}

DEMO_PASSWORDS = {
    "sarah.chen@trustnet.corp": "Admin@2024",
    "vikram.nair@trustnet.corp": "DevOps@2024",
    "priya.sharma@trustnet.corp": "Dev@2024",
    "rahul.mehta@trustnet.corp": "Data@2024",
    "cicd.bot@trustnet.corp": "Bot@2024",
}


def _expected_password(user) -> str:
    if getattr(user, "password", None):
        return user.password
    return DEMO_PASSWORDS.get(user.email.lower(), "")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def _apply_login_risk_context(user, session, request: LoginRequest) -> None:
    ip = request.mock_ip or session.ip_address
    location = request.mock_location or session.location
    profile = USER_IP_PROFILES.get(user.id, {"trusted_ips": set(), "blacklisted_ips": set()})

    ip_suspicious = False
    location_suspicious = False

    if ip in profile["blacklisted_ips"]:
        trust_engine.add_trust_signal(session.session_id, "suspicious_asn")
        session.ip_status = "BLACKLISTED"
        ip_suspicious = True
    elif ip not in profile["trusted_ips"]:
        # New/untrusted IP
        trust_engine.add_trust_signal(session.session_id, "known_vpn")
        session.ip_status = request.mock_ip_status or "NEW"
        ip_suspicious = True
    else:
        trust_engine.add_trust_signal(session.session_id, "clean_residential_ip")
        session.ip_status = request.mock_ip_status or "CLEAN"

    reg = user.registered_location or {}
    reg_lat = float(reg.get("lat", 0.0))
    reg_lon = float(reg.get("lon", 0.0))
    lat = float(location.get("lat", 0.0))
    lon = float(location.get("lon", 0.0))
    distance = _haversine_km(reg_lat, reg_lon, lat, lon)

    if distance > 700: # Completely different location
        trust_engine.add_trust_signal(session.session_id, "new_country")
        location_suspicious = True
    elif distance > 50: # Buffer/Nearby (increased from 150 to catch 'buffer' as suspicious but less so)
        trust_engine.add_trust_signal(session.session_id, "unusual_city")
        location_suspicious = True
    else:
        trust_engine.add_trust_signal(session.session_id, "known_location")

    if request.mock_signal:
        trust_engine.inject_demo_scenario(session.session_id, request.mock_signal)

    # Logic: 
    # 1. Either IP or Location suspicious -> Passkey after 5s
    # 2. Both IP and Location suspicious -> Camera after Passkey
    if ip_suspicious or location_suspicious:
        session.needs_passkey = True
        session.passkey_due_at = (datetime.now() + timedelta(seconds=5)).isoformat()
        session.pending_action = None
    
    if ip_suspicious and location_suspicious:
        session.needs_camera_after_passkey = True


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    user = trust_engine.get_user_by_email(request.email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if request.password != _expected_password(user):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # If face is already stored (enrolled), allow direct login
    if user.face_enrolled:
        requires_face_verification = False
    else:
        # Face not stored - check user type
        if user.role == "Administrator":
            # Admin first time: allow login but require face verification
            requires_face_verification = True
        else:
            # Non-admin without face: block login
            raise HTTPException(
                status_code=403,
                detail="Please scan your face at the admin page before logging in.",
            )

    session_id = str(uuid.uuid4())
    session = trust_engine.create_session(
        session_id,
        user,
        ip=request.mock_ip or "127.0.0.1",
        location_override=request.mock_location,
        ip_status=request.mock_ip_status or "CLEAN",
    )

    token_data = {
        "sub": user.id,
        "email": user.email,
        "session_id": session_id,
        "name": user.name,
        "role": user.role,
        "privilege_score": user.privilege_score,
    }
    access_token = create_access_token(token_data)

    _apply_login_risk_context(user, session, request)
    session = trust_engine.get_session(session_id) or session

    return LoginResponse(
        access_token=access_token,
        user=user,
        session=session,
        requires_face_verification=requires_face_verification,
    )


@router.get("/me")
async def get_current_user(token_data: dict = Depends(verify_token)):
    user = trust_engine.get_user_by_id(token_data.get("sub"))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_dict = user.model_dump()

    session = trust_engine.get_session(token_data.get("session_id"))

    return {
        "user": user_dict,
        "session": session.model_dump() if session else None,
    }


@router.post("/logout")
async def logout(token_data: dict = Depends(verify_token)):
    session_id = token_data.get("session_id")
    if session_id:
        trust_engine.terminate_session(session_id)
    return {"message": "Logged out successfully"}


@router.post("/passkey/challenge")
async def get_passkey_challenge(token_data: dict = Depends(verify_token)):
    return {
        "challenge": "_passkey_challenge_" + str(uuid.uuid4()),
        "rp": {"name": "TRUSTNET", "id": "localhost"},
        "user": {"id": token_data.get("sub"), "name": token_data.get("name")},
        "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
        "timeout": 60000,
        "authenticatorSelection": {"userVerification": "required"},
    }


class PasskeyVerifyBody(BaseModel):
    simulate_failure: bool = False


@router.post("/passkey/verify")
async def verify_passkey(
    body: PasskeyVerifyBody,
    token_data: dict = Depends(verify_token),
):
    sid = token_data.get("session_id")
    if body.simulate_failure:
        result = trust_engine.add_trust_signal(sid, "passkey_failure")
    else:
        result = trust_engine.add_trust_signal(sid, "passkey_success")
    session = trust_engine.get_session(sid)
    if session:
        if body.simulate_failure:
            session.pending_action = "camera_challenge"
            session.needs_camera_after_passkey = True
            session.passkey_verified = False
        else:
            session.passkey_verified = True
            if session.needs_camera_after_passkey:
                session.pending_action = "camera_challenge"
            else:
                session.pending_action = None
                session.trust_score = max(session.trust_score, 85)
                session.access_level = "full"
                session.is_compromised = False
        
        await emit_trust_update(session)
        if session.is_compromised:
            await broadcast_account_compromised(session)
        
        return {
            "verified": not body.simulate_failure,
            "requires_camera": session.needs_camera_after_passkey,
            "trust_score": session.trust_score,
            "is_compromised": session.is_compromised
        }
    
    return {"verified": False, "requires_camera": False}


@router.post("/admin/face-skip")
async def admin_face_skip(token_data: dict = Depends(verify_token)):
    user = trust_engine.get_user_by_id(token_data.get("sub"))
    if not user or user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Admin only")
    session = trust_engine.get_session(token_data.get("session_id"))
    if session:
        trust_engine.add_trust_signal(token_data.get("session_id"), "admin_override_face")
        session.face_verified_this_session = True
        await emit_trust_update(session)
    return {"ok": True}


@router.get("/users")
async def get_all_users():
    users = trust_engine.get_all_users()
    return [u.model_dump() for u in users]
