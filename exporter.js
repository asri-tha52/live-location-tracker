// Exporter for GPX, KML, and CSV route formats

class RouteExporter {
    toCSV(target) {
        const rows = [
            ["Target ID", "Point #", "Timestamp", "ISO Time", "Latitude", "Longitude", "Accuracy (m)", "Speed (m/s)"]
        ]

        const history = target.history && target.history.length > 0 ? target.history : [
            { lat: target.lat, lng: target.lng, accuracy: target.accuracy, speed: target.speed, time: target.lastSeen }
        ]

        history.forEach((pt, idx) => {
            rows.push([
                `"${target.id}"`,
                idx + 1,
                pt.time || "",
                pt.time ? new Date(pt.time).toISOString() : "",
                pt.lat,
                pt.lng,
                pt.accuracy != null ? pt.accuracy.toFixed(1) : "",
                pt.speed != null ? pt.speed.toFixed(2) : ""
            ])
        })

        return rows.map(r => r.join(",")).join("\n")
    }

    toGPX(target) {
        const history = target.history && target.history.length > 0 ? target.history : [
            { lat: target.lat, lng: target.lng, accuracy: target.accuracy, speed: target.speed, time: target.lastSeen }
        ]

        let pointsXml = ""
        history.forEach((pt) => {
            const timeIso = pt.time ? new Date(pt.time).toISOString() : new Date().toISOString()
            pointsXml += `      <trkpt lat="${pt.lat}" lon="${pt.lng}">
        <time>${timeIso}</time>
        ${pt.speed != null ? `<speed>${pt.speed}</speed>` : ''}
      </trkpt>\n`
        })

        return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Live Location Tracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Target Route: ${target.id}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${target.id} Movement Trail</name>
    <trkseg>
${pointsXml}    </trkseg>
  </trk>
</gpx>`
    }

    toKML(target) {
        const history = target.history && target.history.length > 0 ? target.history : [
            { lat: target.lat, lng: target.lng, accuracy: target.accuracy, speed: target.speed, time: target.lastSeen }
        ]

        const coordinatesLine = history.map(pt => `${pt.lng},${pt.lat},0`).join(" ")
        const startPoint = history[0]
        const currentPoint = history[history.length - 1]

        return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Track: ${target.id}</name>
    <Style id="routeLine">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Start Position</name>
      <Point>
        <coordinates>${startPoint.lng},${startPoint.lat},0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Current Position (${target.id})</name>
      <Point>
        <coordinates>${currentPoint.lng},${currentPoint.lat},0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Movement Trail</name>
      <styleUrl>#routeLine</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${coordinatesLine}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`
    }
}

module.exports = new RouteExporter()

