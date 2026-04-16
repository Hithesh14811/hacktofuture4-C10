export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  privilege_score: number;
  risk_level: string;
  avatar: string;
  registered_location: {
    city: string;
    country: string;
    lat: number;
    lon: number;
  };
  normal_hours: string;
  device_fingerprint: string;
  face_enrolled?: boolean;
  face_descriptor?: number[];
  last_face_enrollment?: string;
}

export interface Session {
  session_id: string;
  user_id: string;
  user?: User;
  ip_address: string;
  ip_status: string;
  location: {
    city: string;
    country: string;
    lat: number;
    lon: number;
  };
  trust_score: number;
  baseline_score: number;
  anomalies: string[];
  is_compromised: boolean;
  access_level: string;
  last_updated: string;
  login_time: string;
  pending_action?: string | null;
  face_verified_this_session?: boolean;
  needs_passkey?: boolean;
  needs_camera_after_passkey?: boolean;
  passkey_verified?: boolean;
  camera_verified?: boolean;
  face_fail_attempts?: number;
  passkey_due_at?: string | null;
}

export interface TrustSignal {
  signal_type: string;
  value: any;
  impact: number;
  description: string;
  timestamp: string;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  privilege_score: number;
  risk_level: string;
  is_admin_role?: boolean;
  sensitive?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  action: string;
  severity: string;
  label: string;
}

export interface BlastRadiusResult {
  start_node: string;
  reachable_nodes: {
    node_id: string;
    name: string;
    type: string;
    risk_level: string;
    path: string[];
    depth: number;
  }[];
  total_risk_score: number;
  paths_count: number;
}

export interface Notification {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  user_id?: string;
  action_url?: string;
}

export type AccessLevel = 'blocked' | 'read_only' | 'limited' | 'standard' | 'full';

export interface ServiceCard {
  id: string;
  name: string;
  icon: string;
  status: 'running' | 'stopped' | 'degraded';
  last_accessed: string;
  privileged: string[];
}