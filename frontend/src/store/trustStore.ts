import { create } from 'zustand';
import type { Notification } from '../types';

export interface CompromisedInfo {
  user_id: string;
  name: string;
  role: string;
  is_admin?: boolean;
}

interface TrustState {
  trustScore: number;
  baselineScore: number;
  modelScore: number;
  modelRisk: number;
  modelConfidence: number;
  modelAction: string;
  modelName: string;
  modelVersion: string;
  modelLoaded: boolean;
  modelReasons: string[];
  telemetryState: Record<string, unknown>;
  recentResources: string[];
  apiCallCount: number;
  ipStatus: string;
  location: { city: string; country: string };
  accessLevel: string;
  isCompromised: boolean;
  anomalies: string[];

  notifications: Notification[];
  compromisedAccount: CompromisedInfo | null;

  passkeyModalOpen: boolean;
  cameraChallengeOpen: boolean;
  remediationTick: number;
  
  passkeyDueAt: string | null;
  needsPasskey: boolean;
  faceFailAttempts: number;
  maxFaceAttempts: number;
  blockMessage: string | null;
  restrictionReason: string | null;
  requiredVerification: string | null;
  adminRecoveryRequired: boolean;
  adminRecoveryStatus: string | null;
  adminRecoveryRequestId: string | null;

  setTrustScore: (score: number) => void;
  setModelState: (payload: {
    modelScore?: number;
    modelRisk?: number;
    modelConfidence?: number;
    modelAction?: string;
    modelName?: string;
    modelVersion?: string;
    modelLoaded?: boolean;
    modelReasons?: string[];
    telemetryState?: Record<string, unknown>;
    recentResources?: string[];
    apiCallCount?: number;
  }) => void;
  setIPStatus: (status: string) => void;
  setLocation: (location: { city: string; country: string }) => void;
  setAccessLevel: (level: string) => void;
  setIsCompromised: (compromised: boolean) => void;
  addAnomaly: (anomaly: string) => void;
  setAnomalies: (anomalies: string[]) => void;
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
  setCompromisedAccount: (account: CompromisedInfo | null) => void;
  setPasskeyModalOpen: (open: boolean) => void;
  setCameraChallengeOpen: (open: boolean) => void;
  bumpRemediationTick: () => void;
  setPasskeyDueAt: (dueAt: string | null) => void;
  setNeedsPasskey: (needs: boolean) => void;
  incrementFaceFailAttempts: () => void;
  setFaceFailAttempts: (count: number) => void;
  setBlockState: (payload: {
    blockMessage?: string | null;
    restrictionReason?: string | null;
    requiredVerification?: string | null;
    adminRecoveryRequired?: boolean;
    adminRecoveryStatus?: string | null;
    adminRecoveryRequestId?: string | null;
  }) => void;
  resetFaceFailAttempts: () => void;
  reset: () => void;
}

export const useTrustStore = create<TrustState>()((set) => ({
  trustScore: 100,
  baselineScore: 100,
  modelScore: 50,
  modelRisk: 50,
  modelConfidence: 0,
  modelAction: 'allow',
  modelName: 'builtin_behavior_adapter',
  modelVersion: 'builtin',
  modelLoaded: false,
  modelReasons: [],
  telemetryState: {},
  recentResources: [],
  apiCallCount: 0,
  ipStatus: 'CLEAN',
  location: { city: 'Unknown', country: 'Unknown' },
  accessLevel: 'full',
  isCompromised: false,
  anomalies: [],
  notifications: [],
  compromisedAccount: null,
  passkeyModalOpen: false,
  cameraChallengeOpen: false,
  remediationTick: 0,
  passkeyDueAt: null,
  needsPasskey: false,
  faceFailAttempts: 0,
  maxFaceAttempts: 3,
  blockMessage: null,
  restrictionReason: null,
  requiredVerification: null,
  adminRecoveryRequired: false,
  adminRecoveryStatus: null,
  adminRecoveryRequestId: null,

  setTrustScore: (score) => set({ trustScore: score }),
  setModelState: (payload) => set((state) => ({
    modelScore: payload.modelScore ?? state.modelScore,
    modelRisk: payload.modelRisk ?? state.modelRisk,
    modelConfidence: payload.modelConfidence ?? state.modelConfidence,
    modelAction: payload.modelAction ?? state.modelAction,
    modelName: payload.modelName ?? state.modelName,
    modelVersion: payload.modelVersion ?? state.modelVersion,
    modelLoaded: payload.modelLoaded ?? state.modelLoaded,
    modelReasons: payload.modelReasons ?? state.modelReasons,
    telemetryState: payload.telemetryState ?? state.telemetryState,
    recentResources: payload.recentResources ?? state.recentResources,
    apiCallCount: payload.apiCallCount ?? state.apiCallCount,
  })),
  setIPStatus: (status) => set({ ipStatus: status }),
  setLocation: (location) => set({ location }),
  setAccessLevel: (level) => set({ accessLevel: level }),
  setIsCompromised: (compromised) => set({ isCompromised: compromised }),
  addAnomaly: (anomaly) => set((state) => ({ anomalies: [...state.anomalies, anomaly] })),
  setAnomalies: (anomalies) => set({ anomalies }),
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications].slice(0, 50),
  })),
  clearNotifications: () => set({ notifications: [] }),
  setCompromisedAccount: (account) => set({ compromisedAccount: account }),
  setPasskeyModalOpen: (open) => set({ passkeyModalOpen: open }),
  setCameraChallengeOpen: (open) => set({ cameraChallengeOpen: open }),
  bumpRemediationTick: () => set((s) => ({ remediationTick: s.remediationTick + 1 })),
  setPasskeyDueAt: (dueAt) => set({ passkeyDueAt: dueAt }),
  setNeedsPasskey: (needs) => set({ needsPasskey: needs }),
  incrementFaceFailAttempts: () => set((state) => ({ faceFailAttempts: state.faceFailAttempts + 1 })),
  setFaceFailAttempts: (count) => set({ faceFailAttempts: count }),
  setBlockState: (payload) => set(payload),
  resetFaceFailAttempts: () => set({ faceFailAttempts: 0 }),
  reset: () => set({
    trustScore: 100,
    baselineScore: 100,
    modelScore: 50,
    modelRisk: 50,
    modelConfidence: 0,
    modelAction: 'allow',
    modelName: 'builtin_behavior_adapter',
    modelVersion: 'builtin',
    modelLoaded: false,
    modelReasons: [],
    telemetryState: {},
    recentResources: [],
    apiCallCount: 0,
    ipStatus: 'CLEAN',
    location: { city: 'Unknown', country: 'Unknown' },
    accessLevel: 'full',
    isCompromised: false,
    anomalies: [],
    notifications: [],
    compromisedAccount: null,
    passkeyModalOpen: false,
    cameraChallengeOpen: false,
    remediationTick: 0,
    passkeyDueAt: null,
    needsPasskey: false,
    faceFailAttempts: 0,
    blockMessage: null,
    restrictionReason: null,
    requiredVerification: null,
    adminRecoveryRequired: false,
    adminRecoveryStatus: null,
    adminRecoveryRequestId: null,
  }),
}));
