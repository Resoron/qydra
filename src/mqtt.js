const mqtt = require("mqtt");
const pool = require("./db");

const connectMQTT = (broadcastSensorData) => {
  const client = mqtt.connect(`mqtts://${process.env.MQTT_BROKER}`, {
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASS,
    port: 8883,
  });

  console.log("Attempting MQTT connection to:", process.env.MQTT_BROKER);

  client.on("connect", () => {
    console.log("Server connected to MQTT broker");
    client.subscribe("qydra/#", (err) => {
      if (!err) {
        console.log("Subscribed to qydra/# topic");
      }
    });
  });

  client.on("message", async (topic, message) => {
    try {
      const parts = topic.split("/");
      const deviceId = parts[1];
      const type = parts[2];

      const raw = message.toString();

      // Handle plain text status messages
      if (type === "status" && (raw === "online" || raw === "offline")) {
        await pool.query(
          `UPDATE devices SET online = $1, last_seen = CURRENT_TIMESTAMP 
           WHERE device_id = $2`,
          [raw === "online", deviceId],
        );
        console.log(`Device ${deviceId} is ${raw}`);
        return;
      }

      const payload = JSON.parse(raw);

      // Handle sensor data
      if (type === "sensors") {
        // Auto-register device if it doesn't exist yet
        await pool.query(
          `INSERT INTO devices (device_id, online, last_seen) 
           VALUES ($1, true, CURRENT_TIMESTAMP)
           ON CONFLICT (device_id) DO UPDATE 
           SET online = true, last_seen = CURRENT_TIMESTAMP`,
          [deviceId],
        );

        // Save sensor reading
        await pool.query(
          `INSERT INTO sensor_readings 
           (device_id, moisture_1, moisture_2, raw_1, raw_2) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            deviceId,
            payload.moisture_1,
            payload.moisture_2,
            payload.raw_1,
            payload.raw_2,
          ],
        );

        console.log(`Sensor data saved for device ${deviceId}`);

        // Broadcast to any connected app clients
        if (broadcastSensorData) {
          broadcastSensorData(deviceId, payload);
        }
      }

      // Handle watering complete events
      if (type === "status" && payload.event === "watering_complete") {
        await pool.query(
          `INSERT INTO watering_events 
           (device_id, pump, duration_ms, triggered_by) 
           VALUES ($1, $2, $3, $4)`,
          [deviceId, payload.pump, payload.duration_ms, payload.triggered_by],
        );
        console.log(`Watering event saved for device ${deviceId}`);
      }
    } catch (err) {
      console.error("MQTT message handling error:", err);
    }
  });

  client.on("error", (err) => {
    console.error("MQTT error:", err);
  });

  client.on("offline", () => {
    console.log("MQTT client offline");
  });

  return client;
};

module.exports = connectMQTT;
