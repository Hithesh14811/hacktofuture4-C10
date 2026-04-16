from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from services.graph_service import graph_service

router = APIRouter(prefix="/blast-radius", tags=["blast-radius"])


@router.get("/scenarios")
async def get_scenarios():
    return [{"id": "default", "name": "TRUSTNET IAM Graph", "description": "Default enterprise IAM structure"}]


@router.get("/graph")
async def get_graph():
    return {
        "nodes": graph_service.get_nodes(),
        "edges": graph_service.get_edges()
    }


@router.get("/graph/{scenario_id}")
async def get_scenario_graph(scenario_id: str):
    graph_service.reset_graph()
    return {
        "nodes": graph_service.get_nodes(),
        "edges": graph_service.get_edges()
    }


class AnalyzeRequest(BaseModel):
    start_node: str
    max_depth: int = 3


class QueryRequest(BaseModel):
    node_id: str


@router.post("/analyze")
async def analyze_blast_radius(request: AnalyzeRequest):
    result = graph_service.analyze_blast_radius(request.start_node, request.max_depth)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/critical-paths/{node_id}")
async def get_critical_paths(node_id: str):
    paths = graph_service.get_critical_paths(node_id)
    return {"paths": paths}


@router.get("/hops-to-admin/{node_id}")
async def get_hops_to_admin(node_id: str):
    hops = graph_service.get_hops_to_admin(node_id)
    return {"node_id": node_id, "hops": hops}


@router.post("/query")
async def query_node(request: QueryRequest):
    node = graph_service.get_node(request.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node