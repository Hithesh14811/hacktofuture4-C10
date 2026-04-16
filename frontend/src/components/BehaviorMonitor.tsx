import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getDeviceContext, postRuntimeAccess } from '../lib/telemetry';

type BatchState = {
  startedAt: number;
  keyEvents: number;
  totalHold: number;
  holdSamples: number;
  totalFlight: number;
  flightSamples: number;
  lastKeyTime: number | null;
  mouseEvents: number;
  mouseDistance: number;
  mouseVelocityTotal: number;
  mouseVelocitySamples: number;
  mouseCurveSamples: number;
  mouseCurveTotal: number;
  clickCount: number;
  scrollEvents: number;
  scrollDistance: number;
  apiCalls: number;
  privilegeEscalationAttempts: number;
  dataVolumeRead: number;
  dataVolumeWritten: number;
  resources: Set<string>;
  lastMouse: { x: number; y: number; time: number } | null;
  lastDirection: { dx: number; dy: number } | null;
};

function createBatch(): BatchState {
  return {
    startedAt: Date.now(),
    keyEvents: 0,
    totalHold: 0,
    holdSamples: 0,
    totalFlight: 0,
    flightSamples: 0,
    lastKeyTime: null,
    mouseEvents: 0,
    mouseDistance: 0,
    mouseVelocityTotal: 0,
    mouseVelocitySamples: 0,
    mouseCurveSamples: 0,
    mouseCurveTotal: 0,
    clickCount: 0,
    scrollEvents: 0,
    scrollDistance: 0,
    apiCalls: 0,
    privilegeEscalationAttempts: 0,
    dataVolumeRead: 0,
    dataVolumeWritten: 0,
    resources: new Set<string>(),
    lastMouse: null,
    lastDirection: null,
  };
}

function resourceFromRoute(pathname: string): string {
  if (pathname.includes('/services')) return 'services';
  if (pathname.includes('/secrets')) return 'secrets';
  if (pathname.includes('/incident')) return 'iam';
  if (pathname.includes('/admin')) return 'iam';
  if (pathname.includes('/reports')) return 'reports';
  if (pathname.includes('/logs')) return 'logs';
  return 'dashboard';
}

export function BehaviorMonitor() {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const batchRef = useRef<BatchState>(createBatch());
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!token || !isAuthenticated || !session?.session_id || location.pathname === '/') {
      return;
    }

    const route = location.pathname;
    const resource = resourceFromRoute(route);
    batchRef.current.resources.add(resource);

    postRuntimeAccess(token, {
      route,
      resource,
      action: 'page_view',
      data_volume_read: 1,
      privileged: resource === 'iam' || resource === 'secrets',
    }).catch(() => undefined);

    const onKeyDown = () => {
      const batch = batchRef.current;
      const now = performance.now();
      if (batch.lastKeyTime !== null) {
        batch.totalFlight += now - batch.lastKeyTime;
        batch.flightSamples += 1;
      }
      batch.lastKeyTime = now;
      batch.keyEvents += 1;
    };

    const onKeyUp = () => {
      const batch = batchRef.current;
      if (batch.lastKeyTime !== null) {
        batch.totalHold += performance.now() - batch.lastKeyTime;
        batch.holdSamples += 1;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      const batch = batchRef.current;
      const now = performance.now();
      batch.mouseEvents += 1;
      if (batch.lastMouse) {
        const dx = event.clientX - batch.lastMouse.x;
        const dy = event.clientY - batch.lastMouse.y;
        const dt = Math.max(1, now - batch.lastMouse.time);
        const distance = Math.hypot(dx, dy);
        batch.mouseDistance += distance;
        batch.mouseVelocityTotal += distance / dt;
        batch.mouseVelocitySamples += 1;
        if (batch.lastDirection) {
          const prevMagnitude = Math.max(1, Math.hypot(batch.lastDirection.dx, batch.lastDirection.dy));
          const magnitude = Math.max(1, Math.hypot(dx, dy));
          const cosine = ((batch.lastDirection.dx * dx) + (batch.lastDirection.dy * dy)) / (prevMagnitude * magnitude);
          batch.mouseCurveTotal += 1 - Math.max(-1, Math.min(1, cosine));
          batch.mouseCurveSamples += 1;
        }
        batch.lastDirection = { dx, dy };
      }
      batch.lastMouse = { x: event.clientX, y: event.clientY, time: now };
    };

    const onClick = () => {
      batchRef.current.clickCount += 1;
    };

    const onScroll = () => {
      const currentY = window.scrollY;
      batchRef.current.scrollEvents += 1;
      batchRef.current.scrollDistance += Math.abs(currentY - lastScrollY.current);
      lastScrollY.current = currentY;
    };

    const flush = async () => {
      const batch = batchRef.current;
      const elapsed = Math.max(1, Date.now() - batch.startedAt);
      batch.apiCalls += 1;

      await fetch('/api/telemetry/behavior', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route,
          resource,
          page_label: document.title,
          interval_ms: elapsed,
          key_events: batch.keyEvents,
          key_hold_mean_ms: batch.holdSamples ? batch.totalHold / batch.holdSamples : 0,
          key_flight_mean_ms: batch.flightSamples ? batch.totalFlight / batch.flightSamples : 0,
          typing_speed_cpm: batch.keyEvents ? (batch.keyEvents / elapsed) * 60000 : 0,
          mouse_events: batch.mouseEvents,
          mouse_distance: batch.mouseDistance,
          mouse_velocity_mean: batch.mouseVelocitySamples ? batch.mouseVelocityTotal / batch.mouseVelocitySamples : 0,
          mouse_curve_ratio: batch.mouseCurveSamples ? batch.mouseCurveTotal / batch.mouseCurveSamples : 0,
          click_count: batch.clickCount,
          scroll_events: batch.scrollEvents,
          scroll_distance: batch.scrollDistance,
          api_calls: batch.apiCalls,
          resources: Array.from(batch.resources),
          privilege_escalation_attempts: batch.privilegeEscalationAttempts,
          data_volume_read: batch.dataVolumeRead,
          data_volume_written: batch.dataVolumeWritten,
          device_context: getDeviceContext(route),
        }),
      }).catch(() => undefined);

      batchRef.current = createBatch();
      batchRef.current.resources.add(resource);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    window.addEventListener('scroll', onScroll, { passive: true });

    const interval = window.setInterval(() => {
      void flush();
    }, 6000);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
      window.clearInterval(interval);
      void flush();
    };
  }, [isAuthenticated, location.pathname, session?.session_id, token]);

  return null;
}
