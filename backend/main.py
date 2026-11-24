import copy
import os
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

CHANNEL_ID = os.getenv("THINGSPEAK_CHANNEL_ID")
READ_API_KEY = os.getenv("THINGSPEAK_READ_API_KEY")

# Alert thresholds. Change them here instead of editing the alert logic.
GAS_SPIKE_LIMIT = 1500
SOIL_DRY_LIMIT = 2000
SOIL_WET_LIMIT = 1000
TEMP_LOW_LIMIT = 20

# If the newest ThingSpeak entry is older than this, the device is treated as offline.
MAX_DATA_AGE_MINUTES = 10

# Most recent complete, fresh reading. Used as a fallback when ThingSpeak fails.
last_good_readings = None

app = FastAPI(title="COMPOSTIQ Backend")

# Allow our React dashboard to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_float(feed, key):
    """Read one ThingSpeak field as a float and explain exactly what went wrong."""
    raw = feed.get(key)  # .get returns None instead of raising KeyError

    if raw is None or raw == "":
        # ThingSpeak sends null/empty for fields the device didn't report
        raise HTTPException(
            status_code=422,
            detail=f"ThingSpeak {key} is empty.",
        )

    try:
        return float(raw)  # ThingSpeak returns values as strings, so convert
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"ThingSpeak {key} is not a number: {raw!r}",
        )


def is_too_old(timestamp):
    """Return True if the ThingSpeak timestamp is missing, unreadable, or older than the limit."""
    try:
        # ThingSpeak uses a trailing "Z" for UTC, which fromisoformat needs spelled as +00:00
        last_update = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return True

    age = datetime.now(timezone.utc) - last_update
    return age > timedelta(minutes=MAX_DATA_AGE_MINUTES)


def fetch_latest_feed():
    """Ask ThingSpeak for the newest entry on the channel."""
    if not CHANNEL_ID or not READ_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ThingSpeak credentials are missing."
        )

    url = (
        f"https://api.thingspeak.com/channels/"
        f"{CHANNEL_ID}/feeds.json"
    )

    params = {
        "api_key": READ_API_KEY,
        "results": 1
    }

    try:
        response = requests.get(
            url,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Unable to fetch data from ThingSpeak."
        )

    feeds = data.get("feeds", [])

    if not feeds:
        raise HTTPException(
            status_code=404,
            detail="No sensor readings available."
        )

    return feeds[0]


def build_readings():
    """Fetch the latest feed and turn it into dashboard readings with an alert message."""
    feed = fetch_latest_feed()

    # Field order as used by the device: 5=pump, 6=fan.
    readings = {
        "temperature": read_float(feed, "field1"),
        "humidity": read_float(feed, "field2"),
        "soilMoisture": read_float(feed, "field3"),
        "gasValue": read_float(feed, "field4"),
        "pumpState": bool(int(read_float(feed, "field5"))),
        "fanState": bool(int(read_float(feed, "field6"))),
        "lastUpdate": feed.get("created_at"),
    }

    if readings["gasValue"] > GAS_SPIKE_LIMIT:
        readings["alertMessage"] = "HIGH GAS SPIKE DETECTED - Check compost!"
    elif readings["soilMoisture"] > SOIL_DRY_LIMIT:
        readings["alertMessage"] = "COMPOST TOO DRY - Add Water"
    elif readings["soilMoisture"] < SOIL_WET_LIMIT:
        readings["alertMessage"] = "COMPOST TOO WET - Turn Compost"
    elif readings["temperature"] < TEMP_LOW_LIMIT:
        readings["alertMessage"] = "TEMPERATURE LOW - Compost Cooling"
    else:
        readings["alertMessage"] = "All systems normal"

    return readings


@app.get("/")
def home():
    return {
        "message": "COMPOSTIQ Backend is running!"
    }


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "project": "COMPOSTIQ",
        "thingspeakConfigured": bool(CHANNEL_ID and READ_API_KEY),
        "mqttStatus": "not_reported_by_backend",
    }


@app.get("/api/sensors")
def get_sensor_data():
    global last_good_readings

    try:
        readings = build_readings()
    except HTTPException as error:
        # Fall back to the last good reading for data problems only.
        # Missing credentials (500) and a first request with no history still fail.
        if last_good_readings is None or error.status_code == 500:
            raise

        stale = copy.deepcopy(last_good_readings)

        # Actuator states can change without us seeing them, so mark them unknown.
        stale["pumpState"] = None
        stale["fanState"] = None

        stale["stale"] = True
        stale["staleReason"] = error.detail
        return stale

    # The fetch worked, but the device may have stopped sending updates.
    if is_too_old(readings["lastUpdate"]):
        readings["pumpState"] = None
        readings["fanState"] = None
        readings["stale"] = True
        readings["staleReason"] = (
            f"No device update since {readings['lastUpdate']}."
        )
        return readings

    readings["stale"] = False
    readings["staleReason"] = None
    last_good_readings = copy.deepcopy(readings)
    return readings