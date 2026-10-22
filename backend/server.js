
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const pool = require("./db");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
}));

app.use(express.json());

app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, age, city, message, created_at
      FROM users
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("GET users error:", error.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { name, email, phone, password, age, city, message } = req.body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !password ||
      !city?.trim() ||
      !message?.trim() ||
      age === undefined ||
      age === null ||
      age === ""
    ) {
      return res.status(400).json({
        message: "Please fill in all fields",
      });
    }

    const parsedAge = Number(age);

    if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      return res.status(400).json({ message: "Invalid age" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
        (name, email, phone, password_hash, age, city, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, phone, age, city, message, created_at`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        passwordHash,
        parsedAge,
        city.trim(),
        message.trim(),
      ]
    );

    res.status(201).json({
      message: "User saved successfully",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "This email is already registered",
      });
    }

    console.error("POST user error:", error.message);
    res.status(500).json({ message: "Failed to save user" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`API running on port ${process.env.PORT || 5000}`);
});
