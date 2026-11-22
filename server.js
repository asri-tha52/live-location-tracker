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
        console.log(`Connecting Cloudflare Tunnel...`)
        const tunnel = await cloudflaredTunnel({
            "--url": localURL
        })
        global.remoteURL = await tunnel.url
        console.log(`REMOTE : ${global.remoteURL}`)
        console.log(`TARGET LINK : ${global.remoteURL}/weather`)
    } catch (err) {
        console.warn(`[WARN] Cloudflare tunnel notice: ${err.message || err}`)
        global.remoteURL = localURL
    }
    console.log(`========================================\n`)
})
