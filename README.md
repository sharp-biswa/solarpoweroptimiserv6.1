🌞 Souryanova Solar Guard
ESP32 Edge Firmware for Smart Solar Panel Cleaning & Tilt Control

Souryanova Solar Guard is the ESP32-based edge controller firmware used in the Souryanova Smart Solar Farm Management Optimiser System.
It handles real-time sensing, safety-critical motor control, and cloud connectivity for solar panel cleaning and orientation.

This firmware is designed to work with physical hardware as well as a Wokwi digital twin, ensuring safe testing and deployment.

📌 Key Responsibilities

Automatic solar panel cleaning using a 180° servo wiper

Safe control of a 360° continuous rotation motor for panel orientation

Dust detection using an LDR sensor

Power & current monitoring using INA219

Cloud-based control & telemetry via Blynk IoT

Built-in safety locks and dead-zone logic to prevent runaway motors

🧠 Firmware Features
✅ Core Features

Auto dust-based cleaning activation

Manual override via Blynk dashboard

Auto / Manual operation modes

Real-time telemetry streaming

Offline-safe logic (no blocking delays)

🛡️ Safety Features

Forced motor stop on boot

Dead-zone logic for 360° motor

Platform safety lock switch

Neutral calibration for continuous servo

Automatic wiper parking

🔌 Hardware Requirements
Supported Components
Component	Model	Purpose
Microcontroller	ESP32	Edge controller
Current Sensor	INA219	Current & power monitoring
Dust Sensor	LDR / LM393	Dust & light detection
Wiper Servo	SG90 (180°)	Panel cleaning
Tilt Motor	360° Continuous Servo	Panel orientation
📍 Pin Configuration
Function	ESP32 Pin
Wiper Servo (180°)	GPIO 26
Tilt Servo (360°)	GPIO 27
Dust Sensor (LDR)	GPIO 35 (ADC)
INA219 SDA	GPIO 21
INA219 SCL	GPIO 22
☁️ Blynk IoT Integration
Virtual Pin Mapping
Virtual Pin	Function	Type
V0	Manual Wiper Control	Button
V1	Dust Percentage	Gauge
V2	Panel Current (mA)	Gauge
V3	Panel Power (mW)	Gauge
V4	Platform Rotation	Slider (0–180)
V5	Dust Status	Label
V7	Auto / Manual Mode	Button
V9	Platform Safety Lock	Button
⚙️ Operating Logic
🔄 Auto Cleaning Logic

Triggered when:

Auto Mode (V7) is ON

Dust level > 70%

Automatically starts wiper movement

Stops and parks wiper when dust is low

🧭 360° Motor Control Logic

Neutral position calibrated at 90

Dead-zone applied to prevent slow creeping

Motor moves only if Safety Lock (V9) is enabled

Slider values near neutral force a full stop

if (val > 80 && val < 100) {
  servo360.write(90);
}

🧪 Simulation (Wokwi Digital Twin)

This firmware can run without physical hardware using Wokwi.

Wokwi Setup Steps

Go to https://wokwi.com

Create a new ESP32 project

Add:

INA219

LDR

2 Servo motors

Upload this firmware

Connect to Blynk Cloud

✔ Ideal for testing logic, UI, and AI integration

🛠️ Firmware Configuration
Blynk Credentials

Update these before flashing:

#define BLYNK_TEMPLATE_ID "TMPLxxxxxx"
#define BLYNK_TEMPLATE_NAME "SouryaNova"
#define BLYNK_AUTH_TOKEN "YOUR_BLYNK_TOKEN"

WiFi Credentials
char ssid[] = "YOUR_WIFI_NAME";
char pass[] = "YOUR_WIFI_PASSWORD";

⚠️ Calibration Guidelines
360° Servo Neutral Calibration

Default: 90

If motor slowly rotates at stop:

Try 88, 89, 91, or 92

Dust Sensor

LDR threshold must be tuned per site

Use stable pull-down resistor on GPIO35

Current Safety

Recommended max current limit: 800mA

Future-ready for automatic shutdown logic

🧩 Code Structure Overview

setup()
Initializes motors, sensors, WiFi, and Blynk

loop()

Sensor polling (1s interval)

Auto-clean decision logic

Servo motion handling

Cloud communication

BLYNK_WRITE()
Handles all remote control inputs

📈 System Integration

This firmware integrates with:

Souryanova Backend (via Blynk + WebSocket bridge)

AI analytics engine

Web dashboard for visualization & control

PostgreSQL for historical analysis

🚀 Deployment Readiness

✔ Tested for real hardware
✔ Safe for continuous operation
✔ Simulation-ready
✔ Scalable for multiple nodes

Suitable for:

Solar farms

Rooftop solar systems

Research & academic projects

Hackathons & demonstrations

🔮 Future Enhancements

Overcurrent auto-shutdown

EEPROM/NVS-based calibration storage

AI-driven autonomous tilt control

ESP32-S3 edge AI upgrade

OTA firmware updates

📜 License

MIT License
Free to use, modify, and distribute.
