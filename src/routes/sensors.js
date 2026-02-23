const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

// Get latest sensor reading for a device
router.get("/:deviceId/latest", authenticateToken, async (req, res) => {
  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    const result = await pool.query(
      `SELECT * FROM sensor_readings 
       WHERE device_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 1`,
      [req.params.deviceId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No sensor readings found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get sensor history for a device
router.get("/:deviceId/history", authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const hours = parseInt(req.query.hours) || 24;

  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    const result = await pool.query(
      `SELECT * FROM sensor_readings 
       WHERE device_id = $1 
       AND recorded_at > NOW() - INTERVAL '${hours} hours'
       ORDER BY recorded_at DESC 
       LIMIT $2`,
      [req.params.deviceId, limit],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get watering history for a device
router.get("/:deviceId/watering", authenticateToken, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  try {
    const device = await pool.query(
      `SELECT * FROM devices WHERE device_id = $1 AND user_id = $2`,
      [req.params.deviceId, req.user.id],
    );

    if (device.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }

    const result = await pool.query(
      `SELECT * FROM watering_events 
       WHERE device_id = $1 
       ORDER BY occurred_at DESC 
       LIMIT $2`,
      [req.params.deviceId, limit],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
