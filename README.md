# CompostIQ

CompostIQ is a React/Vite dashboard for the existing ESP32 compost monitor. The Claude redesign supplies the six-page botanical glass UI; all readings continue through the existing FastAPI → ThingSpeak pipeline.

## Run locally

### Backend

1. Install Python 3.10 or later.
2. In `backend`, create and activate a virtual environment.
3. Install dependencies with `pip install -r requirements.txt`.
4. Copy `.env.example` to `.env` and add the ThingSpeak channel ID and read key.
5. Start the API from the repository root with `uvicorn backend.main:app --reload --port 8000`.

### Dashboard

1. Install Node.js 18 or later.
2. From the repository root, run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. In **Settings**, set the backend URL if it is not `http://127.0.0.1:8000`.

To create a production build, run `npm run build`; the static files are written to `dist/`.

## Firmware credentials

Firmware credentials are not included. Copy `firmware/secrets.example.h` to `firmware/secrets.h`, fill in local Wi-Fi, MQTT, and ThingSpeak values, and keep `secrets.h` private. The ESP32 continues to run its pump and fan automation locally; the web dashboard does not issue actuator commands because the current firmware `/control` handler does not implement them.

## Data and limitations

- The browser calls FastAPI only: `/api/sensors`, `/api/health`, and `/api/history`. ThingSpeak credentials remain in the backend environment.
- Firmware field mapping is verified in `sendToThingSpeak()`: fields 1–4 are temperature, humidity, soil moisture and gas; field 5 is alarm; field 6 is pump; field 7 is fan.
- `/api/history` proxies up to 8,000 samples for a selected time window. ThingSpeak's Read Data API supports `minutes` and a maximum of 8,000 results ([MathWorks API reference](https://www.mathworks.com/help/thingspeak/readdata.html)).
- The firmware health score is not uploaded in the ThingSpeak fields. The backend calculates the same formula from real readings and the UI labels the result estimated.
- Wi-Fi, MQTT and uptime are not reported by the current FastAPI API, so these indicators remain unknown unless a future backend version exposes them.
- Event transitions observed in the browser are session events; alert history and sensor trends are reconstructed from real ThingSpeak samples.
- The ESP32 runs pump and fan automation locally. The dashboard reports their states but has no manual actuator controls because the current firmware `/control` handler does not implement commands.
- Device name, location, timezone, buzzer controls and persistent device-side alert configuration are not exposed by the current API.

## Summary of the redesign

- Applied the ivory, sage, forest-green botanical palette, translucent cards, decorative botanical corner art, and responsive navigation across all six pages.
- Kept the existing page set and data flow while aligning backend ThingSpeak field names with the firmware.
- Added firmware threshold guidance for compost health factors and made unavailable scores explicit.
- Removed browser-side API-key storage and embedded cloud URLs that could expose credentials.
- Added a safe backend URL setting and credential templates for local setup.
