from datetime import datetime
import json
import os
import networkx as nx
from typing import Dict, List, Any, Optional, Set
from pathlib import Path

GRAPH_NODES_FILE = Path(__file__).parent.parent / "data" / "iam_graph.json"
GRAPH_EDGES_FILE = Path(__file__).parent.parent / "data" / "iam_edges.json"


class GraphService:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.remediation_history: List[Dict[str, Any]] = []
        self._load_graph()
    
    def _load_graph(self):
        nodes_file = Path(GRAPH_NODES_FILE)
        edges_file = Path(GRAPH_EDGES_FILE)
        
        if nodes_file.exists():
            with open(nodes_file, "r") as f:
                nodes = json.load(f)
                for node in nodes:
                    self.graph.add_node(node["id"], **node)
        
        if edges_file.exists():
            with open(edges_file, "r") as f:
                edges = json.load(f)
                for edge in edges:
                    self.graph.add_edge(edge["source"], edge["target"], **edge)
    
    def get_nodes(self) -> List[Dict[str, Any]]:
        return [dict(self.graph.nodes[node]) for node in self.graph.nodes()]
    
    def get_edges(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": self.graph.edges[source, target].get("id", f"{source}-{target}"),
                "source": source,
                "target": target,
                **self.graph.edges[source, target]
            }
            for source, target in self.graph.edges()
        ]
    
    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        if node_id in self.graph.nodes:
            return dict(self.graph.nodes[node_id])
        return None
    
    def analyze_blast_radius(self, start_node: str, max_depth: int = 3) -> Dict[str, Any]:
        if start_node not in self.graph.nodes:
            return {"error": "Node not found"}
        
        reachable = []
        risk_score = 0
        
        for depth in range(1, max_depth + 1):
            try:
                paths = list(nx.single_source_shortest_path(self.graph, start_node, cutoff=depth))
                for target, path in paths.items():
                    if len(path) > depth:
                        continue
                    node_data = self.graph.nodes[target]
                    reachable.append({
                        "node_id": target,
                        "name": node_data.get("name", target),
                        "type": node_data.get("type", "Unknown"),
                        "risk_level": node_data.get("risk_level", "Unknown"),
                        "path": path,
                        "depth": len(path) - 1
                    })
                    risk_score += node_data.get("privilege_score", 50)
            except nx.NetworkXError:
                pass
        
        return {
            "start_node": start_node,
            "reachable_nodes": reachable,
            "total_risk_score": risk_score,
            "paths_count": len(reachable)
        }
    
    def get_critical_paths(self, start_node: str) -> List[Dict[str, Any]]:
        if start_node not in self.graph.nodes:
            return []
        
        critical_paths = []
        critical_types = {"CriticalAsset", "CriticalResource", "Policy"}
        
        for node in self.graph.nodes():
            if self.graph.nodes[node].get("risk_level") == "Critical":
                try:
                    paths = list(nx.all_simple_paths(self.graph, start_node, node))
                    for path in paths:
                        critical_paths.append({
                            "path": path,
                            "target": node,
                            "target_data": dict(self.graph.nodes[node])
                        })
                except nx.NetworkXError:
                    pass
        
        return critical_paths
    
    def remove_edge(self, edge_id: str) -> bool:
        edges = list(self.graph.edges(data=True))
        for source, target, data in edges:
            if data.get("id") == edge_id:
                self.graph.remove_edge(source, target)
                self.remediation_history.append({
                    "edge_id": edge_id,
                    "source": source,
                    "target": target,
                    "action": "removed",
                    "timestamp": datetime.now().isoformat()
                })
                return True
        return False
    
    def restore_edge(self, edge_id: str) -> bool:
        return False
    
    def apply_remediation(self, edge_ids: List[str], applied_by: str) -> Dict[str, Any]:
        removed_edges = []
        
        for edge_id in edge_ids:
            if self.remove_edge(edge_id):
                removed_edges.append(edge_id)
        
        return {
            "edges_removed": removed_edges,
            "applied_by": applied_by,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_hops_to_admin(self, start_node: str) -> int:
        """Return the shortest number of hops from start_node to any admin node.
        Returns -1 if unreachable."""
        if start_node not in self.graph.nodes:
            return -1

        admin_nodes = [
            n for n in self.graph.nodes
            if self.graph.nodes[n].get("is_admin_role") or self.graph.nodes[n].get("is_wildcard_admin_policy")
        ]

        min_hops = float("inf")
        for admin_id in admin_nodes:
            try:
                length = nx.shortest_path_length(self.graph, start_node, admin_id)
                min_hops = min(min_hops, length)
            except nx.NetworkXNoPath:
                pass

        return int(min_hops) if min_hops != float("inf") else -1

    def reset_graph(self):
        self.graph.clear()
        self._load_graph()
    
    def get_remediation_history(self) -> List[Dict[str, Any]]:
        return self.remediation_history


graph_service = GraphService()