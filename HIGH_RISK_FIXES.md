# HIGH RISK FIXES & CODE CORRECTIONS SPECIFICATION
**Target Stage:** Stage B & Stage C Implementation  
**Audited Codebase:** `youtube-cartoon-agent`  
**Scope:** Actionable code modifications for all identified Critical and High-severity issues  

---

## 1. Summary of Required Modifications

| Target Area | Target Files | Primary Fix Objectives |
| :--- | :--- | :--- |
| **Credential Hygiene** | `backend/config.js`, `.env.example` | Remove hardcoded key constants, enforce env variable checks |
| **Path Traversal & RCE** | `backend/controllers/imageController.js` | Disallow user-controlled filenames, enforce UUID naming, validate types |
| **Arbitrary File Deletion** | `backend/controllers/imageController.js` | Remove `startsWith` wipeout loops, scope deletions to exact IDs |
| **Command Injection** | `backend/services/voiceGenerator.js` | Replace `execSync` string command with `execFileSync` argument array |
| **SSRF & Stream DoS** | `ai-video-service.js` | Add protocol whitelist, host check, redirect counter, 100MB size limit |
| **Memory DoS** | `backend/utils/ffmpegHelper.js` | Add 10MB byte counter limit to `parseJsonBody` |
| **Process Leaks** | `backend/services/renderQueue.js` | Track active child process PIDs, kill processes on cancellation |
| **Environment Tampering** | `backend/controllers/videoController.js` | Disable or protect unauthenticated `/api/save-api-key` |
| **Project Isolation** | `backend/services/characterService.js`, `videoGenerator.js` | Replace global filenames with `storage/projects/<projectId>/...` |
| **Job Persistence** | `backend/services/renderQueue.js` | Store queue state in SQLite instead of in-memory `Map` |

---

## 2. Line-by-Line Technical Fix Specifications

### Fix 1: Hardcoded Credential Removal (`backend/config.js`)
* **Problem Lines:** 26–29
* **Current Code:**
  ```javascript
  const FALLBACK_GEMINI_KEY = "[REDACTED]";
  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = FALLBACK_GEMINI_KEY;
  }
  ```
* **Replacement Code:**
  ```javascript
  const geminiApiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!geminiApiKey && process.env.NODE_ENV === "production") {
    console.warn("⚠️ Warning: GEMINI_API_KEY is not configured in environment or .env file.");
  }
  ```
* **Regression Protection:** Fallback templates in `storyGenerator.js` will automatically activate if the API key is not present, preventing unhandled crashes while eliminating the exposed credential.

---

### Fix 2: Request Body Size Limit (`backend/utils/ffmpegHelper.js`)
* **Problem Lines:** 19–31
* **Current Code:**
  ```javascript
  function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", chunk => (body += chunk));
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(err);
        }
      });
    });
  }
  ```
* **Replacement Code:**
  ```javascript
  function parseJsonBody(req, maxBytes = 15 * 1024 * 1024) { // 15MB limit for high-res photo uploads
    return new Promise((resolve, reject) => {
      let body = "";
      let received = 0;
      req.on("data", chunk => {
        received += chunk.length;
        if (received > maxBytes) {
          req.destroy();
          const err = new Error("Payload Too Large: Maximum allowed size is 15MB");
          err.statusCode = 413;
          reject(err);
          return;
        }
        body += chunk;
      });
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          err.statusCode = 400;
          reject(new Error("Malformed JSON in request body"));
        }
      });
      req.on("error", reject);
    });
  }
  ```

---

### Fix 3: Path Traversal & Arbitrary Code Execution (`backend/controllers/imageController.js`)
* **Problem Lines:** 50–78 & 125–145
* **Current Code in `uploadCustomAsset`:**
  ```javascript
  const { type, filename, data } = body;
  const ext = path.extname(filename || "image.png") || ".png";
  const saveName = `${type}${ext}`;
  const storagePath = path.join(imagesDir, saveName);
  ```
* **Replacement Code:**
  ```javascript
  const crypto = require("crypto");

  const ALLOWED_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".mp4"];
  const ALLOWED_TYPES = ["character", "scene", "background", "sticker", "prop", "reference"];

  async function uploadCustomAsset(req, res) {
    try {
      const body = await parseJsonBody(req);
      const { type, filename, data } = body;
      
      const safeType = ALLOWED_TYPES.includes(type) ? type : "asset";
      let ext = path.extname(filename || "").toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) ext = ".png";

      // Enforce safe unique server-generated filename
      const safeName = `${safeType}_${crypto.randomUUID()}${ext}`;
      const storagePath = path.join(imagesDir, safeName);
      
      // Strict path traversal prevention check
      if (!path.resolve(storagePath).startsWith(path.resolve(imagesDir))) {
        throw new Error("Invalid destination path");
      }

      const base64Content = data.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Content, "base64");
      
      // Enforce maximum buffer size of 10MB
      if (buffer.length > 10 * 1024 * 1024) throw new Error("Image buffer exceeds 10MB limit");

      fs.writeFileSync(storagePath, buffer);
      try { fs.writeFileSync(path.join(assetsDir, safeName), buffer); } catch (_) {}

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, filename: safeName, url: `/storage/images/${safeName}` }));
    } catch (err) {
      res.writeHead(err.statusCode || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }
  ```

---

### Fix 4: Arbitrary Project Wiping in `deleteCustomAsset` (`backend/controllers/imageController.js`)
* **Problem Lines:** 147–165
* **Current Code:**
  ```javascript
  async function deleteCustomAsset(req, res) {
    try {
      const body = await parseJsonBody(req);
      const { type } = body;
      [imagesDir, assetsDir].forEach(dir => {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir).forEach(f => {
          if (f.toLowerCase().startsWith(type)) {
            try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
          }
        });
      });
  ```
* **Replacement Code:**
  ```javascript
  async function deleteCustomAsset(req, res) {
    try {
      const body = await parseJsonBody(req);
      const filename = path.basename(String(body.filename || body.type || ""));
      
      // Strict validation: do not allow empty, wildcard, or root queries
      if (!filename || filename.length < 5 || filename === "." || filename.includes("*")) {
        throw new Error("A specific, valid asset filename must be provided for deletion.");
      }

      let deletedCount = 0;
      [imagesDir, assetsDir].forEach(dir => {
        if (!fs.existsSync(dir)) return;
        const targetPath = path.join(dir, filename);
        if (fs.existsSync(targetPath) && path.resolve(targetPath).startsWith(path.resolve(dir))) {
          try {
            fs.unlinkSync(targetPath);
            deletedCount++;
          } catch (e) {
            console.warn(`Could not unlink ${targetPath}:`, e.message);
          }
        }
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, deleted: deletedCount > 0, filename }));
    } catch (err) {
      res.writeHead(err.statusCode || 500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }
  ```

---

### Fix 5: Shell Command Interpolation in `voiceGenerator.js`
* **Problem Line:** 144
* **Current Code:**
  ```javascript
  execSync(`${ffBin} -y -i "${tempMp3}" -ar 44100 -ac 2 "${wavOutputFile}"`, { stdio: "ignore" });
  ```
* **Replacement Code:**
  ```javascript
  const { execFileSync } = require("child_process");
  
  execFileSync(
    ffmpegPath,
    ["-y", "-i", tempMp3, "-ar", "44100", "-ac", "2", wavOutputFile],
    { stdio: "ignore", timeout: 20000 }
  );
  ```

---

### Fix 6: SSRF and Unbounded Download in `ai-video-service.js`
* **Problem Lines:** 11–32
* **Replacement Code:**
  ```javascript
  const ALLOWED_DOWNLOAD_DOMAINS = [
    "replicate.delivery",
    "pbxt.replicate.delivery",
    "pollinations.ai",
    "image.pollinations.ai"
  ];

  function downloadFile(targetUrl, destPath, maxRedirects = 3) {
    return new Promise((resolve, reject) => {
      if (maxRedirects < 0) return reject(new Error("Too many HTTP redirects"));

      const parsed = new URL(targetUrl);
      if (parsed.protocol !== "https:") return reject(new Error("Only secure HTTPS URLs are permitted"));

      const isAllowedHost = ALLOWED_DOWNLOAD_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
      if (!isAllowedHost) return reject(new Error(`Download blocked: ${parsed.hostname} is not an authorized media host`));

      const file = fs.createWriteStream(destPath);
      let downloadedBytes = 0;
      const MAX_BYTES = 100 * 1024 * 1024; // 100MB video cap

      const req = https.get(targetUrl, { timeout: 30000 }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(destPath, () => {});
          return downloadFile(res.headers.location, destPath, maxRedirects - 1).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }

        res.on("data", chunk => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_BYTES) {
            req.destroy();
            file.close();
            fs.unlink(destPath, () => {});
            reject(new Error("File exceeded maximum allowed download size of 100MB"));
          }
        });

        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      });

      req.on("error", err => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
      req.on("timeout", () => {
        req.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error("Download connection timed out after 30 seconds"));
      });
    });
  }
  ```

---

### Fix 7: Process Leaks & Zombie Processes on Render Cancellation (`renderQueue.js`)
* **Problem Lines:** 176–184
* **Replacement Code:**
  ```javascript
  const activeProcesses = new Map(); // jobId -> ChildProcess

  function registerActiveProcess(jobId, childProcess) {
    activeProcesses.set(jobId, childProcess);
  }

  function unregisterActiveProcess(jobId) {
    activeProcesses.delete(jobId);
  }

  function cancelRenderJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) return false;

    job.status = "cancelled";
    job.stage = "Cancelled by User";
    job.stageDetail = "Render process was terminated.";

    // Immediately kill active FFmpeg process if running
    const child = activeProcesses.get(jobId);
    if (child && !child.killed) {
      try {
        child.kill("SIGKILL");
        console.log(`🔪 Terminated active FFmpeg process for job ${jobId}`);
      } catch (e) {
        console.warn(`Could not kill process for job ${jobId}:`, e.message);
      }
      activeProcesses.delete(jobId);
    }
    return true;
  }
  ```

---

## 3. Regression Testing Criteria for Stage B
1. Verify `parseJsonBody` correctly rejects requests over 15MB with HTTP 413.
2. Verify `uploadCustomAsset` refuses path traversal payloads (`../../`) and writes strictly to `imagesDir`.
3. Verify `deleteCustomAsset` rejects empty string requests and will not delete unrelated assets.
4. Verify voice synthesis runs without shell string interpolation.
5. Verify `cancelRenderJob` kills child FFmpeg processes.
