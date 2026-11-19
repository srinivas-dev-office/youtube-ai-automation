const {
  loadCharacters,
  upsertCharacter,
  deleteCharacterById,
  generateCharacterView,
  setPrimaryReference,
  saveUploadedCharacterPhoto,
  toggleCharacterLock,
  getProjectContext
} = require("../services/characterService");
const { parseJsonBody } = require("../utils/ffmpegHelper");

async function getCharacters(req, res, parsedUrl) {
  try {
    const projectId = (parsedUrl && parsedUrl.query && parsedUrl.query.projectId) || req.headers["x-project-id"];
    const characters = loadCharacters(projectId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, characters }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function saveCharacter(req, res) {
  try {
    const body = await parseJsonBody(req);
    const projectId = body.projectId || req.headers["x-project-id"];
    const character = upsertCharacter(body, projectId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, character }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function deleteCharacter(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { id } = body;
    if (!id) throw new Error("Character id is required");
    deleteCharacterById(id);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function generateCharacterImage(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { characterId, viewType, characterStyle, category } = body;
    if (!characterId) throw new Error("characterId is required");

    const result = await generateCharacterView(characterId, viewType || "front", characterStyle || "realistic", category || "Animation");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function extractStoryCharacters(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { prompt, category, characterStyle } = body;
    const { extractFallbackCharacters } = require("../services/storyGenerator");
    const { syncCharactersFromStoryboard } = require("../services/characterService");

    const rawChars = extractFallbackCharacters(prompt || "", category || "Animation", characterStyle || "stylized");
    const characters = await syncCharactersFromStoryboard({ characters: rawChars }, characterStyle || "stylized", category || "Animation");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, characters }));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function setPrimaryCharacterImage(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { characterId, imageUrl } = body;
    if (!characterId || !imageUrl) throw new Error("characterId and imageUrl are required");

    const result = setPrimaryReference(characterId, imageUrl);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function uploadCharacterPhoto(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { characterId, filename, data } = body;
    if (!characterId || !data) throw new Error("characterId and data are required");

    const result = saveUploadedCharacterPhoto(characterId, filename || "custom_photo.png", data);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function lockCharacter(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { characterId, locked } = body;
    if (!characterId) throw new Error("characterId is required");
    const result = toggleCharacterLock(characterId, locked);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

async function getProjectContextHandler(req, res) {
  try {
    const context = getProjectContext();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(context));
  } catch (err) {
    const status = err.statusCode || 500;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}

module.exports = {
  getCharacters,
  saveCharacter,
  deleteCharacter,
  generateCharacterImage,
  setPrimaryCharacterImage,
  uploadCharacterPhoto,
  extractStoryCharacters,
  lockCharacter,
  getProjectContextHandler
};
