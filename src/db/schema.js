const pool = require("./index");

const createTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) DEFAULT 'My Qydra',
        online BOOLEAN DEFAULT false,
        last_seen TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sensor_readings (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) REFERENCES devices(device_id) ON DELETE CASCADE,
        moisture_1 INTEGER,
        moisture_2 INTEGER,
        raw_1 INTEGER,
        raw_2 INTEGER,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) REFERENCES devices(device_id) ON DELETE CASCADE,
        pump INTEGER NOT NULL,
        active BOOLEAN DEFAULT false,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        days INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS moisture_configs (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) REFERENCES devices(device_id) ON DELETE CASCADE,
        pump INTEGER NOT NULL,
        active BOOLEAN DEFAULT false,
        threshold INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        cooldown_period INTEGER DEFAULT 43200000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS watering_events (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) REFERENCES devices(device_id) ON DELETE CASCADE,
        pump INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        triggered_by VARCHAR(50) NOT NULL,
        occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("All tables created successfully");
    process.exit(0);
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
};

createTables();
