
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const pool = require("./db");


const app = express();

const MAX_TOTAL_SIZE = 200 * 1024 * 1024; 
const MAX_FILES = 20;

const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".trycloudflare.com")
      ) {
        return cb(null, true);
      }
      cb(new Error("Not allowed by CORS"));
    },
    allowedHeaders: ["Content-Type", "ngrok-skip-browser-warning"],
  })
);

app.use(express.json());
app.use("/uploads", express.static(uploadDir));
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    cb(null, `${crypto.randomUUID()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_TOTAL_SIZE,
    files: MAX_FILES,
  },
});

async function removeUploadedFiles(files = []) {
  await Promise.all(
    files.map((file) =>
      fs.promises.unlink(file.path).catch(() => {})
    )
  );
}

// GET users

app.get("/api/users", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.age,
        u.city,
        u.message,
        u.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', f.id,
              'originalName', f.original_name,
              'sizeBytes', f.size_bytes,
              'mimeType', f.mime_type,
              'relativePath', f.relative_path
            )
          ) FILTER (WHERE f.id IS NOT NULL),
          '[]'::json
        ) AS files
      FROM users u
      LEFT JOIN user_files f ON f.user_id = u.id
      GROUP BY u.id
      ORDER BY u.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("GET users error:", error.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});


// POST user + multiple files
app.post("/api/users", (req, res) => {
  upload.array("files", MAX_FILES)(req, res, async (uploadError) => {
    const files = req.files || [];

    try {
      if (uploadError) {
        await removeUploadedFiles(files);

        if (uploadError.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            message: "A file exceeds the 200 MB per-file limit.",
          });
        }

        if (uploadError.code === "LIMIT_FILE_COUNT") {
          return res.status(413).json({
            message: `You can upload a maximum of ${MAX_FILES} files.`,
          });
        }

        return res.status(400).json({
          message: uploadError.message || "File upload failed",
        });
      }

      // Enforce 200 MB combined limit
      const totalSize = files.reduce(
        (total, file) => total + file.size,
        0
      );

      if (totalSize > MAX_TOTAL_SIZE) {
        await removeUploadedFiles(files);

        return res.status(413).json({
          message: "All selected files together must be 200 MB or less.",
        });
      }

      const { name, email, phone, password, age, city, message } =
        req.body;

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
        await removeUploadedFiles(files);

        return res.status(400).json({
          message: "Please fill in all fields",
        });
      }

      const parsedAge = Number(age);

      if (
        !Number.isInteger(parsedAge) ||
        parsedAge < 1 ||
        parsedAge > 120
      ) {
        await removeUploadedFiles(files);
        return res.status(400).json({ message: "Invalid age" });
      }

      if (password.length < 8) {
        await removeUploadedFiles(files);

        return res.status(400).json({
          message: "Password must be at least 8 characters",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const userResult = await client.query(
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

        const user = userResult.rows[0];

        for (const file of files) {
          await client.query(
            `INSERT INTO user_files
              (user_id, original_name, stored_name, mime_type,
               size_bytes, relative_path)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              file.originalname,
              file.filename,
              file.mimetype,
              file.size,
              `uploads/${file.filename}`,
            ]
          );
        }

        await client.query("COMMIT");

        return res.status(201).json({
          message: "User and files saved successfully",
          user,
          files: files.map((file) => ({
            originalName: file.originalname,
            sizeBytes: file.size,
            mimeType: file.mimetype,
          })),
          totalFileSizeBytes: totalSize,
        });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        await removeUploadedFiles(files);

        if (error.code === "23505") {
          return res.status(409).json({
            message: "This email is already registered",
          });
        }

        console.error("Save user error:", error.message);

        return res.status(500).json({
          message: "Failed to save user and files",
        });
      } finally {
        client.release();
      }
    } catch (error) {
      await removeUploadedFiles(files);
      console.error("POST user error:", error.message);

      return res.status(500).json({
        message: "An unexpected error occurred",
      });
    }
  });
});

const PORT = process.env.PORT || 7001;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
