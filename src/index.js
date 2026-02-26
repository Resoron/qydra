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
const rateLimit = require("express-rate-limit");

dotenv.config();

const app = express();
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later" },
});

app.use(limiter);
app.use("/api/auth", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/schedules", scheduleRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Qydra server is running" });
});

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

const clients = new Map();

wss.on("connection", (ws) => {
  console.log("App client connected via WebSocket");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
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

const mqttClient = connectMQTT(broadcastSensorData);
app.set("mqttClient", mqttClient);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Qydra server running on port ${PORT}`);
});

module.exports = app;
