# SECURITY AUDIT REPORT: YOUTUBE CARTOON AGENT
**Classification:** Internal Security Assessment  
**Date:** 2026-11-18  
**Scope:** Application Security, Credential Protection, Injection Risks, Storage Safety, and DoS Vectors  
**Compliance Standard:** OWASP Top 10 API Security Risks (2023)

---

## 1. Vulnerability Matrix Summary

| Vulnerability ID | Category | Severity | File Location | Remediation Effort |
| :--- | :--- | :--- | :--- | :--- |
| **`SEC-01`** | Credential Exposure | **CRITICAL** | `backend/config.js:26` | Low |
| **`SEC-02`** | Credential Exposure | **CRITICAL** | `.env.example:2` | Low |
| **`SEC-03`** | Remote Code Execution | **CRITICAL** | `backend/controllers/imageController.js:130` | Medium |
| **`SEC-04`** | Arbitrary File Deletion | **CRITICAL** | `backend/controllers/imageController.js:154` | Medium |
| **`SEC-05`** | Configuration Tampering | **CRITICAL** | `backend/controllers/videoController.js:80` | Low |
| **`SEC-06`** | Command Injection | **CRITICAL** | `backend/services/voiceGenerator.js:144` | Low |
| **`SEC-07`** | SSRF & Unbounded Download | **CRITICAL** | `ai-video-service.js:11` | Medium |
| **`SEC-08`** | Broken Access Control | **CRITICAL** | `backend/server.js:110` | High |
| **`PERF-01`** | Denial of Service (Memory) | **HIGH** | `backend/utils/ffmpegHelper.js:22` | Low |
| **`REL-01`** | Infinite Loop (DoS) | **HIGH** | `ai-video-service.js:61` | Low |
| **`REL-02`** | Process Leak / Zombie Child | **HIGH** | `backend/services/renderQueue.js:176` | Medium |
| **`OAUTH-01`** | OAuth Port Mismatch | **HIGH** | `upload-youtube.js:29` | Low |

---

## 2. In-Depth Vulnerability Analysis

### `SEC-01`: Hardcoded Secret Fallback
* **CWE:** CWE-798: Use of Hard-coded Credentials
* **Location:** `backend/config.js` (Line 26)
* **Mechanics:**
  The code defines a constant `FALLBACK_GEMINI_KEY = "..."` and assigns it to `process.env.GEMINI_API_KEY` whenever the environment variable is not explicitly populated.
* **Exploit Scenario:**
  Any user or bot that obtains repository access, reads shared archive packages, or extracts unminified source code gains full unauthorized use of the creator's Gemini API quota.
* **Remediation:**
  Delete line 26 entirely. Implement a startup validator in `backend/config.js`:
  ```javascript
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.trim().length === 0) {
    console.error("FATAL: GEMINI_API_KEY environment variable is required.");
    process.exit(1);
  }
  ```

---

### `SEC-02`: Active Credential in Example Template
* **CWE:** CWE-540: Inclusion of Sensitive Information in Source Code
* **Location:** `.env.example` (Line 2)
* **Mechanics:**
  `.env.example` contains an actual key string assigned to `GEMINI_API_KEY`.
* **Exploit Scenario:**
  Example files are intended for public documentation. Distributing this file publishes live credentials.
* **Remediation:**
  Replace with a non-functional placeholder: `GEMINI_API_KEY=your_gemini_api_key_here`.

---

### `SEC-03`: Arbitrary File Overwrite & RCE via `uploadCustomAsset`
* **CWE:** CWE-22: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')
* **Location:** `backend/controllers/imageController.js` (Lines 125–145)
* **Mechanics:**
  ```javascript
  const { type, filename, data } = body;
  const ext = path.extname(filename || "image.png") || ".png";
  const saveName = `${type}${ext}`;
  const storagePath = path.join(imagesDir, saveName);
  ```
  `type` and `filename` are user-controlled strings parsed from incoming JSON. `path.join("storage/images", "../../server.js")` resolves to `server.js` at the project root.
* **Exploit Scenario:**
  An attacker sends an unauthenticated `POST /api/upload-asset` with:
  ```json
  {
    "type": "../../backend/server",
    "filename": "payload.js",
    "data": "data:text/javascript;base64,cmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpLmV4ZWMoJy4uLicp..."
  }
  ```
  This immediately replaces the server script with malicious code, executing on the next server reload or request.
* **Remediation:**
  1. Never trust user-supplied filenames or `type` parameters for filesystem paths.
  2. Whitelist allowed asset types: `['background', 'character', 'prop', 'scene']`.
  3. Validate file magic bytes (signatures for PNG, JPEG, WEBP, MP4).
  4. Generate a secure UUID filename: `${crypto.randomUUID()}.${safeExt}`.
  5. Check `path.resolve(storageDir, safeName).startsWith(path.resolve(storageDir))`.

---

### `SEC-04`: Arbitrary Project Deletion via `deleteCustomAsset`
* **CWE:** CWE-73: External Control of File Name or Path
* **Location:** `backend/controllers/imageController.js` (Lines 147–165)
* **Mechanics:**
  ```javascript
  const { type } = body;
  [imagesDir, assetsDir].forEach(dir => {
    fs.readdirSync(dir).forEach(f => {
      if (f.toLowerCase().startsWith(type)) {
        fs.unlinkSync(path.join(dir, f));
      }
    });
  });
  ```
  When `type` is empty (`""`), `f.startsWith("")` evaluates to `true` for every file in the directory.
* **Exploit Scenario:**
  An unauthenticated caller issues `POST /api/delete-asset` with `{ "type": "" }`. Every single image, background, and character asset is wiped from the disk.
* **Remediation:**
  1. Enforce `typeof type === "string" && type.length >= 3`.
  2. Reject deletion requests that do not specify a concrete, validated asset ID stored in the database.
  3. Never use prefix matching (`startsWith`) to delete files; use exact path comparison.

---

### `SEC-05`: Unauthenticated `.env` Overwriting via `/api/save-api-key`
* **CWE:** CWE-284: Improper Access Control
* **Location:** `backend/controllers/videoController.js` (Lines 74–99)
* **Mechanics:**
  The endpoint accepts a POST request with `{ "apiKey": "..." }`, injects it into `process.env.GEMINI_API_KEY`, and writes it into `.env` using regular expression string replacement.
* **Exploit Scenario:**
  An attacker can overwrite the API key with invalid values to cause persistent DoS, or inject line breaks (`\nPORT=9999\nEVIL=1`) to tamper with other environment variables.
* **Remediation:**
  Remove this endpoint or restrict it to authenticated local system administrators.

---

### `SEC-06`: Shell Metacharacter Injection in Voice Generation
* **CWE:** CWE-78: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')
* **Location:** `backend/services/voiceGenerator.js` (Line 144)
* **Mechanics:**
  `execSync(`${ffBin} -y -i "${tempMp3}" -ar 44100 -ac 2 "${wavOutputFile}"`, { stdio: "ignore" });`
  Passing a string to `execSync` invokes the system command shell (`cmd.exe` on Windows, `/bin/sh` on Unix). If any path component contains quotes or shell operators (`&`, `|`, `;`), the command breaks or executes unintended secondary commands.
* **Remediation:**
  Always use `execFileSync` with discrete string arrays:
  ```javascript
  execFileSync(ffmpegPath, ["-y", "-i", tempMp3, "-ar", "44100", "-ac", "2", wavOutputFile]);
  ```

---

### `SEC-07`: Unrestricted SSRF in `downloadFile`
* **CWE:** CWE-918: Server-Side Request Forgery (SSRF)
* **Location:** `ai-video-service.js` (Lines 11–32)
* **Mechanics:**
  `downloadFile(url, destPath)` connects to arbitrary URLs and recursively calls itself on HTTP 3xx redirects without validating the target domain or protocol.
* **Exploit Scenario:**
  An attacker supplying a malicious video URL can pivot to probe local loopback ports (`http://localhost:3000`), local cloud metadata endpoints (`http://169.254.169.254/latest/meta-data/`), or consume all server disk space by streaming an endless response.
* **Remediation:**
  1. Whitelist allowed URL protocols (`https:` only).
  2. Whitelist allowed download hostnames (e.g. `*.replicate.delivery`, `*.pollinations.ai`).
  3. Enforce maximum redirects (max 3).
  4. Enforce strict connection timeout (15s) and maximum size limits (100MB).

---

### `SEC-08`: Total Absence of Authentication / Authorization
* **CWE:** CWE-306: Missing Authentication for Critical Function
* **Location:** `backend/server.js` (Lines 110–118)
* **Mechanics:**
  The server routes requests without inspecting authorization headers, session cookies, or verifying client origins.
* **Exploit Scenario:**
  Any user able to reach port 4000 can invoke `/api/upload-youtube` to publish videos to the connected YouTube channel, start expensive background render jobs, or delete user projects.
* **Remediation:**
  Implement a central authentication middleware:
  ```javascript
  function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.APP_SECRET_TOKEN}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Unauthorized access" }));
      return false;
    }
    return true;
  }
  ```

---

### `PERF-01`: Memory Exhaustion DoS via `parseJsonBody`
* **CWE:** CWE-400: Uncontrolled Resource Consumption
* **Location:** `backend/utils/ffmpegHelper.js` (Lines 19–31)
* **Mechanics:**
  `req.on("data", chunk => (body += chunk))` buffers the entire incoming request into memory before JSON parsing without verifying stream size.
* **Exploit Scenario:**
  Sending a 1GB continuous HTTP POST request forces Node.js to allocate V8 heap until memory exhaustion causes an unrecoverable process crash.
* **Remediation:**
  ```javascript
  function parseJsonBody(req, maxBytes = 10 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let body = "";
      let receivedBytes = 0;
      req.on("data", chunk => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBytes) {
          req.destroy();
          reject(new Error("Payload Too Large (HTTP 413)"));
          return;
        }
        body += chunk;
      });
      req.on("end", () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error("Invalid JSON payload"));
        }
      });
    });
  }
  ```

---

## 3. General Security Hardening Recommendations

1. **Security Headers:** Add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a strict `Content-Security-Policy` to `backend/server.js`.
2. **Rate Limiting:** Implement a sliding-window in-memory or SQLite-backed rate limiter for expensive AI endpoints (`/api/generate-storyboard`, `/api/generate-scene-image`, `/api/render-job/start`).
3. **Safe Process Isolation:** When spawning FFmpeg or PowerShell, ensure child processes run with explicit execution timeouts and cleanly close all pipe streams upon termination.
