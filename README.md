# 🛰️ Live Location Tracker

A full-featured real-time GPS tracking application built with Node.js, Express, Socket.IO, Leaflet, and Bulma. Tracks live GPS coordinates with historical breadcrumb trails, reverse physical geocoding, and realistic meteorological radar lures.

---

## ✨ Features

- **📍 Real-Time GPS Tracking**: Streams accurate coordinates via WebSocket (Socket.IO).
- **🛣️ Breadcrumb Trail Route**: Traces the target's movement path on Leaflet maps with custom starting point and live pulsing radar marker.
- **🗺️ Physical Address Geocoding**: Automatically resolves coordinates to human-readable street, city, and area addresses.
- **🟢 Live Online/Offline Status**: Detects active targets in real-time with visual pulsing indicators and relative time stamps ("Just now", "2m ago").
- **🌤️ Realistic Weather Radar Lure**: Uses real-time meteorological forecasts from Open-Meteo API (temperature, humidity, wind, sky condition) based on the target's actual coordinates.
- **🌐 Cloudflare Tunnel Integration**: Automatically provides a secure public URL without manual port forwarding.
- **📊 Admin Dashboard**: Clean dark-themed console with one-click link sharing, target management, and Google Maps integration.

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
*(Or for development with auto-reload: `npm run dev`)*

When the server starts, it displays both the local dashboard URL and the public Cloudflare tunnel URL:
```
LOCAL       : http://localhost:6589
REMOTE      : https://your-subdomain.trycloudflare.com
TARGET LINK : https://your-subdomain.trycloudflare.com/weather
```

---

## 🔑 Admin Login

Open `http://localhost:6589` in your browser:
- **Username**: `admin`
- **Password**: `admin`

*(Credentials can be configured in `config.js` or via environment variables `ADMIN_USER` and `ADMIN_PASS`)*

---

## ⚖️ Disclaimer

This tool is created for educational, research, and authorized security demonstration purposes only. Always obtain explicit permission before testing or tracking devices.
