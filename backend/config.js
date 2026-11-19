const path = require("path");
const fs = require("fs");

// Load .env reliably
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const idx = trimmed.indexOf("=");
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim();
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  } catch (err) {
    console.warn("Notice: Could not load .env file:", err.message);
  }
}

// Ensure GEMINI_API_KEY is present; warn if missing
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ [Config Warning] GEMINI_API_KEY is not set in environment or .env file. AI features requiring Gemini will require configuration.");
}

// Load config.json
const configJsonPath = path.join(__dirname, "../config/config.json");
let configData = {};
if (fs.existsSync(configJsonPath)) {
  try {
    configData = JSON.parse(fs.readFileSync(configJsonPath, "utf8"));
  } catch (_) {}
}

const rootDir = path.join(__dirname, "..");
const storageDir = path.join(rootDir, "storage");
const imagesDir = path.join(storageDir, "images");
const audioDir = path.join(storageDir, "audio");
const videosDir = path.join(storageDir, "videos");
const outputDir = path.join(rootDir, "output");
const assetsDir = path.join(rootDir, "assets");

const fallbackFfmpeg = "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";
const ffmpegPath = process.env.FFMPEG_PATH || (fs.existsSync(fallbackFfmpeg) ? fallbackFfmpeg : "ffmpeg");

// Ensure all storage directories exist
[storageDir, imagesDir, audioDir, videosDir, outputDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

module.exports = {
  port: process.env.PORT || configData.server?.port || 4000,
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  ffmpegPath,
  rootDir,
  storageDir,
  imagesDir,
  audioDir,
  videosDir,
  outputDir,
  assetsDir,
  credentialsPath: path.join(rootDir, "client_secret.json"),
  tokenPath: path.join(rootDir, "token.json"),
  configData
};
