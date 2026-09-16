const path = require("path");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const supabase = require("./config/supabase");
const harvestRoutes = require("./routes/harvest");
const activityRoutes = require("./routes/activities");
const profileRoutes = require("./routes/profile");
const aiRoutes = require("./routes/ai");

// Connect to MongoDB if MONGODB_URI is provided
connectDB();

const app = express();

app.use(cors());
// Serve locally uploaded crop and activity images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Activities can carry base64 photo/audio data URLs (a 5 MB photo becomes
// ~6.7 MB of base64). Express's default JSON limit (100kb) rejected those
// with 413, which surfaced in production as "Unable to add activity".
app.use(express.json({ limit: "10mb" }));

app.use("/api/harvest", harvestRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/profile", profileRoutes);
// Multilingual AI farm assistant — secret key stays in Render env vars.
app.use("/api/chat", aiRoutes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "Welcome to HarvestID API 🌱" });
});

app.get("/health", (req, res) => {
  res.json({ success: true, message: "Backend is healthy" });
});

app.get("/add-test", async (req, res) => {
  try {
    const testRecord = {
      farmer_name: "Darshan",
      crop_name: "Rice",
      location: "Bangalore",
      planting_date: "2026-08-01",
      harvest_date: "2026-11-15",
      status: "Growing",
    };

    if (supabase) {
      const { data, error } = await supabase.from("harvest").insert([testRecord]).select();
      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
      return res.json({ success: true, data });
    }

    const fs = require("fs");
    const harvestStorePath = path.join(__dirname, "data/harvest.json");
    let existing = [];
    try {
      existing = JSON.parse(fs.readFileSync(harvestStorePath, "utf8"));
    } catch {}
    const newRecord = { id: Date.now(), created_at: new Date().toISOString(), ...testRecord };
    fs.writeFileSync(harvestStorePath, JSON.stringify([newRecord, ...existing], null, 2));
    res.json({ success: true, data: [newRecord] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// JSON error handler — Express's default handler returns HTML pages, but the
// frontend needs JSON so it can surface the real reason (e.g. oversized body).
app.use((err, req, res, next) => {
  const isTooLarge = err?.type === "entity.too.large" || err?.status === 413;
  res.status(isTooLarge ? 413 : err?.status || 500).json({
    success: false,
    error: isTooLarge
      ? "Request body too large — keep photos under ~5 MB."
      : err?.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});