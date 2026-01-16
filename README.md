Souryanova- Smart Solar Farm Management Optimiser System

Smart Solar Farm Management Optimiser System is a comprehensive management and monitoring platform for solar farms, leveraging AI to optimize energy output, predict maintenance needs, and automate hardware control.

## 🚀 Features

- **Real-time Monitoring**: Track energy output, efficiency, temperature, and dust levels for up to 200 solar panels.
- **AI-Powered Analytics**:
  - Efficiency forecasting using machine learning models.
  - Degradation risk assessment (Low/Medium/High).
  - Smart recommendations for cleaning, tilt adjustment, and maintenance.
- **Hardware Integration**:
  - **Blynk IoT**: Real-time data polling and control for cleaning mechanisms.
  - **Wokwi Simulator**: Digital twin integration for sensor simulation.
  - **Auto-Tilt System**: AI-optimized or time-based panel orientation control.
- **Smart Alerts**: Automated notifications for critical efficiency drops, high dust levels, or hardware overloads.
- **PDF Reporting**: Generate detailed maintenance and performance reports.
- **Weather Integration**: Correlates solar performance with local weather data (OpenWeatherMap).

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Shadcn UI, Framer Motion, Recharts.
- **Backend**: Node.js, Express, WebSocket (WS).
- **Database**: PostgreSQL with Drizzle ORM.
- **AI/ML**: Custom TypeScript-based AI Engine for predictive analytics.
- **IoT**: Blynk API integration, Wokwi Simulator.

## 🏁 Getting Started

### Prerequisites

- Node.js (v20 or higher)
- PostgreSQL database

### Environment Variables

Create a `.env` file or set the following in your environment:

```env
DATABASE_URL=your_postgresql_connection_string
WEATHER_API_KEY=your_openweathermap_api_key (optional, defaults to demo)
```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Push the database schema:
   ```bash
   npm run db:push
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

- `client/`: React frontend application.
- `server/`: Express backend, AI engine, and IoT integrations.
- `shared/`: Shared TypeScript types and Drizzle database schema.

## 📜 License

MIT

🔌 ESP32 Hardware Configuration (Souryanova AI Edge Node)

Souryanova AI uses an ESP32 as an edge controller for real-time sensing and actuation of solar panel cleaning and tilt mechanisms.

📡 Supported Sensors & Actuators
Component	Model	Purpose	ESP32 Pin
Current Sensor	INA219	Panel current & power monitoring	I2C (SDA 21, SCL 22)
Dust Sensor	LM393 / LDR	Dust / Day-Night detection	GPIO 35 (ADC)
Wiper Servo	SG90 (180°)	Panel cleaning arm	GPIO 26
Tilt Servo	Continuous (360°)	Panel orientation	GPIO 27
🔐 Blynk IoT Cloud Mapping
Function	Datastream	Type
Wiper Manual Control	V0	Button (0/1)
Panel Current	V2	Gauge (mA)
Panel Power	V3	Gauge (mW)
Tilt Motor Control	V4	Slider (0–180)
Dust Status	V5	Label (String)
Raw Dust Level	V6	Gauge
Auto / Manual Mode	V7	Button
Safety Status	V8	Label
⚙️ ESP32 Firmware Features

Auto dust-based cleaning activation

AI-assisted tilt control via Blynk cloud

Overcurrent protection with automatic motor shutdown

Offline operation with cloud re-sync

Real-time telemetry streaming to Souryanova AI backend

🧪 Wokwi Digital Twin (Optional)

For simulation without physical hardware:

Create ESP32 project on https://wokwi.com

Add:

INA219

LDR

2x Servo Motors

Flash the same firmware used on physical ESP32

Connect to Blynk Cloud for full system simulation

🌐 Replit & Web Dashboard Integration

Souryanova AI frontend (hosted on Replit or Vercel) pulls data from:

Blynk REST API for real-time telemetry

WebSocket bridge for live dashboard updates

PostgreSQL for historical trend analysis

This allows:

Cloud visualization of current, power, dust, tilt angle

AI inference results overlaid with real sensor data

Automated cleaning & tilt scheduling from web UI

🚨 Safety & Calibration Notes

Calibrate 360° servo neutral (typically 88–92)

Set overcurrent limit in firmware (default: 800mA)

LDR threshold must be tuned per installation

Use pull-down resistor on GPIO35 for noise stability
