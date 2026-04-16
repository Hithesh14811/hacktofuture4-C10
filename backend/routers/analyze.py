from fastapi import APIRouter
from models import IPAnalyzeRequest, GeoAnalyzeRequest
from services import ip_analyzer

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("/ip")
async def analyze_ip_endpoint(req: IPAnalyzeRequest):
    return await ip_analyzer.analyze_ip(req.ip_address)


@router.post("/geo")
async def analyze_geo_endpoint(req: GeoAnalyzeRequest):
    return await ip_analyzer.analyze_location_change(
        req.last_lat,
        req.last_lon,
        req.new_lat,
        req.new_lon,
        req.time_elapsed_minutes,
    )
