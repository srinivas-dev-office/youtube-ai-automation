const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// Determine FFmpeg binary location
const fallbackFfmpeg = "C:\\Users\\alath\\Downloads\\ffmpeg-9.0.2-essentials_build\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe";
const ffmpegPath = process.env.FFMPEG_PATH || (fs.existsSync(fallbackFfmpeg) ? fallbackFfmpeg : "ffmpeg");

/**
 * Execute FFmpeg command synchronously
 */
function execFfmpeg(args, options = {}) {
  return execFileSync(ffmpegPath, args, { stdio: "inherit", ...options });
}

const MAX_REQUEST_BODY_SIZE = 10 * 1024 * 1024; // 10 MB limit to protect against heap exhaustion DoS

/**
 * Parse incoming JSON request body with memory protection and size limits
 */
function parseJsonBody(req, maxSize = MAX_REQUEST_BODY_SIZE) {
  return new Promise((resolve, reject) => {
    let body = "";
    let receivedBytes = 0;
    let exceeded = false;

    function onData(chunk) {
      if (exceeded) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxSize) {
        exceeded = true;
        req.removeListener("data", onData);
        const err = new Error(`Payload Too Large: Request body exceeds maximum limit of ${Math.round(maxSize / (1024 * 1024))}MB`);
        err.statusCode = 413;
        try { req.destroy(); } catch (_) {}
        return reject(err);
      }
      body += chunk;
    }

    req.on("data", onData);
    req.on("end", () => {
      if (exceeded) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        const parseErr = new Error(`Bad Request: Invalid JSON format (${err.message})`);
        parseErr.statusCode = 400;
        reject(parseErr);
      }
    });
    req.on("error", (err) => {
      if (!exceeded) reject(err);
    });
  });
}

/**
 * Set strict anti-caching headers on every HTTP response
 */
function setNoCacheHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}

/**
 * Get Content-Type MIME string from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime"
  };
  return mimeTypes[ext] || "application/octet-stream";
}

module.exports = {
  ffmpegPath,
  execFfmpeg,
  parseJsonBody,
  setNoCacheHeaders,
  getMimeType,
  MAX_REQUEST_BODY_SIZE
};
