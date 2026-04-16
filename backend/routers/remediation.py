from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from models import RemediationApplyRequest
from services.graph_service import graph_service
from services import trust_engine
from realtime import broadcast_remediation_applied

router = APIRouter(prefix="/remediation", tags=["remediation"])
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


@router.post("/apply")
async def apply_remediation(
    body: RemediationApplyRequest,
    token_data: dict = Depends(verify_token),
):
    actor = trust_engine.get_user_by_id(token_data.get("sub"))
    if not actor:
        raise HTTPException(status_code=401, detail="Invalid user")

    compromised_id = body.compromised_user_id
    if compromised_id:
        cu = trust_engine.get_user_by_id(compromised_id)
        if cu and cu.role == "Administrator":
            raise HTTPException(
                status_code=400,
                detail="Admin account compromise cannot be auto-remediated",
            )

    result = graph_service.apply_remediation(body.edge_ids, actor.name)
    result["timestamp"] = datetime.now().isoformat()
    await broadcast_remediation_applied(
        {
            "user_id": compromised_id or token_data.get("sub"),
            "edges_removed": result.get("edges_removed", []),
            "applied_by": actor.name,
            "applied_by_id": actor.id,
        }
    )
    return result


@router.get("/history")
async def get_remediation_history():
    return {"history": graph_service.get_remediation_history()}
