const fs = require("fs");
const path = require("path");
const { imagesDir, assetsDir } = require("../config");
const { parseJsonBody } = require("../utils/ffmpegHelper");
const {
  generateImageForScene,
  generateAllSceneImages,
  generateCharacterReference,
  previewCharacterReplacement,
  applyCharacterReplacement,
  applyCharacterReplacementToAll
} = require("../services/imageGenerator");

const ALLOWED_MEDIA_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".mp4", ".webm", ".mov", ".mkv",
  ".mp3", ".wav", ".m4a"
]);

function isPathSafe(targetPath, baseDir) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
}

async function generateSceneImage(req, res) {
  try {
    const body = await parseJsonBody(req);
    const sceneNumber = parseInt(body.sceneNumber || body.sceneIndex, 10) || 1;
    const characterStyle = body.characterStyle || body.style || "stylized";
    const category = body.category || "Animation";
    const prompt = body.prompt || body.scene?.pixarPrompt || body.scene?.prompt || body.scene?.storyBeat || `Scene ${sceneNumber}`;
    const previousScenePrompt = body.previousScenePrompt || "";
    const characterDetails = body.characterDetails || "";

    const result = await generateImageForScene(sceneNumber, prompt, body.apiKey, characterStyle, characterDetails, category, previousScenePrompt, body.projectId);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function generateAllImages(req, res) {
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
}

async function uploadSceneMedia(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { sceneNumber, filename, data } = body;

    const sceneNum = parseInt(sceneNumber, 10);
    if (isNaN(sceneNum) || sceneNum < 1 || sceneNum > 1000) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid scene number (must be integer between 1 and 1000)" }));
      return;
    }

    const ext = (path.extname(filename || ".png") || ".png").toLowerCase();
    if (!ALLOWED_MEDIA_EXTS.has(ext)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: `Disallowed media format: ${ext}` }));
      return;
    }

    if (!data || typeof data !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Missing or invalid media data" }));
      return;
    }

    const saveName = `scene${sceneNum}${ext}`;
    const storagePath = path.join(imagesDir, saveName);
    const assetPath = path.join(assetsDir, saveName);

    if (!isPathSafe(storagePath, imagesDir) || !isPathSafe(assetPath, assetsDir)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Path traversal detected" }));
      return;
    }

    // Clean old scene files matching exact prefix
    [imagesDir, assetsDir].forEach(dir => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(f => {
        if (f.toLowerCase().startsWith(`scene${sceneNum}.`)) {
          const filePath = path.join(dir, f);
          if (isPathSafe(filePath, dir)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
          }
        }
      });
    });

    const base64Content = data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Content, "base64");
    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid or empty media buffer" }));
      return;
    }

    fs.writeFileSync(storagePath, buffer);
    try { fs.writeFileSync(assetPath, buffer); } catch (_) {}

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, filename: saveName }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function deleteSceneMedia(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { sceneNumber } = body;
    const sceneNum = parseInt(sceneNumber, 10);
    if (isNaN(sceneNum) || sceneNum < 1 || sceneNum > 1000) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid scene number" }));
      return;
    }

    [imagesDir, assetsDir].forEach(dir => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(f => {
        if (f.toLowerCase().startsWith(`scene${sceneNum}.`)) {
          const filePath = path.join(dir, f);
          if (isPathSafe(filePath, dir)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
          }
        }
      });
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function loadSampleScenes(req, res) {
  try {
    const samples = [
      { src: "sample_scene1.mp4", dest: "scene1.mp4" },
      { src: "sample_scene2.mp4", dest: "scene2.mp4" },
      { src: "sample_scene3.mp4", dest: "scene3.mp4" }
    ];

    for (const s of samples) {
      const srcPath = path.join(assetsDir, s.src);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(imagesDir, s.dest));
        fs.copyFileSync(srcPath, path.join(assetsDir, s.dest));
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Sample clips loaded!" }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function uploadCustomAsset(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { type, filename, data } = body;

    const safeType = String(type || "").trim();
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(safeType)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid asset identifier. Only alphanumeric characters, dashes, and underscores (2-64 chars) are allowed." }));
      return;
    }

    const ext = (path.extname(filename || "image.png") || ".png").toLowerCase();
    if (!ALLOWED_MEDIA_EXTS.has(ext)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: `Disallowed asset extension: ${ext}` }));
      return;
    }

    if (!data || typeof data !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Media data must be provided" }));
      return;
    }

    const saveName = `${safeType}${ext}`;
    const storagePath = path.join(imagesDir, saveName);
    const assetPath = path.join(assetsDir, saveName);

    if (!isPathSafe(storagePath, imagesDir) || !isPathSafe(assetPath, assetsDir)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Path traversal detected" }));
      return;
    }

    const base64Content = data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Content, "base64");
    if (buffer.length === 0 || buffer.length > 10 * 1024 * 1024) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid or empty asset buffer" }));
      return;
    }

    fs.writeFileSync(storagePath, buffer);
    try { fs.writeFileSync(assetPath, buffer); } catch (_) {}

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, filename: saveName }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function deleteCustomAsset(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { type } = body;

    const safeType = String(type || "").trim().toLowerCase();
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(safeType)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid asset identifier for deletion" }));
      return;
    }

    [imagesDir, assetsDir].forEach(dir => {
      if (!fs.existsSync(dir)) return;
      fs.readdirSync(dir).forEach(f => {
        const lower = f.toLowerCase();
        // Strictly match safeType with dot or exact name to prevent wiping unrelated assets
        if (lower.startsWith(safeType + ".") || lower === safeType) {
          const filePath = path.join(dir, f);
          if (isPathSafe(filePath, dir)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
          }
        }
      });
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function generateCharacterRef(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { characterName, description, characterStyle } = body;
    const result = await generateCharacterReference(characterName, description, characterStyle || "stylized");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function getCharacterRef(req, res) {
  const refPath = path.join(imagesDir, "character_ref.png");
  const assetRefPath = path.join(assetsDir, "character_ref.png");
  if (fs.existsSync(refPath) || fs.existsSync(assetRefPath)) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, url: `/assets/character_ref.png?_t=${Date.now()}` }));
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, url: null }));
}

async function handleCharacterReplacePreview(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { sceneNumber, originalCharacter, newCharacter, expression, action, characterStyle, referenceUrl } = body;
    const result = await previewCharacterReplacement(
      parseInt(sceneNumber, 10) || 1,
      originalCharacter || "",
      newCharacter || "Hero",
      expression || "Focused",
      action || "Standing",
      characterStyle || "realistic",
      referenceUrl
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function handleCharacterReplaceApply(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { sceneNumber, previewFilename, adjustments } = body;
    const result = await applyCharacterReplacement(
      parseInt(sceneNumber, 10) || 1,
      previewFilename,
      adjustments || {}
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function handleCharacterReplaceAll(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { scenes, newCharacter, characterStyle } = body;
    const results = await applyCharacterReplacementToAll(
      Array.isArray(scenes) ? scenes : [],
      newCharacter || "Hero",
      characterStyle || "realistic"
    );
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, results }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

module.exports = {
  generateSceneImage,
  generateAllImages,
  uploadSceneMedia,
  deleteSceneMedia,
  loadSampleScenes,
  uploadCustomAsset,
  deleteCustomAsset,
  generateCharacterRef,
  getCharacterRef,
  handleCharacterReplacePreview,
  handleCharacterReplaceApply,
  handleCharacterReplaceAll
};
