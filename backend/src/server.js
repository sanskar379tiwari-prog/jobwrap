const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { roadmapRouter } = require("./routes/roadmapRoutes");
const { errorHandler } = require("./middleware/errorHandler");

// v1 simplification: env config is read directly in this file (no config layer yet).
// Force .env to win over existing OS env vars (common source of confusion on Windows).
dotenv.config({ override: true });

const PORT = Number(process.env.PORT || 3000);
const AI_API_URL = process.env.AI_API_URL;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL;

if (!AI_API_URL || !AI_API_KEY) {
  // v1 simplification: fail fast with a clear message instead of a config module.
  // Keep this strict: missing AI credentials makes the core app unusable.
  // Do NOT log AI_API_KEY.
  console.error(
    "Missing required env vars. Please set AI_API_URL and AI_API_KEY in your .env file."
  );
  process.exit(1);
}

// Only required for chat/responses style APIs. HF-Inference model URLs encode the model in the path.
if (AI_API_URL.includes("/v1/") && !AI_MODEL) {
  console.error(
    "Missing AI_MODEL. This API URL requires AI_MODEL to be set in your .env file."
  );
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "50kb" }));
const path = require("path");

app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/roadmap", roadmapRouter);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  // Safe to log (no secrets). Helps debug env mismatch.
  console.log(`AI_API_URL: ${AI_API_URL}`);
  console.log(`AI_MODEL: ${AI_MODEL || "(not used)"}`);
});

