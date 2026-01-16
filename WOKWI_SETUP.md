
# Wokwi IoT Simulator Setup Guide

## Overview
Yeh guide aapko batayega kaise Wokwi.com par virtual hardware setup karein jo humare application se connect hoga.

## Step 1: Wokwi Project Setup

1. **Wokwi.com par jaayein** - https://wokwi.com/
2. **New Project banayein** - ESP32 select karein
3. **Components add karein:**
   - ESP32 Dev Board
   - Light Sensor (LDR)
   - Temperature Sensor (DHT22 or LM35)
   - Voltage/Current Sensor
   - Dust Sensor (GP2Y1010AU0F)

## Step 2: ESP32 Code (Arduino)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define LDR_PIN 34
#define VOLTAGE_PIN 35
#define CURRENT_PIN 32
#define DUST_PIN 33

DHT dht(DHTPIN, DHTTYPE);

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* serverUrl = "YOUR_REPLIT_URL/api/panels/panel-1/reading";

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

void loop() {
  // Read sensors
  float temperature = dht.readTemperature();
  int ldrValue = analogRead(LDR_PIN);
  int voltageValue = analogRead(VOLTAGE_PIN);
  int currentValue = analogRead(CURRENT_PIN);
  int dustValue = analogRead(DUST_PIN);
  
  // Convert to actual values
  float sunlight = map(ldrValue, 0, 4095, 0, 1000);
  float voltage = (voltageValue / 4095.0) * 20.0;
  float current = (currentValue / 4095.0) * 5.0;
  float dustLevel = (dustValue / 4095.0) * 10.0;
  float energyOutput = voltage * current;
  
  // Send data to server
  if(WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    String jsonData = "{";
    jsonData += "\"energyOutput\":" + String(energyOutput) + ",";
    jsonData += "\"sunlightIntensity\":" + String(sunlight) + ",";
    jsonData += "\"temperature\":" + String(temperature) + ",";
    jsonData += "\"dustLevel\":" + String(dustLevel) + ",";
    jsonData += "\"voltage\":" + String(voltage) + ",";
    jsonData += "\"current\":" + String(current);
    jsonData += "}";
    
    int httpResponseCode = http.POST(jsonData);
    Serial.println("Response: " + String(httpResponseCode));
    http.end();
  }
  
  delay(2000); // Send data every 2 seconds
}
```

## Step 3: Wokwi Diagram.json

Wokwi editor mein "diagram.json" file create karein:

```json
{
  "version": 1,
  "author": "Solar Panel Monitor",
  "editor": "wokwi",
  "parts": [
    { "type": "wokwi-esp32-devkit-v1", "id": "esp", "top": 0, "left": 0 },
    { "type": "wokwi-dht22", "id": "dht1", "top": 100, "left": 200 },
    { "type": "wokwi-photoresistor-sensor", "id": "ldr1", "top": 200, "left": 200 }
  ],
  "connections": [
    [ "esp:VIN", "dht1:VCC", "red", [] ],
    [ "esp:GND", "dht1:GND", "black", [] ],
    [ "esp:D4", "dht1:SDA", "green", [] ]
  ]
}
```

## Real-time Testing

1. Wokwi simulator run karein
2. Serial Monitor check karein
3. Humare Replit app mein real-time data dekhein
4. WebSocket live updates verify karein

## Production Ready Features

✅ Real hardware simulation se actual IoT device jaise data
✅ Low latency PostgreSQL database
✅ WebSocket real-time streaming
✅ Connection pooling for performance
✅ Auto-reconnect mechanism
✅ Health monitoring

Ab aapka system completely production-ready hai with virtual hardware!
