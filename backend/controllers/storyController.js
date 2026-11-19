const fs = require("fs");
const path = require("path");
const { outputDir } = require("../config");
const { parseJsonBody } = require("../utils/ffmpegHelper");
const projectService = require("../services/projectService");
const {
  generateStoryWithGemini,
  generateStoryboardWithGemini,
  generateStoryboardFromNarration
} = require("../services/storyGenerator");

async function getStory(req, res) {
  const storyFile = path.join(outputDir, "generated-story.json");
  if (fs.existsSync(storyFile)) {
    try {
      const story = JSON.parse(fs.readFileSync(storyFile, "utf8"));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ story }));
      return;
    } catch (_) {}
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ story: null }));
}

async function getStoryboard(req, res, parsedUrl) {
  const projectId = (parsedUrl && parsedUrl.query && parsedUrl.query.projectId) || req.headers["x-project-id"];
  if (projectId) {
    try {
      const proj = projectService.getProjectById(projectId);
      if (proj && proj.storyboard) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ storyboard: proj.storyboard }));
        return;
      }
    } catch (_) {}
  }

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
}

async function generateStory(req, res) {
  try {
    const body = await parseJsonBody(req);
    const prompt = body.prompt || "A brave man fighting with a lion in forest";
    const story = await generateStoryWithGemini(prompt);
    fs.writeFileSync(path.join(outputDir, "generated-story.json"), JSON.stringify(story, null, 2), "utf8");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, story }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function generateStoryboard(req, res) {
  try {
    const body = await parseJsonBody(req);
    const durationUnit = body.durationUnit || (body.duration && String(body.duration).includes("min") ? "min" : "s");
    const rawDur = parseFloat(body.duration) || 20;
    const duration = durationUnit === "min" ? Math.min(180, Math.max(1, rawDur * 60)) : Math.min(180, Math.max(5, rawDur));
    const characterStyle = body.characterStyle || "stylized";
    const category = body.category || body.storyCategory || "Animation";
    const storyTone = body.storyTone || `${category} and Cinematic`;
    let storyboard;

    if (body.narration && body.narration.trim().length > 0) {
      storyboard = await generateStoryboardFromNarration(body.narration.trim(), duration, characterStyle, storyTone, durationUnit, category);
    } else {
      const prompt = (body.prompt || "").trim() || "A captivating story of mystery and adventure";
      storyboard = await generateStoryboardWithGemini(prompt, duration, characterStyle, storyTone, durationUnit, category);
    }

    // Automatically synchronize characters for this specific story and generate their reference images
    const { syncCharactersFromStoryboard } = require("../services/characterService");
    const characters = await syncCharactersFromStoryboard(storyboard, characterStyle, category);

    fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

    if (body.projectId) {
      try {
        projectService.saveProjectStoryboard(body.projectId, storyboard);
      } catch (sbErr) {
        console.warn("Could not save storyboard to SQLite:", sbErr.message);
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, storyboard, characters }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function generateFromNarration(req, res) {
  try {
    const body = await parseJsonBody(req);
    const durationUnit = body.durationUnit || (body.duration && String(body.duration).includes("min") ? "min" : "s");
    const rawDur = parseFloat(body.duration) || 20;
    const duration = durationUnit === "min" ? Math.min(180, Math.max(1, rawDur * 60)) : Math.min(180, Math.max(5, rawDur));
    const narration = (body.narration || "").trim();
    const characterStyle = body.characterStyle || "stylized";
    const category = body.category || body.storyCategory || "Animation";
    const storyTone = body.storyTone || `${category} and Cinematic`;

    if (!narration) throw new Error("No narration text provided");

    const storyboard = await generateStoryboardFromNarration(narration, duration, characterStyle, storyTone, durationUnit, category);
    
    // Automatically synchronize characters for this specific story
    const { syncCharactersFromStoryboard } = require("../services/characterService");
    const characters = await syncCharactersFromStoryboard(storyboard, characterStyle, category);

    fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

    if (body.projectId) {
      try {
        projectService.saveProjectStoryboard(body.projectId, storyboard);
      } catch (sbErr) {
        console.warn("Could not save storyboard to SQLite:", sbErr.message);
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, storyboard, characters }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function saveStoryboard(req, res) {
  try {
    const body = await parseJsonBody(req);
    const storyboard = body.storyboard || body;
    fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

    if (body.projectId) {
      try {
        projectService.saveProjectStoryboard(body.projectId, storyboard);
      } catch (sbErr) {
        console.warn("Could not save storyboard to SQLite:", sbErr.message);
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, storyboard }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

module.exports = {
  getStory,
  getStoryboard,
  generateStory,
  generateStoryboard,
  generateFromNarration,
  saveStoryboard
};
