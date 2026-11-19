# Comprehensive Remaining Issues & Future Roadmap Specification

**Project:** `youtube-cartoon-agent`  
**Audit Stage:** Stage A (Complete Audit & Specification)  
**Date:** November 2026  
**Document Status:** Complete Audit Report  

---

## 1. Executive Summary

This report provides the exhaustive inventory of all identified **Critical**, **High**, **Medium**, and **Low** risks across the `youtube-cartoon-agent` repository, along with the technical roadmap for long-form video production (5–20 minutes), advanced visual character conditioning, Instagram publishing, and legacy prototype retirement.

**Audit Status:**
- Stage A Audit: **100% Complete**
- Source Code Modified: **0 Files**
- Credentials Exposed: **0 Tokens / Keys**

---

## 2. Comprehensive Risk Register (Critical, High, Medium, Low)

### 2.1 Critical Risks (Immediate Remediation Required in Stage B)

#### [SEC-01] Hardcoded Gemini API Key Fallback
- **Exact File Path:** `backend/config.js`
- **Line Range:** Line 26
- **Function / Context:** Configuration export object
- **Problem:** Contains a hardcoded API key string as fallback: `GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSy..."`.
- **Impact:** Compromises API quota, incurs unexpected billing, and leaks credentials if code is shared or pushed to a repository.
- **Recommended Fix:** Enforce strict environment variable presence:
  ```javascript
  if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL: GEMINI_API_KEY environment variable is required.");
    process.exit(1);
  }
  ```

#### [SEC-02] Active-Looking Credential in `.env.example`
- **Exact File Path:** `.env.example`
- **Line Range:** Line 2
- **Function / Context:** Example configuration template
- **Problem:** Shows an actual key format `GEMINI_API_KEY=AIzaSy...` rather than a sanitized dummy string.
- **Impact:** Misleads developers, risks accidentally committing real keys.
- **Recommended Fix:** Replace with `GEMINI_API_KEY=your_gemini_api_key_here`.

#### [SEC-03] Arbitrary File Write / Remote Code Execution in Custom Asset Upload
- **Exact File Path:** `backend/controllers/imageController.js`
- **Line Range:** Lines 125–145
- **Function Name:** `uploadCustomAsset`
- **Problem:** Unchecked concatenation of user-supplied `type` into file path: `${name}.${type}`. No magic-byte file validation.
- **Impact:** Remote attackers can write arbitrary `.js`, `.bat`, or `.exe` files into the backend filesystem.
- **Recommended Fix:** Implement strict MIME type whitelisting (`image/png`, `image/jpeg`, `image/webp`), generate sanitized UUID filenames, verify image magic bytes, and isolate storage under `storage/projects/<projectId>/assets/`.

#### [SEC-04] Arbitrary File Deletion / Project Wipeout
- **Exact File Path:** `backend/controllers/imageController.js`
- **Line Range:** Lines 147–165
- **Function Name:** `deleteCustomAsset`
- **Problem:** Weak directory boundary validation using `resolved.startsWith(assetsDir)`. If `assetsDir` evaluates to an empty string or relative path, arbitrary system files can be unlinked.
- **Impact:** Malicious requests can delete project source files, configuration files, or database stores.
- **Recommended Fix:** Delete assets strictly by database primary key ID. Never accept arbitrary file paths from HTTP request parameters.

#### [SEC-05] Unauthenticated `.env` File Overwrite
- **Exact File Path:** `backend/controllers/videoController.js`
- **Line Range:** Lines 74–99
- **Function Name:** `saveApiKey`
- **Problem:** Endpoint `POST /api/save-api-key` accepts user input and writes it directly to `.env` while mutating `process.env` in memory without any authentication.
- **Impact:** Attackers can hijack runtime configuration, disable security controls, or inject malicious environment variables.
- **Recommended Fix:** Disable or completely remove this endpoint from production. Environment variables must be managed securely through the host environment or an authenticated admin panel.

---

### 2.2 High Risks (Remediation Required in Stages B & C)

#### [SEC-06] Command Injection Risk in Voice Generation
- **Exact File Path:** `backend/services/voiceGenerator.js`
- **Line Range:** Line 144
- **Function Name:** `generateVoiceESpeak` / `generateVoicePowerShell`
- **Problem:** Uses `child_process.execSync` with template literal interpolation of text input: ``execSync(`espeak -v ${voice} "${text}" -w ${outputPath}`)``.
- **Impact:** If `text` contains shell metacharacters (`" & calc.exe & "` or PowerShell subexpressions `$(...)`), command injection occurs.
- **Recommended Fix:** Replace `execSync` with `child_process.spawn` or `execFile` passing arguments as an array of literal strings.

#### [DATA-01] Global Shared File Collisions & Lack of Project Isolation
- **Exact File Paths:**
  - `backend/services/videoRenderer.js` (`final-cartoon-short.mp4`)
  - `storage/characters.json`
  - `storage/projects.json`
  - `output/` (flat directory)
- **Function Names:** `renderVideo`, `saveCharacter`, `saveStory`
- **Problem:** Multiple projects overwrite the same global files (`scene1.png`, `final-cartoon-short.mp4`). Rendering two projects concurrently corrupts output.
- **Impact:** Data loss, asset crossover between stories, race conditions.
- **Recommended Fix:** Migrate to SQLite database (`studio.db`) and project-scoped directories (`storage/projects/<projectId>/...`).

#### [DATA-02] In-Memory Render Queue Loss on Restart
- **Exact File Path:** `backend/services/renderQueue.js`
- **Line Range:** Lines 5–25
- **Function Name:** `RenderQueue` constructor & `addJob`
- **Problem:** Jobs are tracked solely in `this.jobs = new Map()`.
- **Impact:** Server restart or crash completely wipes active and pending rendering jobs with no recovery mechanism.
- **Recommended Fix:** Persist render queue state in SQLite `render_jobs` table.

#### [REL-02] Render Cancellation Fails to Terminate FFmpeg Child Processes
- **Exact File Path:** `backend/services/renderQueue.js`
- **Line Range:** Lines 85–105
- **Function Name:** `cancelRenderJob`
- **Problem:** Setting job status to `cancelled` does not send `SIGTERM` / `taskkill` to spawned FFmpeg child processes.
- **Impact:** Orphaned FFmpeg processes continue consuming 100% CPU in the background, starving the system of resources.
- **Recommended Fix:** Retain PID of spawned child processes and execute `tree-kill` or `taskkill /pid <PID> /f /t` on Windows upon cancellation.

---

### 2.3 Medium Risks (Remediation in Stages C, D & E)

#### [PERF-01] Uncapped JSON Body Parser (Denial of Service)
- **Exact File Path:** `backend/ffmpegHelper.js`
- **Line Range:** Lines 30–50
- **Function Name:** `parseJsonBody`
- **Problem:** Accumulates `req.on('data')` chunks into a string with no size boundary check.
- **Impact:** An attacker can send an endless HTTP payload stream to exhaust Node.js heap memory (`JavaScript heap out of memory`).
- **Recommended Fix:** Enforce a hard payload ceiling:
  ```javascript
  const MAX_PAYLOAD = 10 * 1024 * 1024; // 10 MB
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_PAYLOAD) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      req.destroy();
    }
  });
  ```

#### [REL-01] Unbounded Polling Loop in AI Video Generation
- **Exact File Path:** `ai-video-service.js`
- **Line Range:** Lines 80–115
- **Function Name:** `generateVideoWithReplicate`
- **Problem:** `while (true)` loop with `await new Promise(r => setTimeout(r, 5000))` and no maximum retry counter or timeout.
- **Impact:** If Replicate hangs, the request hangs forever, holding open network sockets and resources.
- **Recommended Fix:** Add maximum poll limit (e.g., 60 iterations = 5 minutes timeout) and explicit error throwing.

#### [OAUTH-01] OAuth Port Mismatch Between Standalone Scripts & Backend Server
- **Exact File Paths:** `authorize-youtube.js` vs `backend/config.js`
- **Problem:** Standalone script expects OAuth redirect on `http://localhost:3000/oauth2callback`, whereas backend runs on `http://localhost:4000`.
- **Impact:** Browser redirection fails with connection refused if the developer runs the backend server instead of the CLI script.
- **Recommended Fix:** Unify all OAuth redirect URLs to read dynamically from `process.env.PORT` (`http://localhost:${PORT}/api/youtube/oauth2callback`).

#### [AI-01] Scene Duration Independence Bug
- **Exact File Path:** `backend/services/geminiService.js`
- **Line Range:** Lines 45–70
- **Function Name:** `generateStoryPrompt`
- **Problem:** AI prompt does not dynamically bind scene counts to the selected video duration.
- **Impact:** 20-second shorts sometimes generate 12 scenes, while 2-minute videos generate only 3 scenes.
- **Recommended Fix:** Dynamic duration math injected into system prompt instructions.

---

### 2.4 Low Risks & Code Smells (Remediation in Stage F)

#### [CODE-01] Dual Entry Points in Public Directory
- **Files:** Root `index.html` vs `public/index.html`
- **Problem:** Root `index.html` is the active frontend (contains YouTube integration tabs), but `public/` directory contains an older duplicate version.
- **Impact:** Confusion during edits; risk of modifying the wrong file.
- **Recommended Fix:** Consolidate active frontend into `public/` or point Express/Node static server unambiguously to root.

#### [CODE-02] 20 Legacy Prototype Files in Root
- **Files:** `ai-video-service.js`, `image-service.js`, `gemini-service.js`, `video-pipeline.js`, `create-voice.ps1`, etc.
- **Problem:** Root directory contains early prototype scripts that duplicate logic now organized under `backend/services/`.
- **Impact:** Bloats codebase and creates maintenance ambiguity.
- **Recommended Fix:** Archive all legacy prototypes into a dedicated `archive/legacy_prototypes/` folder.

---

## 3. Long-Form Video Architecture (5–20 Minute Productions)

The current application was originally optimized for 20–60 second YouTube Shorts. To support 5–20 minute long-form episodes without crashing the server or exhausting browser memory, the following architectural enhancements are planned:

### 3.1 Chapter-Based Screenplay Chunking
A 10-minute video contains approximately 60–80 distinct scenes. Generating this in a single Gemini API call causes response truncation and narrative drift.
- **Structure:**
  - Story Idea -> 3 to 5 Chapters (Act I, Act IIA, Act IIB, Act III).
  - Each Chapter contains 12–18 individual scenes.
  - Character states and plot continuity are passed across chapter boundaries via a persistent "Story Memory" JSON context.

### 3.2 Segment-Based FFmpeg Batch Rendering
Rendering 80 scenes with high-resolution image zoom filters in a single FFmpeg execution command causes memory fragmentation and risks losing hours of work if a single frame crashes.
- **Batching Pipeline:**
  1. Render each scene individually into a short MP4 chunk (`scene_001.mp4`, `scene_002.mp4`...) under `storage/projects/<projectId>/temp/`.
  2. Maintain a render manifest SQLite table. If scene 42 fails, retry only scene 42.
  3. Concatenate validated scene MP4 chunks using FFmpeg `concat` demuxer (`-f concat -safe 0 -c copy`).
  4. Overlay full episode background music, audio normalization (`loudnorm`), and global title credits.

---

## 4. Advanced Character Consistency (Visual Conditioning Roadmap)

To guarantee character consistency from scene to scene:

### 4.1 Canonical Reference Sheet Generation
1. When a character is created, the system generates a 4-view character turnaround sheet (Front, 3/4 Profile, Side, Close-up Portrait).
2. The character's visual traits (e.g., exact clothing hex codes, hairstyle geometry, distinguishing facial marks) are extracted and stored in `characters` SQLite table.

### 4.2 Seed & Prompt Conditioning
1. When generating scenes containing Character X, the system retrieves Character X's canonical visual description and prepends it to the image generator prompt.
2. The character's locked visual seed is passed as a conditioning parameter.
3. For providers supporting image-to-image or IP-Adapter (such as Stable Diffusion or Gemini Imagen 3 image reference), the character's reference image URL is passed directly as conditioning input.

---

## 5. Instagram Publishing Integration Roadmap

### 5.1 Technical Specifications
- **Aspect Ratio:** 9:16 (1080x1920) for Instagram Reels, 1:1 (1080x1080) for Feed Carousels.
- **Duration Limit:** Up to 90 seconds for Reels.
- **Video Format:** MP4, H.264 video codec, AAC audio, 30 fps, max 4GB file size.

### 5.2 API Integration (Meta Graph API)
- **Endpoint:** `POST https://graph.facebook.com/v19.0/{ig-user-id}/media`
- **Workflow:**
  1. User authenticates via Facebook Login with `instagram_basic` and `instagram_content_publish` permissions.
  2. Backend uploads rendered video to a temporary public URL or direct container upload.
  3. Backend polls container status until `FINISHED`.
  4. Backend publishes container: `POST https://graph.facebook.com/v19.0/{ig-user-id}/media_publish`.

---

## 6. Legacy File Retirement Plan

To prepare for clean production deployment in Stage F:
1. Create `archive/prototypes/` directory.
2. Safely move the 20 legacy root files (`ai-video-service.js`, `image-service.js`, `video-pipeline.js`, etc.) into `archive/prototypes/`.
3. Verify that zero active backend modules import from archived files.

---

## 7. Stage A Verification & Next Steps

All 8 formal markdown reports are now generated and saved to the project root:
1. `CODE_AUDIT_REPORT.md` (Complete file inventory, function catalog, dependency map)
2. `SECURITY_AUDIT_REPORT.md` (Vulnerabilities SEC-01 through SEC-08, OWASP evaluation)
<!-- 3. `HIGH_RISK_FIXES.md` (Exact code patches for all Critical & High risks) -->
4. `ARCHITECTURE.md` (System components, data flow, multi-project folder structure)
5. `DATABASE_MIGRATION.md` (Complete SQLite schema, DDL, JSON migration strategy)
6. `API_DOCUMENTATION.md` (All REST endpoints, request/response schemas, security matrix)
7. `TEST_REPORT.md` (Commands executed, actual results, deferred tests, regression plan)
8. `REMAINING_ISSUES.md` (Risk register, long-form video architecture, consistency, roadmap)

**CRITICAL COMMITMENT:**  
No application source files have been touched, no packages have been installed, and no files have been deleted.

We are awaiting your explicit review and approval before proceeding to **Stage B (Critical Security Fixes)**.
