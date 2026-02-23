const express = require("express");
const dotenv = require("dotenv");
const http = require("http");
const WebSocket = require("ws");
const db = require("./db");
const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/devices");
const sensorRoutes = require("./routes/sensors");
const scheduleRoutes = require("./routes/schedules");
const connectMQTT = require("./mqtt");

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/schedules", scheduleRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Qydra server is running" });
});

// Create HTTP server so WebSocket can share the same port
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Track connected clients and which device they are subscribed to
const clients = new Map();

wss.on("connection", (ws) => {
  console.log("App client connected via WebSocket");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Client sends { type: "subscribe", device_id: "abc123", token: "jwt..." }
      if (data.type === "subscribe") {
        clients.set(ws, { device_id: data.device_id });
        console.log(`Client subscribed to device ${data.device_id}`);
        ws.send(
          JSON.stringify({ type: "subscribed", device_id: data.device_id }),
        );
      }
    } catch (err) {
      console.error("WebSocket message error:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("App client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
    clients.delete(ws);
  });
});

// Function to broadcast sensor data to subscribed clients
const broadcastSensorData = (deviceId, data) => {
  clients.forEach((clientInfo, ws) => {
    if (clientInfo.device_id === deviceId && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "sensor_update",
          device_id: deviceId,
          data,
        }),
      );
    }
  });
};

// Make MQTT client and broadcast function available to routes and mqtt.js
const mqttClient = connectMQTT(broadcastSensorData);
app.set("mqttClient", mqttClient);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Qydra server running on port ${PORT}`);
});

module.exports = app;
