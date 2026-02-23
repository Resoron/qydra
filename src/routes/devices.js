const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Get all devices for logged in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get single device
router.get("/:deviceId", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Register a device to a user
router.post("/register", authenticateToken, async (req, res) => {
  const { device_id, name } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE devices SET user_id = $1, name = $2 
       WHERE device_id = $3 
       RETURNING *`,
      [req.user.id, name || "My Qydra", device_id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({
          error: "Device not found - make sure it is powered on and connected",
        });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update device name
router.patch("/:deviceId/name", authenticateToken, async (req, res) => {
  const { name } = req.body;

  try {
    const result = await pool.query(
      `UPDATE devices SET name = $1 
       WHERE device_id = $2 AND user_id = $3 
       RETURNING *`,
      [name, req.params.deviceId, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send watering command to device
router.post("/:deviceId/water", authenticateToken, async (req, res) => {
  const { pump, duration } = req.body;

  if (!pump || !duration) {
    return res.status(400).json({ error: "pump and duration are required" });
  }

  try {
    // Verify device belongs to user
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    // Publish command to MQTT
    const mqttClient = req.app.get("mqttClient");
    const topic = `qydra/${req.params.deviceId}/commands`;
    const payload = JSON.stringify({ action: "water", pump, duration });
    mqttClient.publish(topic, payload);

    res.json({
      success: true,
      message: `Watering command sent to pump ${pump}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Send stop command to device
router.post("/:deviceId/stop", authenticateToken, async (req, res) => {
  const { pump } = req.body;

  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    const mqttClient = req.app.get("mqttClient");
    const topic = `qydra/${req.params.deviceId}/commands`;
    const payload = JSON.stringify({ action: "stop", pump });
    mqttClient.publish(topic, payload);

    res.json({ success: true, message: `Stop command sent to pump ${pump}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
