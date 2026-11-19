const {
  getStory,
  getStoryboard,
  generateStory,
  generateStoryboard,
  generateFromNarration,
  saveStoryboard
} = require("../controllers/storyController");

function handleStoryRoutes(req, res, pathname, method, parsedUrl) {
  if (pathname === "/api/story" && method === "GET") {
    getStory(req, res);
    return true;
  }
  if (pathname === "/api/storyboard" && method === "GET") {
    getStoryboard(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/save-storyboard" && method === "POST") {
    saveStoryboard(req, res);
    return true;
  }
  if (pathname === "/api/generate-story" && method === "POST") {
    generateStory(req, res);
    return true;
  }
  if (pathname === "/api/generate-storyboard" && method === "POST") {
    generateStoryboard(req, res);
    return true;
  }
  if (pathname === "/api/generate-from-narration" && method === "POST") {
    generateFromNarration(req, res);
    return true;
  }
  return false;
}

module.exports = { handleStoryRoutes };
