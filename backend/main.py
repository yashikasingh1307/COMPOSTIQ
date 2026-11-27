import os
import math
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware

# Load the backend's own .env regardless of the directory used to launch
# uvicorn (for example, `uvicorn backend.main:app` from the project root).
# Existing process environment variables still take precedence.
load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=False)

CHANNEL_ID = os.getenv("THINGSPEAK_CHANNEL_ID")
READ_API_KEY = os.getenv("THINGSPEAK_READ_API_KEY")
ESP32_BASE_URL = os.getenv("ESP32_BASE_URL", "").strip().rstrip("/")
CONTROL_API_TOKEN = os.getenv("CONTROL_API_TOKEN", "").strip()

app = FastAPI(title="COMPOSTIQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "COMPOSTIQ Backend is running!"}


@app.get("/api/health")
def health():
    thingspeak_configured = bool(CHANNEL_ID and READ_API_KEY)
    esp32_configured = bool(ESP32_BASE_URL)
    result = {
        "status": "online",
        "project": "COMPOSTIQ",
        "thingspeakConfigured": thingspeak_configured,
        "esp32Configured": esp32_configured,
        "controlConfigured": bool(esp32_configured and CONTROL_API_TOKEN),
        "deviceControlConfigured": None,
        "mqttStatus": "not_reported_by_backend",
        "esp32Reachable": None,
        "wifiConnected": None,
        "mqttConnected": None,
        "thingSpeakConnected": None,
        "uptimeSeconds": None,
        "sensorDataSource": "esp32" if esp32_configured else ("thingspeak" if thingspeak_configured else None),
        "configurationHint": None,
    }
    if esp32_configured:
        try:
            response = requests.get(f"{ESP32_BASE_URL}/health", timeout=2.5)
            response.raise_for_status()
            device = response.json()
            if not isinstance(device, dict):
                raise ValueError("Invalid device health payload")
            result.update({
                "esp32Reachable": True,
                "wifiConnected": device.get("wifiConnected"),
                "mqttConnected": device.get("mqttConnected"),
                "thingSpeakConnected": device.get("thingSpeakConnected"),
                "uptimeSeconds": device.get("uptimeSeconds"),
                "deviceControlConfigured": device.get("controlConfigured"),
            })
            if device.get("controlConfigured") is not None:
                result["controlConfigured"] = result["controlConfigured"] and device.get("controlConfigured") is True
        except (requests.RequestException, TypeError, ValueError):
            result["esp32Reachable"] = False
            result["configurationHint"] = "ESP32_BASE_URL is set, but the ESP32 /health endpoint could not be reached. Check the device IP, Wi-Fi, and firmware."
    elif thingspeak_configured:
        result["configurationHint"] = "ESP32_BASE_URL is not set. Sensor readings use ThingSpeak, so they may be delayed."
    else:
        result["configurationHint"] = "Configure ESP32_BASE_URL for live device readings or add ThingSpeak channel credentials."
    return result


def _require_thingspeak_config():
    if not CHANNEL_ID or not READ_API_KEY:
        raise HTTPException(status_code=500, detail="ThingSpeak credentials are missing.")


def _fetch_feeds(params):
    _require_thingspeak_config()
    url = f"https://api.thingspeak.com/channels/{CHANNEL_ID}/feeds.json"
    try:
        response = requests.get(url, params={"api_key": READ_API_KEY, **params}, timeout=10)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get("feeds", []), list):
            raise ValueError("Unexpected ThingSpeak response")
        return payload.get("feeds", [])
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Unable to fetch data from ThingSpeak.")
    except (TypeError, ValueError):
        raise HTTPException(status_code=502, detail="ThingSpeak returned an invalid response.")


def _health_score(temperature, humidity, soil_moisture, gas_value):
    """Match calculateHealthScore() in firmware; this is estimated from cloud fields."""
    temp_score = 100.0
    humidity_score = 100.0
    soil_score = 100.0
    gas_score = 100.0
    if temperature < 20:
        temp_score = (temperature / 20.0) * 100
    elif temperature > 35:
        temp_score = max(0.0, 100 - ((temperature - 35) * 5))
    if humidity < 40:
        humidity_score = (humidity / 40.0) * 100
    elif humidity > 60:
        humidity_score = max(0.0, 100 - ((humidity - 60) * 2))
    if soil_moisture < 1000:
        soil_score = (soil_moisture / 1000.0) * 100
    elif soil_moisture > 2000:
        soil_score = max(0.0, 100 - ((soil_moisture - 2000) * 0.05))
    if gas_value > 1500:
        gas_score = max(0.0, 100 - ((gas_value - 1500) * 0.1))
    return (temp_score + humidity_score + soil_score + gas_score) / 4.0


def _alert_message(readings):
    if readings.get("gasValue") is not None and readings["gasValue"] > 1500:
        return "HIGH GAS SPIKE DETECTED - Check compost!"
    if readings.get("soilMoisture") is not None and readings["soilMoisture"] > 2000:
        return "COMPOST TOO DRY - Add Water"
    if readings.get("soilMoisture") is not None and readings["soilMoisture"] < 1000:
        return "COMPOST TOO WET - Turn Compost"
    if readings.get("temperature") is not None and readings["temperature"] < 20:
        return "TEMPERATURE LOW - Compost Cooling"
    return "All systems normal"


def _sensor_validity(temperature, humidity, soil_moisture, gas_value):
    dht_valid = temperature is not None and humidity is not None and not (temperature == 0 and humidity == 0)
    return {
        "temperature": dht_valid and math.isfinite(temperature) and -40 <= temperature <= 80,
        "humidity": dht_valid and math.isfinite(humidity) and 0 <= humidity <= 100,
        # ADC rail readings indicate a likely open/short analog connection.
        # Verify/tune the firmware rail limits for the actual sensor module.
        "soilMoisture": soil_moisture is not None and math.isfinite(soil_moisture) and 5 < soil_moisture < 4090,
        "gasValue": gas_value is not None and math.isfinite(gas_value) and 5 < gas_value < 4090,
    }


def _optional_state(feed, field_name):
    """Return an uploaded 0/1 state, or None when the feed omits that status."""
    value = feed.get(field_name)
    if value is None or str(value).strip() == "":
        return None
    return bool(int(float(value)))


def _parse_device_payload(payload):
    """Normalize the firmware /data response while preserving unknown statuses."""
    raw = {
        "temperature": float(payload["temperature"]) if payload.get("temperature") is not None else None,
        "humidity": float(payload["humidity"]) if payload.get("humidity") is not None else None,
        "soilMoisture": float(payload["soilMoisture"]) if payload.get("soilMoisture") is not None else None,
        "gasValue": float(payload["gasValue"]) if payload.get("gasValue") is not None else None,
    }
    validity = _sensor_validity(raw["temperature"], raw["humidity"], raw["soilMoisture"], raw["gasValue"])
    reported_validity = payload.get("sensorValidity")
    if isinstance(reported_validity, dict):
        validity = {key: valid and reported_validity.get(key) is not False for key, valid in validity.items()}
    readings = {
        **{key: value if validity.get(key, False) else None for key, value in raw.items()},
        "sensorValidity": validity,
        "alarmState": payload.get("alarmState"),
        "pumpState": payload.get("pumpState"),
        "fanState": payload.get("fanState"),
        "lastUpdate": datetime.now(timezone.utc).isoformat(),
        "source": "esp32",
    }
    for key in ("alarmState", "pumpState", "fanState"):
        if readings[key] is not None:
            value = readings[key]
            if isinstance(value, str):
                readings[key] = bool(int(float(value)))
            else:
                readings[key] = bool(value)
    if payload.get("healthScore") is not None:
        readings["healthScore"] = float(payload["healthScore"])
    if all(readings[key] is not None for key in ("temperature", "humidity", "soilMoisture", "gasValue")):
        fallback_score = _health_score(readings["temperature"], readings["humidity"], readings["soilMoisture"], readings["gasValue"])
    else:
        fallback_score = None
    if payload.get("healthScore") is not None and fallback_score is not None:
        readings["healthScore"] = float(payload["healthScore"])
    else:
        readings["healthScore"] = fallback_score
    readings["operatingMode"] = payload.get("operatingMode", "AUTO")
    readings["thresholds"] = payload.get("thresholds") or {}
    readings["alertMessage"] = payload.get("alertMessage") or _alert_message(readings)
    return readings


def _fetch_device_data():
    """Read instantaneous state from ESP32 server-side; the browser still calls FastAPI only."""
    if not ESP32_BASE_URL:
        return None
    try:
        response = requests.get(f"{ESP32_BASE_URL}/data", timeout=3)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            return None
        return _parse_device_payload(payload)
    except (requests.RequestException, TypeError, ValueError, KeyError):
        # ThingSpeak remains the fallback when the device is temporarily unreachable.
        return None


def _parse_feed(feed):
    raw = {
        "temperature": float(feed["field1"]),
        "humidity": float(feed["field2"]),
        "soilMoisture": float(feed["field3"]),
        "gasValue": float(feed["field4"]),
    }
    validity = _sensor_validity(raw["temperature"], raw["humidity"], raw["soilMoisture"], raw["gasValue"])
    readings = {
        **{key: value if validity[key] else None for key, value in raw.items()},
        "sensorValidity": validity,
        # Verified against sendToThingSpeak() in the ESP32 firmware:
        # field5=alarmState, field6=pumpState, field7=fanState.
        # Some ThingSpeak rows omit status fields; keep those unknown instead of
        # rejecting valid sensor measurements or reporting a false OFF state.
        "alarmState": _optional_state(feed, "field5"),
        "pumpState": _optional_state(feed, "field6"),
        "fanState": _optional_state(feed, "field7"),
        "lastUpdate": feed["created_at"],
        "source": "thingspeak",
    }
    readings["healthScore"] = _health_score(*raw.values()) if all(validity.values()) else None
    readings["alertMessage"] = _alert_message(readings)
    return readings


@app.get("/api/sensors")
def get_sensor_data():
    device_reading = _fetch_device_data()
    if device_reading is not None:
        return device_reading
    if not (CHANNEL_ID and READ_API_KEY):
        if ESP32_BASE_URL:
            raise HTTPException(
                status_code=502,
                detail="FastAPI could not read /data from the configured ESP32, and ThingSpeak fallback is not configured. Check ESP32_BASE_URL, Wi-Fi, and firmware.",
            )
        raise HTTPException(
            status_code=503,
            detail="No sensor source is configured. Set ESP32_BASE_URL for live ESP32 readings or configure ThingSpeak credentials in backend/.env.",
        )
    # Inspect a short window so one partial ThingSpeak upload does not block the
    # dashboard when a nearby complete sensor sample is available.
    feeds = _fetch_feeds({"results": 10})
    if not feeds:
        raise HTTPException(status_code=404, detail="No sensor readings available.")
    for feed in feeds:
        try:
            return _parse_feed(feed)
        except (TypeError, ValueError, KeyError):
            continue
    raise HTTPException(
        status_code=422,
        detail="The latest ThingSpeak rows do not contain numeric fields 1–4 and created_at.",
    )


@app.get("/api/history")
def get_sensor_history(minutes: int = Query(default=1440, ge=60, le=10080)):
    """Proxy real ThingSpeak samples for charts without exposing the read key to the browser."""
    feeds = _fetch_feeds({"minutes": minutes, "results": 8000})
    readings = []
    for feed in feeds:
        try:
            readings.append(_parse_feed(feed))
        except (TypeError, ValueError, KeyError):
            # Keep valid samples if a historical feed row is incomplete.
            continue
    return {"minutes": minutes, "readings": readings}


@app.post("/api/control")
def control_device(command: dict = Body(...), request: Request = None):
    """Forward validated commands through FastAPI; the browser never receives the device token."""
    allowed_origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
    if request and request.headers.get("origin") and request.headers.get("origin") not in allowed_origins:
        raise HTTPException(status_code=403, detail="This dashboard origin is not allowed to control the device.")
    if not ESP32_BASE_URL or not CONTROL_API_TOKEN:
        raise HTTPException(status_code=503, detail="Configure ESP32_BASE_URL and CONTROL_API_TOKEN in the backend environment.")
    allowed = {"mode", "pump", "fan", "soilDryThreshold", "temperatureThreshold", "soilRemovedAdc"}
    if not isinstance(command, dict) or not command or not set(command).issubset(allowed):
        raise HTTPException(status_code=422, detail="Control request contains unsupported or missing fields.")
    payload = {}
    if "mode" in command:
        mode = str(command["mode"]).upper()
        if mode not in {"AUTO", "MANUAL"}:
            raise HTTPException(status_code=422, detail="Mode must be AUTO or MANUAL.")
        payload["mode"] = mode
    for key in ("pump", "fan"):
        if key in command:
            if type(command[key]) is not bool:
                raise HTTPException(status_code=422, detail=f"{key} must be true or false.")
            payload[key] = "ON" if command[key] else "OFF"
    if "soilDryThreshold" in command:
        value = command["soilDryThreshold"]
        if type(value) is not int or not 1001 <= value <= 4000:
            raise HTTPException(status_code=422, detail="Soil dry threshold must be an integer from 1001 to 4000 ADC.")
        payload["soilDryThreshold"] = str(value)
    if "temperatureThreshold" in command:
        value = command["temperatureThreshold"]
        if type(value) not in (int, float) or not 34 <= value <= 60:
            raise HTTPException(status_code=422, detail="Temperature threshold must be from 34 to 60 °C.")
        payload["temperatureThreshold"] = str(value)
    if "soilRemovedAdc" in command:
        value = command["soilRemovedAdc"]
        if type(value) is not int or (value != 0 and not 6 <= value <= 4089):
            raise HTTPException(status_code=422, detail="Probe-removed ADC must be 0 to disable or 6–4089 to calibrate.")
        payload["soilRemovedAdc"] = str(value)
    try:
        response = requests.post(
            f"{ESP32_BASE_URL}/control", data=payload,
            headers={"X-CompostIQ-Control-Token": CONTROL_API_TOKEN}, timeout=4,
        )
        try:
            result = response.json()
        except ValueError:
            result = {"message": response.text[:200]}
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=result.get("detail") or result.get("message") or "ESP32 rejected the command.")
        return result
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="FastAPI could not reach the ESP32 control endpoint.")
