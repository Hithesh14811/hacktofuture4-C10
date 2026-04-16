import httpx
from typing import Dict, Any, Optional
from datetime import datetime


async def analyze_ip(ip_address: str) -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            fields = "status,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,mobile,query"
            url = f"http://ip-api.com/json/{ip_address}?fields={fields}"
            response = await client.get(url)
            
            if response.status_code != 200:
                return _get_default_analysis(ip_address)
            
            data = response.json()
            
            if data.get("status") != "success":
                return _get_default_analysis(ip_address)
            
            return _compute_ip_risk(data)
            
    except Exception as e:
        return _get_default_analysis(ip_address)


def _get_default_analysis(ip: str) -> Dict[str, Any]:
    return {
        "ip": ip,
        "country": "Unknown",
        "city": "Unknown",
        "lat": 0.0,
        "lon": 0.0,
        "isp": "Unknown",
        "is_datacenter": False,
        "is_vpn": False,
        "is_mobile": False,
        "asn": "",
        "risk_level": "CLEAN",
        "timestamp": datetime.now().isoformat()
    }


def _compute_ip_risk(data: dict) -> Dict[str, Any]:
    is_datacenter = data.get("hosting", False)
    is_vpn = data.get("proxy", False)
    is_mobile = data.get("mobile", False)
    asn = data.get("as", "")
    
    tor_asns = ["AS60729", "AS208323", "AS49532", "AS20510"]
    is_tor = any(tor in asn for tor in tor_asns)
    
    if is_datacenter or is_tor:
        risk_level = "BLOCK"
    elif is_vpn:
        risk_level = "HIGH"
    else:
        risk_level = "CLEAN"
    
    return {
        "ip": data.get("query", ""),
        "country": data.get("country", "Unknown"),
        "city": data.get("city", "Unknown"),
        "lat": data.get("lat", 0.0),
        "lon": data.get("lon", 0.0),
        "isp": data.get("isp", "Unknown"),
        "is_datacenter": is_datacenter,
        "is_vpn": is_vpn,
        "is_mobile": is_mobile,
        "asn": asn,
        "risk_level": risk_level,
        "timestamp": datetime.now().isoformat()
    }


async def analyze_location_change(
    last_lat: float, last_lon: float,
    new_lat: float, new_lon: float,
    time_elapsed_minutes: float
) -> Dict[str, Any]:
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371
    
    dlat = radians(new_lat - last_lat)
    dlon = radians(new_lon - last_lon)
    a = sin(dlat/2)**2 + cos(radians(last_lat)) * cos(radians(new_lat)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    distance_km = R * c
    
    max_possible_distance = (time_elapsed_minutes / 60) * 900 + 300
    
    if distance_km > max_possible_distance:
        return {
            "type": "impossible_travel",
            "distance_km": round(distance_km, 2),
            "time_minutes": time_elapsed_minutes,
            "impact": -35,
            "action": "passkey_challenge"
        }
    
    if distance_km > 500:
        return {
            "type": "significant_location_change",
            "distance_km": round(distance_km, 2),
            "impact": -20,
            "action": "passkey_challenge"
        }
    
    if distance_km > 50:
        return {
            "type": "location_shift",
            "distance_km": round(distance_km, 2),
            "impact": -10,
            "action": "flag_monitor"
        }
    
    return {
        "type": "normal_location",
        "distance_km": round(distance_km, 2),
        "impact": 0,
        "action": "none"
    }