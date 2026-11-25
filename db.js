const fs = require("fs")
const path = require("path")

const DB_FILE = path.join(__dirname, "data", "tracker_db.json")

class Database {
    constructor() {
        this.data = {
            targets: {},
            settings: {
                whatsappPhone: process.env.WHATSAPP_PHONE || "",
                whatsappApiKey: process.env.WHATSAPP_API_KEY || "",
                whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || "",
                discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
                geofences: {} // [targetId]: { lat, lng, radius, active }
            }
        }
        this._writeTimeout = null
        this.init()
    }

    init() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const raw = fs.readFileSync(DB_FILE, "utf-8")
                const parsed = JSON.parse(raw)
                if (parsed.targets) this.data.targets = parsed.targets
                if (parsed.settings) this.data.settings = { ...this.data.settings, ...parsed.settings }
                console.log(`[DB] Loaded ${Object.keys(this.data.targets).length} saved targets from database.`)
            } else {
                this.saveImmediate()
            }
        } catch (err) {
            console.error("[DB] Error loading database file, initializing empty:", err.message)
            this.saveImmediate()
        }
    }

    save() {
        // Debounce disk writes by 300ms so rapid socket/location updates don't spam disk I/O
        if (this._writeTimeout) return
        this._writeTimeout = setTimeout(() => {
            this.saveImmediate()
            this._writeTimeout = null
        }, 300)
    }

    saveImmediate() {
        try {
            const tempFile = `${DB_FILE}.tmp`
            fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), "utf-8")
            fs.renameSync(tempFile, DB_FILE)
        } catch (err) {
            console.error("[DB] Error writing to database file:", err.message)
        }
    }

    getAllTargets() {
        return this.data.targets
    }

    getTarget(id) {
        return this.data.targets[id] || null
    }

    saveTarget(id, targetObj) {
        this.data.targets[id] = targetObj
        this.save()
    }

    deleteTarget(id) {
        if (this.data.targets[id]) {
            delete this.data.targets[id]
            delete this.data.settings.geofences[id]
            this.save()
            return true
        }
        return false
    }

    clearHistory(id) {
        if (this.data.targets[id]) {
            this.data.targets[id].history = [
                {
                    lat: this.data.targets[id].lat,
                    lng: this.data.targets[id].lng,
                    accuracy: this.data.targets[id].accuracy,
                    speed: this.data.targets[id].speed,
                    time: this.data.targets[id].lastSeen
                }
            ]
            this.save()
            return true
        }
        return false
    }

    clearAllTargets() {
        this.data.targets = {}
        this.data.settings.geofences = {}
        this.save()
    }

    getSettings() {
        return this.data.settings
    }

    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings }
        this.saveImmediate()
        return this.data.settings
    }

    getGeofence(id) {
        return this.data.settings.geofences[id] || null
    }

    setGeofence(id, geofence) {
        if (!geofence) {
            delete this.data.settings.geofences[id]
        } else {
            this.data.settings.geofences[id] = geofence
        }
        this.save()
    }
}

module.exports = new Database()

