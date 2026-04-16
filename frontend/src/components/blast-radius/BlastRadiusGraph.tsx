import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GraphNode, GraphEdge } from '../../types';

interface BlastRadiusGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode?: string | null;
  onNodeClick?: (id: string) => void;
  compromisedNodeId?: string | null;
  hopsToAdmin?: number | null;
}

export default function BlastRadiusGraph({
  nodes,
  edges,
  selectedNode,
  onNodeClick,
  compromisedNodeId,
  hopsToAdmin,
}: BlastRadiusGraphProps) {
  const layoutNodes = useMemo(() => {
    const nodeMap: Record<string, { x: number; y: number }> = {
      sarah: { x: 0, y: 0 },
      admin_role: { x: 250, y: 0 },
      admin_policy: { x: 500, y: 0 },
      secrets_res: { x: 750, y: -120 },
      crown_db: { x: 750, y: 120 },
      vikram: { x: 0, y: 200 },
      devops_role: { x: 250, y: 200 },
      priya: { x: 0, y: 400 },
      lambda_res: { x: 250, y: 400 },
      rahul: { x: 0, y: 560 },
      s3_res: { x: 250, y: 560 },
      cicd: { x: -250, y: 200 },
    };

    return nodes.map((node) => ({
      id: node.id,
      position: nodeMap[node.id] || { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: node.name },
      style: {
        background: node.id === compromisedNodeId ? '#fdf0f1' : '#ffffff',
        color: '#232f3e',
        border: compromisedNodeId === node.id
          ? '2px solid #d0021b'
          : selectedNode === node.id
          ? '2px solid #e47911'
          : '1px solid #eaeded',
        borderRadius: '2px',
        padding: '12px 18px',
        fontSize: '12px',
        fontWeight: 'bold',
        fontFamily: 'Amazon Ember, Arial, sans-serif',
        boxShadow: compromisedNodeId === node.id
          ? '0 0 12px rgba(208, 2, 27, 0.2)'
          : selectedNode === node.id
          ? '0 0 10px rgba(228, 121, 17, 0.2)'
          : '0 1px 3px rgba(0, 0, 0, 0.05)',
      },
      selected: selectedNode === node.id,
    }));
  }, [nodes, selectedNode, compromisedNodeId]);

  const flowEdges = useMemo(() => {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: 'smoothstep',
      animated: edge.severity === 'critical',
      style: {
        stroke: getEdgeColor(edge.severity),
        strokeWidth: edge.severity === 'critical' ? 2 : 1,
        strokeDasharray: '4 4', // Dotted lines as requested
      },
      labelStyle: {
        fill: '#565959',
        fontSize: 10,
        fontFamily: 'Amazon Ember, Arial, sans-serif',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: getEdgeColor(edge.severity),
      },
    }));
  }, [edges]);

  const [nodes_state, setNodes, onNodesChange] = useNodesState(layoutNodes as Node[]);
  const [edges_state, setEdges_, onEdgesChange] = useEdgesState(flowEdges as Edge[]);

  // Sync when external props change (e.g. after remediation or when compromised node changes)
  useEffect(() => {
    setNodes(layoutNodes as Node[]);
  }, [layoutNodes, setNodes]);

  useEffect(() => {
    setEdges_(flowEdges as Edge[]);
  }, [flowEdges, setEdges_]);

  const onNodeClick_cb = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const nodeTypes = useMemo(() => ({}), []);

  return (
    <div className="w-full h-full bg-[#f2f3f3] relative">
      <ReactFlow
        nodes={nodes_state}
        edges={edges_state}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick_cb}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Background
          color="#eaeded"
          gap={25}
          size={1}
        />
        <Controls />
      </ReactFlow>

      {/* Hops to Admin overlay */}
      {compromisedNodeId && hopsToAdmin !== null && hopsToAdmin !== undefined && (
        <div className="absolute top-4 right-4 z-10 rounded-sm border border-[#d0021b]/60 bg-white/95 px-4 py-3 shadow-md">
          <div className="text-[10px] uppercase text-[#565959] mb-1">Hops to Admin</div>
          <div className="font-mono text-3xl font-bold text-[#d0021b]">
            {hopsToAdmin === -1 ? '∞' : hopsToAdmin}
          </div>
          <div className="text-[10px] text-[#565959] mt-1">
            {hopsToAdmin === -1 ? 'No path exists' : hopsToAdmin === 0 ? 'IS admin' : `${hopsToAdmin} hop${hopsToAdmin > 1 ? 's' : ''} away`}
          </div>
        </div>
      )}
    </div>
  );
}

function getEdgeColor(severity?: string) {
  if (severity === 'critical') return '#d0021b';
  if (severity === 'high') return '#e47911';
  return '#879596';
}