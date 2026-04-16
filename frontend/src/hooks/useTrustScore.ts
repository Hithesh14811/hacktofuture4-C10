import { useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTrustStore } from '../store/trustStore';

export function useTrustScore() {
  const { session, user } = useAuthStore();
  const { trustScore, setTrustScore, setAccessLevel, setIsCompromised } = useTrustStore();

  const injectSignal = useCallback(async (signalType: string) => {
    if (!session?.session_id) return;
    
    try {
      const response = await fetch('/api/trust/signal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.session_id,
          signal_type: signalType,
        }),
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.trust_score !== undefined) {
        setTrustScore(data.trust_score);
        setAccessLevel(data.access_level);
        setIsCompromised(data.is_compromised);
      }
      if (data.is_compromised && user) {
        useTrustStore.getState().setCompromisedAccount({
          user_id: user.id,
          name: user.name,
          role: user.role,
          is_admin: user.role === 'Administrator',
        });
      }

      return data;
    } catch (error) {
      console.error('Failed to inject signal:', error);
    }
  }, [session, user, setTrustScore, setAccessLevel, setIsCompromised]);

  const injectScenario = useCallback(async (scenario: string) => {
    if (!session?.session_id) return;
    
    try {
      const response = await fetch('/api/trust/demo/inject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: session.session_id,
          scenario: scenario,
        }),
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      if (data.trust_score !== undefined) {
        setTrustScore(data.trust_score);
        setAccessLevel(data.access_level);
        setIsCompromised(data.is_compromised);
      }
      if (data.is_compromised && user) {
        useTrustStore.getState().setCompromisedAccount({
          user_id: user.id,
          name: user.name,
          role: user.role,
          is_admin: user.role === 'Administrator',
        });
      }

      return data;
    } catch (error) {
      console.error('Failed to inject scenario:', error);
    }
  }, [session, user, setTrustScore, setAccessLevel, setIsCompromised]);

  const getTrustScoreColor = useCallback((score: number) => {
    if (score >= 80) return '#00FF88';
    if (score >= 60) return '#FFB800';
    if (score >= 40) return '#FF8C00';
    return '#FF2D55';
  }, []);

  const getTrustLevelLabel = useCallback((score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Medium';
    if (score >= 40) return 'Low';
    return 'Critical';
  }, []);

  return {
    trustScore,
    setTrustScore,
    injectSignal,
    injectScenario,
    getTrustScoreColor,
    getTrustLevelLabel,
    setIPStatus: useTrustStore.getState().setIPStatus,
    setLocation: useTrustStore.getState().setLocation,
    setIsCompromised: useTrustStore.getState().setIsCompromised,
  };
}