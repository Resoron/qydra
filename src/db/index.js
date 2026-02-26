const { Pool } = require("pg");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to PostgreSQL database");
  }
});

module.exports = pool;
