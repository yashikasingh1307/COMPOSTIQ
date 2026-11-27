// Full updated COMPOSTIQ code with MQTT + ThingSpeak + Live Dashboard + Compost Health Score
// Paste this entire code into Arduino IDE and upload to ESP32

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include "secrets.h"  // Copy secrets.example.h to secrets.h and fill locally.

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
#define BUZZER_PIN 18

// Relay outputs: Relay 1 controls the water pump; Relay 2 controls the fan.
#define PUMP_RELAY_PIN 26
#define FAN_RELAY_PIN 27

// Many 5V relay modules are active-LOW. If your relay board is active-HIGH,
// swap these two values after checking the relay module documentation.
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// Automatic actuator thresholds and timing.
#define FAN_TEMP_ON_THRESHOLD 35.0
#define FAN_TEMP_OFF_THRESHOLD 33.0
#define FAN_GAS_ON_THRESHOLD 1500
#define FAN_GAS_OFF_THRESHOLD 1300
#define PUMP_RUN_DURATION_MS 2000UL
#define PUMP_COOLDOWN_MS 60000UL

#define SOIL_DRY_THRESHOLD 2000
#define SOIL_WET_THRESHOLD 1000
#define GAS_THRESHOLD 1500
#define TEMP_LOW_THRESHOLD 20.0

#define DHT_TYPE DHT22  // Matches the DHT22 sensor in your wiring diagram
DHT dht(DHT_PIN, DHT_TYPE);

WebServer webServer(80);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

float temperature = 0;
float humidity = 0;
float healthScore = 0;
int soilMoisture = 0;
int gasValue = 0;
bool alarmState = false;
bool pumpState = false;
bool fanState = false;
unsigned long pumpStartedAt = 0;
unsigned long lastPumpRun = 0;
String lastUpdate = ""; 
String alertMessage = "All systems normal";

void reconnectMQTT() {
  while (!mqttClient.connected()) {
    if (mqttClient.connect("ESP32Client", mqtt_user, mqtt_pass)) break;
    delay(2000);
  }
}

void calculateHealthScore() {
  float tempScore = 100, humidityScore = 100, soilScore = 100, gasScore = 100;
  if (temperature < 20) tempScore = (temperature / 20.0) * 100;
  else if (temperature > 35) tempScore = max(0.0f, 100 - ((temperature - 35) * 5));

  if (humidity < 40) humidityScore = (humidity / 40.0) * 100;
  else if (humidity > 60) humidityScore = max(0.0f, 100 - ((humidity - 60) * 2));

  if (soilMoisture < 1000) soilScore = (soilMoisture / 1000.0) * 100;
else if (soilMoisture > 2000) soilScore = max(0.0f, 100.0f - ((soilMoisture - 2000) * 0.05f));

if (gasValue > 1500) gasScore = max(0.0f, 100.0f - ((gasValue - 1500) * 0.1f));

  healthScore = (tempScore + humidityScore + soilScore + gasScore) / 4.0;
}

void publishMQTTData() {
  mqttClient.publish("COMPOSTIQ/temp", String(temperature).c_str());
  mqttClient.publish("COMPOSTIQ/humidity", String(humidity).c_str());
  mqttClient.publish("COMPOSTIQ/soil", String(soilMoisture).c_str());
  mqttClient.publish("COMPOSTIQ/gas", String(gasValue).c_str());
  mqttClient.publish("COMPOSTIQ/health", String(healthScore).c_str());
  mqttClient.publish("COMPOSTIQ/alarm", alarmState ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/alert", alertMessage.c_str());
  mqttClient.publish("COMPOSTIQ/pump", pumpState ? "1" : "0");
  mqttClient.publish("COMPOSTIQ/fan", fanState ? "1" : "0");
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(FAN_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, RELAY_OFF);
  digitalWrite(FAN_RELAY_PIN, RELAY_OFF);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(1000);

  espClient.setInsecure();
  mqttClient.setServer(mqtt_server, mqtt_port);

  webServer.on("/", handleRoot);
  webServer.on("/data", handleData);
  webServer.on("/health", handleHealth);
  webServer.on("/alarm", handleAlarm);
  webServer.on("/control", handleControl);
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
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  soilMoisture = analogRead(SOIL_SENSOR_PIN);
  gasValue = analogRead(GAS_SENSOR_PIN);
  if (isnan(temperature) || isnan(humidity)) {
    temperature = 0; humidity = 0;
  }
  lastUpdate = String(millis() / 1000);
}

void checkAlarmAndAlerts() {
  bool tempLow = temperature < TEMP_LOW_THRESHOLD;
  bool soilTooDry = soilMoisture > SOIL_DRY_THRESHOLD;
  bool soilTooWet = soilMoisture < SOIL_WET_THRESHOLD;
  bool gasHigh = gasValue > GAS_THRESHOLD;

  alarmState = tempLow || soilTooDry || soilTooWet || gasHigh;

  if (gasHigh) alertMessage = "HIGH GAS SPIKE DETECTED - Check compost!";
  else if (soilTooDry) alertMessage = "COMPOST TOO DRY - Add Water";
  else if (soilTooWet) alertMessage = "COMPOST TOO WET - Turn Compost";
  else if (tempLow) alertMessage = "TEMPERATURE LOW - Compost Cooling";
  else alertMessage = "All systems normal";

  digitalWrite(BUZZER_PIN, alarmState ? HIGH : LOW);
}

// Automatically control the pump and ventilation fan.
// Pump: short watering pulse when the soil sensor reports dry compost.
// Fan: runs when temperature OR gas level is high, with hysteresis
// to prevent rapid relay switching around the threshold.
void updateActuators() {
  unsigned long now = millis();

  // WATER PUMP (Relay 1 / GPIO 26)
  if (pumpState && (now - pumpStartedAt >= PUMP_RUN_DURATION_MS)) {
    pumpState = false;
    digitalWrite(PUMP_RELAY_PIN, RELAY_OFF);
    lastPumpRun = now;
  }

  if (!pumpState &&
      soilMoisture > SOIL_DRY_THRESHOLD &&
      (lastPumpRun == 0 || now - lastPumpRun >= PUMP_COOLDOWN_MS)) {
    pumpState = true;
    pumpStartedAt = now;
    digitalWrite(PUMP_RELAY_PIN, RELAY_ON);
  }

  // VENTILATION FAN (Relay 2 / GPIO 27)
  bool fanTrigger = (temperature >= FAN_TEMP_ON_THRESHOLD) ||
                    (gasValue >= FAN_GAS_ON_THRESHOLD);
  bool fanCanStop = (temperature <= FAN_TEMP_OFF_THRESHOLD) &&
                    (gasValue <= FAN_GAS_OFF_THRESHOLD);

  if (!fanState && fanTrigger) {
    fanState = true;
    digitalWrite(FAN_RELAY_PIN, RELAY_ON);
  } else if (fanState && fanCanStop) {
    fanState = false;
    digitalWrite(FAN_RELAY_PIN, RELAY_OFF);
  }
}

void sendToThingSpeak() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = "http://" + String(thingSpeakServer) + "/update?api_key=" + apiKey;
    url += "&field1=" + String(temperature);
    url += "&field2=" + String(humidity);
    url += "&field3=" + String(soilMoisture);
    url += "&field4=" + String(gasValue);
    url += "&field5=" + String(alarmState ? 1 : 0);
    url += "&field6=" + String(pumpState ? 1 : 0);
    url += "&field7=" + String(fanState ? 1 : 0);
    http.begin(url);
    http.GET();
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

document.getElementById('temp').innerHTML = data.temperature + ' &deg;C';
document.getElementById('humidity').innerText = data.humidity + ' %';
document.getElementById('soil').innerText = data.soilMoisture;
document.getElementById('gas').innerText = data.gasValue;
document.getElementById('pump').innerText = data.pumpState ? 'ON' : 'OFF';
document.getElementById('fan').innerText = data.fanState ? 'ON' : 'OFF';
document.getElementById('health').innerText = data.healthScore.toFixed(1) + ' %';
document.getElementById('alarm').innerText = data.alarmState ? 'ACTIVE' : 'INACTIVE';
document.getElementById('updateTime').innerText = 'Last update: ' + data.lastUpdate;
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
if(data.soilMoisture > 2000){
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

function toggleBuzzer() {
fetch('/control?buzzer=off')
.then(response => response.text())
.then(data => alert('Buzzer turned off manually'));
}

setInterval(updateData, 2000);
window.onload = updateData;
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
<button onclick="toggleBuzzer()" style="padding:10px;background:#3498db;color:white;border:none;border-radius:5px;cursor:pointer;">
Turn Off Buzzer
</button>
</div>

<div class="card">
<h3>System Information</h3>
<div id="updateTime">Last update: --</div>
<div>ThingSpeak: Active</div>
<div>MQTT: Connected</div>
</div>

</div>
</body>
</html>
)====";

  webServer.send(200, "text/html", html);
}
void handleData() {
  String json = "{";
  json += "\"temperature\":" + String(temperature) + ",";
  json += "\"humidity\":" + String(humidity) + ",";
  json += "\"soilMoisture\":" + String(soilMoisture) + ",";
  json += "\"gasValue\":" + String(gasValue) + ",";
  json += "\"healthScore\":" + String(healthScore) + ",";
  json += "\"alarmState\":" + String(alarmState ? "true" : "false") + ",";
  json += "\"pumpState\":" + String(pumpState ? "true" : "false") + ",";
  json += "\"fanState\":" + String(fanState ? "true" : "false") + ",";
  json += "\"alertMessage\":\"" + alertMessage + "\",";
  json += "\"lastUpdate\":\"" + lastUpdate + "\"}";
  webServer.sendHeader("Access-Control-Allow-Origin", "*");
  webServer.sendHeader("Cache-Control", "no-store");
  webServer.send(200, "application/json", json);
}

void handleHealth() {
  String json = "{\"wifiConnected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
  json += ",\"mqttConnected\":" + String(mqttClient.connected() ? "true" : "false");
  json += ",\"uptimeSeconds\":" + String(millis() / 1000) + "}";
  webServer.sendHeader("Access-Control-Allow-Origin", "*");
  webServer.sendHeader("Cache-Control", "no-store");
  webServer.send(200, "application/json", json);
}

void handleAlarm(){ webServer.send(200,"text/plain", alarmState?"ACTIVE":"INACTIVE"); }
void handleControl(){ webServer.send(200,"text/plain","OK"); }
 

