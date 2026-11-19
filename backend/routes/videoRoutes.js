const {
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
} = require("../controllers/videoController");

function handleVideoRoutes(req, res, pathname, method, parsedUrl) {
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
  if (pathname === "/api/render-job/start" && method === "POST") {
    startRenderJobController(req, res);
    return true;
  }
  if (pathname === "/api/render-job/status" && method === "GET") {
    getRenderJobStatusController(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/render-job/cancel" && method === "POST") {
    cancelRenderJobController(req, res);
    return true;
  }
  if (pathname === "/api/status" && method === "GET") {
    getStatus(req, res);
    return true;
  }
  if (pathname === "/api/generate-voice" && method === "POST") {
    generateNarrationAudio(req, res);
    return true;
  }
  if (pathname === "/api/voices" && method === "GET") {
    getVoices(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/projects" && method === "GET") {
    getProjects(req, res);
    return true;
  }
  if (pathname === "/api/project" && method === "GET") {
    getProjectByIdController(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/save-project" && method === "POST") {
    saveProject(req, res);
    return true;
  }
  if (pathname === "/api/delete-project" && method === "POST") {
    deleteProject(req, res);
    return true;
  }
  if (pathname === "/api/video-providers" && method === "GET") {
    getVideoProvidersController(req, res);
    return true;
  }
  if (pathname === "/api/render-hybrid" && method === "POST") {
    renderHybridMovieController(req, res);
    return true;
  }
  if (pathname === "/api/lipsync-visemes" && (method === "POST" || method === "GET")) {
    getLipSyncVisemesController(req, res, parsedUrl);
    return true;
  }
  if (pathname === "/api/save-api-key" && method === "POST") {
    saveApiKey(req, res);
    return true;
  }
  if ((pathname === "/api/render-storyboard" || pathname === "/api/storyboard/render-movie" || pathname === "/api/render-video") && method === "POST") {
    renderStoryboardMovie(req, res);
    return true;
  }
  if (pathname === "/api/video") {
    streamVideo(req, res);
    return true;
  }
  if (pathname === "/api/upload-youtube" && method === "POST") {
    publishToYouTube(req, res);
    return true;
  }
  if (pathname === "/auth/start") {
    startAuth(req, res);
    return true;
  }
  if (pathname === "/oauth2callback") {
    oauthCallback(req, res, parsedUrl);
    return true;
  }
  return false;
}

module.exports = { handleVideoRoutes };
