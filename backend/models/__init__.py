from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMINISTRATOR = "Administrator"
    DEVOPS_ENGINEER = "DevOps Engineer"
    DEVELOPER = "Developer"
    DATA_ANALYST = "Data Analyst"
    SERVICE_PRINCIPAL = "Service Principal"


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class AccessLevel(str, Enum):
    BLOCKED = "blocked"
    READ_ONLY = "read_only"
    LIMITED = "limited"
    STANDARD = "standard"
    FULL = "full"


class TrustSignal(BaseModel):
    signal_type: str
    value: Any
    impact: int
    description: str
    timestamp: str = ""


class User(BaseModel):
    id: str
    name: str
    email: str
    password: str = Field(default="", exclude=True)
    role: str
    privilege_score: int
    risk_level: str
    avatar: str
    registered_location: dict
    normal_hours: str
    device_fingerprint: str
    face_enrolled: bool = False
    face_descriptor: Optional[List[float]] = None
    last_face_enrollment: Optional[str] = None
    account_restricted: bool = False
    restriction_reason: Optional[str] = None


class Session(BaseModel):
    session_id: str
    user_id: str
    user: Optional[User] = None
    ip_address: str = "127.0.0.1"
    ip_status: str = "CLEAN"
    location: dict = {"city": "Unknown", "country": "Unknown", "lat": 0.0, "lon": 0.0}
    trust_score: int = 100
    baseline_score: int = 100
    anomalies: List[str] = []
    is_compromised: bool = False
    access_level: str = "full"
    last_updated: str = ""
    login_time: str = ""
    pending_action: Optional[str] = None
    signals: List[TrustSignal] = Field(default_factory=list)
    face_verified_this_session: bool = False
    needs_passkey: bool = False
    needs_camera_after_passkey: bool = False
    passkey_verified: bool = False
    camera_verified: bool = False
    face_fail_attempts: int = 0
    passkey_due_at: Optional[str] = None
    restriction_reason: Optional[str] = None
    block_message: Optional[str] = None
    required_verification: Optional[str] = None
    admin_recovery_required: bool = False
    admin_recovery_status: Optional[str] = None
    admin_recovery_request_id: Optional[str] = None


class SessionTrustState(BaseModel):
    session_id: str
    user_id: str
    current_score: int
    baseline_score: int
    signals: List[TrustSignal] = []
    anomalies: List[str] = []
    is_compromised: bool
    access_level: str
    last_updated: str = ""


class IPAnalysis(BaseModel):
    ip: str
    country: str = "Unknown"
    city: str = "Unknown"
    lat: float = 0.0
    lon: float = 0.0
    isp: str = "Unknown"
    is_datacenter: bool = False
    is_vpn: bool = False
    is_mobile: bool = False
    asn: str = ""
    risk_level: str = "CLEAN"


class LoginRequest(BaseModel):
    email: str
    password: str
    mock_ip: Optional[str] = None
    mock_ip_status: Optional[str] = None
    mock_signal: Optional[str] = None
    mock_location: Optional[dict] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User
    session: Optional[Session] = None
    requires_face_verification: bool = False


class FaceVerifyRequest(BaseModel):
    session_id: str
    match_confidence: float
    liveness_passed: bool
    face_descriptor: Optional[List[float]] = None


class FaceEnrollRequest(BaseModel):
    session_id: str
    face_descriptor: List[float]


class TrustUpdate(BaseModel):
    session_id: str
    user_id: str
    trust_score: int
    delta: int
    reason: str
    access_level: str


class AnomalyEvent(BaseModel):
    session_id: str
    user_id: str
    type: str
    severity: str
    action_required: str
    message: str


class CompromiseEvent(BaseModel):
    user_id: str
    name: str
    role: str
    privilege_score: int
    trust_score: int
    is_admin: bool


class Notification(BaseModel):
    id: str
    severity: str
    message: str
    timestamp: str
    user_id: Optional[str] = None
    action_url: Optional[str] = None


class AdminRecoveryVoteRequest(BaseModel):
    request_id: str
    approve: bool


class RemediationApplyRequest(BaseModel):
    edge_ids: List[str]
    compromised_user_id: Optional[str] = None


class IPAnalyzeRequest(BaseModel):
    ip_address: str = "127.0.0.1"


class GeoAnalyzeRequest(BaseModel):
    last_lat: float
    last_lon: float
    new_lat: float
    new_lon: float
    time_elapsed_minutes: float
