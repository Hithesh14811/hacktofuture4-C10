import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Brain, ChevronLeft, ChevronRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTrustStore } from '../store/trustStore';

export function RLStatusOverlay() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 24, y: 96 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    modelScore,
    modelRisk,
    modelConfidence,
    modelAction,
    modelName,
    modelLoaded,
    modelReasons,
    recentResources,
    apiCallCount,
  } = useTrustStore();

  const hidden = !isAuthenticated || location.pathname === '/';
  const tone = useMemo(() => {
    if (modelRisk >= 75) return 'red';
    if (modelRisk >= 45) return 'amber';
    return 'green';
  }, [modelRisk]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const overlayWidth = collapsed ? 144 : 320;
      const overlayHeight = collapsed ? 112 : 420;
      const nextX = Math.max(8, Math.min(window.innerWidth - overlayWidth, event.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - overlayHeight, event.clientY - dragOffsetRef.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      draggingRef.current = false;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [collapsed]);

  if (hidden) return null;

  return (
    <aside
      className={`fixed z-[90] rounded-sm border border-[#d7e3f0] bg-white/96 shadow-[0_20px_60px_rgba(35,47,62,0.18)] backdrop-blur transition-[width,height,padding] ${
        collapsed ? 'h-[104px] w-[136px] p-3' : 'max-h-[420px] w-[320px] p-4'
      }`}
      style={{ left: position.x, top: position.y }}
    >
      <div className={`${collapsed ? 'mb-2' : 'mb-3'} flex items-start justify-between gap-3`}>
        <div
          className={`flex cursor-grab select-none ${collapsed ? 'flex-col items-center gap-1 text-center' : 'items-center gap-2'}`}
          onPointerDown={(event) => {
            draggingRef.current = true;
            dragOffsetRef.current = {
              x: event.clientX - position.x,
              y: event.clientY - position.y,
            };
          }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2f7fc] text-[#0073bb]">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#565959]">
              {collapsed ? 'RL' : 'Live RL Scoring'}
            </div>
            {!collapsed && (
              <div className="text-sm font-bold text-[#232f3e]">{modelLoaded ? modelName : 'Builtin fallback model'}</div>
            )}
          </div>
        </div>
        <div className={`flex ${collapsed ? 'flex-col items-center gap-2' : 'items-center gap-2'}`}>
          {tone === 'green' ? (
            <ShieldCheck className="h-5 w-5 text-[#00a86b]" />
          ) : (
            <ShieldAlert className={`h-5 w-5 ${tone === 'red' ? 'text-[#d0021b]' : 'text-[#e47911]'}`} />
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed((value) => !value);
            }}
            className="rounded-sm border border-[#d7e3f0] bg-white p-1 text-[#565959] hover:bg-[#f7fbff]"
            aria-label={collapsed ? 'Expand RL overlay' : 'Collapse RL overlay'}
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {collapsed ? (
        <div className="mt-1 text-center">
          <div className={`font-mono text-2xl font-bold ${tone === 'green' ? 'text-[#00a86b]' : tone === 'amber' ? 'text-[#e47911]' : 'text-[#d0021b]'}`}>
            {modelScore}
          </div>
          <div className="mt-1 text-[9px] uppercase text-[#565959]">{modelAction}</div>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-sm bg-[#f7fbff] p-3">
              <div className="text-[10px] uppercase text-[#565959]">Model Score</div>
              <div className={`mt-1 font-mono text-xl font-bold ${tone === 'green' ? 'text-[#00a86b]' : tone === 'amber' ? 'text-[#e47911]' : 'text-[#d0021b]'}`}>
                {modelScore}
              </div>
            </div>
            <div className="rounded-sm bg-[#f7fbff] p-3">
              <div className="text-[10px] uppercase text-[#565959]">Risk</div>
              <div className={`mt-1 font-mono text-xl font-bold ${tone === 'green' ? 'text-[#00a86b]' : tone === 'amber' ? 'text-[#e47911]' : 'text-[#d0021b]'}`}>
                {modelRisk}
              </div>
            </div>
            <div className="rounded-sm bg-[#f7fbff] p-3">
              <div className="text-[10px] uppercase text-[#565959]">Action</div>
              <div className="mt-1 text-sm font-bold uppercase text-[#232f3e]">{modelAction}</div>
            </div>
          </div>
          <div className="mt-3 rounded-sm border border-[#eaeded] bg-[#fcfdff] p-3">
            <div className="flex items-center justify-between text-[10px] uppercase text-[#565959]">
              <span>Confidence</span>
              <span>{Math.round(modelConfidence * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e7eef7]">
              <div
                className={`h-full rounded-full ${tone === 'green' ? 'bg-[#00a86b]' : tone === 'amber' ? 'bg-[#e47911]' : 'bg-[#d0021b]'}`}
                style={{ width: `${Math.round(modelConfidence * 100)}%` }}
              />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-[10px] uppercase text-[#565959]">Why the model is scoring this way</div>
            <div className="mt-2 space-y-2">
              {(modelReasons.length ? modelReasons : ['Learning this user profile from live session telemetry']).map((reason) => (
                <div key={reason} className="rounded-sm border border-[#eaeded] bg-[#fafbfc] px-3 py-2 text-xs text-[#232f3e]">
                  {reason}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#565959]">
            <div className="rounded-sm bg-[#f7fbff] p-3">
              <div className="uppercase text-[10px]">API Calls</div>
              <div className="mt-1 font-mono text-base font-bold text-[#232f3e]">{apiCallCount}</div>
            </div>
            <div className="rounded-sm bg-[#f7fbff] p-3">
              <div className="uppercase text-[10px]">Resources</div>
              <div className="mt-1 text-[#232f3e]">{recentResources.slice(-2).join(', ') || 'Profiling'}</div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
