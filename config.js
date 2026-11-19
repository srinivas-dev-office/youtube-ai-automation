const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn("Notice: Could not load .env file automatically:", err.message);
  }
}

const fallbackFfmpeg = "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";

let ffmpegPath = process.env.FFMPEG_PATH || (fs.existsSync(fallbackFfmpeg) ? fallbackFfmpeg : "ffmpeg");

const outputDir = path.join(__dirname, "output");

function ensureOutputDir() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

module.exports = {
  ffmpegPath,
  outputDir,
  ensureOutputDir,
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  credentialsPath: path.join(__dirname, "client_secret.json"),
  tokenPath: path.join(__dirname, "token.json")
};
