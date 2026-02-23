const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Get schedules for a device
router.get("/:deviceId", authenticateToken, async (req, res) => {
  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    const result = await pool.query(
      `SELECT * FROM schedules WHERE device_id = $1 ORDER BY pump, hour, minute`,
      [req.params.deviceId],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create or update a schedule
router.post("/:deviceId", authenticateToken, async (req, res) => {
  const { pump, active, hour, minute, days, duration } = req.body;

  if (
    pump === undefined ||
    hour === undefined ||
    minute === undefined ||
    !days ||
    !duration
  ) {
    return res
      .status(400)
      .json({ error: "pump, hour, minute, days and duration are required" });
  }

  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Upsert schedule
    const result = await pool.query(
      `INSERT INTO schedules (device_id, pump, active, hour, minute, days, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (device_id, pump) DO UPDATE
       SET active = $3, hour = $4, minute = $5, days = $6, duration = $7
       RETURNING *`,
      [req.params.deviceId, pump, active ?? true, hour, minute, days, duration],
    );

    // Send config to device via MQTT
    const mqttClient = req.app.get("mqttClient");
    const topic = `qydra/${req.params.deviceId}/commands`;
    const payload = JSON.stringify({
      action: "set_schedule",
      pump,
      active: active ?? true,
      hour,
      minute,
      days,
      duration,
    });
    mqttClient.publish(topic, payload);

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a schedule
router.delete("/:deviceId/:pump", authenticateToken, async (req, res) => {
  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    await pool.query(
      `DELETE FROM schedules WHERE device_id = $1 AND pump = $2`,
      [req.params.deviceId, req.params.pump],
    );

    // Deactivate on device via MQTT
    const mqttClient = req.app.get("mqttClient");
    const topic = `qydra/${req.params.deviceId}/commands`;
    const payload = JSON.stringify({
      action: "set_schedule",
      pump: parseInt(req.params.pump),
      active: false,
      hour: 0,
      minute: 0,
      days: 0,
      duration: 0,
    });
    mqttClient.publish(topic, payload);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
