const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { google } = require("googleapis");
const { outputDir, ensureOutputDir, credentialsPath, tokenPath } = require("./config");
const { generateStoryWithGemini, generateStoryboardWithGemini, generateStoryboardFromNarration } = require("./gemini-service");
const { generateImageForScene, generateAllSceneImages } = require("./image-service");
const { generateVoice } = require("./voice-service");
const { generateCartoonVideo } = require("./video-generator");
const { mergeAudioAndSubtitles } = require("./subtitles-merger");
const { renderMultiSceneStoryboard, findSceneMedia } = require("./storyboard-engine");
const { generateVideoWithReplicate, getFreeAiVideoTools } = require("./ai-video-service");
const { uploadToYouTube } = require("./upload-youtube");

const PORT = process.env.PORT || 4000;
const assetsDir = path.join(__dirname, "assets");
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

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
      if (match) {
        key = `scene${match[1]}`;
      }
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set anti-caching headers on EVERY response to eliminate browser caching issues completely
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  // Static Frontend Files
  if (pathname === "/" || pathname === "/index.html") {
    const htmlPath = path.join(__dirname, "public", "index.html");
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  // Serve static assets from assets/ with anti-caching & proper streaming
  if (pathname.startsWith("/assets/")) {
    const assetFile = path.join(assetsDir, path.basename(pathname));
    if (fs.existsSync(assetFile)) {
      const ext = path.extname(assetFile).toLowerCase();
      const mimeTypes = {
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
        ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime"
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";
      const stat = fs.statSync(assetFile);
      const total = stat.size;

      // Handle video range requests for smooth scrubbing/looping
      if (req.headers.range && contentType.startsWith("video/")) {
        const range = req.headers.range;
        const parts = range.replace(/bytes=/, "").split("-");
        const partialstart = parts[0];
        const partialend = parts[1];
        const start = parseInt(partialstart, 10);
        const end = partialend ? parseInt(partialend, 10) : total - 1;
        const chunksize = (end - start) + 1;

        const file = fs.createReadStream(assetFile, { start, end });
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
          "Cache-Control": "no-store, no-cache, must-revalidate"
        });
        file.pipe(res);
        return;
      }

      res.writeHead(200, {
        "Content-Length": total,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      });
      fs.createReadStream(assetFile).pipe(res);
      return;
    }
  }

  // API: Status
  if (pathname === "/api/status" && method === "GET") {
    let youtubeAuthorized = false;
    let channelTitle = null;

    if (fs.existsSync(credentialsPath) && fs.existsSync(tokenPath)) {
      try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
        const config = credentials.installed || credentials.web;
        const tokens = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
        const auth = new google.auth.OAuth2(config.client_id, config.client_secret, `http://localhost:${PORT}/oauth2callback`);
        auth.setCredentials(tokens);

        const yt = google.youtube({ version: "v3", auth });
        const chRes = await yt.channels.list({ part: ["snippet"], mine: true });
        if (chRes.data.items && chRes.data.items.length > 0) {
          youtubeAuthorized = true;
          channelTitle = chRes.data.items[0].snippet.title;
        }
      } catch (e) {
        youtubeAuthorized = false;
      }
    }

    const assets = getExistingAssets();
    const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ youtubeAuthorized, channelTitle, assets, hasGeminiKey }));
    return;
  }

  // API: Save Gemini API Key
  if (pathname === "/api/save-api-key" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const key = (body.apiKey || "").trim();
      if (!key) throw new Error("API Key cannot be empty");

      process.env.GEMINI_API_KEY = key;
      require("./config").geminiApiKey = key;

      // Persist to .env file
      const envPath = path.join(__dirname, ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf8");
      }
      if (envContent.includes("GEMINI_API_KEY=")) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${key}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${key}\n`;
      }
      fs.writeFileSync(envPath, envContent.trim() + "\n", "utf8");

      console.log("✅ [Auth] Gemini API Key saved and activated for Imagen 3!");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Gemini API Key activated for Imagen 3!" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Get Current Story
  if (pathname === "/api/story" && method === "GET") {
    const storyFile = path.join(outputDir, "generated-story.json");
    if (fs.existsSync(storyFile)) {
      const story = JSON.parse(fs.readFileSync(storyFile, "utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ story }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ story: null }));
    return;
  }

  // API: Get Current Storyboard
  if (pathname === "/api/storyboard" && method === "GET") {
    const sbFile = path.join(outputDir, "generated-storyboard.json");
    if (fs.existsSync(sbFile)) {
      try {
        const storyboard = JSON.parse(fs.readFileSync(sbFile, "utf8"));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ storyboard }));
        return;
      } catch (_) {}
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ storyboard: null }));
    return;
  }

  // API: Generate Story
  if (pathname === "/api/generate-story" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const prompt = body.prompt || "A brave man fighting with a lion in forest with full of trees";
      const story = await generateStoryWithGemini(prompt);
      ensureOutputDir();
      fs.writeFileSync(path.join(outputDir, "generated-story.json"), JSON.stringify(story, null, 2), "utf8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, story }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Generate Storyboard (from Idea Prompt OR Narration Script, with Duration and Character Style support)
  if (pathname === "/api/generate-storyboard" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const duration = Math.min(20, Math.max(5, parseInt(body.duration, 10) || 10));
      const characterStyle = body.characterStyle || "stylized";
      let storyboard;
      if (body.narration && body.narration.trim().length > 0) {
        storyboard = await generateStoryboardFromNarration(body.narration.trim(), duration, characterStyle);
      } else {
        const prompt = body.prompt || "A playful baby panda exploring the bamboo mountains";
        storyboard = await generateStoryboardWithGemini(prompt, duration, characterStyle);
      }
      ensureOutputDir();
      fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, storyboard }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Auto-Generate Scenes specifically from Step 2 Narration Script
  if (pathname === "/api/generate-from-narration" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const narration = (body.narration || "").trim();
      const duration = Math.min(20, Math.max(5, parseInt(body.duration, 10) || 10));
      const characterStyle = body.characterStyle || "stylized";
      if (!narration) throw new Error("No narration text provided");

      console.log(`[Dashboard] Auto-generating scenes from narration script (${duration}s max duration, style: ${characterStyle})...`);
      const storyboard = await generateStoryboardFromNarration(narration, duration, characterStyle);
      ensureOutputDir();
      fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, storyboard }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Auto-Generate Image for a Single Scene
  if (pathname === "/api/generate-scene-image" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { sceneNumber, prompt, apiKey, characterStyle } = body;
      const result = await generateImageForScene(sceneNumber, prompt, apiKey, characterStyle || "stylized");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Auto-Generate All Scene Images
  if (pathname === "/api/generate-all-images" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { scenes, apiKey, characterStyle } = body;
      if (!Array.isArray(scenes)) throw new Error("scenes must be an array");
      const results = await generateAllSceneImages(scenes, apiKey, characterStyle || "stylized");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, results }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Upload Scene Media (Accepts BOTH Videos [.mp4, .webm, .mov] AND Images [.png, .jpg])
  if (pathname === "/api/upload-scene" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { sceneNumber, filename, data } = body;
      const ext = (path.extname(filename || ".png") || ".png").toLowerCase();
      const saveName = `scene${sceneNumber}${ext}`;
      const savePath = path.join(assetsDir, saveName);

      // Clean old scene files of the same number regardless of extension
      const files = fs.readdirSync(assetsDir);
      for (const f of files) {
        const lower = f.toLowerCase();
        if (lower.startsWith(`scene${sceneNumber}.`) || lower.startsWith(`scene${sceneNumber}_`)) {
          try { fs.unlinkSync(path.join(assetsDir, f)); } catch (_) {}
        }
      }

      const base64Content = data.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(savePath, Buffer.from(base64Content, "base64"));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, filename: saveName }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Delete Scene Media
  if (pathname === "/api/delete-scene" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { sceneNumber } = body;
      const files = fs.readdirSync(assetsDir);
      for (const f of files) {
        const lower = f.toLowerCase();
        if (lower.startsWith(`scene${sceneNumber}.`) || lower.startsWith(`scene${sceneNumber}_`)) {
          try { fs.unlinkSync(path.join(assetsDir, f)); } catch (_) {}
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Load Reference 3D Pixar Sample Clips (Apple vs Carrot Food Fight)
  if (pathname === "/api/load-sample-scenes" && method === "POST") {
    try {
      const samples = [
        { src: "sample_scene1.mp4", dest: "scene1.mp4" },
        { src: "sample_scene2.mp4", dest: "scene2.mp4" },
        { src: "sample_scene3.mp4", dest: "scene3.mp4" }
      ];

      for (const s of samples) {
        const srcPath = path.join(assetsDir, s.src);
        if (fs.existsSync(srcPath)) {
          const files = fs.readdirSync(assetsDir);
          for (const f of files) {
            const l = f.toLowerCase();
            if (l.startsWith(s.dest.replace(".mp4", "."))) {
              try { fs.unlinkSync(path.join(assetsDir, f)); } catch (_) {}
            }
          }
          fs.copyFileSync(srcPath, path.join(assetsDir, s.dest));
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "Reference 3D Pixar video clips loaded into Scene 1, Scene 2, and Scene 3!" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Generate AI Video Clip
  if (pathname === "/api/generate-ai-video" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { sceneNumber, prompt, apiToken } = body;
      const token = apiToken || process.env.REPLICATE_API_TOKEN;

      if (!token) {
        const tools = getFreeAiVideoTools(prompt);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: false,
          needsToken: true,
          message: "No API token detected. Use the free AI tools below or upload your video clip directly!",
          tools
        }));
        return;
      }

      const media = findSceneMedia(sceneNumber);
      let imgBase64 = "";
      if (media && media.type === "image") {
        imgBase64 = fs.readFileSync(media.path).toString("base64");
      }

      const result = await generateVideoWithReplicate(token, prompt, imgBase64, sceneNumber);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Render 3D Pixar Multi-Scene Master Movie
  if (pathname === "/api/render-storyboard" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const storyboard = body.storyboard;
      if (!storyboard || !storyboard.scenes) throw new Error("No storyboard scenes provided");

      ensureOutputDir();
      fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

      console.log(`[Dashboard] Rendering Master Movie for "${storyboard.title}"...`);
      const { audioPath } = generateVoice(storyboard.narration, "cartoon-narration.wav");

      // Calculate master video duration from storyboard scenes (MAXIMUM 20.0s strictly enforced)
      const rawDuration = storyboard.scenes.reduce((sum, s) => sum + (parseFloat(s.duration) || 2.5), 0) || 10.0;
      const movieDuration = Math.min(20.0, Math.max(4.0, rawDuration));

      // Auto-generate scene images if any scene is missing an image
      const characterStyle = storyboard.characterStyle || body.characterStyle || "stylized";
      console.log(`[Dashboard] Verifying all scene images exist for "${storyboard.title}" (Style: ${characterStyle})...`);
      for (let i = 0; i < storyboard.scenes.length; i++) {
        const sc = storyboard.scenes[i];
        const sceneNum = sc.sceneNumber || (i + 1);
        const media = findSceneMedia(sceneNum);
        if (!media) {
          console.log(`🎨 [Render] Auto-generating missing image for Scene ${sceneNum}...`);
          const prompt = sc.pixarPrompt || sc.title || `Scene ${sceneNum}`;
          await generateImageForScene(sceneNum, prompt, null, characterStyle);
        }
      }

      // Render stitched video (seamlessly handles real 3D video clips or dynamic character motion)
      const stitchedVideo = renderMultiSceneStoryboard(storyboard.scenes, movieDuration);

      // Check for custom background music
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
        font: body.font || "Impact",
        color: body.color || "yellow",
        fontSize: parseInt(body.fontSize, 10) || 54,
        useBox: body.useBox !== false,
        bgmPath,
        bgmVolume: parseFloat(body.bgmVolume) || 0.18
      };

      const finalVideo = mergeAudioAndSubtitles(stitchedVideo, audioPath, storyboard.subtitles, movieDuration, "final-cartoon-short.mp4", subOptions);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, path: finalVideo, duration: movieDuration }));
    } catch (err) {
      console.error("[Dashboard] Storyboard rendering failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Upload Custom Asset (Background, Character 1, Character 2, Soundtrack)
  if (pathname === "/api/upload-asset" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { type, filename, data } = body;
      const ext = path.extname(filename || "image.png") || ".png";
      const saveName = `${type}${ext}`;
      const savePath = path.join(assetsDir, saveName);

      // Clean existing of same type
      const files = fs.readdirSync(assetsDir);
      for (const f of files) {
        if (f.toLowerCase().startsWith(type)) {
          try { fs.unlinkSync(path.join(assetsDir, f)); } catch (_) {}
        }
      }

      const base64Content = data.replace(/^data:[^;]+;base64,/, "");
      fs.writeFileSync(savePath, Buffer.from(base64Content, "base64"));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, filename: saveName }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Delete Custom Asset
  if (pathname === "/api/delete-asset" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const { type } = body;
      const files = fs.readdirSync(assetsDir);
      for (const f of files) {
        if (f.toLowerCase().startsWith(type)) {
          try { fs.unlinkSync(path.join(assetsDir, f)); } catch (_) {}
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Render Classic Single-Scene Video
  if (pathname === "/api/render" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const story = body.story;
      if (!story) throw new Error("No story data provided");

      ensureOutputDir();
      fs.writeFileSync(path.join(outputDir, "generated-story.json"), JSON.stringify(story, null, 2), "utf8");

      console.log(`[Dashboard] Generating Voice for "${story.headline}"...`);
      const { audioPath, duration } = generateVoice(story.narration, "cartoon-narration.wav");

      console.log(`[Dashboard] Generating Visual Animation (${duration}s)...`);
      const rawVideo = generateCartoonVideo(story, duration, "raw-cartoon-visuals.mp4");

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
        font: body.font || "Impact",
        color: body.color || "yellow",
        fontSize: parseInt(body.fontSize, 10) || 54,
        useBox: body.useBox !== false,
        bgmPath,
        bgmVolume: parseFloat(body.bgmVolume) || 0.18
      };

      console.log("[Dashboard] Merging Audio, Subtitles & Background Music...");
      const finalVideo = mergeAudioAndSubtitles(rawVideo, audioPath, story.subtitles, duration, "final-cartoon-short.mp4", subOptions);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, path: finalVideo, duration }));
    } catch (err) {
      console.error("[Dashboard] Video rendering failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // API: Stream Video (with strict anti-caching)
  if (pathname === "/api/video") {
    const videoFile = path.join(outputDir, "final-cartoon-short.mp4");
    if (!fs.existsSync(videoFile)) {
      res.writeHead(404, {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      });
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
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0"
    });
    fs.createReadStream(videoFile).pipe(res);
    return;
  }

  // API: Publish to YouTube
  if (pathname === "/api/upload-youtube" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const result = await uploadToYouTube(null, body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, videoId: result.id }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // OAuth 1-Click Connect
  if (pathname === "/auth/start") {
    if (!fs.existsSync(credentialsPath)) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("client_secret.json missing");
      return;
    }
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const config = credentials.installed || credentials.web;
    const oauth2Client = new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      `http://localhost:${PORT}/oauth2callback`
    );

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
    return;
  }

  // OAuth Callback
  if (pathname === "/oauth2callback") {
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
      const oauth2Client = new google.auth.OAuth2(
        config.client_id,
        config.client_secret,
        `http://localhost:${PORT}/oauth2callback`
      );

      const { tokens } = await oauth2Client.getToken(code);
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`
        <div style="font-family:sans-serif; text-align:center; padding: 40px; background:#141418; color:#fff; min-height:100vh;">
          <h2 style="color:#22c55e;">🎉 YouTube Authorization Successful!</h2>
          <p>Your channel is now connected to the Admin Panel.</p>
          <p>You can close this tab and return to the dashboard.</p>
          <script>setTimeout(() => window.close(), 2500);</script>
        </div>
      `);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h2>Authorization Error:</h2><p>${err.message}</p>`);
    }
    return;
  }

  // Fallback 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log("==================================================");
  console.log("   🚀 YOUTUBE CARTOON AGENT - ADMIN PANEL         ");
  console.log("==================================================");
  console.log(`🌐 Dashboard running at: http://localhost:${PORT}`);
  console.log("👉 Open http://localhost:4000 in your browser!");
  console.log("==================================================");
});
