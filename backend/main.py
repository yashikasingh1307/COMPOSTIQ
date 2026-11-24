import os
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

CHANNEL_ID = os.getenv("THINGSPEAK_CHANNEL_ID")
READ_API_KEY = os.getenv("THINGSPEAK_READ_API_KEY")
ESP32_BASE_URL = os.getenv("ESP32_BASE_URL", "").strip().rstrip("/")

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
    return {
        "status": "online",
        "project": "COMPOSTIQ",
        "thingspeakConfigured": bool(CHANNEL_ID and READ_API_KEY),
        "esp32Configured": bool(ESP32_BASE_URL),
        "mqttStatus": "not_reported_by_backend",
    }


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
    if readings["gasValue"] > 1500:
        return "HIGH GAS SPIKE DETECTED - Check compost!"
    if readings["soilMoisture"] > 2000:
        return "COMPOST TOO DRY - Add Water"
    if readings["soilMoisture"] < 1000:
        return "COMPOST TOO WET - Turn Compost"
    if readings["temperature"] < 20:
        return "TEMPERATURE LOW - Compost Cooling"
    return "All systems normal"


def _optional_state(feed, field_name):
    """Return an uploaded 0/1 state, or None when the feed omits that status."""
    value = feed.get(field_name)
    if value is None or str(value).strip() == "":
        return None
    return bool(int(float(value)))


def _parse_device_payload(payload):
    """Normalize the firmware /data response while preserving unknown statuses."""
    readings = {
        "temperature": float(payload["temperature"]),
        "humidity": float(payload["humidity"]),
        "soilMoisture": float(payload["soilMoisture"]),
        "gasValue": float(payload["gasValue"]),
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
    readings = {
        "temperature": float(feed["field1"]),
        "humidity": float(feed["field2"]),
        "soilMoisture": float(feed["field3"]),
        "gasValue": float(feed["field4"]),
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
    readings["healthScore"] = _health_score(
        readings["temperature"], readings["humidity"],
        readings["soilMoisture"], readings["gasValue"],
    )
    readings["alertMessage"] = _alert_message(readings)
    return readings


@app.get("/api/sensors")
def get_sensor_data():
    device_reading = _fetch_device_data()
    if device_reading is not None:
        return device_reading
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
