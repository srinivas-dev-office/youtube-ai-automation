const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const { port, rootDir, storageDir, imagesDir, audioDir, videosDir, assetsDir } = require("./config");
const { setNoCacheHeaders, getMimeType } = require("./utils/ffmpegHelper");
const { handleStoryRoutes } = require("./routes/storyRoutes");
const { handleImageRoutes } = require("./routes/imageRoutes");
const { handleVideoRoutes } = require("./routes/videoRoutes");
const { handleCharacterRoutes } = require("./routes/characterRoutes");
const { runMigration } = require("./migrations/migrateJsonToSqlite");

// Run SQLite migration check on startup (DATA-01)
try {
  runMigration();
} catch (migErr) {
  console.warn("⚠️ SQLite migration check note:", migErr.message);
}

// Auto-sync Animio AI Brand Logo to assets and storage
try {
  const brainLogo = "C:\\Users\\alath\\.gemini\\antigravity\\brain\\8615a0bd-107b-45b0-96c2-6519d8d32db2\\.user_uploaded\\media_1794998176589_b60e0014.jpg";
  if (fs.existsSync(brainLogo)) {
    const targetAssets = path.join(assetsDir, "animio_logo.jpg");
    const targetImages = path.join(imagesDir, "animio_logo.jpg");
    if (!fs.existsSync(targetAssets)) fs.copyFileSync(brainLogo, targetAssets);
    if (!fs.existsSync(targetImages)) fs.copyFileSync(brainLogo, targetImages);
  }
} catch (_) {}

const frontendDir = path.join(rootDir, "frontend");
const publicDir = path.join(rootDir, "public");

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Set anti-caching headers on every response
  setNoCacheHeaders(res);

  // Animio AI Brand Logo Route
  if (pathname === "/assets/animio_logo.jpg" || pathname === "/animio_logo.jpg" || pathname === "/logo.png" || pathname === "/favicon.ico") {
    const candidateLogoPaths = [
      path.join(assetsDir, "animio_logo.jpg"),
      path.join(imagesDir, "animio_logo.jpg"),
      path.join(frontendDir, "animio_logo.jpg"),
      "C:\\Users\\alath\\.gemini\\antigravity\\brain\\8615a0bd-107b-45b0-96c2-6519d8d32db2\\.user_uploaded\\media_1794998176589_b60e0014.jpg",
      "C:\\Users\\alath\\.gemini\\antigravity\\brain\\8615a0bd-107b-45b0-96c2-6519d8d32db2\\scratch\\animio_logo.jpg"
    ];
    for (const p of candidateLogoPaths) {
      if (fs.existsSync(p)) {
        res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
        fs.createReadStream(p).pipe(res);
        return;
      }
    }
  }

  // 1. Static Frontend Files
  if (pathname === "/" || pathname === "/index.html") {
    let htmlPath = path.join(frontendDir, "index.html");
    if (!fs.existsSync(htmlPath)) htmlPath = path.join(publicDir, "index.html");
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  if (pathname === "/style.css") {
    const cssPath = path.join(frontendDir, "style.css");
    if (fs.existsSync(cssPath)) {
      res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
      fs.createReadStream(cssPath).pipe(res);
      return;
    }
  }

  if (pathname === "/script.js") {
    const jsPath = path.join(frontendDir, "script.js");
    if (fs.existsSync(jsPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      fs.createReadStream(jsPath).pipe(res);
      return;
    }
  }

  // 2. Storage / Media Files (/assets/ and /storage/images/)
  if (pathname.startsWith("/assets/") || pathname.startsWith("/storage/images/")) {
    const filename = path.basename(pathname);
    let filePath = path.join(imagesDir, filename);
    if (!fs.existsSync(filePath)) filePath = path.join(assetsDir, filename);

    if (fs.existsSync(filePath)) {
      const contentType = getMimeType(filePath);
      const stat = fs.statSync(filePath);
      const total = stat.size;

      // Handle video range streaming
      if (req.headers.range && contentType.startsWith("video/")) {
        const parts = req.headers.range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType
        });
        file.pipe(res);
        return;
      }

      res.writeHead(200, {
        "Content-Length": total,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes"
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // 2.5 Project-Isolated Media Files (/storage/projects/:projectId/...)
  if (pathname.startsWith("/storage/projects/")) {
    const rel = pathname.replace(/^\/storage\/projects\//, "");
    const slashIdx = rel.indexOf("/");
    if (slashIdx > 0) {
      const pId = rel.slice(0, slashIdx).replace(/[^a-zA-Z0-9_-]/g, "");
      const assetSub = rel.slice(slashIdx + 1);
      const projectRoot = path.resolve(storageDir, "projects", pId);
      const fullAssetPath = path.resolve(projectRoot, assetSub);

      // Verify directory containment to prevent path traversal
      if (fullAssetPath.startsWith(projectRoot) && fs.existsSync(fullAssetPath)) {
        const contentType = getMimeType(fullAssetPath);
        const stat = fs.statSync(fullAssetPath);
        const total = stat.size;

        if (req.headers.range && contentType.startsWith("video/")) {
          const parts = req.headers.range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
          const chunksize = end - start + 1;
          const file = fs.createReadStream(fullAssetPath, { start, end });
          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": contentType
          });
          file.pipe(res);
          return;
        }

        res.writeHead(200, {
          "Content-Length": total,
          "Content-Type": contentType,
          "Accept-Ranges": "bytes"
        });
        fs.createReadStream(fullAssetPath).pipe(res);
        return;
      }
    }
  }

  // 3. Audio & Video Storage Routes
  if (pathname.startsWith("/storage/audio/")) {
    const filePath = path.join(audioDir, path.basename(pathname));
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": getMimeType(filePath) });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  if (pathname.startsWith("/storage/videos/")) {
    const filePath = path.join(videosDir, path.basename(pathname));
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": getMimeType(filePath) });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // 4. API Routes
  if (handleStoryRoutes(req, res, pathname, method, parsedUrl)) return;
  if (handleCharacterRoutes(req, res, pathname, method, parsedUrl)) return;
  if (handleImageRoutes(req, res, pathname, method, parsedUrl)) return;
  if (handleVideoRoutes(req, res, pathname, method, parsedUrl)) return;

  // 404 Fallback
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Error: Port ${port} is already in use by another process.`);
    console.error(`👉 To free port ${port} on Windows, run:`);
    console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${port}).OwningProcess -Force`);
    console.error(`👉 Or change the PORT variable in your .env file.\n`);
    process.exit(1);
  } else {
    console.error("Server error:", err);
    process.exit(1);
  }
});

server.listen(port, () => {
  console.log("==================================================");
  console.log("   🚀 TOONCRAFT AI STUDIO - BACKEND SERVER        ");
  console.log("==================================================");
  console.log(`🌐 Dashboard running at: http://localhost:${port}`);
  console.log(`👉 Open http://localhost:${port} in your browser!`);
  console.log("==================================================");
});

module.exports = server;
