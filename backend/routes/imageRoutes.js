const {
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
} = require("../controllers/imageController");
const {
  generateSceneVideoController,
  generateAllSceneVideosController,
  getSceneVideoStatusController
} = require("../controllers/videoController");

function handleImageRoutes(req, res, pathname, method, parsedUrl) {
  if (pathname === "/api/generate-scene-video" && method === "POST") {
    generateSceneVideoController(req, res);
    return true;
  }
  if (pathname === "/api/generate-all-scene-videos" && method === "POST") {
    generateAllSceneVideosController(req, res);
    return true;
  }
  if (pathname === "/api/scene-video-status" && method === "GET") {
    getSceneVideoStatusController(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/generate-scene-image" && method === "POST") {
    generateSceneImage(req, res);
    return true;
  }
  if (pathname === "/api/character-replace-preview" && method === "POST") {
    handleCharacterReplacePreview(req, res);
    return true;
  }
  if (pathname === "/api/character-replace-apply" && method === "POST") {
    handleCharacterReplaceApply(req, res);
    return true;
  }
  if (pathname === "/api/character-replace-all" && method === "POST") {
    handleCharacterReplaceAll(req, res);
    return true;
  }
  if (pathname === "/api/generate-character-ref" && method === "POST") {
    generateCharacterRef(req, res);
    return true;
  }
  if (pathname === "/api/character-ref" && method === "GET") {
    getCharacterRef(req, res);
    return true;
  }
  if (pathname === "/api/generate-all-images" && method === "POST") {
    generateAllImages(req, res);
    return true;
  }
  if (pathname === "/api/upload-scene" && method === "POST") {
    uploadSceneMedia(req, res);
    return true;
  }
  if (pathname === "/api/delete-scene" && method === "POST") {
    deleteSceneMedia(req, res);
    return true;
  }
  if (pathname === "/api/load-sample-scenes" && method === "POST") {
    loadSampleScenes(req, res);
    return true;
  }
  if (pathname === "/api/upload-asset" && method === "POST") {
    uploadCustomAsset(req, res);
    return true;
  }
  if (pathname === "/api/delete-asset" && method === "POST") {
    deleteCustomAsset(req, res);
    return true;
  }
  return false;
}

module.exports = { handleImageRoutes };
