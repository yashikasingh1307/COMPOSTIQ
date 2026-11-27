// Full updated COMPOSTIQ code with MQTT + ThingSpeak + Live Dashboard + Compost Health Score
// Paste this entire code into Arduino IDE and upload to ESP32

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <Preferences.h>
#include <esp_timer.h>
#include "secrets.h"  // Copy secrets.example.h to secrets.h and fill locally.

#ifndef CONTROL_API_TOKEN
#define CONTROL_API_TOKEN ""
#endif

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;

const char* mqtt_server = "189a6597eab74aadaac35f47fefe20b9.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = MQTT_USERNAME;
const char* mqtt_pass = MQTT_PASSWORD;

const char* thingSpeakServer = "api.thingspeak.com";
String apiKey = THINGSPEAK_WRITE_API_KEY;

#define DHT_PIN 4
#define SOIL_SENSOR_PIN 34
#define GAS_SENSOR_PIN 35

// Relay outputs: Relay 1 controls the water pump; Relay 2 controls the fan.
#define PUMP_RELAY_PIN 26
#define FAN_RELAY_PIN 27

// Many 5V relay modules are active-LOW. If your relay board is active-HIGH,
// swap these two values after checking the relay module documentation.
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// Automatic actuator thresholds and timing.
#define DEFAULT_FAN_TEMP_ON_THRESHOLD 35.0
#define FAN_TEMP_OFF_THRESHOLD 33.0
#define FAN_GAS_ON_THRESHOLD 1500
#define FAN_GAS_OFF_THRESHOLD 1300
#define PUMP_RUN_DURATION_MS 2000UL
#define PUMP_COOLDOWN_MS 60000UL

#define DEFAULT_SOIL_DRY_THRESHOLD 2000
#define SOIL_WET_THRESHOLD 1000
#define GAS_THRESHOLD 1500
#define TEMP_LOW_THRESHOLD 20.0

// Near-rail ADC values indicate an open/short analog sensor circuit. Confirm
// these bounds against the actual soil/gas modules during commissioning.
#define ANALOG_VALID_MIN 5
#define ANALOG_VALID_MAX 4090
#define SOIL_PROBE_OUT_TOLERANCE_ADC 80

#define DHT_TYPE DHT22  // Matches the DHT22 sensor in your wiring diagram
DHT dht(DHT_PIN, DHT_TYPE);

WebServer webServer(80);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
Preferences preferences;
esp_timer_handle_t pumpSafetyTimer = nullptr;

float temperature = 0;
float humidity = 0;
float healthScore = 0;
int soilMoisture = 0;
int gasValue = 0;
bool alarmState = false;
volatile bool pumpState = false;
bool fanState = false;
bool temperatureValid = false;
bool humidityValid = false;
bool soilMoistureValid = false;
bool gasValueValid = false;
bool thingSpeakConnected = false;
String operatingMode = "AUTO";
int soilDryThreshold = DEFAULT_SOIL_DRY_THRESHOLD;
int soilRemovedAdc = 0;  // Set from dashboard after reading the probe-out value.
float fanTempOnThreshold = DEFAULT_FAN_TEMP_ON_THRESHOLD;
const char* controlToken = CONTROL_API_TOKEN;
unsigned long pumpStartedAt = 0;
volatile unsigned long lastPumpRun = 0;
String lastUpdate = ""; 
String alertMessage = "All systems normal";

void pumpSafetyTimeout(void*) {
  digitalWrite(PUMP_RELAY_PIN, RELAY_OFF);
  pumpState = false;
  lastPumpRun = millis();
}

bool startPumpPulse() {
  if (pumpState) return true;
  if (!pumpSafetyTimer) return false;
  pumpState = true;
  pumpStartedAt = millis();
  digitalWrite(PUMP_RELAY_PIN, RELAY_ON);
  if (esp_timer_start_once(pumpSafetyTimer, (uint64_t)PUMP_RUN_DURATION_MS * 1000ULL) != ESP_OK) {
    digitalWrite(PUMP_RELAY_PIN, RELAY_OFF);
    pumpState = false;
    lastPumpRun = millis();
    return false;
  }
  return true;
}

void stopPump() {
  bool wasRunning = pumpState;
  if (pumpSafetyTimer && esp_timer_is_active(pumpSafetyTimer)) esp_timer_stop(pumpSafetyTimer);
  pumpState = false;
  digitalWrite(PUMP_RELAY_PIN, RELAY_OFF);
  if (wasRunning) lastPumpRun = millis();
}

void reconnectMQTT() {
  static unsigned long lastAttempt = 0;
  if (mqttClient.connected() || millis() - lastAttempt < 5000) return;
  lastAttempt = millis();
  mqttClient.connect("ESP32Client", mqtt_user, mqtt_pass);
}

void calculateHealthScore() {
  float tempScore = 100, humidityScore = 100, soilScore = 100, gasScore = 100;
  if (temperature < 20) tempScore = (temperature / 20.0) * 100;
  else if (temperature > 35) tempScore = max(0.0f, 100 - ((temperature - 35) * 5));

  if (humidity < 40) humidityScore = (humidity / 40.0) * 100;
  else if (humidity > 60) humidityScore = max(0.0f, 100 - ((humidity - 60) * 2));

  if (!soilMoistureValid || !temperatureValid || !humidityValid || !gasValueValid) {
    healthScore = -1;
    return;
  }
  if (soilMoisture < 1000) soilScore = (soilMoisture / 1000.0) * 100;
  else if (soilMoisture > soilDryThreshold) soilScore = max(0.0f, 100.0f - ((soilMoisture - soilDryThreshold) * 0.05f));

if (gasValue > 1500) gasScore = max(0.0f, 100.0f - ((gasValue - 1500) * 0.1f));

  healthScore = (tempScore + humidityScore + soilScore + gasScore) / 4.0;
}

void publishMQTTData() {
  String tempPayload = temperatureValid ? String(temperature) : String("invalid");
  String humidityPayload = humidityValid ? String(humidity) : String("invalid");
  String soilPayload = soilMoistureValid ? String(soilMoisture) : String("invalid");
  String gasPayload = gasValueValid ? String(gasValue) : String("invalid");
  String healthPayload = healthScore >= 0 ? String(healthScore) : String("invalid");
  mqttClient.publish("COMPOSTIQ/temp", tempPayload.c_str());
  mqttClient.publish("COMPOSTIQ/humidity", humidityPayload.c_str());
  mqttClient.publish("COMPOSTIQ/soil", soilPayload.c_str());
  mqttClient.publish("COMPOSTIQ/gas", gasPayload.c_str());
  mqttClient.publish("COMPOSTIQ/health", healthPayload.c_str());
  mqttClient.publish("COMPOSTIQ/valid/temperature", temperatureValid ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/valid/humidity", humidityValid ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/valid/soil", soilMoistureValid ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/valid/gas", gasValueValid ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/alarm", alarmState ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/alert", alertMessage.c_str());
  mqttClient.publish("COMPOSTIQ/pump", pumpState ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/fan", fanState ? "1" : "0");
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  preferences.begin("compostiq", false);
  int storedSoilThreshold = preferences.getInt("soilDry", DEFAULT_SOIL_DRY_THRESHOLD);
  int storedSoilRemovedAdc = preferences.getInt("soilOut", 0);
  float storedTempThreshold = preferences.getFloat("tempOn", DEFAULT_FAN_TEMP_ON_THRESHOLD);
  if (storedSoilThreshold >= 1001 && storedSoilThreshold <= 4000) soilDryThreshold = storedSoilThreshold;
  if (storedSoilRemovedAdc == 0 || (storedSoilRemovedAdc > ANALOG_VALID_MIN && storedSoilRemovedAdc < ANALOG_VALID_MAX)) soilRemovedAdc = storedSoilRemovedAdc;
  if (storedTempThreshold >= 34 && storedTempThreshold <= 60) fanTempOnThreshold = storedTempThreshold;

  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(FAN_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, RELAY_OFF);
  digitalWrite(FAN_RELAY_PIN, RELAY_OFF);
  esp_timer_create_args_t pumpTimerArgs = {};
  pumpTimerArgs.callback = &pumpSafetyTimeout;
  pumpTimerArgs.name = "pump_cutoff";
  esp_timer_create(&pumpTimerArgs, &pumpSafetyTimer);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(1000);
  Serial.print("ESP32 address: http://");
  Serial.println(WiFi.localIP());

  espClient.setInsecure();
  mqttClient.setServer(mqtt_server, mqtt_port);

  webServer.on("/", handleRoot);
  webServer.on("/data", handleData);
  webServer.on("/health", handleHealth);
  webServer.on("/alarm", handleAlarm);
  const char* controlHeaders[] = {"X-CompostIQ-Control-Token"};
  webServer.collectHeaders(controlHeaders, 1);
  webServer.on("/control", HTTP_POST, handleControl);
  webServer.begin();
}

void loop() {
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  webServer.handleClient();
  readSensors();
  checkAlarmAndAlerts();
  updateActuators();
  calculateHealthScore();

  static unsigned long lastMQTT = 0;
  if (millis() - lastMQTT >= 5000) {
    publishMQTTData();
    lastMQTT = millis();
  }

  static unsigned long lastThingSpeak = 0;
  if (millis() - lastThingSpeak >= 30000) {
    sendToThingSpeak();
    lastThingSpeak = millis();
  }

  delay(1000);
}

void readSensors() {
  float measuredTemperature = dht.readTemperature();
  float measuredHumidity = dht.readHumidity();
  soilMoisture = analogRead(SOIL_SENSOR_PIN);
  gasValue = analogRead(GAS_SENSOR_PIN);
  temperatureValid = !isnan(measuredTemperature) && measuredTemperature >= -40 && measuredTemperature <= 80;
  humidityValid = !isnan(measuredHumidity) && measuredHumidity >= 0 && measuredHumidity <= 100;
  temperature = temperatureValid ? measuredTemperature : 0;
  humidity = humidityValid ? measuredHumidity : 0;
  soilMoistureValid = soilMoisture > ANALOG_VALID_MIN && soilMoisture < ANALOG_VALID_MAX &&
                      (soilRemovedAdc == 0 || abs(soilMoisture - soilRemovedAdc) > SOIL_PROBE_OUT_TOLERANCE_ADC);
  gasValueValid = gasValue > ANALOG_VALID_MIN && gasValue < ANALOG_VALID_MAX;
  lastUpdate = String(millis() / 1000);
}

void checkAlarmAndAlerts() {
  bool tempLow = temperatureValid && temperature < TEMP_LOW_THRESHOLD;
  bool soilTooDry = soilMoistureValid && soilMoisture > soilDryThreshold;
  bool soilTooWet = soilMoistureValid && soilMoisture < SOIL_WET_THRESHOLD;
  bool gasHigh = gasValueValid && gasValue > GAS_THRESHOLD;

  alarmState = tempLow || soilTooDry || soilTooWet || gasHigh;

  if (!temperatureValid || !humidityValid || !soilMoistureValid || !gasValueValid) alertMessage = "One or more sensors are disconnected or invalid";
  else if (gasHigh) alertMessage = "HIGH GAS SPIKE DETECTED - Check compost!";
  else if (soilTooDry) alertMessage = "COMPOST TOO DRY - Add Water";
  else if (soilTooWet) alertMessage = "COMPOST TOO WET - Turn Compost";
  else if (tempLow) alertMessage = "TEMPERATURE LOW - Compost Cooling";
  else alertMessage = "All systems normal";

}

// Automatically control the pump and ventilation fan.
// Pump: short watering pulse when the soil sensor reports dry compost.
// Fan: runs when temperature OR gas level is high, with hysteresis
// to prevent rapid relay switching around the threshold.
void updateActuators() {
  unsigned long now = millis();

  // WATER PUMP (Relay 1 / GPIO 26)
  if (pumpState && (!soilMoistureValid || now - pumpStartedAt >= PUMP_RUN_DURATION_MS)) {
    stopPump();
  }

  if (operatingMode == "MANUAL") return;

  if (!pumpState &&
      soilMoistureValid && soilMoisture > soilDryThreshold &&
      (lastPumpRun == 0 || now - lastPumpRun >= PUMP_COOLDOWN_MS)) {
    startPumpPulse();
  }

  // VENTILATION FAN (Relay 2 / GPIO 27)
  bool fanTrigger = (temperatureValid && temperature >= fanTempOnThreshold) ||
                    (gasValueValid && gasValue >= FAN_GAS_ON_THRESHOLD);
  bool fanCanStop = temperatureValid && gasValueValid &&
                    temperature <= FAN_TEMP_OFF_THRESHOLD && gasValue <= FAN_GAS_OFF_THRESHOLD;

  if (!fanState && fanTrigger) {
    fanState = true;
    digitalWrite(FAN_RELAY_PIN, RELAY_ON);
  } else if (fanState && fanCanStop) {
    fanState = false;
    digitalWrite(FAN_RELAY_PIN, RELAY_OFF);
  }
}

void sendToThingSpeak() {
  thingSpeakConnected = false;
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "http://" + String(thingSpeakServer) + "/update?api_key=" + apiKey;
    if (temperatureValid) url += "&field1=" + String(temperature);
    if (humidityValid) url += "&field2=" + String(humidity);
    if (soilMoistureValid) url += "&field3=" + String(soilMoisture);
    if (gasValueValid) url += "&field4=" + String(gasValue);
    url += "&field5=" + String(alarmState ? 1 : 0);
    url += "&field6=" + String(pumpState ? 1 : 0);
    url += "&field7=" + String(fanState ? 1 : 0);
    http.begin(url);
    int responseCode = http.GET();
    String responseBody = http.getString();
    thingSpeakConnected = responseCode == 200 && responseBody.toInt() > 0;
    http.end();
  }
}
void handleRoot() {
  String html = R"====(
<!DOCTYPE html>
<html>
<head>
<title>ESP32 Compost Monitor</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{font-family:Arial;text-align:center;background:#f0f0f0;margin:0;padding:20px;}
.container{max-width:1000px;margin:auto;}
.card{background:white;padding:20px;margin:15px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}
.sensor-value{font-size:2em;font-weight:bold;color:#2c3e50;}
.alert-box{padding:15px;border-radius:8px;margin:10px 0;font-weight:bold;}
.alert-normal{background:#51cf66;color:white;}
.alert-warning{background:#ffd43b;color:black;}
.alert-danger{background:#ff6b6b;color:white;}
.alarm-active{background:#ff6b6b;color:white;}
.alarm-inactive{background:#51cf66;color:white;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.health-main-card{max-width:500px;margin:30px auto;border:4px solid black;}
.status-dry{background:linear-gradient(135deg,#ffa726,#ff6b6b);color:white;}
.status-wet{background:linear-gradient(135deg,#42a5f5,#1976d2);color:white;}
.status-normal{background:linear-gradient(135deg,#66bb6a,#2e7d32);color:white;}
</style>

<script>
function updateData() {
fetch('/data')
.then(response => response.json())
.then(data => {

document.getElementById('temp').innerText = data.temperature == null ? 'Disconnected' : data.temperature + ' °C';
document.getElementById('humidity').innerText = data.humidity == null ? 'Disconnected' : data.humidity + ' %';
document.getElementById('soil').innerText = data.soilMoisture == null ? 'Disconnected' : data.soilMoisture;
document.getElementById('gas').innerText = data.gasValue == null ? 'Disconnected' : data.gasValue;
document.getElementById('pump').innerText = data.pumpState ? 'ON' : 'OFF';
document.getElementById('fan').innerText = data.fanState ? 'ON' : 'OFF';
document.getElementById('health').innerText = data.healthScore == null ? 'Unavailable' : data.healthScore.toFixed(1) + ' %';
document.getElementById('alarm').innerText = data.alarmState ? 'ACTIVE' : 'INACTIVE';
document.getElementById('updateTime').innerText = 'Last update: ' + data.lastUpdate;
document.getElementById('mode').innerText = 'Operating mode: ' + data.operatingMode;
document.getElementById('alertMessage').innerText = data.alertMessage;

const alarmCard = document.getElementById('alarmCard');
alarmCard.className = data.alarmState ? 'card alarm-active' : 'card alarm-inactive';

const alertBox = document.getElementById('alertMessage');
if(data.alertMessage.includes('GAS SPIKE')){
alertBox.className='alert-box alert-danger';
}
else if(data.alertMessage.includes('All systems normal')){
alertBox.className='alert-box alert-normal';
}
else{
alertBox.className='alert-box alert-warning';
}

const soilCard = document.getElementById('soilCard');
if(!data.sensorValidity.soilMoisture){
soilCard.className='card';
}
else if(data.soilMoisture > data.thresholds.soilDry){
soilCard.className='card status-dry';
}
else if(data.soilMoisture < 1000){
soilCard.className='card status-wet';
}
else{
soilCard.className='card status-normal';
}

const healthCard = document.getElementById('healthCard');
if(data.healthScore > 85){
healthCard.style.background='linear-gradient(135deg,#66bb6a,#2e7d32)';
healthCard.style.color='white';
}
else if(data.healthScore > 60){
healthCard.style.background='linear-gradient(135deg,#ffd43b,#ffb300)';
healthCard.style.color='black';
}
else{
healthCard.style.background='linear-gradient(135deg,#ff6b6b,#c62828)';
healthCard.style.color='white';
}

});
}

setInterval(updateData, 2000);
window.onload = updateData;

function updateConnectivity() {
fetch('/health').then(response => response.json()).then(status => {
document.getElementById('wifiStatus').innerText = status.wifiConnected ? 'Connected' : 'Disconnected';
document.getElementById('mqttStatus').innerText = status.mqttConnected ? 'Connected' : 'Disconnected';
document.getElementById('thingSpeakStatus').innerText = status.thingSpeakConnected ? 'Connected' : 'Disconnected';
});
}
setInterval(updateConnectivity, 5000);
window.addEventListener('load', updateConnectivity);
</script>
</head>

<body>
<div class="container">

<h1>Compost Monitoring System</h1>

<div class="card alert-box alert-normal" id="alertMessage">
Loading...
</div>

<div class="grid">

<div class="card">
<h2>Temperature</h2>
<div class="sensor-value" id="temp">--</div>
<small>Optimal: 20-35</small>
</div>

<div class="card">
<h2>Humidity</h2>
<div class="sensor-value" id="humidity">--</div>
<small>Optimal: 40-60%</small>
</div>

<div class="card" id="soilCard">
<h2>Soil Moisture</h2>
<div class="sensor-value" id="soil">--</div>
<small>Dry: >2000, Wet: <1000</small>
</div>

<div class="card">
<h2>Gas Level</h2>
<div class="sensor-value" id="gas">--</div>
<small>Alert: >1500</small>
</div>

</div>

<div class="grid">
  <div class="card">
    <h2>Water Pump</h2>
    <div class="sensor-value" id="pump">OFF</div>
    <small>Automatic moisture control</small>
  </div>
  <div class="card">
    <h2>Ventilation Fan</h2>
    <div class="sensor-value" id="fan">OFF</div>
    <small>Automatic temperature / gas control</small>
  </div>
</div>

<div class="card health-main-card" id="healthCard">
<h2>Compost Health</h2>
<div class="sensor-value" id="health">--</div>
<small>Ideal >85%</small>
</div>

<div class="card" id="alarmCard">
<h2>Alarm Status</h2>
<div class="sensor-value" id="alarm">--</div>
</div>

<div class="card">
<h3>System Information</h3>
<div id="updateTime">Last update: --</div>
<div id="mode">Operating mode: --</div>
<div>ThingSpeak: <span id="thingSpeakStatus">Unknown</span></div>
<div>MQTT: <span id="mqttStatus">Unknown</span></div>
<div>Wi-Fi: <span id="wifiStatus">Unknown</span></div>
</div>

</div>
</body>
</html>
)====";

  webServer.send(200, "text/html", html);
}
void handleData() {
  String json = "{";
  json += "\"temperature\":" + (temperatureValid ? String(temperature, 1) : String("null")) + ",";
  json += "\"humidity\":" + (humidityValid ? String(humidity, 1) : String("null")) + ",";
  json += "\"soilMoisture\":" + (soilMoistureValid ? String(soilMoisture) : String("null")) + ",";
  json += "\"gasValue\":" + (gasValueValid ? String(gasValue) : String("null")) + ",";
  json += "\"healthScore\":" + (healthScore >= 0 ? String(healthScore, 1) : String("null")) + ",";
  json += "\"sensorValidity\":{";
  json += "\"temperature\":" + String(temperatureValid ? "true" : "false") + ",";
  json += "\"humidity\":" + String(humidityValid ? "true" : "false") + ",";
  json += "\"soilMoisture\":" + String(soilMoistureValid ? "true" : "false") + ",";
  json += "\"gasValue\":" + String(gasValueValid ? "true" : "false") + "},";
  json += "\"alarmState\":" + String(alarmState ? "true" : "false") + ",";
  json += "\"pumpState\":" + String(pumpState ? "true" : "false") + ",";
  json += "\"fanState\":" + String(fanState ? "true" : "false") + ",";
  json += "\"operatingMode\":\"" + operatingMode + "\",";
  json += "\"thresholds\":{";
  json += "\"soilDry\":" + String(soilDryThreshold) + ",";
  json += "\"soilRemovedAdc\":" + String(soilRemovedAdc) + ",";
  json += "\"temperatureHigh\":" + String(fanTempOnThreshold, 1) + "},";
  json += "\"alertMessage\":\"" + alertMessage + "\",";
  json += "\"lastUpdate\":\"" + lastUpdate + "\"}";
  webServer.sendHeader("Access-Control-Allow-Origin", "*");
  webServer.sendHeader("Cache-Control", "no-store");
  webServer.send(200, "application/json", json);
}

void handleHealth() {
  String json = "{\"wifiConnected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
  json += ",\"mqttConnected\":" + String(mqttClient.connected() ? "true" : "false");
  json += ",\"thingSpeakConnected\":" + String(thingSpeakConnected ? "true" : "false");
  json += ",\"controlConfigured\":" + String(String(controlToken).length() > 0 ? "true" : "false");
  json += ",\"operatingMode\":\"" + operatingMode + "\"";
  json += ",\"uptimeSeconds\":" + String(millis() / 1000) + "}";
  webServer.sendHeader("Access-Control-Allow-Origin", "*");
  webServer.sendHeader("Cache-Control", "no-store");
  webServer.send(200, "application/json", json);
}

void handleAlarm(){ webServer.send(200,"text/plain", alarmState?"ACTIVE":"INACTIVE"); }
void handleControl() {
  if (!controlToken[0] || webServer.header("X-CompostIQ-Control-Token") != String(controlToken)) {
    webServer.send(403, "application/json", "{\"detail\":\"Invalid or missing control token.\"}");
    return;
  }
  bool changed = false;
  if (webServer.hasArg("mode")) {
    String requestedMode = webServer.arg("mode");
    requestedMode.toUpperCase();
    if (requestedMode != "AUTO" && requestedMode != "MANUAL") {
      webServer.send(422, "application/json", "{\"detail\":\"Mode must be AUTO or MANUAL.\"}");
      return;
    }
    stopPump();
    operatingMode = requestedMode;
    fanState = false;
    digitalWrite(FAN_RELAY_PIN, RELAY_OFF);
    changed = true;
  }
  if (webServer.hasArg("soilDryThreshold")) {
    int value = webServer.arg("soilDryThreshold").toInt();
    if (value < 1001 || value > 4000) {
      webServer.send(422, "application/json", "{\"detail\":\"Soil threshold must be 1001–4000 ADC.\"}");
      return;
    }
    soilDryThreshold = value;
    preferences.putInt("soilDry", soilDryThreshold);
    changed = true;
  }
  if (webServer.hasArg("soilRemovedAdc")) {
    int value = webServer.arg("soilRemovedAdc").toInt();
    if (value != 0 && (value <= ANALOG_VALID_MIN || value >= ANALOG_VALID_MAX)) {
      webServer.send(422, "application/json", "{\"detail\":\"Probe-removed ADC must be 0 to disable or between 6 and 4089.\"}");
      return;
    }
    soilRemovedAdc = value;
    preferences.putInt("soilOut", soilRemovedAdc);
    changed = true;
  }
  if (webServer.hasArg("temperatureThreshold")) {
    float value = webServer.arg("temperatureThreshold").toFloat();
    if (value < 34 || value > 60) {
      webServer.send(422, "application/json", "{\"detail\":\"Temperature threshold must be 34–60 °C.\"}");
      return;
    }
    fanTempOnThreshold = value;
    preferences.putFloat("tempOn", fanTempOnThreshold);
    changed = true;
  }
  if (webServer.hasArg("pump")) {
    if (operatingMode != "MANUAL") {
      webServer.send(409, "application/json", "{\"detail\":\"Switch to MANUAL mode before controlling the pump.\"}");
      return;
    }
    String command = webServer.arg("pump");
    command.toUpperCase();
    if (command == "ON") {
      if (!soilMoistureValid) {
        webServer.send(409, "application/json", "{\"detail\":\"Pump blocked: soil sensor is invalid or disconnected.\"}");
        return;
      }
      if (!pumpState && lastPumpRun != 0 && millis() - lastPumpRun < PUMP_COOLDOWN_MS) {
        webServer.send(409, "application/json", "{\"detail\":\"Pump cooldown is active.\"}");
        return;
      }
      if (!startPumpPulse()) {
        webServer.send(503, "application/json", "{\"detail\":\"Pump safety timer could not be started; output was kept OFF.\"}");
        return;
      }
      changed = true;
    } else if (command == "OFF") {
      stopPump();
      changed = true;
    } else {
      webServer.send(422, "application/json", "{\"detail\":\"Pump command must be ON or OFF.\"}");
      return;
    }
  }
  if (webServer.hasArg("fan")) {
    if (operatingMode != "MANUAL") {
      webServer.send(409, "application/json", "{\"detail\":\"Switch to MANUAL mode before controlling the fan.\"}");
      return;
    }
    String command = webServer.arg("fan");
    command.toUpperCase();
    if (command != "ON" && command != "OFF") {
      webServer.send(422, "application/json", "{\"detail\":\"Fan command must be ON or OFF.\"}");
      return;
    }
    fanState = command == "ON";
    digitalWrite(FAN_RELAY_PIN, fanState ? RELAY_ON : RELAY_OFF);
    changed = true;
  }
  if (!changed) {
    webServer.send(422, "application/json", "{\"detail\":\"No supported control command was provided.\"}");
    return;
  }
  String json = "{\"ok\":true,\"message\":\"Command applied.\",\"operatingMode\":\"" + operatingMode + "\"";
  json += ",\"pumpState\":" + String(pumpState ? "true" : "false");
  json += ",\"fanState\":" + String(fanState ? "true" : "false") + "}";
  webServer.send(200, "application/json", json);
}
 

