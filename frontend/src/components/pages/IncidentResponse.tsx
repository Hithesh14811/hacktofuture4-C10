import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Zap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTrustStore } from '../../store/trustStore';
import { TopBar } from '../dashboard/TopBar';
import { Sidebar } from '../dashboard/Sidebar';
import BlastRadiusGraph from '../blast-radius/BlastRadiusGraph';
import type { GraphNode, GraphEdge, BlastRadiusResult } from '../../types';

const USER_TO_GRAPH: Record<string, string> = {
  usr_001: 'sarah',
  usr_002: 'vikram',
  usr_003: 'priya',
  usr_004: 'rahul',
  usr_005: 'cicd',
};

export default function IncidentResponse() {
  const { user, token, session } = useAuthStore();
  const { compromisedAccount, remediationTick, trustScore, ipStatus, location } = useTrustStore();
  const [sidebarCollapsed] = useState(false);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BlastRadiusResult | null>(null);
  const [hopsToAdmin, setHopsToAdmin] = useState<number | null>(null);
  const [showTOTPModal, setShowTOTPModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [verified, setVerified] = useState(false);
  const [remediationBusy, setRemediationBusy] = useState(false);

  const isAdmin = user?.role === 'Administrator';
  const canAccess = Boolean(token && user);
  const needsTotp = !isAdmin && Boolean(compromisedAccount && !compromisedAccount.is_admin);

  const compromisedGraphId = useMemo(() => {
    if (!compromisedAccount) return null;
    return USER_TO_GRAPH[compromisedAccount.user_id] || null;
  }, [compromisedAccount]);

  const remediationEdgeIds = useMemo(() => {
    if (!analysis?.reachable_nodes?.length || !edges.length || !compromisedGraphId) {
      return [];
    }

    const ids = new Set<string>();
    for (const node of analysis.reachable_nodes) {
      const path = node.path || [];
      for (let i = 0; i < path.length - 1; i += 1) {
        const edge = edges.find((candidate) => candidate.source === path[i] && candidate.target === path[i + 1]);
        if (edge) {
          ids.add(edge.id);
        }
      }
    }

    return Array.from(ids);
  }, [analysis, compromisedGraphId, edges]);

  const analyzeNode = useCallback(async (nodeId: string) => {
    try {
      const res = await fetch('/api/blast-radius/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_node: nodeId, max_depth: 3 }),
      });
      const data = await res.json();
      setAnalysis(data);

      try {
        const hopsRes = await fetch(`/api/blast-radius/hops-to-admin/${nodeId}`);
        const hopsData = await hopsRes.json();
        setHopsToAdmin(hopsData.hops);
      } catch {
        setHopsToAdmin(null);
      }
    } catch (error) {
      console.error('Failed to analyze:', error);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (needsTotp && !verified) {
      setShowTOTPModal(true);
    } else {
      setShowTOTPModal(false);
    }
  }, [token, needsTotp, verified]);

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch('/api/blast-radius/graph');
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);

      const defaultGraphId = compromisedAccount
        ? USER_TO_GRAPH[compromisedAccount.user_id]
        : user
          ? USER_TO_GRAPH[user.id]
          : null;
      const activeNodeId = selectedNode || defaultGraphId || data.nodes?.[0]?.id;

      if (activeNodeId) {
        setSelectedNode(activeNodeId);
        await analyzeNode(activeNodeId);
      }
    } catch (error) {
      console.error('Failed to load graph:', error);
    }
  }, [analyzeNode, compromisedAccount, selectedNode, user]);

  useEffect(() => {
    if (!token || !canAccess) return;
    if (needsTotp && !verified) return;
    loadGraph();
  }, [token, canAccess, needsTotp, verified, loadGraph, remediationTick]);

  useEffect(() => {
    if (!token || !canAccess) return;
    if (needsTotp && !verified) return;

    const interval = setInterval(() => {
      loadGraph();
    }, 15000);

    return () => clearInterval(interval);
  }, [token, canAccess, needsTotp, verified, loadGraph]);

  const applyRemediation = async () => {
    if (!token || !compromisedAccount || compromisedAccount.is_admin) return;
    setRemediationBusy(true);
    try {
      const res = await fetch('/api/remediation/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          edge_ids: remediationEdgeIds,
          compromised_user_id: compromisedAccount.user_id,
        }),
      });
      if (res.ok) {
        await loadGraph();
      }
    } catch (error) {
      console.error('Failed to apply remediation:', error);
    } finally {
      setRemediationBusy(false);
    }
  };

  const handleVerifyTOTP = () => {
    if (totpCode === '847291') {
      setVerified(true);
      setShowTOTPModal(false);
      setTotpError('');
    } else {
      setTotpError('Invalid code. Try 847291 for demo.');
    }
  };

  if (!canAccess) {
    return (
      <div className="flex h-screen flex-col bg-bg-primary">
        <TopBar />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-border bg-bg-card p-8 text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-text-muted" />
            <h2 className="font-display text-xl font-bold text-text-primary">IAM topology</h2>
            <p className="mt-2 text-text-secondary">
              Sign in to view the live identity and resource relationship map for this cloud environment.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const adminCompromiseView = compromisedAccount?.is_admin;
  const sessionDuration = session?.login_time
    ? Math.max(0, Math.floor((Date.now() - new Date(session.login_time).getTime()) / 1000))
    : 0;
  const hh = String(Math.floor(sessionDuration / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sessionDuration % 3600) / 60)).padStart(2, '0');
  const ss = String(sessionDuration % 60).padStart(2, '0');

  const riskLevel = useMemo(() => {
    if (trustScore >= 80) return 'Low';
    if (trustScore >= 60) return 'Medium';
    if (trustScore >= 40) return 'High';
    return 'Critical';
  }, [trustScore]);

  return (
    <div className="flex h-screen flex-col bg-[#f2f3f3] text-[#11181C]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="flex flex-1 overflow-hidden bg-white">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-[#eaeded] bg-white px-8 py-4">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#232f3e]">Live IAM Topology</h1>
                  <p className="text-sm text-[#565959]">Track always-on relationships between identities, policies, and cloud resources in real time.</p>
                </div>
                <div className="rounded-sm border border-[#0073bb]/20 bg-[#f7fbff] px-4 py-3">
                  <div className="text-[10px] uppercase text-[#565959]">Topology Refresh</div>
                  <div className="mt-1 text-sm font-bold text-[#0073bb]">Streaming every 15 seconds</div>
                </div>
                {compromisedAccount && (
                  <div className="flex items-center gap-6 rounded-sm border border-[#d0021b] bg-[#fdf0f1] px-6 py-3">
                    <div className="flex items-center gap-2 text-[#d0021b]">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-bold">COMPROMISED: {compromisedAccount.name}</span>
                    </div>
                    <div className="h-8 w-px bg-[#d0021b]/20" />
                    <div className="grid grid-cols-5 gap-8">
                      <div>
                        <div className="text-[10px] uppercase text-[#565959]">Trust Score</div>
                        <div className={`font-mono text-lg font-bold ${trustScore < 40 ? 'text-[#d0021b]' : 'text-[#e47911]'}`}>{trustScore}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[#565959]">IP Status</div>
                        <div className="font-mono text-lg font-bold text-[#232f3e]">{ipStatus}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[#565959]">Location</div>
                        <div className="font-mono text-lg font-bold text-[#232f3e]">{location.city}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[#565959]">Risk Level</div>
                        <div className={`font-mono text-lg font-bold ${trustScore < 40 ? 'text-[#d0021b]' : 'text-[#e47911]'}`}>{riskLevel}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[#565959]">Session Duration</div>
                        <div className="font-mono text-lg font-bold text-[#232f3e]">{hh}:{mm}:{ss}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex-1">
              {adminCompromiseView && (
                <div className="absolute top-4 left-4 z-10 max-w-lg rounded-sm border border-[#d0021b] bg-white p-4 text-sm text-[#565959] shadow-md">
                  <div className="font-bold text-[#d0021b]">ADMIN ACCOUNT COMPROMISE DETECTED</div>
                  <p className="mt-2">
                    Access restricted until secondary recovery. Remediation from this console is disabled until the recovery workflow completes.
                  </p>
                </div>
              )}
              {!compromisedAccount && (
                <div className="absolute top-4 left-4 z-10 max-w-lg rounded-sm border border-[#0073bb]/30 bg-white/95 p-4 text-sm text-[#565959] shadow-md">
                  <div className="font-bold text-[#0073bb]">LIVE TOPOLOGY STREAM</div>
                  <p className="mt-2">
                    The IAM graph stays active even without an attack so teams can inspect live connections, permissions, and escalation paths at any time.
                  </p>
                </div>
              )}
              {nodes.length > 0 && (
                <BlastRadiusGraph
                  nodes={nodes}
                  edges={edges}
                  selectedNode={selectedNode}
                  compromisedNodeId={compromisedGraphId}
                  hopsToAdmin={hopsToAdmin}
                  onNodeClick={(id) => {
                    setSelectedNode(id);
                    analyzeNode(id);
                  }}
                />
              )}
            </div>
          </div>

          <aside className="w-96 overflow-y-auto border-l border-[#eaeded] bg-[#f2f3f3] p-6">
            <h3 className="mb-6 text-lg font-bold text-[#232f3e]">{compromisedAccount ? 'Incident Analysis' : 'Topology Analysis'}</h3>

            {compromisedAccount && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-sm border border-[#d0021b] bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center gap-2 text-[#d0021b]">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-bold uppercase text-xs">Compromised Identity</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fdf0f1] font-bold text-[#d0021b]">
                    {compromisedAccount.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#232f3e]">{compromisedAccount.name}</div>
                    <div className="text-[10px] text-[#565959] uppercase">{compromisedAccount.role}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {hopsToAdmin !== null && (
              <div className="mb-6 rounded-sm border border-[#eaeded] bg-white p-4 shadow-sm">
                <div className="mb-3 text-[10px] font-bold uppercase text-[#565959]">Path to Administrator</div>
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-mono text-xl font-bold ${hopsToAdmin <= 1 ? 'border-[#d0021b] text-[#d0021b]' : 'border-[#e47911] text-[#e47911]'}`}>
                    {hopsToAdmin === -1 ? 'Inf' : hopsToAdmin}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-[#232f3e]">
                      {hopsToAdmin === -1 ? 'Isolated' : hopsToAdmin === 0 ? 'Admin Node' : `${hopsToAdmin} Hops to Admin`}
                    </div>
                    <p className="text-[10px] leading-tight text-[#565959]">
                      {hopsToAdmin === -1 ? 'No direct path to admin privileges detected.' : `This node is ${hopsToAdmin} step(s) away from full administrative control.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {analysis && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-sm border border-[#eaeded] bg-white p-4 shadow-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase text-[#565959]">Reachable</div>
                    <div className="text-2xl font-bold text-[#0073bb]">{analysis.reachable_nodes?.length || 0}</div>
                  </div>
                  <div className="rounded-sm border border-[#eaeded] bg-white p-4 shadow-sm">
                    <div className="mb-1 text-[10px] font-bold uppercase text-[#565959]">Risk Score</div>
                    <div className="text-2xl font-bold text-[#e47911]">{analysis.total_risk_score || 0}</div>
                  </div>
                </div>

                <div className="mb-2 text-[10px] font-bold uppercase text-[#565959]">
                  {compromisedAccount ? 'Blast Radius Entities' : 'Connected Entities'}
                </div>
                <div className="space-y-2">
                  {analysis.reachable_nodes?.slice(0, 8).map((node: { name: string; risk_level: string; path: string[] }, i: number) => (
                    <div
                      key={i}
                      className="rounded-sm border border-[#eaeded] bg-white p-3 transition-colors hover:border-[#0073bb]"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#232f3e]">{node.name}</span>
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            node.risk_level === 'Critical'
                              ? 'bg-[#fdf0f1] text-[#d0021b]'
                              : node.risk_level === 'High'
                                ? 'bg-[#fff4e5] text-[#e47911]'
                                : 'bg-[#f2f3f3] text-[#565959]'
                          }`}
                        >
                          {node.risk_level}
                        </span>
                      </div>
                      <div className="truncate text-[10px] font-mono text-[#565959]">
                        {node.path?.join(' -> ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!adminCompromiseView && compromisedAccount && (isAdmin || verified) && (
              <div className="mt-8 border-t border-[#eaeded] pt-6">
                <button
                  type="button"
                  onClick={applyRemediation}
                  disabled={remediationBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-[#d0021b] py-3 text-sm font-bold text-white transition-colors hover:bg-[#a30115] disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  {remediationBusy ? 'ISOLATING...' : 'RUN REMEDIATION'}
                </button>
                <p className="mt-2 text-center text-[10px] text-[#565959]">
                  This action will drop the trust score and revoke permissions.
                </p>
              </div>
            )}

            {!compromisedAccount && (
              <div className="mt-8 rounded-sm border border-[#eaeded] bg-white p-6 text-center shadow-sm">
                <Shield className="mx-auto mb-4 h-10 w-10 text-[#565959] opacity-20" />
                <p className="text-xs text-[#565959]">
                  Select any node on the IAM map to inspect connected services, reachable entities, and potential privilege escalation paths.
                </p>
              </div>
            )}
          </aside>
        </main>
      </div>

      {showTOTPModal && needsTotp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-96 rounded-xl border border-border bg-bg-card p-6"
          >
            <h3 className="mb-4 font-display text-xl font-bold text-text-primary">Secure Access Required</h3>
            <p className="mb-4 text-sm text-text-secondary">
              Enter the 6-digit code for <strong>NimbusCloud</strong> (demo: <span className="font-mono">847291</span>).
            </p>
            <input
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="Enter code"
              className="mb-2 w-full rounded-lg border border-border bg-bg-secondary px-4 py-3 text-center font-mono text-xl tracking-widest"
            />
            {totpError && <p className="mb-4 text-sm text-accent-red">{totpError}</p>}
            <button
              type="button"
              onClick={handleVerifyTOTP}
              className="w-full rounded-lg bg-accent-cyan py-3 font-medium text-bg-primary"
            >
              Verify
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
