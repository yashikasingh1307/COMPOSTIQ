import os

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

CHANNEL_ID = os.getenv("THINGSPEAK_CHANNEL_ID")
READ_API_KEY = os.getenv("THINGSPEAK_READ_API_KEY")

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

    feed = feeds[0]

    try:
        readings = {
            "temperature": float(feed["field1"]),
            "humidity": float(feed["field2"]),
            "soilMoisture": float(feed["field3"]),
            "gasValue": float(feed["field4"]),
            # Firmware field order: 5=alarm, 6=pump, 7=fan.
            "alarmState": bool(int(float(feed["field5"]))),
            "pumpState": bool(int(float(feed["field6"]))),
            "fanState": bool(int(float(feed["field7"]))),
            "lastUpdate": feed["created_at"]
        }
        if readings["gasValue"] > 1500:
            readings["alertMessage"] = "HIGH GAS SPIKE DETECTED - Check compost!"
        elif readings["soilMoisture"] > 2000:
            readings["alertMessage"] = "COMPOST TOO DRY - Add Water"
        elif readings["soilMoisture"] < 1000:
            readings["alertMessage"] = "COMPOST TOO WET - Turn Compost"
        elif readings["temperature"] < 20:
            readings["alertMessage"] = "TEMPERATURE LOW - Compost Cooling"
        else:
            readings["alertMessage"] = "All systems normal"

    except (TypeError, ValueError, KeyError):
        raise HTTPException(
            status_code=422,
            detail="Sensor data is incomplete or invalid."
        )

    return readings
