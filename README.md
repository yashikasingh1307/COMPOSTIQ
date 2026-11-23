# CompostIQ

CompostIQ is a React/Vite dashboard for the existing ESP32 compost monitor. The redesign includes six connected pages, live sensor cards, session-only sample history, firmware-based threshold guidance, and a botanical glass UI. It reads sensor samples through the repository's FastAPI → ThingSpeak pipeline.

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

- The backend requests only the latest ThingSpeak feed. The sensor table and trend chart therefore retain samples only while this dashboard session is open; they are not historical cloud queries.
- The current ThingSpeak feed contains sensor values plus alarm, pump, and fan fields. The backend maps these fields according to the firmware (`field5` alarm, `field6` pump, `field7` fan).
- The firmware health score is not included in ThingSpeak fields. The dashboard reports the score as unavailable rather than fabricating or recalculating it.
- MQTT connectivity is not exposed by the FastAPI service, so Settings marks it as unreported.
- Event entries are observed during the current browser session, not retrieved from a persistent event log.
- Device name, location, timezone, manual actuator modes, buzzer controls, and persistent alerts are not supported by the existing API and are not presented as working settings.

## Summary of the redesign

- Applied the ivory, sage, forest-green botanical palette, translucent cards, decorative botanical corner art, and responsive navigation across all six pages.
- Kept the existing page set and data flow while aligning backend ThingSpeak field names with the firmware.
- Added firmware threshold guidance for compost health factors and made unavailable scores explicit.
- Removed browser-side API-key storage and embedded cloud URLs that could expose credentials.
- Added a safe backend URL setting and credential templates for local setup.
