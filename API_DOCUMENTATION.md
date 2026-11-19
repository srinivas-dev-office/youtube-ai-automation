# API Documentation & Contract Specification

**Project:** `youtube-cartoon-agent`  
**Audit Stage:** Stage A (Complete Audit & Specification)  
**Date:** November 2026  
**Document Status:** Complete Audit Specification  

---

## 1. Overview & General Standards

The `youtube-cartoon-agent` backend runs on Node.js using native HTTP routing or Express-compatible middleware dispatch in `backend/server.js`.

### Standard Headers
- `Content-Type: application/json` (Required for POST/PUT endpoints)
- `X-Project-ID: <string>` (Mandatory in Stage B+ for multi-project isolation)
- `Authorization: Bearer <session_or_api_token>` (Mandatory in Stage B+ for protected mutation endpoints)

### Standard Response Wrappers
To eliminate inconsistent controller response shapes, all modernized endpoints comply with the following envelopes:

#### Success Envelope (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "meta": {
    "projectId": "proj-uuid-1234",
    "timestamp": 1700000000000
  }
}
```

#### Error Envelope (`400`, `401`, `403`, `404`, `429`, `500`):
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Detailed sanitized error description",
    "details": []
  }
}
```

---

## 2. Story & Screenplay Endpoints (`backend/routes/storyRoutes.js`)

### 2.1 Generate Complete Story & Screenplay
- **Route:** `POST /api/generate-story`
- **Controller Function:** `storyController.generateStory` (`backend/controllers/storyController.js`)
- **Service Dependency:** `backend/services/geminiService.js` -> `generateStoryPrompt`
- **Purpose:** Generates a structured multi-scene screenplay from an idea, genre, tone, target duration, and target language.

#### Request Headers:
| Header | Type | Required | Description |
|---|---|---|---|
| `Content-Type` | `string` | Yes | Must be `application/json` |
| `X-Project-ID` | `string` | No (Recommended) | Project ID scope |

#### Request Body Schema:
```json
{
  "idea": "A young girl moves into an old haunted house and discovers a friendly ghost girl.",
  "genre": "Horror / Comedy",
  "targetDuration": 60,
  "language": "te",
  "voiceStyle": "narrator-female",
  "aspectRatio": "9:16",
  "characters": [
    {
      "name": "Maya",
      "age": "8-year-old girl",
      "visualDescription": "Big hazel eyes, purple sweater, braided dark hair"
    }
  ]
}
```
*Validation Rules:*
- `idea`: String, required, min 10 chars, max 2,000 chars.
- `targetDuration`: Integer, required, between 15 and 1200 (seconds).
- `language`: String, ISO code (e.g., `'en'`, `'te'`, `'hi'`), default `'en'`.
- `genre`: String, optional, max 100 chars.

#### Responses:
- **`200 OK`**:
```json
{
  "success": true,
  "data": {
    "title": "Maya and the Whispering Attic",
    "duration": 60,
    "language": "te",
    "characters": [
      {
        "id": "char-maya",
        "name": "Maya",
        "description": "8-year-old girl with big hazel eyes and purple sweater"
      },
      {
        "id": "char-chaya",
        "name": "Chaya",
        "description": "Translucent glowing friendly ghost girl in Victorian dress"
      }
    ],
    "scenes": [
      {
        "sceneNumber": 1,
        "duration": 6,
        "visualPrompt": "Maya standing outside a Victorian haunted house carrying a small backpack, cinematic lighting, 3D Pixar style, high detail",
        "narration": "మాయ తన కొత్త పాత ఇంటి ముందు నిలబడింది. కిటికీలో ఏదో కదిలినట్లు అనిపించింది.",
        "dialogue": "",
        "cameraMovement": "pan_right",
        "transition": "fade"
      }
    ]
  }
}
```
- **`400 Bad Request`**: `{ "success": false, "error": { "code": "VALIDATION_FAILED", "message": "Field 'idea' is required and must be at least 10 characters." } }`
- **`429 Too Many Requests`**: `{ "success": false, "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Gemini API generation quota reached. Retry in 60s." } }`
- **`500 Internal Server Error`**: `{ "success": false, "error": { "code": "AI_GENERATION_FAILED", "message": "Failed to parse screenplay structure from AI response." } }`

---

### 2.2 Generate Scene Visual Prompts
- **Route:** `POST /api/generate-prompts`
- **Controller Function:** `storyController.generatePrompts` (`backend/controllers/storyController.js`)
- **Service Dependency:** `backend/services/geminiService.js`
- **Purpose:** Refines rough scene notes into production-ready 3D cartoon style prompts adhering to character consistency rules.

#### Request Body Schema:
```json
{
  "sceneDescription": "Maya meets Chaya inside the dusty attic.",
  "characters": ["char-maya", "char-chaya"],
  "visualStyle": "3D Cartoon / Pixar Animation",
  "aspectRatio": "9:16"
}
```

#### Responses:
- **`200 OK`**:
```json
{
  "success": true,
  "data": {
    "positivePrompt": "Masterpiece 3D animation style, 8-year-old Indian girl Maya with big hazel eyes and purple knitted sweater sitting in sunlit dusty attic, beside glowing translucent ghost girl Chaya in Victorian dress, whimsical dust motes, volumetric soft lighting, Octane render, 8k resolution",
    "negativePrompt": "photorealistic, live action, deformed hands, extra limbs, mutated fingers, blurry, ugly, text, watermark, signature",
    "aspectRatio": "9:16"
  }
}
```

---

### 2.3 Save & Load Stories
- **Route:** `POST /api/save-story`
  - **Controller:** `storyController.saveStory`
  - **Payload:** `{ "projectId": "p1", "title": "Maya", "screenplay": { ... } }`
  - **Status:** `200 OK`
- **Route:** `GET /api/stories`
  - **Controller:** `storyController.getStories`
  - **Query:** `?projectId=p1`
  - **Response:** Array of saved story revisions.

---

## 3. Character Management Endpoints (`backend/routes/characterRoutes.js`)

### 3.1 Generate Character Reference
- **Route:** `POST /api/generate-character`
- **Controller Function:** `characterController.generateCharacter` (`backend/controllers/characterController.js`)
- **Service Dependency:** `backend/services/imageGenerator.js` -> Pollination / Imagen / Stable Diffusion
- **Purpose:** Generates a front-facing canonical 3D model turnaround sheet for a character.

#### Request Body Schema:
```json
{
  "name": "Maya",
  "age": "8",
  "gender": "female",
  "visualDescription": "Curious expression, hazel eyes, dark brown double braids, lavender hoodie with cat emblem",
  "artStyle": "3D Pixar Cartoon",
  "projectId": "proj-101"
}
```

#### Responses:
- **`200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "char-9a4f21",
    "name": "Maya",
    "referenceImageUrl": "/storage/projects/proj-101/characters/char-9a4f21_ref.png",
    "seed": 4829103,
    "prompt": "Full body turnaround sheet of Maya, 8yo girl, 3D animated cartoon...",
    "locked": true
  }
}
```

---

### 3.2 List & Delete Characters
- **Route:** `GET /api/characters`
  - **Query:** `?projectId=proj-101`
  - **Response:** List of character objects with thumbnail URLs and lock statuses.
- **Route:** `DELETE /api/characters/:id`
  - **Params:** `id` (Character UUID)
  - **Query:** `?projectId=proj-101`
  - **Response:** `{ "success": true, "message": "Character char-9a4f21 deleted" }`

---

## 4. Image & Storyboard Endpoints (`backend/routes/imageRoutes.js`)

### 4.1 Generate Scene Image
- **Route:** `POST /api/generate-scene`
- **Controller Function:** `imageController.generateScene` (`backend/controllers/imageController.js`)
- **Service Dependency:** `backend/services/imageGenerator.js`
- **Purpose:** Generates a high-resolution storyboard frame enforcing character consistency via seed & reference description injection.

#### Request Body Schema:
```json
{
  "projectId": "proj-101",
  "sceneIndex": 1,
  "prompt": "Maya walks through the creaky wooden door of the abandoned hallway",
  "characterIds": ["char-9a4f21"],
  "width": 720,
  "height": 1280,
  "cameraAngle": "wide-angle low-shot"
}
```

#### Responses:
- **`200 OK`**:
```json
{
  "success": true,
  "data": {
    "sceneIndex": 1,
    "imageUrl": "/storage/projects/proj-101/scenes/scene_001.png",
    "width": 720,
    "height": 1280,
    "generationTimeMs": 4200
  }
}
```

---

### 4.2 Upload Custom Asset (CRITICAL SECURITY VULNERABILITY AUDIT: `SEC-03`)
- **Route:** `POST /api/upload-asset`
- **Controller Function:** `imageController.uploadCustomAsset` (`backend/controllers/imageController.js` lines 125–145)
- **Current Behavior:** Accepts `base64Data`, `name`, `type`. Uses `type` directly to formulate filename `${name}.${type}` and writes directly to `./assets/`.
- **Security Vulnerability (`SEC-03`):** Unsanitized extension allows `.js` or `.exe` uploads. No magic-number validation allows executable code injection.
- **Required Hardened Schema:**
```json
{
  "projectId": "proj-101",
  "fileName": "custom_background.png",
  "fileType": "image/png",
  "base64Data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
}
```
*Hardened Validation Rules:*
- Payload size must not exceed 10 MB.
- MIME type must strictly match `image/png`, `image/jpeg`, `image/webp`, or `audio/mpeg`.
- Base64 data decoded buffer must have magic numbers verified (e.g. `89 50 4E 47` for PNG).
- File written to project-isolated sandbox `storage/projects/<projectId>/assets/<uuid>.png`.

---

### 4.3 Delete Custom Asset (CRITICAL SECURITY VULNERABILITY AUDIT: `SEC-04`)
- **Route:** `POST /api/delete-asset`
- **Controller Function:** `imageController.deleteCustomAsset` (`backend/controllers/imageController.js` lines 147–165)
- **Current Vulnerability (`SEC-04`):** Path traversal checks use `resolved.startsWith(assetsDir)`. If `assetsDir` is empty string or unresolvable, arbitrary system files can be unlinked.
- **Required Hardened Schema:**
```json
{
  "projectId": "proj-101",
  "assetId": "ast-4821a8"
}
```
*Rule:* Asset lookup strictly by ID from database table `assets`. Path is resolved entirely server-side.

---

## 5. Video Rendering & Queue Endpoints (`backend/routes/videoRoutes.js`)

### 5.1 Submit Video Render Job
- **Route:** `POST /api/render-video`
- **Controller Function:** `videoController.renderVideo` (`backend/controllers/videoController.js`)
- **Service Dependency:** `backend/services/renderQueue.js`, `backend/services/videoRenderer.js`, `backend/services/voiceGenerator.js`
- **Purpose:** Queues an asynchronous multi-scene video compilation with voiceover, audio normalization, motion graphics, and subtitle burn-in.

#### Request Body Schema:
```json
{
  "projectId": "proj-101",
  "title": "Maya and the Haunted Attic",
  "aspectRatio": "9:16",
  "fps": 30,
  "language": "te",
  "voicePersonality": "te-IN-Standard-A",
  "scenes": [
    {
      "sceneIndex": 1,
      "duration": 5.0,
      "imagePath": "/storage/projects/proj-101/scenes/scene_001.png",
      "narrationText": "మాయ నిశ్శబ్దంగా అడుగులు వేసింది.",
      "cameraMotion": "zoom_in",
      "transition": "crossfade"
    }
  ],
  "subtitleStyle": {
    "fontName": "Nirmala UI",
    "fontSize": 24,
    "primaryColor": "&H00FFFFFF",
    "outlineColor": "&H00000000",
    "alignment": 2
  }
}
```

#### Responses:
- **`202 Accepted`**:
```json
{
  "success": true,
  "data": {
    "jobId": "job-8f20b3",
    "status": "queued",
    "queuePosition": 1,
    "estimatedTimeSeconds": 45,
    "statusUrl": "/api/render-status/job-8f20b3"
  }
}
```

---

### 5.2 Poll Render Status
- **Route:** `GET /api/render-status/:jobId`
- **Controller Function:** `videoController.getRenderStatus`
- **Purpose:** Non-blocking polling endpoint to query progress of FFmpeg rendering and voice synthesis.

#### Responses:
- **`200 OK` (In Progress)**:
```json
{
  "success": true,
  "data": {
    "jobId": "job-8f20b3",
    "status": "rendering",
    "progress": 65,
    "currentStage": "Encoding scene 3 of 5 (FFmpeg zoom_in filter)",
    "etaSeconds": 18
  }
}
```
- **`200 OK` (Completed)**:
```json
{
  "success": true,
  "data": {
    "jobId": "job-8f20b3",
    "status": "completed",
    "progress": 100,
    "outputVideoUrl": "/output/proj-101/final_video.mp4",
    "fileSizeBytes": 12450892,
    "durationSeconds": 30.5
  }
}
```
- **`200 OK` (Failed)**:
```json
{
  "success": false,
  "data": {
    "jobId": "job-8f20b3",
    "status": "failed",
    "error": "Voice synthesis failed: language code 'xyz' unsupported by eSpeak/Edge-TTS"
  }
}
```

---

### 5.3 Cancel Render Job
- **Route:** `POST /api/cancel-render/:jobId`
- **Controller Function:** `videoController.cancelRender`
- **Purpose:** Immediately aborts running FFmpeg child process (`SIGTERM` / `taskkill`), marks job status `cancelled`, and frees workers in `renderQueue.js`.

---

### 5.4 Save API Key (CRITICAL SECURITY VULNERABILITY AUDIT: `SEC-05`)
- **Route:** `POST /api/save-api-key`
- **Controller Function:** `videoController.saveApiKey` (`backend/controllers/videoController.js` lines 74–99)
- **Current Vulnerability (`SEC-05`):** Unauthenticated POST overwrites `.env` file on disk and updates `process.env`. Allows any client to sabotage application configuration or inject malicious environment variables.
- **Stage B Remediation:** This endpoint is completely removed or restricted strictly to local administrator authentication with whitelist-only key validation.

---

## 6. YouTube OAuth & Upload Endpoints (`backend/routes/videoRoutes.js`)

### 6.1 Get YouTube Authorization URL
- **Route:** `GET /api/youtube/auth-url`
- **Controller Function:** `videoController.getYoutubeAuthUrl`
- **Purpose:** Generates OAuth2 consent URL with offline access and YouTube upload scopes (`https://www.googleapis.com/auth/youtube.upload`).

#### Response:
```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload..."
  }
}
```

---

### 6.2 YouTube OAuth2 Callback
- **Route:** `GET /api/youtube/oauth2callback`
- **Query Params:** `code`, `state`
- **Controller Function:** `videoController.youtubeOAuthCallback`
- **Purpose:** Exchanges authorization code for refresh token and stores encrypted credentials in `storage/auth/youtube_token.json`.

---

### 6.3 Upload Video to YouTube
- **Route:** `POST /api/upload-youtube`
- **Controller Function:** `videoController.uploadToYouTube`
- **Payload:**
```json
{
  "projectId": "proj-101",
  "videoPath": "/output/proj-101/final_video.mp4",
  "title": "Maya and the Haunted Attic | 3D Cartoon Short",
  "description": "Created with AI Video Studio #animation #shorts",
  "tags": ["animation", "cartoon", "telugu stories", "shorts"],
  "privacyStatus": "unlisted"
}
```
- **Responses:**
  - `200 OK`: `{ "success": true, "data": { "videoId": "dQw4w9WgXcQ", "videoUrl": "https://youtu.be/dQw4w9WgXcQ" } }`
  - `401 Unauthorized`: Token expired and refresh failed.
  - `403 Forbidden`: YouTube quota exceeded for the day.

---

## 7. Complete Endpoint Matrix & Security Requirements

| Method | Endpoint | Auth Required | Rate Limit | Risk ID | Status |
|---|---|---|---|---|---|
| POST | `/api/generate-story` | Optional (Local) / Yes (Prod) | 10 req / min | DOS-01 | Active |
| POST | `/api/generate-prompts` | Optional (Local) / Yes (Prod) | 20 req / min | DOS-01 | Active |
| POST | `/api/save-story` | Optional | 60 req / min | - | Active |
| GET | `/api/stories` | No | 60 req / min | - | Active |
| POST | `/api/generate-character`| Optional | 10 req / min | DOS-01 | Active |
| GET | `/api/characters` | No | 60 req / min | - | Active |
| DELETE| `/api/characters/:id` | Admin / Owner | 30 req / min | SEC-04 | Active |
| POST | `/api/generate-scene` | Optional | 10 req / min | DOS-01 | Active |
| POST | `/api/upload-asset` | Authenticated | 10 req / min | SEC-03 | **CRITICAL FIX REQ** |
| POST | `/api/delete-asset` | Authenticated | 30 req / min | SEC-04 | **CRITICAL FIX REQ** |
| GET | `/api/assets` | No | 60 req / min | - | Active |
| POST | `/api/render-video` | Optional (Local) | 5 req / min | PERF-01 | Active |
| GET | `/api/render-status/:jobId`| No | 120 req / min | - | Active |
| POST | `/api/cancel-render/:jobId`| Optional | 30 req / min | REL-02 | Active |
| GET | `/api/render-history` | No | 60 req / min | - | Active |
| POST | `/api/save-api-key` | Strictly Disabled / Local | 2 req / hr | SEC-05 | **CRITICAL FIX REQ** |
| GET | `/api/youtube/auth-url` | Admin | 10 req / min | - | Active |
| GET | `/api/youtube/oauth2callback`| Public OAuth | 10 req / min | - | Active |
| POST | `/api/upload-youtube` | Admin | 5 req / min | OAUTH-01 | Active |
| GET | `/api/youtube/channels`| Admin | 10 req / min | - | Active |

---
*End of API Documentation Specification.*
