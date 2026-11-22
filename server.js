const { tunnel: cloudflaredTunnel } = require("cloudflared")
const cookieParser = require("cookie-parser")
const socketIO = require("socket.io")
const config = require("./config")
const express = require("express")
const tarkine = require("tarkine")
const http = require('http')

const app = express()
const server = http.createServer(app)
const io = new socketIO.Server(server)
const PORT = process.env.PORT || config.port

global.remoteURL = `http://localhost:${PORT}`
global.IO = io

app.set("view engine", "html")
app.engine("html", tarkine.renderFile)
app.use(cookieParser())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(__dirname + "/public"))
app.use(express.json())

app.use("/", require("./router"))

server.listen(PORT, async () => {
    const localURL = `http://localhost:${PORT}`
    console.log(`\n========================================`)
    console.log(`🚀 Live Location Tracker Server Started`)
    console.log(`LOCAL  : ${localURL}`)

    try {
        console.log(`Connecting Cloudflare Tunnel (15s timeout)...`)
        const tunnel = cloudflaredTunnel({
            "--url": localURL
        })

        // Safeguard with 15-second timeout so server never hangs if offline
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Cloudflare tunnel handshake timed out (15s)")), 15000)
        )

        global.remoteURL = await Promise.race([tunnel.url, timeoutPromise])
        console.log(`REMOTE : ${global.remoteURL}`)
        console.log(`TARGET LINK : ${global.remoteURL}/weather`)
    } catch (err) {
        console.warn(`[NOTICE] Cloudflare tunnel unavailable: ${err.message || err}`)
        console.warn(`Using local fallback URL: ${localURL}`)
        global.remoteURL = localURL
    }
    console.log(`========================================\n`)
})
