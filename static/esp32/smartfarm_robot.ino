// Smart Farm robot - ESP32 sketch (Arduino core for ESP32)
// Sends soil moisture + TDS + zone ID to the Smart Farm website once per hour.
// Developed by Fares Hazem.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASSWORD";
// Use the endpoint and API key shown on the website's Robot page:
const char* ENDPOINT  = "https://YOUR-DOMAIN/api/robot/readings";
const char* API_KEY   = "PASTE_API_KEY_HERE";
const char* ROBOT_ID  = "robot-1";

const int PIN_MOISTURE = 34;      // capacitive soil moisture sensor (analog)
const int PIN_TDS      = 35;      // TDS sensor (analog)
const int ADC_DRY      = 3200;    // CALIBRATE: raw value in dry air
const int ADC_WET      = 1400;    // CALIBRATE: raw value in water
const unsigned long REPORT_MS = 3600000UL;  // 1 hour (match the website's report interval)

// IMPORTANT: replace with your real positioning/tracking logic (encoders, GPS, line/RFID markers...).
// It must return the zone number 1..256 in zigzag order (row 1 left->right, row 2 right->left, ...).
int getCurrentZone() { return 1; }

float readMoisturePercent() {
  long sum = 0; for (int i = 0; i < 20; i++) { sum += analogRead(PIN_MOISTURE); delay(5); }
  float raw = sum / 20.0;
  float pct = (ADC_DRY - raw) * 100.0 / (ADC_DRY - ADC_WET);
  return constrain(pct, 0.0, 100.0);
}

float readTdsPpm(float tempC = 25.0) {   // common Gravity-style TDS formula; calibrate with a standard solution
  long sum = 0; for (int i = 0; i < 20; i++) { sum += analogRead(PIN_TDS); delay(5); }
  float v = (sum / 20.0) * 3.3 / 4095.0;
  float comp = v / (1.0 + 0.02 * (tempC - 25.0));
  return (133.42 * comp * comp * comp - 255.86 * comp * comp + 857.39 * comp) * 0.5;
}

bool sendReading() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(5000); }
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client;
  client.setInsecure();   // for production, use client.setCACert(rootCA) instead
  HTTPClient http;
  http.begin(client, ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", API_KEY);
  String body = String("{\"robot_id\":\"") + ROBOT_ID + "\",\"zone_id\":" + getCurrentZone() +
                ",\"moisture\":" + String(readMoisturePercent(), 1) +
                ",\"tds\":" + String(readTdsPpm(), 0) + "}";
  int code = http.POST(body);
  Serial.printf("POST -> %d %s\n", code, http.getString().c_str());
  http.end();
  return code == 201;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected");
}

unsigned long lastSend = 0;
void loop() {
  if (lastSend == 0 || millis() - lastSend >= REPORT_MS) {
    if (sendReading()) lastSend = millis();
    else delay(30000);          // retry in 30 s if it failed
  }
  delay(1000);
}
