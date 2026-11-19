const {
  getCharacters,
  saveCharacter,
  deleteCharacter,
  generateCharacterImage,
  setPrimaryCharacterImage,
  uploadCharacterPhoto,
  extractStoryCharacters,
  lockCharacter,
  getProjectContextHandler
} = require("../controllers/characterController");

function handleCharacterRoutes(req, res, pathname, method, parsedUrl) {
  if (pathname === "/api/project-context" && method === "GET") {
    getProjectContextHandler(req, res);
    return true;
  }
  if (pathname === "/api/lock-character" && method === "POST") {
    lockCharacter(req, res);
    return true;
  }
  if (pathname === "/api/characters" && method === "GET") {
    getCharacters(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/extract-characters" && method === "POST") {
    extractStoryCharacters(req, res);
    return true;
  }
  if (pathname === "/api/save-character" && method === "POST") {
    saveCharacter(req, res);
    return true;
  }
  if (pathname === "/api/delete-character" && method === "POST") {
    deleteCharacter(req, res);
    return true;
  }
  if (pathname === "/api/generate-character-image" && method === "POST") {
    generateCharacterImage(req, res);
    return true;
  }
  if (pathname === "/api/set-primary-character-image" && method === "POST") {
    setPrimaryCharacterImage(req, res);
    return true;
  }
  if (pathname === "/api/upload-character-photo" && method === "POST") {
    uploadCharacterPhoto(req, res);
    return true;
  }
  return false;
}

module.exports = { handleCharacterRoutes };
