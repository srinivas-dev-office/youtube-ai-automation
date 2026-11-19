# CODE AUDIT REPORT: YOUTUBE CARTOON AGENT
**Date:** 2026-11-18  
**Scope:** Complete Codebase Inspection across 51 Source and Configuration Files  
**Auditor:** Antigravity AI Security & Systems Team  
**Status:** Stage A Complete (Read-Only Inspection)

---

## 1. Executive Summary

A comprehensive, non-destructive audit of `youtube-cartoon-agent` was conducted across all 51 source, route, controller, service, utility, and configuration files.

The application functions as a **Dual-Mode AI Video Studio & Non-Linear Video Editor (NLE)** targeting vertical YouTube Shorts and animated cartoon generation. It integrates:
* **LLM Engine:** Direct REST integration with Google Gemini (`gemini-2.5-flash`, `gemini-3-flash-preview`, etc.)
* **Visual Generation:** Free-tier image generation via Pollinations AI (FLUX / Turbo) and AI Horde (Distributed SDXL / ICBINP)
* **Voice Synthesis:** Edge Cloud TTS & Windows SAPI PowerShell automation
* **Compositing & Video:** FFmpeg 9.0.2 with audio-reactive waveforms, breathing vignette, XFade transitions, and drawtext subtitle filters
* **Publishing:** Google YouTube Data API v3 OAuth2 client

While the application features functional generation and rendering capabilities, the codebase suffers from **severe security vulnerabilities (RCE, arbitrary file wipeout, hardcoded credentials)**, a **total lack of project data isolation** (all projects overwrite shared filenames), **in-memory-only job persistence**, and **legacy architectural duplication**.

---

## 2. Source Code Inventory

### 2.1 Active Server, Controllers & Engines (`backend/`)
| File Path | Lines | Role | Key Functions / Exports |
| :--- | :--- | :--- | :--- |
| `backend/server.js` | 143 | HTTP Server & Static Router | Main request dispatcher, range streaming for media, route handoffs |
| `backend/config.js` | 70 | Configuration & Directories | Path resolution, environment variable loader, FFmpeg path detection |
| `backend/utils/ffmpegHelper.js` | 74 | Execution & Request Helpers | `execFfmpeg`, `parseJsonBody`, `setNoCacheHeaders`, `getMimeType` |
| `backend/routes/storyRoutes.js` | 28 | Story Route Dispatcher | `/api/story`, `/api/storyboard`, `/api/generate-storyboard` |
| `backend/routes/characterRoutes.js` | 53 | Character Route Dispatcher | `/api/characters`, `/api/save-character`, `/api/lock-character`, `/api/project-context` |
| `backend/routes/imageRoutes.js` | 68 | Image Route Dispatcher | `/api/generate-scene-image`, `/api/upload-scene`, `/api/delete-scene`, `/api/upload-asset` |
| `backend/routes/videoRoutes.js` | 83 | Video & YouTube Router | `/api/render-job/*`, `/api/video`, `/api/upload-youtube`, `/auth/start` |
| `backend/controllers/storyController.js` | 135 | Story Business Logic | `getStoryboard`, `generateStoryboard`, `generateFromNarration` |
| `backend/controllers/characterController.js` | 148 | Character Business Logic | `getCharacters`, `saveCharacter`, `lockCharacter`, `uploadCharacterPhoto` |
| `backend/controllers/imageController.js` | 260 | Image Business Logic | `generateSceneImage`, `uploadSceneMedia`, `uploadCustomAsset`, `deleteCustomAsset` |
| `backend/controllers/videoController.js` | 432 | Video & Publish Logic | `renderStoryboardMovie`, `startRenderJobController`, `publishToYouTube`, `saveApiKey` |
| `backend/services/storyGenerator.js` | 752 | Gemini Story Engine | `generateStoryboardWithGemini`, `calculateSceneStructure`, `callGeminiApi` |
| `backend/services/imageGenerator.js` | 542 | Image Generation Engine | `generateImageForScene`, `generateImageWithPollinations`, `generateImageWithHorde` |
| `backend/services/videoGenerator.js` | 377 | FFmpeg Stitching Engine | `renderSceneClip`, `renderMultiSceneStoryboard`, `mergeAudioAndSubtitles` |
| `backend/services/characterService.js` | 489 | Character Consistency Engine | `loadCharacters`, `syncCharactersFromStoryboard`, `toggleCharacterLock`, `getProjectContext` |
| `backend/services/voiceGenerator.js` | 216 | Voice Synthesis Engine | `generateVoice`, `synthesizeMultiLangAudio`, `synthesizeWithSapi`, `getCatalogForLanguage` |
| `backend/services/renderQueue.js` | 190 | Async Background Job Queue | `createRenderJob`, `getRenderJob`, `cancelRenderJob` |

### 2.2 Active Frontend Suite (`frontend/`)
| File Path | Lines | Role | Key Functions / Elements |
| :--- | :--- | :--- | :--- |
| `frontend/index.html` | 1,280 | Complete Application UI | Dual Studio/Editor modes, 10-category sidebar, timeline lanes, modals |
| `frontend/script.js` | 2,338 | Frontend Application State | `StudioSuite`, timeline synchronization, polling queue, canvas rendering |
| `frontend/style.css` | 1,875 | Design System & CSS | Dark theme tokens, glassmorphism, responsive grid, timeline tracks |

### 2.3 Root Scripts, Automation & OAuth Utilities
| File Path | Lines | Role | Status |
| :--- | :--- | :--- | :--- |
| `server.js` | 1 | Entry point redirect | Active (`require("./backend/server")`) |
| `config.js` | 33 | Root legacy config | Legacy fallback |
| `package.json` | 25 | Project manifest | Active (`googleapis: ^188.0.0`) |
| `.gitignore` | 5 | Git exclusion list | Incomplete (excludes secrets but misses databases/renders) |
| `.env.example` | 5 | Configuration template | High-Risk (contains active-looking key) |
| `authorize-youtube.js` | 105 | Standalone OAuth flow | Active CLI (`npm run auth`) |
| `upload-youtube.js` | 114 | Standalone YouTube uploader | Active CLI & imported by `videoController.js` |
| `get-channel.js` | 52 | YouTube channel inspection | Active diagnostic utility |
| `create-voice.ps1` | 50 | PowerShell Windows Speech SAPI | Fallback audio generator |
| `ai-video-service.js` | 114 | Standalone Replicate Video | Inactive in active dashboard (High Risk SSRF) |
| `image-service.js` | 295 | Root image service | Legacy duplicate of `backend/services/imageGenerator.js` |
| `gemini-service.js` | 766 | Root story service | Legacy duplicate of `backend/services/storyGenerator.js` |
| `story-generator.js` | 40 | Standalone CLI story test | Legacy CLI prototype |
| `storyboard-engine.js` | 30 | Standalone CLI engine test | Legacy CLI prototype |
| `video-generator.js` | 40 | Standalone CLI video test | Legacy CLI prototype |
| `voice-service.js` | 35 | Standalone CLI voice test | Legacy CLI prototype |
| `pipeline.js` | 50 | Standalone batch pipeline | Legacy CLI prototype |
| `generate-story-video.js` | 40 | Standalone FFmpeg test | Legacy CLI prototype |
| `animated-cartoon.js` | 45 | Standalone FFmpeg test | Legacy CLI prototype |
| `combine-video-audio.js` | 35 | Standalone FFmpeg test | Legacy CLI prototype |
| `subtitles-merger.js` | 35 | Standalone FFmpeg test | Legacy CLI prototype |
| `add-subtitles.js` | 35 | Standalone FFmpeg test | Legacy CLI prototype |
| `public/index.html` | 1,591 | Previous v1 UI dashboard | Inactive legacy dashboard (superseded by `frontend/index.html`) |
| `config/config.json` | 15 | Static JSON configuration | Active config fallback |

---

## 3. Detailed File-by-File Findings

### 3.1 `backend/server.js`
* **Function:** Main HTTP server handler (Lines 16–119).
* **Vulnerability:** Dispatches all routes without checking origin, authentication, or session tokens. Static file handlers for `/assets/`, `/storage/images/`, `/storage/audio/`, and `/storage/videos/` parse paths using `path.basename(pathname)` which avoids direct traversal, but exposes all user media publicly.
* **Impact:** Any client that can connect to the port can trigger video rendering, upload files, or trigger YouTube uploads.
* **Recommended Fix:** Implement an authentication middleware layer (Bearer token or loopback guard) and security headers (`X-Content-Type-Options: nosniff`, `Content-Security-Policy`).

### 3.2 `backend/config.js`
* **Function:** Configuration initialization (Lines 25–29, 48–49).
* **Vulnerability:** Line 26 defines `FALLBACK_GEMINI_KEY = "AQ.Ab8..."`. Line 48 defines `fallbackFfmpeg = "C:\\Users\\alath\\Downloads\\..."`.
* **Impact:** Embedded credentials and rigid environment coupling to a single developer's machine.
* **Recommended Fix:** Remove `FALLBACK_GEMINI_KEY`. Throw an immediate error if `GEMINI_API_KEY` is not provided in environment variables. Resolve FFmpeg strictly from `process.env.FFMPEG_PATH` or system `PATH`.

### 3.3 `backend/utils/ffmpegHelper.js`
* **Function:** `parseJsonBody` (Lines 19–31).
* **Vulnerability:** Body chunks are appended into memory (`body += chunk`) without verifying `body.length`.
* **Impact:** Denial of Service (DoS) via process Out-of-Memory (OOM) crash if an oversized body is sent.
* **Recommended Fix:** Add a byte counter; if payload exceeds 10MB (or 256KB for non-file endpoints), immediately call `req.destroy()` and return HTTP 413.

### 3.4 `backend/controllers/imageController.js`
* **Function:** `uploadCustomAsset` (Lines 125–145).
* **Vulnerability:** `saveName = `${type}${ext}`` allows an attacker to supply a traversal sequence in `type` (`../../server`) and an extension of `.js` to overwrite source code.
* **Impact:** Critical Remote Code Execution / Arbitrary File Overwrite.
* **Recommended Fix:** Whitelist allowed `type` tokens (e.g. `['character', 'scene', 'background', 'sticker']`), generate a secure random filename, and validate MIME headers.
* **Function:** `deleteCustomAsset` (Lines 147–165).
* **Vulnerability:** Calls `f.toLowerCase().startsWith(type)` on all files. If `type` is empty string `""`, it matches and deletes every file in `imagesDir` and `assetsDir`.
* **Impact:** Critical data loss and complete project wipeout.
* **Recommended Fix:** Validate `type` against strict regex `/^[a-zA-Z0-9_-]{2,50}$/`, ensure it cannot be empty, and scope deletion strictly to the active project folder.

### 3.5 `backend/controllers/videoController.js`
* **Function:** `saveApiKey` (Lines 74–99).
* **Vulnerability:** Writes unauthenticated user-supplied keys directly to the physical `.env` file on disk.
* **Impact:** Environment tampering and denial of service.
* **Recommended Fix:** Deprecate or secure behind strict local administrator authentication.

### 3.6 `backend/services/voiceGenerator.js`
* **Function:** `synthesizeMultiLangAudio` (Line 144).
* **Vulnerability:** `execSync(`${ffBin} -y -i "${tempMp3}" -ar 44100 -ac 2 "${wavOutputFile}"`, { stdio: "ignore" });`
* **Impact:** Shell command injection if filenames or paths contain shell metacharacters.
* **Recommended Fix:** Replace `execSync` with `execFileSync(ffmpegPath, ["-y", "-i", tempMp3, "-ar", "44100", "-ac", "2", wavOutputFile])`.

### 3.7 `ai-video-service.js`
* **Function:** `downloadFile` (Lines 11–32) & `generateVideoWithReplicate` (Lines 61–75).
* **Vulnerability:** `downloadFile` has no SSRF host validation, no timeout, and handles HTTP redirects recursively without a depth counter. `generateVideoWithReplicate` runs `while (true)` with no maximum iteration limit.
* **Impact:** SSRF, infinite loop process lock, and unbounded disk filling.
* **Recommended Fix:** Use an AbortController with a 30s timeout, limit redirects to 3, enforce maximum file download size (100MB), and limit polling to 50 attempts (200s).

### 3.8 `backend/services/renderQueue.js`
* **Function:** `createRenderJob` (Line 7) & `cancelRenderJob` (Line 176).
* **Vulnerability:** `jobs = new Map()` stores jobs only in RAM. `cancelRenderJob` sets status to cancelled but does not kill the active FFmpeg child process.
* **Impact:** Complete loss of job history and status on server restart; orphaned zombie FFmpeg processes running at 100% CPU.
* **Recommended Fix:** Store jobs in SQLite table `render_jobs`. Track child process PID and kill with `SIGTERM`/`SIGKILL` upon cancellation.

### 3.9 `backend/services/characterService.js`
* **Function:** `loadCharacters` (Line 7, Line 367).
* **Vulnerability:** Stores all character definitions in a single global `storage/characters.json` file and syncs primary references to a shared `storage/images/character_ref.png`.
* **Impact:** Total lack of isolation. Any new character in Project B overwrites characters in Project A.
* **Recommended Fix:** Scope character records to `project_id` in SQLite and store images under `storage/projects/<projectId>/characters/`.

---

## 4. Architectural Summary & Action Plan

1. **Security & Input Sanitization (Stage B):** Eliminate all Critical vulnerabilities (`SEC-01` to `SEC-08`), add body size limits, replace shell commands with argument arrays, and protect static routes.
2. **Database & Data Isolation (Stage C):** Replace flat JSON files with SQLite (`better-sqlite3`), introducing relational tables and strict project-scoped file directories.
3. **Provider Consolidation (Stage D & E):** Establish single unified provider interfaces for Image and Video generation, eliminating orphaned root scripts.
4. **Long-Form & Multi-Act Storytelling (Stage F):** Implement chapter-based chunking to support 5–20 minute stories alongside 20–60s Shorts.
