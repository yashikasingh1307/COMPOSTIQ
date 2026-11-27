# CompostIQ

CompostIQ is a React/Vite dashboard for the existing ESP32 compost monitor. It keeps the six-page botanical glass UI, gets live readings and actuator state through FastAPI from the ESP32 when configured, and uses ThingSpeak for historical trends and fallback data.

## Run locally

### Backend

1. Install Python 3.10 or later.
2. In `backend`, create and activate a virtual environment.
3. Install dependencies with `pip install -r requirements.txt`.
4. Copy `.env.example` to `.env` and add the ThingSpeak channel ID and read key, ESP32 URL, and control token. To show instantaneous pump/fan state, set `ESP32_BASE_URL` to the ESP32's local address (for example `http://192.168.1.42`).
5. From the `backend` folder, start the API with `uvicorn main:app --reload --host 0.0.0.0 --port 8000`.

### Dashboard

1. Install Node.js 18 or later.
2. From the repository root, run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. In **Settings**, set the backend URL if it is not `http://127.0.0.1:8000`.

To create a production build, run `npm run build`; the static files are written to `dist/`.

## Firmware credentials

Firmware credentials are not included. Copy `firmware/secrets.example.h` to `firmware/secrets.h`, fill in local Wi-Fi, MQTT, ThingSpeak values, and a private control token, and keep `secrets.h` private. The token must match `CONTROL_API_TOKEN` in `backend/.env`. Reflash the ESP32 after firmware changes. The Serial Monitor prints its local IP address after Wi-Fi connects.

## Data and limitations

- The browser calls FastAPI only: `/api/sensors`, `/api/health`, and `/api/history`. ThingSpeak credentials and the optional ESP32 address remain in the backend environment. When configured, FastAPI reads instantaneous sensor/actuator state from the firmware `/data` endpoint; ThingSpeak remains the historical feed and the fallback when the ESP32 is unreachable.
- Firmware field mapping is verified in `sendToThingSpeak()`: fields 1–4 are temperature, humidity, soil moisture and gas; field 5 is alarm; field 6 is pump; field 7 is fan.
- `/api/history` proxies up to 8,000 samples for a selected time window. ThingSpeak's Read Data API supports `minutes` and a maximum of 8,000 results ([MathWorks API reference](https://www.mathworks.com/help/thingspeak/readdata.html)).
- The firmware health score is not uploaded in the ThingSpeak fields. The backend calculates the same formula from real readings and the UI labels the result estimated.
- Wi-Fi, MQTT and uptime are read by FastAPI from the ESP32 `/health` endpoint when the device URL is configured.
- Event transitions observed in the browser are session events; alert history and sensor trends are reconstructed from real ThingSpeak samples.
- The ESP32 runs pump and fan automation locally in AUTO mode. MANUAL mode and pump/fan commands are forwarded by FastAPI to the ESP32 `/control` endpoint; command tokens are never sent to the browser.
- Pump activation is limited to a 2-second pulse and 60-second cooldown, including manual mode. Pump ON is rejected when soil sensor validity fails. Outputs turn off when switching modes.
- Soil dry and fan temperature thresholds are saved in ESP32 NVS and restored after reboot. Allowed ranges are 1001–4000 ADC and 34–60 °C, keeping the fan trigger above its 33 °C stop threshold and soil dry above the wet-alert boundary.
- Sensor validity detects DHT22 failures and analog ADC rail values. Tune `ANALOG_VALID_MIN/MAX` against the installed analog sensors. A moisture probe lifted into air may still return a plausible ADC value; reliable removal detection for that case requires calibrating a probe-out ADC threshold or adding a physical presence sensor.
- For probe-out detection, first switch to MANUAL, remove the probe, read its raw ADC value, enter **Soil probe removed reading** on Automation, and save. The ESP32 persists this calibration and marks readings within ±80 ADC as disconnected. Calibrate for the actual module; leave blank to disable it.
- Alert state is computed from sensor readings and shown in the dashboard.

## Summary of the redesign

- Applied the ivory, sage, forest-green botanical palette, translucent cards, decorative botanical corner art, and responsive navigation across all six pages.
- Kept the existing page set and data flow while aligning backend ThingSpeak field names with the firmware.
- Added firmware threshold guidance for compost health factors and made unavailable scores explicit.
- Removed browser-side API-key storage and embedded cloud URLs that could expose credentials.
- Added a safe backend URL setting and credential templates for local setup.
