from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

name = "trustnet_contextual_rl"
version = "1.0"

STATE_FILE = Path(__file__).resolve().parent.parent / "data" / "default_rl_model_state.json"
ACTIONS = ("allow", "challenge", "restrict", "terminate")
DEFAULT_BIASES = {
    "allow": 0.55,
    "challenge": 0.2,
    "restrict": -0.1,
    "terminate": -0.35,
}


def _default_state() -> Dict[str, Any]:
    return {
        "action_bias": dict(DEFAULT_BIASES),
        "feature_weights": {
            "resource_novelty": -0.42,
            "route_novelty": -0.28,
            "device_mismatch": -0.52,
            "screen_mismatch": -0.16,
            "timezone_mismatch": -0.24,
            "unusual_hour": -0.18,
            "typing_speed_delta": -0.25,
            "key_hold_delta": -0.22,
            "key_flight_delta": -0.22,
            "mouse_velocity_delta": -0.19,
            "mouse_curve_delta": -0.14,
            "scroll_delta": -0.11,
            "click_delta": -0.12,
            "privilege_escalation_attempts": -0.48,
            "api_calls": -0.12,
            "data_volume_read": -0.1,
            "data_volume_written": -0.12,
            "privilege_score": -0.1,
            "ip_blacklisted": -0.5,
            "ip_new": -0.18,
            "admin_role": -0.08,
        },
        "learning_rate": 0.04,
        "reward_history": [],
        "steps": 0,
    }


def _load_state() -> Dict[str, Any]:
    if not STATE_FILE.exists():
        return _default_state()
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_state()


STATE = _load_state()


def _bounded(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _flatten_features(observation: Dict[str, Any]) -> Dict[str, float]:
    novelty = observation.get("novelty", {})
    deviations = observation.get("deviations", {})
    telemetry = observation.get("telemetry", {})
    context = observation.get("context", {})

    features = {
        "resource_novelty": float(novelty.get("resource_novelty", 0.0)),
        "route_novelty": float(novelty.get("route_novelty", 0.0)),
        "device_mismatch": float(novelty.get("device_mismatch", 0.0)),
        "screen_mismatch": float(novelty.get("screen_mismatch", 0.0)),
        "timezone_mismatch": float(novelty.get("timezone_mismatch", 0.0)),
        "unusual_hour": float(novelty.get("unusual_hour", 0.0)),
        "typing_speed_delta": float(deviations.get("typing_speed_delta", 0.0)),
        "key_hold_delta": float(deviations.get("key_hold_delta", 0.0)),
        "key_flight_delta": float(deviations.get("key_flight_delta", 0.0)),
        "mouse_velocity_delta": float(deviations.get("mouse_velocity_delta", 0.0)),
        "mouse_curve_delta": float(deviations.get("mouse_curve_delta", 0.0)),
        "scroll_delta": float(deviations.get("scroll_delta", 0.0)),
        "click_delta": float(deviations.get("click_delta", 0.0)),
        "privilege_escalation_attempts": _bounded(float(telemetry.get("privilege_escalation_attempts", 0.0)) / 3.0, 0.0, 1.0),
        "api_calls": _bounded(float(telemetry.get("api_calls", 0.0)) / 10.0, 0.0, 1.0),
        "data_volume_read": _bounded(float(telemetry.get("data_volume_read", 0.0)) / 100.0, 0.0, 1.0),
        "data_volume_written": _bounded(float(telemetry.get("data_volume_written", 0.0)) / 100.0, 0.0, 1.0),
        "privilege_score": _bounded(float(context.get("privilege_score", 0.0)) / 100.0, 0.0, 1.0),
        "ip_blacklisted": 1.0 if context.get("ip_status") == "BLACKLISTED" else 0.0,
        "ip_new": 1.0 if context.get("ip_status") == "NEW" else 0.0,
        "admin_role": 1.0 if context.get("user_role") == "Administrator" else 0.0,
    }
    return features


def _risk_from_features(features: Dict[str, float]) -> float:
    weights = STATE.get("feature_weights", {})
    weighted = sum(features[key] * float(weights.get(key, 0.0)) for key in features)
    normalized = _bounded(0.42 + weighted, -0.55, 0.45)
    risk = _bounded((1 - (normalized + 0.55) / 1.0) * 100.0, 5.0, 99.0)

    if features["privilege_escalation_attempts"] > 0:
        risk = _bounded(risk + 10, 0.0, 100.0)
    if features["ip_blacklisted"] > 0:
        risk = _bounded(risk + 14, 0.0, 100.0)

    return risk


def _action_scores(features: Dict[str, float], risk: float) -> Dict[str, float]:
    base = STATE.get("action_bias", DEFAULT_BIASES)
    threat = risk / 100.0
    return {
        "allow": float(base.get("allow", 0.0)) + (1 - threat) * 0.8 - features["device_mismatch"] * 0.4,
        "challenge": float(base.get("challenge", 0.0)) + threat * 0.55 + features["resource_novelty"] * 0.25,
        "restrict": float(base.get("restrict", 0.0)) + threat * 0.75 + features["privilege_score"] * 0.22,
        "terminate": float(base.get("terminate", 0.0)) + threat * 1.0 + features["ip_blacklisted"] * 0.35 + features["privilege_escalation_attempts"] * 0.3,
    }


def _reasons(features: Dict[str, float], risk: float, action: str) -> List[str]:
    reasons: List[str] = []
    mapping = [
        ("device_mismatch", "Device fingerprint differs from the learned user profile"),
        ("resource_novelty", "This session is reaching resources the user rarely touches"),
        ("route_novelty", "Navigation path differs from prior safe sessions"),
        ("typing_speed_delta", "Typing rhythm drifted from the learned baseline"),
        ("mouse_velocity_delta", "Mouse movement velocity drifted from the learned baseline"),
        ("timezone_mismatch", "Timezone context differs from the learned device profile"),
        ("unusual_hour", "Access time is outside the user’s learned operating window"),
        ("privilege_escalation_attempts", "Privilege escalation activity was observed"),
        ("data_volume_read", "The session is reading more data than usual"),
        ("data_volume_written", "The session is writing more data than usual"),
    ]
    for key, text in mapping:
        if features.get(key, 0.0) >= 0.35:
            reasons.append(text)
    if risk < 35:
        reasons.insert(0, "Behavior remains close to the learned profile for this identity")
    if action in {"restrict", "terminate"} and features.get("privilege_score", 0.0) >= 0.7:
        reasons.append("The identity is privileged, so the model is applying stricter policy pressure")
    return reasons[:4]


def predict(observation: Dict[str, Any]) -> Dict[str, Any]:
    features = _flatten_features(observation)
    risk = _risk_from_features(features)
    score = int(round(_bounded(100.0 - risk, 1.0, 99.0)))
    action_scores = _action_scores(features, risk)
    action = max(action_scores, key=action_scores.get)
    confidence = _bounded(0.58 + abs((risk / 100.0) - 0.5) * 0.45, 0.55, 0.97)

    return {
        "score": score,
        "risk": int(round(risk)),
        "confidence": round(confidence, 3),
        "action": action,
        "reasons": _reasons(features, risk, action),
        "debug": {"features": features, "action_scores": action_scores},
    }


def learn(payload: Dict[str, Any]) -> None:
    observation = payload.get("observation", {})
    assessment = payload.get("assessment", {})
    reward = float(payload.get("reward", 0.0))
    features = _flatten_features(observation)
    action = str(assessment.get("action", "allow"))
    learning_rate = float(STATE.get("learning_rate", 0.04))

    # Positive reward nudges toward trusting the observed behavior.
    # Negative reward hardens the model against the same feature mix.
    direction = 1 if reward >= 0 else -1
    scale = abs(reward)
    weights = STATE.setdefault("feature_weights", _default_state()["feature_weights"])
    biases = STATE.setdefault("action_bias", dict(DEFAULT_BIASES))

    for key, value in features.items():
        current = float(weights.get(key, 0.0))
        delta = learning_rate * value * scale * direction
        if action in {"restrict", "terminate"}:
            current -= delta
        else:
            current += delta * 0.8
        weights[key] = round(_bounded(current, -1.2, 1.2), 6)

    for candidate in ACTIONS:
        base = float(biases.get(candidate, 0.0))
        if candidate == action:
            base += learning_rate * reward
        else:
            base -= learning_rate * reward * 0.25
        biases[candidate] = round(_bounded(base, -2.0, 2.0), 6)

    history = STATE.setdefault("reward_history", [])
    history.append(round(reward, 4))
    del history[:-200]
    STATE["steps"] = int(STATE.get("steps", 0)) + 1


def save(path: str | None = None) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(STATE, indent=2), encoding="utf-8")
