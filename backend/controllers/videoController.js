const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { outputDir, storageDir, videosDir, assetsDir, credentialsPath, tokenPath, rootDir, port } = require("../config");
const { parseJsonBody } = require("../utils/ffmpegHelper");
const { generateVoice, getCatalogForLanguage } = require("../services/voiceGenerator");
const { findSceneMedia, renderMultiSceneStoryboard, mergeAudioAndSubtitles } = require("../services/videoGenerator");
const { createRenderJob, getRenderJob, cancelRenderJob } = require("../services/renderQueue");
const { uploadToYouTube } = require("../../upload-youtube");
const projectService = require("../services/projectService");
const { aiVideoManager } = require("../services/aiVideoProviders");
const { generateLipSyncVisemes } = require("../services/lipSyncService");
const { renderHybridMovie } = require("../services/hybridRenderer");

function getExistingAssets() {
  const assets = {};
  if (!fs.existsSync(assetsDir)) return assets;
  const files = fs.readdirSync(assetsDir);
  const sampleAvailable = fs.existsSync(path.join(assetsDir, "sample_scene1.mp4"));

  for (const f of files) {
    const lower = f.toLowerCase();
    const ext = path.extname(f).toLowerCase();
    const isVideo = [".mp4", ".webm", ".mov", ".mkv"].includes(ext);
    const isAudio = [".mp3", ".wav", ".m4a", ".aac"].includes(ext);

    let key = null;
    if (lower.startsWith("background") || lower.startsWith("forest") || lower.startsWith("bg.")) key = "background";
    else if (lower.startsWith("man") || lower.startsWith("hero") || lower.startsWith("character1") || lower.startsWith("char1")) key = "man";
    else if (lower.startsWith("lion") || lower.startsWith("villain") || lower.startsWith("character2") || lower.startsWith("char2")) key = "lion";
    else if (lower.startsWith("bgm") || lower.startsWith("music") || lower.startsWith("soundtrack") || lower.startsWith("audio")) key = "bgm";
    else {
      const match = lower.match(/^scene(\d+)\./);
      if (match) key = `scene${match[1]}`;
    }

    if (key) {
      assets[key] = {
        url: `/assets/${f}`,
        filename: f,
        type: isVideo ? "video" : (isAudio ? "audio" : "image")
      };
    }
  }
  assets.sampleAvailable = sampleAvailable;
  return assets;
}

async function getStatus(req, res) {
  let youtubeAuthorized = false;
  let channelTitle = null;

  if (fs.existsSync(credentialsPath) && fs.existsSync(tokenPath)) {
    try {
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
      const config = credentials.installed || credentials.web;
      const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
      const auth = new google.auth.OAuth2(config.client_id, config.client_secret, `http://localhost:${port}/oauth2callback`);
      auth.setCredentials(tokens);

      const yt = google.youtube({ version: "v3", auth });
      const chRes = await yt.channels.list({ part: ["snippet"], mine: true });
      if (chRes.data.items && chRes.data.items.length > 0) {
        youtubeAuthorized = true;
        channelTitle = chRes.data.items[0].snippet.title;
      }
    } catch (_) {
      youtubeAuthorized = false;
    }
  }

  const assets = getExistingAssets();
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ youtubeAuthorized, channelTitle, assets, hasGeminiKey }));
}

async function saveApiKey(req, res) {
  try {
    // Restrict API key mutation strictly to localhost loopback connections
    const remoteIp = req.socket?.remoteAddress || "";
    const isLocal = remoteIp === "127.0.0.1" || remoteIp === "::1" || remoteIp === "::ffff:127.0.0.1";
    if (!isLocal) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Forbidden: API key configuration is restricted to local connections." }));
      return;
    }

    const body = await parseJsonBody(req);
    const key = (body.apiKey || "").trim();

    // Strict validation: alphanumeric, hyphens, underscores only; 20-128 chars
    if (!key || !/^[A-Za-z0-9_-]{20,128}$/.test(key)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid API key format. Key must be 20-128 alphanumeric characters with no spaces or symbols." }));
      return;
    }

    process.env.GEMINI_API_KEY = key;

    const envPath = path.join(rootDir, ".env");
    let lines = [];
    if (fs.existsSync(envPath)) {
      lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    }
    let replaced = false;
    lines = lines.map(line => {
      if (line.trim().startsWith("GEMINI_API_KEY=")) {
        replaced = true;
        return `GEMINI_API_KEY=${key}`;
      }
      return line;
    });
    if (!replaced) {
      lines.push(`GEMINI_API_KEY=${key}`);
    }
    fs.writeFileSync(envPath, lines.filter(l => l !== undefined).join("\n").trim() + "\n", "utf8");

    console.log("✅ [Auth] Gemini API Key securely saved and activated in memory and local .env");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Gemini API Key activated for Imagen 3!" }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function renderStoryboardMovie(req, res) {
  try {
    const body = await parseJsonBody(req);
    const storyboard = body.storyboard;
    if (!storyboard || !storyboard.scenes) throw new Error("No storyboard scenes provided");

    fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

    console.log(`[Dashboard] Rendering Master Movie for "${storyboard.title}"...`);
    const voiceRes = await generateVoice(storyboard.narration || "", "cartoon-narration.wav", {
      language: body.language || storyboard.language || "telugu"
    });
    const audioPath = voiceRes.audioPath;
    const voiceDuration = voiceRes.duration;

    // Calculate dynamic duration based on scenes and narration audio
    const rawDuration = storyboard.scenes.reduce((sum, s) => sum + (parseFloat(s.duration) || 2.5), 0) || 10.0;
    const movieDuration = Math.min(180.0, Math.max(4.0, voiceDuration || rawDuration));

    const aspectRatio = body.aspectRatio || body.format || "9:16";
    const adjustments = body.adjustments || {};
    const stitchedVideo = renderMultiSceneStoryboard(storyboard.scenes, movieDuration, aspectRatio, adjustments);

    let bgmPath = null;
    if (fs.existsSync(assetsDir)) {
      const aFiles = fs.readdirSync(assetsDir);
      for (const f of aFiles) {
        const l = f.toLowerCase();
        if (l.startsWith("bgm") || l.startsWith("music") || l.startsWith("soundtrack") || l.startsWith("audio")) {
          bgmPath = path.join(assetsDir, f);
          break;
        }
      }
    }

    const subOptions = {
      showCaptions: body.showCaptions !== false && body.useCaptions !== false,
      position: body.position || "bottom",
      font: adjustments.font || body.font || "Impact",
      color: adjustments.textColor || body.color || "yellow",
      fontSize: parseInt(adjustments.fontSize || body.fontSize, 10) || 54,
      useBox: body.useBox !== false,
      bgmPath,
      bgmVolume: parseFloat(body.bgmVolume || adjustments.bgmVolume) || 0.18
    };

    const finalVideo = mergeAudioAndSubtitles(stitchedVideo, audioPath, storyboard.subtitles, movieDuration, "final-cartoon-short.mp4", subOptions);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, path: finalVideo, duration: movieDuration }));
  } catch (err) {
    console.error("[Dashboard] Storyboard rendering failed:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function startRenderJobController(req, res) {
  try {
    const body = await parseJsonBody(req);
    const job = createRenderJob(body);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, jobId: job.id, job }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function getRenderJobStatusController(req, res, parsedUrl) {
  try {
    const jobId = (parsedUrl && parsedUrl.query && parsedUrl.query.jobId) || req.headers["x-job-id"];
    if (!jobId) throw new Error("Missing jobId parameter");
    const job = getRenderJob(jobId);
    if (!job) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Job not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, job }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function cancelRenderJobController(req, res) {
  try {
    const body = await parseJsonBody(req);
    const jobId = body.jobId;
    const cancelled = cancelRenderJob(jobId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, cancelled }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

function streamVideo(req, res) {
  let videoFile = path.join(videosDir, "final-cartoon-short.mp4");
  if (!fs.existsSync(videoFile)) {
    videoFile = path.join(outputDir, "final-cartoon-short.mp4");
  }

  if (!fs.existsSync(videoFile)) {
    res.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store, no-cache" });
    res.end("Video not found. Please render first.");
    return;
  }

  const stat = fs.statSync(videoFile);
  const total = stat.size;

  if (req.headers.range) {
    const range = req.headers.range;
    const parts = range.replace(/bytes=/, "").split("-");
    const partialstart = parts[0];
    const partialend = parts[1];
    const start = parseInt(partialstart, 10);
    const end = partialend ? parseInt(partialend, 10) : total - 1;
    const chunksize = (end - start) + 1;

    const file = fs.createReadStream(videoFile, { start, end });
    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    file.pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Length": total,
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
  });
  fs.createReadStream(videoFile).pipe(res);
}

async function publishToYouTube(req, res) {
  try {
    const body = await parseJsonBody(req);
    const result = await uploadToYouTube(null, body);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, videoId: result.id }));
  } catch (err) {
    let errMsg = err.message || "Upload failed";
    if (errMsg.includes("invalid_grant") || err.response?.data?.error === "invalid_grant") {
      errMsg = "YouTube OAuth token has expired. Please re-authorize via the 'Connect YouTube' button or run 'npm run auth'.";
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: errMsg }));
  }
}

function startAuth(req, res) {
  if (!fs.existsSync(credentialsPath)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("client_secret.json missing");
    return;
  }
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  const config = credentials.installed || credentials.web;
  const oauth2Client = new google.auth.OAuth2(config.client_id, config.client_secret, `http://localhost:${port}/oauth2callback`);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly"
    ]
  });

  res.writeHead(302, { Location: authUrl });
  res.end();
}

async function oauthCallback(req, res, parsedUrl) {
  const code = parsedUrl.query.code;
  const error = parsedUrl.query.error;

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization canceled or failed</h2><p>${error || "No code"}</p>`);
    return;
  }

  try {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const config = credentials.installed || credentials.web;
    const oauth2Client = new google.auth.OAuth2(config.client_id, config.client_secret, `http://localhost:${port}/oauth2callback`);

    const { tokens } = await oauth2Client.getToken(code);
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <div style="font-family:sans-serif; text-align:center; padding: 40px; background:#0E1B2D; color:#E9F0F5; min-height:100vh;">
        <h2 style="color:#FF693D;">🎉 YouTube Authorization Successful!</h2>
        <p>Your channel is now connected to ToonCraft AI Studio.</p>
        <p>You can close this tab and return to the dashboard.</p>
        <script>setTimeout(() => window.close(), 2500);</script>
      </div>
    `);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization Error:</h2><p>${err.message}</p>`);
  }
}

async function generateNarrationAudio(req, res) {
  try {
    const body = await parseJsonBody(req);
    const narration = (body.narration || "").trim();
    if (!narration) throw new Error("Narration text is required");
    const { audioPath, duration, language } = await generateVoice(narration, "cartoon-narration.wav", body);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      audioUrl: `/storage/audio/cartoon-narration.wav?_t=${Date.now()}`,
      duration,
      language
    }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

function getVoices(req, res, parsedUrl) {
  const lang = (parsedUrl && parsedUrl.query && parsedUrl.query.lang) || "telugu";
  const voices = getCatalogForLanguage(lang);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    success: true,
    language: lang,
    voices,
    total: voices.length,
    note: voices.length < 10 ? `Showing all ${voices.length} authentic configured voices for ${lang}.` : undefined
  }));
}

function getProjects(req, res) {
  try {
    let projects = projectService.listProjects();
    if (!projects || projects.length === 0) {
      // Fallback to projects.json if SQLite hasn't been migrated yet
      const projPath = path.join(storageDir, "projects.json");
      if (fs.existsSync(projPath)) {
        try { projects = JSON.parse(fs.readFileSync(projPath, "utf8")); } catch (_) {}
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, projects }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

function getProjectByIdController(req, res, parsedUrl) {
  try {
    const projectId = (parsedUrl && parsedUrl.query && parsedUrl.query.id) || req.headers["x-project-id"];
    if (!projectId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing project id" }));
      return;
    }
    const project = projectService.getProjectById(projectId);
    if (!project) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Project not found" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, project }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function saveProject(req, res) {
  try {
    const body = await parseJsonBody(req);
    const newProj = {
      id: body.id || `proj_${Date.now()}`,
      name: body.name || body.title || "Untitled Video Project",
      title: body.title || body.name || "Untitled Video Project",
      category: body.category || "Animation",
      characterStyle: body.characterStyle || "realistic",
      format: body.format || body.aspectRatio || "9:16",
      duration: body.duration ? `${body.duration}${body.durationUnit || 's'}` : "20s",
      createdDate: new Date().toISOString().split("T")[0],
      videoStatus: body.videoStatus || "Ready",
      thumbnail: body.thumbnail || "/assets/scene1.png",
      uploadStatus: body.uploadStatus || "Ready to Publish",
      storyboard: body.storyboard || null
    };

    // Save in SQLite (Primary Source of Truth)
    projectService.upsertProject(newProj);
    if (newProj.storyboard && typeof newProj.storyboard === "object") {
      projectService.saveProjectStoryboard(newProj.id, newProj.storyboard);
    }

    // Mirror to projects.json for backward compatibility
    const projPath = path.join(storageDir, "projects.json");
    let projects = [];
    if (fs.existsSync(projPath)) {
      try { projects = JSON.parse(fs.readFileSync(projPath, "utf8")); } catch (_) {}
    }
    const existingIdx = projects.findIndex(p => p.id === newProj.id);
    if (existingIdx >= 0) {
      projects[existingIdx] = { ...projects[existingIdx], ...newProj };
    } else {
      projects.unshift(newProj);
    }
    try {
      fs.writeFileSync(projPath, JSON.stringify(projects.slice(0, 30), null, 2), "utf8");
    } catch (_) {}

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, project: newProj }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function deleteProject(req, res) {
  try {
    const body = await parseJsonBody(req);
    const id = body.id;
    if (!id) throw new Error("Project id is required");

    // Delete in SQLite and remove isolated project directory
    projectService.deleteProjectById(id);

    // Mirror to projects.json
    const projPath = path.join(storageDir, "projects.json");
    let projects = [];
    if (fs.existsSync(projPath)) {
      try { projects = JSON.parse(fs.readFileSync(projPath, "utf8")); } catch (_) {}
    }
    projects = projects.filter(p => p.id !== id);
    try {
      fs.writeFileSync(projPath, JSON.stringify(projects, null, 2), "utf8");
    } catch (_) {}

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

/**
 * Get active AI Video Provider configurations (zero credential leakage)
 */
function getVideoProvidersController(req, res) {
  try {
    const providers = aiVideoManager.getProviderStatus();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, providers }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

/**
 * Trigger hybrid multi-engine AI & FFmpeg render job
 */
async function renderHybridMovieController(req, res) {
  try {
    const body = await parseJsonBody(req);
    const projectId = body.projectId || (body.storyboard && body.storyboard.projectId);
    if (!projectId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing required projectId" }));
      return;
    }

    const job = createRenderJob({
      ...body,
      projectId,
      useHybrid: true
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, jobId: job.id, job }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

/**
 * Calculate phonetic visemes and amplitude envelope for lip-sync
 */
async function getLipSyncVisemesController(req, res, parsedUrl = null) {
  try {
    let body = {};
    if (req.method === "GET") {
      body = (parsedUrl && parsedUrl.query) ? parsedUrl.query : {};
    } else {
      body = await parseJsonBody(req);
    }
    const { text, wavFilename, projectId } = body;
    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing text parameter" }));
      return;
    }

    let audioPath = null;
    if (projectId && wavFilename) {
      audioPath = projectService.getProjectAssetPath(projectId, "audio", wavFilename);
    } else if (wavFilename) {
      audioPath = path.join(storageDir, "audio", wavFilename);
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      audioPath = path.join(storageDir, "audio", "cartoon-narration.wav");
    }

    if (!fs.existsSync(audioPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Audio WAV file not found for lip-sync analysis" }));
      return;
    }

    const visemes = generateLipSyncVisemes(text, audioPath);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, visemes }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

/**
 * Generates an Image-to-Video animated clip for an individual scene
 * using Google Veo 3.1 with cascading fallback
 */
async function generateSceneVideoController(req, res) {
  try {
    const body = await parseJsonBody(req);
    const sceneNumber = parseInt(body.sceneNumber || body.sceneIndex, 10);
    if (isNaN(sceneNumber) || sceneNumber < 1 || sceneNumber > 1000) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid scene number (must be integer between 1 and 1000)" }));
      return;
    }

    const projectId = String(body.projectId || "proj_default").replace(/[^a-zA-Z0-9_-]/g, "");
    const dirs = projectService.getProjectDirs(projectId);
    const duration = Math.min(15, Math.max(2, parseFloat(body.duration) || 5.0));
    const aspectRatio = body.aspectRatio || "9:16";
    const preferredProvider = body.preferredProvider || body.provider || "veo";
    const prompt = body.prompt || body.scenePrompt || body.storyBeat || `Scene ${sceneNumber} cinematic animation`;
    const cameraMotion = body.cameraMotion || body.cameraDirection || "cinematic slow push";
    const characterAction = body.characterAction || "natural character animation and movement";

    // 1. Locate or generate scene input image
    let imagePath = null;
    const candidates = [
      path.join(dirs.images, `scene${sceneNumber}.png`),
      path.join(dirs.images, `scene${sceneNumber}.jpg`),
      path.join(dirs.images, `scene_${sceneNumber}.png`),
      path.join(dirs.images, `scene_${sceneNumber}.jpg`),
      path.join(storageDir, "images", `scene${sceneNumber}.png`),
      path.join(storageDir, "images", `scene${sceneNumber}.jpg`),
      path.join(assetsDir, `scene${sceneNumber}.png`),
      path.join(assetsDir, `scene${sceneNumber}.jpg`)
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        imagePath = c;
        break;
      }
    }

    // If no scene image exists yet, generate it first using Nano Banana 2
    if (!imagePath) {
      console.log(`[Scene ${sceneNumber}] Image not found. Auto-generating image via Nano Banana 2 first...`);
      const { generateImageForScene } = require("../services/imageGenerator");
      const imgRes = await generateImageForScene(sceneNumber, prompt, null, body.characterStyle || "stylized", "", body.category || "Animation", "", projectId);
      imagePath = path.join(dirs.images, `scene${sceneNumber}.png`);
      if (!fs.existsSync(imagePath)) {
        imagePath = path.join(storageDir, "images", `scene${sceneNumber}.png`);
      }
    }

    const clipFileName = `scene_${sceneNumber}_clip.mp4`;
    const outputClipPath = path.join(dirs.videos, clipFileName);
    const legacyVideoPath = path.join(videosDir, clipFileName);

    // Fallback callback for organic FFmpeg 2.5D animation
    const fallbackCallback = async (opts) => {
      const { buildCinematicFilterChain } = require("../services/cinematicCamera");
      const { execFfmpeg } = require("../utils/ffmpegHelper");
      const dynamicFilter = buildCinematicFilterChain({
        cameraMotion: opts.cameraMotion || "dramatic_zoom_in",
        characterAnchor: "hero_center",
        duration: opts.duration,
        aspectRatio: opts.aspectRatio,
        adjustments: {}
      });
      execFfmpeg([
        "-framerate", "30",
        "-loop", "1",
        "-t", `${opts.duration}`,
        "-i", opts.imagePath,
        "-vf", dynamicFilter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        "-video_track_timescale", "30000",
        "-y", opts.outputPath
      ]);
      return {
        outputPath: opts.outputPath,
        duration: opts.duration,
        provider: "ffmpeg_cinematic"
      };
    };

    console.log(`🎥 [Scene ${sceneNumber}] Generating video clip (Provider: ${preferredProvider}, Duration: ${duration}s)...`);
    const genResult = await aiVideoManager.generateClipWithFallback({
      prompt,
      imagePath,
      duration,
      cameraMotion,
      characterAction,
      aspectRatio,
      outputPath: outputClipPath,
      preferredProvider,
      fallbackCallback
    });

    // Copy to legacy videos directory for unified web access
    try {
      fs.copyFileSync(outputClipPath, legacyVideoPath);
    } catch (_) { }

    // Update SQLite database scene record
    try {
      projectService.updateSceneMedia(projectId, sceneNumber, {
        videoClipPath: outputClipPath,
        status: "video_ready"
      });
    } catch (dbErr) {
      console.warn(`[Scene ${sceneNumber}] Note on SQLite scene update:`, dbErr.message);
    }

    const isAi = !genResult.fallbackUsed && (genResult.provider === "veo" || genResult.provider === "runway" || genResult.provider === "pika");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      sceneNumber,
      projectId,
      videoClipPath: outputClipPath,
      videoUrl: `/storage/videos/${clipFileName}`,
      projectVideoUrl: `/storage/projects/${projectId}/videos/${clipFileName}`,
      duration: genResult.duration || duration,
      provider: genResult.provider,
      isAiGenerated: isAi,
      fallbackUsed: !!genResult.fallbackUsed,
      engine: genResult.provider === "veo" ? "Google Veo 3.1" : (genResult.fallbackUsed ? "FFmpeg 2.5D Organic Engine" : genResult.provider)
    }));
  } catch (err) {
    console.error("[generateSceneVideoController] Error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

/**
 * Generates video clips for all scenes in the storyboard
 */
async function generateAllSceneVideosController(req, res) {
  try {
    const body = await parseJsonBody(req);
    const scenes = body.scenes || [];
    const projectId = String(body.projectId || "proj_default").replace(/[^a-zA-Z0-9_-]/g, "");
    const preferredProvider = body.preferredProvider || body.provider || "veo";

    if (!Array.isArray(scenes) || scenes.length === 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "scenes must be a non-empty array" }));
      return;
    }

    console.log(`🎬 [Batch Video] Generating video clips for ${scenes.length} scenes (Provider: ${preferredProvider})...`);
    const results = [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const sceneNum = parseInt(sc.sceneNumber || (i + 1), 10);
      const prompt = sc.pixarPrompt || sc.storyBeat || sc.prompt || `Scene ${sceneNum}`;
      const cameraMotion = sc.cameraMotion || sc.cameraDirection || sc.motion_effect || "cinematic slow push";
      const characterAction = sc.characterAction || sc.character_action || "natural character animation";
      const duration = parseFloat(sc.duration) || 5.0;

      // Small pause between calls to respect external rate limits
      if (i > 0) {
        await new Promise(r => setTimeout(r, 1000));
      }

      try {
        const dirs = projectService.getProjectDirs(projectId);
        const clipFileName = `scene_${sceneNum}_clip.mp4`;
        const outputClipPath = path.join(dirs.videos, clipFileName);
        const legacyVideoPath = path.join(videosDir, clipFileName);

        let imagePath = null;
        const candidates = [
          path.join(dirs.images, `scene${sceneNum}.png`),
          path.join(dirs.images, `scene${sceneNum}.jpg`),
          path.join(storageDir, "images", `scene${sceneNum}.png`),
          path.join(assetsDir, `scene${sceneNum}.png`)
        ];
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            imagePath = c;
            break;
          }
        }

        if (!imagePath) {
          const { generateImageForScene } = require("../services/imageGenerator");
          await generateImageForScene(sceneNum, prompt, null, "stylized", "", "Animation", "", projectId);
          imagePath = path.join(dirs.images, `scene${sceneNum}.png`);
        }

        const fallbackCallback = async (opts) => {
          const { buildCinematicFilterChain } = require("../services/cinematicCamera");
          const { execFfmpeg } = require("../utils/ffmpegHelper");
          const dynamicFilter = buildCinematicFilterChain({
            cameraMotion: opts.cameraMotion || "dramatic_zoom_in",
            characterAnchor: "hero_center",
            duration: opts.duration,
            aspectRatio: opts.aspectRatio,
            adjustments: {}
          });
          execFfmpeg([
            "-framerate", "30",
            "-loop", "1",
            "-t", `${opts.duration}`,
            "-i", opts.imagePath,
            "-vf", dynamicFilter,
            "-c:v", "libx264",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            "-video_track_timescale", "30000",
            "-y", opts.outputPath
          ]);
          return { outputPath: opts.outputPath, duration: opts.duration, provider: "ffmpeg_cinematic" };
        };

        const genResult = await aiVideoManager.generateClipWithFallback({
          prompt,
          imagePath,
          duration,
          cameraMotion,
          characterAction,
          aspectRatio: "9:16",
          outputPath: outputClipPath,
          preferredProvider,
          fallbackCallback
        });

        try { fs.copyFileSync(outputClipPath, legacyVideoPath); } catch (_) { }

        projectService.updateSceneMedia(projectId, sceneNum, {
          videoClipPath: outputClipPath,
          status: "video_ready"
        });

        const isAi = !genResult.fallbackUsed && (genResult.provider === "veo" || genResult.provider === "runway" || genResult.provider === "pika");

        results.push({
          success: true,
          sceneNumber: sceneNum,
          videoClipPath: outputClipPath,
          videoUrl: `/storage/videos/${clipFileName}`,
          duration: genResult.duration || duration,
          provider: genResult.provider,
          isAiGenerated: isAi,
          fallbackUsed: !!genResult.fallbackUsed,
          engine: genResult.provider === "veo" ? "Google Veo 3.1" : (genResult.fallbackUsed ? "FFmpeg 2.5D Organic Engine" : genResult.provider)
        });
      } catch (err) {
        results.push({
          success: false,
          sceneNumber: sceneNum,
          error: err.message
        });
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, count: results.length, results }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

/**
 * Checks if a scene has a generated video clip and returns its metadata
 */
function getSceneVideoStatusController(req, res, parsedUrl) {
  try {
    const sceneNumber = parseInt(parsedUrl.query?.sceneNumber || "1", 10);
    const projectId = String(parsedUrl.query?.projectId || "proj_default").replace(/[^a-zA-Z0-9_-]/g, "");
    const dirs = projectService.getProjectDirs(projectId);
    const clipFileName = `scene_${sceneNumber}_clip.mp4`;
    const projectClip = path.join(dirs.videos, clipFileName);
    const legacyClip = path.join(videosDir, clipFileName);

    let exists = false;
    let clipPath = null;
    let mtime = null;

    if (fs.existsSync(projectClip)) {
      exists = true;
      clipPath = projectClip;
      mtime = fs.statSync(projectClip).mtime;
    } else if ((!projectId || projectId === "proj_default") && fs.existsSync(legacyClip)) {
      exists = true;
      clipPath = legacyClip;
      mtime = fs.statSync(legacyClip).mtime;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      sceneNumber,
      exists,
      videoUrl: exists ? `/storage/videos/${clipFileName}` : null,
      mtime
    }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

module.exports = {
  getStatus,
  saveApiKey,
  renderStoryboardMovie,
  startRenderJobController,
  getRenderJobStatusController,
  cancelRenderJobController,
  streamVideo,
  publishToYouTube,
  startAuth,
  oauthCallback,
  generateNarrationAudio,
  getVoices,
  getProjects,
  getProjectByIdController,
  saveProject,
  deleteProject,
  getVideoProvidersController,
  renderHybridMovieController,
  getLipSyncVisemesController,
  generateSceneVideoController,
  generateAllSceneVideosController,
  getSceneVideoStatusController
};
