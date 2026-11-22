# 🛰️ Live Location Tracker Pro

A comprehensive, production-grade real-time GPS tracking and geofencing platform built with Node.js, Express, Socket.IO, Leaflet, and Bulma. Features multiple convincing lures, persistent storage, Telegram & Discord instant alerts, device telemetry, and route export.

---

## ✨ Features

- **📍 Real-Time GPS Tracking**: Streams live coordinates via WebSocket (Socket.IO).
- **🛣️ Breadcrumb Trail Route**: Visualizes the target's movement trajectory on Leaflet maps with custom starting point and live radar marker.
- **🗺️ Physical Address Geocoding**: Automatically translates latitude/longitude into human-readable street, city, and neighborhood names.
- **💾 Persistent Database**: Saves targets, movement histories, settings, and geofences to disk across server restarts.
- **🎭 4 Multi-Lure Templates**:
  - 🌦️ **Weather Radar** (`/weather`): Local meteorological forecasts (Open-Meteo).
  - 📦 **Express Courier Tracking** (`/courier`): Realistic parcel delivery status and arrival radar.
  - 📶 **HyperSpeed 5G Benchmark** (`/speedtest`): High-speed network testing and latency gauge.
  - 🍔 **Nearby Food & Discounts** (`/nearby`): Local dining offers and cafe coupons.
- **🤖 Telegram & Discord Bot Alerts**: Dispatches instant webhook notifications when a target connects, acquires precision GPS, or breaches a geofence.
- **🔋 Device Telemetry**: Captures battery level, charging status, network connection type (5G/4G/WiFi), and device OS.
- **⚠️ Geofencing & Perimeter Alarms**: Define custom radius perimeters and trigger instant audio and webhook alarms if breached.
- **📄 Route Export**: Export recorded movement trails to **GPX** (GPS), **KML** (Google Earth), or **CSV** (Spreadsheets).
- **🌐 Cloudflare Tunnel Integration**: Automatically provides a secure public URL without manual port forwarding.

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/asri-tha52/live-location-tracker.git
cd live-location-tracker
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the server
```bash
npm start
```

---

## 🔑 Admin Console

Open `http://localhost:6589` in your browser:
- **Default Username**: `admin`
- **Default Password**: `admin`

*(Configurable in `config.js` or via environment variables `ADMIN_USER` and `ADMIN_PASS`)*

---

## ⚖️ Disclaimer

This application is designed solely for educational, research, and authorized security demonstration purposes. Always obtain explicit authorization before deploying or tracking devices.
