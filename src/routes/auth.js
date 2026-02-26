const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const { body, validationResult } = require("express-validator");

const router = express.Router();

router.post(
  "/register",
  body("email").isEmail().normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  body("name").trim().notEmpty().withMessage("Name is required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password, name } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name",
        [email, hashedPassword, name],
      );

      const user = result.rows[0];
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.status(201).json({ token, user });
    } catch (err) {
      if (err.code === "23505") {
        return res.status(400).json({ error: "Email already in use" });
      }
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

router.post(
  "/login",
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
      ]);

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

module.exports = router;
