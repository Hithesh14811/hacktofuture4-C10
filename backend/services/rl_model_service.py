from __future__ import annotations

import importlib.util
import json
import math
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from models import BehaviorTelemetryRequest, DeviceContext, Session

DATA_DIR = Path(__file__).parent.parent / "data"
CONFIG_FILE = DATA_DIR / "rl_model_config.json"
PROFILE_FILE = DATA_DIR / "behavior_profiles.json"
EVENTS_FILE = DATA_DIR / "behavior_events.jsonl"
DEFAULT_MODEL_PATH = str((Path(__file__).parent / "default_rl_model.py").resolve())


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _write_json(path: Path, payload: Any) -> None:
    _ensure_data_dir()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _bounded(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _safe_div(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator


class BuiltinBehaviorAdapter:
    name = "builtin_behavior_adapter"
    version = "1.0"

    def predict(self, observation: Dict[str, Any]) -> Dict[str, Any]:
        deviations = observation.get("deviations", {})
        novelty = observation.get("novelty", {})
        context = observation.get("context", {})
        telemetry = observation.get("telemetry", {})

        risk = 12.0
        reasons: List[str] = []

        route_novelty = novelty.get("route_novelty", 0.0)
        resource_novelty = novelty.get("resource_novelty", 0.0)
        device_mismatch = novelty.get("device_mismatch", 0.0)
        screen_mismatch = novelty.get("screen_mismatch", 0.0)
        timezone_mismatch = novelty.get("timezone_mismatch", 0.0)
        unusual_hour = novelty.get("unusual_hour", 0.0)

        if route_novelty > 0.45:
            risk += 10
            reasons.append("New route pattern for this identity")
        if resource_novelty > 0.45:
            risk += 12
            reasons.append("Resource access deviates from learned profile")
        if device_mismatch > 0.5:
            risk += 18
            reasons.append("Device fingerprint mismatch detected")
        if screen_mismatch > 0.5:
            risk += 6
            reasons.append("Screen profile differs from usual device")
        if timezone_mismatch > 0.5:
            risk += 12
            reasons.append("Timezone differs from user's learned profile")
        if unusual_hour > 0.5:
            risk += 9
            reasons.append("Session occurs outside learned operating hours")

        for label, amount, threshold, reason in (
            ("typing_speed_delta", 14, 0.55, "Typing cadence deviates from baseline"),
            ("key_hold_delta", 10, 0.55, "Key dwell timing drift detected"),
            ("key_flight_delta", 10, 0.55, "Key flight timing drift detected"),
            ("mouse_velocity_delta", 10, 0.55, "Mouse velocity pattern drift detected"),
            ("mouse_curve_delta", 8, 0.6, "Mouse path curvature changed materially"),
            ("scroll_delta", 6, 0.65, "Scroll behavior differs from prior sessions"),
            ("click_delta", 6, 0.65, "Click rhythm differs from prior sessions"),
        ):
            if deviations.get(label, 0.0) > threshold:
                risk += amount
                reasons.append(reason)

        privilege_attempts = telemetry.get("privilege_escalation_attempts", 0)
        if privilege_attempts:
            risk += 18 + (privilege_attempts * 4)
            reasons.append("Privilege escalation attempt recorded")

        api_calls = telemetry.get("api_calls", 0)
        if api_calls >= 8:
            risk += 12
            reasons.append("Burst API usage observed")

        data_volume_read = telemetry.get("data_volume_read", 0.0)
        data_volume_written = telemetry.get("data_volume_written", 0.0)
        if data_volume_read > 50:
            risk += 10
            reasons.append("High data read volume")
        if data_volume_written > 25:
            risk += 12
            reasons.append("High data write volume")

        if context.get("ip_status") in {"BLACKLISTED", "NEW"}:
            risk += 20 if context.get("ip_status") == "BLACKLISTED" else 8
            reasons.append("Network context already flagged by trust engine")

        if context.get("user_role") == "Administrator":
            risk += 6
            reasons.append("Privileged identity receives stricter scrutiny")

        risk = _bounded(risk)
        score = round(100 - risk)
        confidence = _bounded(55 + (len(reasons) * 5), 30, 96) / 100
        if risk >= 85:
            action = "terminate"
        elif risk >= 70:
            action = "restrict"
        elif risk >= 45:
            action = "challenge"
        else:
            action = "allow"

        return {
            "score": score,
            "risk": round(risk),
            "confidence": round(confidence, 3),
            "action": action,
            "reasons": reasons[:4],
        }

    def learn(self, payload: Dict[str, Any]) -> None:
        return None


class RLModelService:
    def __init__(self) -> None:
        _ensure_data_dir()
        self._config = _read_json(
            CONFIG_FILE,
            {"model_path": DEFAULT_MODEL_PATH, "updated_at": None, "loaded": False, "error": None},
        )
        self._profiles: Dict[str, Any] = _read_json(PROFILE_FILE, {})
        self._adapter: Any = BuiltinBehaviorAdapter()
        self._loaded_path: Optional[str] = None
        if not self._config.get("model_path"):
            self._config["model_path"] = DEFAULT_MODEL_PATH
        self._load_configured_model()

    def _load_configured_model(self) -> None:
        model_path = self._config.get("model_path") or ""
        if not model_path:
            self._config["loaded"] = False
            self._config["error"] = None
            model_path = DEFAULT_MODEL_PATH
            self._config["model_path"] = model_path
        try:
            self._adapter = self._load_adapter_from_path(model_path)
            self._loaded_path = model_path
            self._config["loaded"] = True
            self._config["error"] = None
        except Exception as exc:
            self._adapter = BuiltinBehaviorAdapter()
            self._loaded_path = None
            self._config["loaded"] = False
            self._config["error"] = str(exc)
        _write_json(CONFIG_FILE, self._config)

    def _load_adapter_from_path(self, model_path: str) -> Any:
        path = Path(model_path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        if path.suffix.lower() == ".py":
            spec = importlib.util.spec_from_file_location("trustnet_rl_model", path)
            if spec is None or spec.loader is None:
                raise RuntimeError("Unable to load Python model module")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module

        if path.suffix.lower() in {".pkl", ".pickle"}:
            with path.open("rb") as handle:
                return pickle.load(handle)

        raise RuntimeError("Supported model files are .py, .pkl, or .pickle")

    def get_model_status(self) -> Dict[str, Any]:
        adapter = self._adapter
        return {
            "configured_path": self._config.get("model_path") or "",
            "loaded": bool(self._config.get("loaded")),
            "error": self._config.get("error"),
            "name": getattr(adapter, "name", getattr(adapter, "__name__", "custom_rl_model")),
            "version": getattr(adapter, "version", "unknown"),
            "using_builtin_fallback": isinstance(adapter, BuiltinBehaviorAdapter),
            "updated_at": self._config.get("updated_at"),
            "default_model_path": DEFAULT_MODEL_PATH,
        }

    def configure_model_path(self, model_path: str) -> Dict[str, Any]:
        self._config["model_path"] = model_path.strip()
        self._config["updated_at"] = datetime.now().isoformat()
        _write_json(CONFIG_FILE, self._config)
        self._load_configured_model()
        return self.get_model_status()

    def _profile_for_user(self, user_id: str) -> Dict[str, Any]:
        profile = self._profiles.get(user_id)
        if profile is None:
            profile = {
                "samples": 0,
                "metrics": {},
                "routes": {},
                "resources": {},
                "hours": {},
                "devices": {},
                "screen_profiles": {},
                "timezones": {},
                "last_updated": None,
            }
            self._profiles[user_id] = profile
        return profile

    def _update_metric(self, profile: Dict[str, Any], key: str, value: float) -> None:
        metrics = profile.setdefault("metrics", {})
        metric = metrics.setdefault(key, {"mean": 0.0, "count": 0, "m2": 0.0})
        metric["count"] += 1
        delta = value - metric["mean"]
        metric["mean"] += delta / metric["count"]
        delta2 = value - metric["mean"]
        metric["m2"] += delta * delta2

    def _metric_deviation(self, profile: Dict[str, Any], key: str, value: float) -> float:
        metric = profile.get("metrics", {}).get(key)
        if not metric or metric.get("count", 0) < 3:
            return 0.0
        variance = _safe_div(metric["m2"], max(1, metric["count"] - 1))
        stddev = math.sqrt(max(variance, 1e-9))
        z_score = abs(value - metric["mean"]) / max(stddev, 1.0)
        return _bounded(z_score / 3.5, 0.0, 1.0)

    def _count_novelty(self, counts: Dict[str, int], key: str) -> float:
        if not counts:
            return 0.0
        total = sum(counts.values())
        known = counts.get(key, 0)
        if known:
            return _bounded(1 - (known / max(total, 1)), 0.0, 0.8)
        return 1.0

    def _device_context_dict(self, context: Optional[DeviceContext]) -> Dict[str, Any]:
        if not context:
            return DeviceContext().model_dump()
        return context.model_dump()

    def build_observation(
        self,
        session: Session,
        telemetry: BehaviorTelemetryRequest,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        profile = self._profile_for_user(session.user_id)
        device_context = telemetry.device_context or session.device_context
        dc = self._device_context_dict(device_context)
        hour = datetime.now().hour
        telemetry_dict = telemetry.model_dump()
        observed_resources = telemetry.resources or ([telemetry.resource] if telemetry.resource else [])

        deviations = {
            "typing_speed_delta": self._metric_deviation(profile, "typing_speed_cpm", telemetry.typing_speed_cpm),
            "key_hold_delta": self._metric_deviation(profile, "key_hold_mean_ms", telemetry.key_hold_mean_ms),
            "key_flight_delta": self._metric_deviation(profile, "key_flight_mean_ms", telemetry.key_flight_mean_ms),
            "mouse_velocity_delta": self._metric_deviation(profile, "mouse_velocity_mean", telemetry.mouse_velocity_mean),
            "mouse_curve_delta": self._metric_deviation(profile, "mouse_curve_ratio", telemetry.mouse_curve_ratio),
            "scroll_delta": self._metric_deviation(profile, "scroll_distance", telemetry.scroll_distance),
            "click_delta": self._metric_deviation(profile, "click_count", telemetry.click_count),
        }

        screen_key = f"{dc.get('screen_width', 0)}x{dc.get('screen_height', 0)}"
        novelty = {
            "route_novelty": self._count_novelty(profile.get("routes", {}), telemetry.route),
            "resource_novelty": max(
                [self._count_novelty(profile.get("resources", {}), resource) for resource in observed_resources] or [0.0]
            ),
            "device_mismatch": self._count_novelty(profile.get("devices", {}), dc.get("fingerprint", "")),
            "screen_mismatch": self._count_novelty(profile.get("screen_profiles", {}), screen_key),
            "timezone_mismatch": self._count_novelty(profile.get("timezones", {}), dc.get("timezone", "")),
            "unusual_hour": self._count_novelty(profile.get("hours", {}), str(hour)),
        }

        observation = {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "context": {
                "trust_score": session.trust_score,
                "ip_status": session.ip_status,
                "access_level": session.access_level,
                "user_role": session.user.role if session.user else "",
                "privilege_score": session.user.privilege_score if session.user else 0,
            },
            "telemetry": telemetry_dict,
            "deviations": deviations,
            "novelty": novelty,
            "device_context": dc,
            "profile_samples": profile.get("samples", 0),
        }
        return observation, profile

    def _normalize_prediction(self, raw: Any) -> Dict[str, Any]:
        if isinstance(raw, dict):
            score = raw.get("score")
            risk = raw.get("risk")
            if score is None and risk is not None:
                score = 100 - float(risk)
            if risk is None and score is not None:
                risk = 100 - float(score)
            return {
                "score": int(round(_bounded(float(score if score is not None else 50)))),
                "risk": int(round(_bounded(float(risk if risk is not None else 50)))),
                "confidence": float(_bounded(float(raw.get("confidence", 0.5)) * 100 if float(raw.get("confidence", 0.5)) <= 1 else float(raw.get("confidence", 50)), 0, 100) / 100),
                "action": str(raw.get("action", "allow")),
                "reasons": [str(reason) for reason in raw.get("reasons", [])][:4],
            }

        if isinstance(raw, (int, float)):
            score = int(round(_bounded(float(raw))))
            return {"score": score, "risk": 100 - score, "confidence": 0.5, "action": "allow", "reasons": []}

        return {"score": 50, "risk": 50, "confidence": 0.5, "action": "allow", "reasons": []}

    def evaluate(self, session: Session, telemetry: BehaviorTelemetryRequest) -> Dict[str, Any]:
        observation, profile = self.build_observation(session, telemetry)
        adapter = self._adapter

        if hasattr(adapter, "predict"):
            raw = adapter.predict(observation)
        elif hasattr(adapter, "evaluate"):
            raw = adapter.evaluate(observation)
        else:
            raw = BuiltinBehaviorAdapter().predict(observation)

        assessment = self._normalize_prediction(raw)
        assessment.update(
            {
                "model_name": getattr(adapter, "name", getattr(adapter, "__name__", "custom_rl_model")),
                "model_version": getattr(adapter, "version", "unknown"),
                "model_loaded": not isinstance(adapter, BuiltinBehaviorAdapter),
                "features": observation,
            }
        )
        self._append_event({"timestamp": datetime.now().isoformat(), "type": "assessment", "assessment": assessment, "observation": observation})
        self._update_profile(profile, telemetry)
        self._teach_model(adapter, observation, assessment)
        return assessment

    def _teach_model(self, adapter: Any, observation: Dict[str, Any], assessment: Dict[str, Any]) -> None:
        if not hasattr(adapter, "learn"):
            return
        reward = round((assessment["score"] - assessment["risk"]) / 100, 3)
        adapter.learn({"observation": observation, "reward": reward, "assessment": assessment})
        saver = getattr(adapter, "save", None) or getattr(adapter, "save_model", None)
        if callable(saver):
            try:
                if self._loaded_path and Path(self._loaded_path).suffix.lower() in {".pkl", ".pickle"}:
                    saver(self._loaded_path)
                else:
                    saver()
            except TypeError:
                saver()

    def _update_profile(self, profile: Dict[str, Any], telemetry: BehaviorTelemetryRequest) -> None:
        profile["samples"] = profile.get("samples", 0) + 1
        for key in (
            "typing_speed_cpm",
            "key_hold_mean_ms",
            "key_flight_mean_ms",
            "mouse_velocity_mean",
            "mouse_curve_ratio",
            "scroll_distance",
            "click_count",
        ):
            self._update_metric(profile, key, float(getattr(telemetry, key, 0.0) or 0.0))

        profile.setdefault("routes", {})
        profile["routes"][telemetry.route] = profile["routes"].get(telemetry.route, 0) + 1
        profile.setdefault("resources", {})
        for resource in telemetry.resources or ([telemetry.resource] if telemetry.resource else []):
            if resource:
                profile["resources"][resource] = profile["resources"].get(resource, 0) + 1

        dc = self._device_context_dict(telemetry.device_context)
        if dc.get("fingerprint"):
            profile.setdefault("devices", {})
            profile["devices"][dc["fingerprint"]] = profile["devices"].get(dc["fingerprint"], 0) + 1
        screen_key = f"{dc.get('screen_width', 0)}x{dc.get('screen_height', 0)}"
        profile.setdefault("screen_profiles", {})
        profile["screen_profiles"][screen_key] = profile["screen_profiles"].get(screen_key, 0) + 1
        if dc.get("timezone"):
            profile.setdefault("timezones", {})
            profile["timezones"][dc["timezone"]] = profile["timezones"].get(dc["timezone"], 0) + 1
        hour_key = str(datetime.now().hour)
        profile.setdefault("hours", {})
        profile["hours"][hour_key] = profile["hours"].get(hour_key, 0) + 1
        profile["last_updated"] = datetime.now().isoformat()
        _write_json(PROFILE_FILE, self._profiles)

    def _append_event(self, event: Dict[str, Any]) -> None:
        _ensure_data_dir()
        with EVENTS_FILE.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event) + "\n")


rl_model_service = RLModelService()
