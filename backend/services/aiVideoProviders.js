const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

/**
 * Base AI Video Provider Interface
 */
class BaseVideoProvider {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
  }

  isConfigured() {
    return false;
  }

  async generateClip(options) {
    throw new Error(`generateClip not implemented in ${this.name}`);
  }
}

/**
 * Google Veo 3.1 AI Video Generation Provider
 * Powered by Google GenAI veo-3.1-generate-preview model
 */
class GoogleVeoProvider extends BaseVideoProvider {
  constructor() {
    super("veo");
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || "";
    this.apiHost = "generativelanguage.googleapis.com";
    this.model = process.env.GOOGLE_VEO_MODEL || "veo-3.1-generate-preview";
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.length >= 10);
  }

  async generateClip({
    prompt,
    imagePath,
    duration = 5.0,
    cameraMotion = "cinematic slow push",
    characterAction = "smooth natural animation",
    aspectRatio = "9:16",
    outputPath,
    seed
  }) {
    if (!this.isConfigured()) {
      throw new Error("Google Veo 3.1 requires GEMINI_API_KEY or GOOGLE_AI_KEY configured in environment or .env");
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error(`Scene image does not exist for Image-to-Video generation: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString("base64");
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";

    const motionPrompt = `${prompt || "Cinematic animated scene"}. Camera motion: ${cameraMotion}. Action: ${characterAction}. Vivid colors, fluid 24fps motion, consistent character identity, preserved background composition, high definition cartoon studio quality.`;

    const targetDuration = Math.min(10, Math.max(3, Math.round(duration || 5)));
    const targetAspect = aspectRatio === "16:9" ? "16:9" : aspectRatio === "1:1" ? "1:1" : "9:16";

    const payload = {
      instances: [
        {
          prompt: motionPrompt,
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: mimeType
          }
        }
      ],
      parameters: {
        aspectRatio: targetAspect,
        sampleCount: 1,
        durationSeconds: targetDuration,
        resolution: "720p"
      }
    };

    console.log(`[GoogleVeoProvider] Initiating Veo 3.1 LRO task for ${path.basename(imagePath)} (Duration: ${targetDuration}s, Aspect: ${targetAspect})...`);

    const lroRes = await this._postJson(`/v1beta/models/${this.model}:predictLongRunning?key=${this.apiKey}`, payload);
    const operationName = lroRes.name;

    if (!operationName) {
      throw new Error(`Veo 3.1 did not return operation name: ${JSON.stringify(lroRes)}`);
    }

    console.log(`[GoogleVeoProvider] Operation started: ${operationName}. Polling for completion...`);

    const videoResult = await this._pollOperation(operationName, 180000);

    if (videoResult.bytesBase64Encoded) {
      const vidBuffer = Buffer.from(videoResult.bytesBase64Encoded, "base64");
      fs.writeFileSync(outputPath, vidBuffer);
    } else if (videoResult.uri) {
      await this._downloadFile(videoResult.uri, outputPath);
    } else {
      throw new Error("Veo 3.1 completed operation but returned neither video URI nor base64 bytes");
    }

    console.log(`[GoogleVeoProvider] AI Video clip successfully saved to: ${outputPath}`);
    return {
      provider: "veo",
      model: this.model,
      outputPath,
      duration: targetDuration,
      success: true,
      motionPrompt
    };
  }

  async _postJson(pathWithQuery, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: pathWithQuery,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 45000
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
          } else {
            reject(new Error(`Google Veo API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Veo API request timed out")); });
      req.write(postData);
      req.end();
    });
  }

  async _pollOperation(operationName, timeoutMs = 180000) {
    const startTime = Date.now();
    let delay = 3000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(8000, delay * 1.25);

      const opStatus = await this._getJson(`/v1beta/${operationName}?key=${this.apiKey}`);
      if (opStatus.done) {
        if (opStatus.error) {
          throw new Error(`Veo 3.1 operation failed: ${opStatus.error.message || JSON.stringify(opStatus.error)}`);
        }
        const genVideos = opStatus.response?.generatedVideos;
        if (genVideos && genVideos.length > 0) {
          const video = genVideos[0].video || genVideos[0];
          return {
            uri: video.uri || video.videoUri,
            bytesBase64Encoded: video.bytesBase64Encoded
          };
        }
        throw new Error(`Veo 3.1 completed with unexpected payload structure: ${JSON.stringify(opStatus.response)}`);
      }
    }
    throw new Error(`Veo 3.1 operation timed out after ${timeoutMs / 1000} seconds`);
  }

  async _getJson(pathWithQuery) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: pathWithQuery,
        method: "GET",
        headers: { "Content-Type": "application/json" },
        timeout: 20000
      };
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Veo poll timed out")); });
      req.end();
    });
  }

  async _downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(destPath);
      const client = url.startsWith("https") ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this._downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Failed to download Veo clip, HTTP ${res.statusCode}`));
        }
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      }).on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
}

/**
 * RunwayML Gen-2 / Gen-3 Alpha Video Provider
 */
class RunwayProvider extends BaseVideoProvider {
  constructor() {
    super("runway");
    this.apiKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET || "";
    // Official Runway Developer API hostname (docs.dev.runwayml.com)
    this.apiHost = process.env.RUNWAY_API_HOST || "api.dev.runwayml.com";
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.length >= 16);
  }

  async generateClip({ prompt, imagePath, duration = 4.0, cameraMotion = "zoom_in", outputPath, seed }) {
    if (!this.isConfigured()) {
      throw new Error("RunwayML API key is not configured. Set RUNWAY_API_KEY in environment or .env");
    }

    // Map internal camera motion to Runway camera motion params
    const runwayCamera = this._mapCameraMotion(cameraMotion);

    // Prepare payload
    let imageBase64 = "";
    if (imagePath && fs.existsSync(imagePath)) {
      imageBase64 = `data:image/png;base64,${fs.readFileSync(imagePath).toString("base64")}`;
    }

    const payload = {
      promptText: prompt || "Cinematic animation",
      promptImage: imageBase64 || undefined,
      model: process.env.RUNWAY_MODEL || "gen4_turbo", // Active model (gen3a_turbo was retired by Runway July 2026)
      duration: Math.min(10, Math.max(5, Math.round(duration))),
      ratio: "768:1280", // 9:16 portrait
      cameraMotion: runwayCamera,
      watermark: false,
      seed: seed || Math.floor(Math.random() * 1000000)
    };

    console.log(`[RunwayProvider] Submitting image-to-video task (Camera: ${cameraMotion}, Duration: ${duration}s)...`);
    
    // In production, performs HTTPS POST to Runway API and polls task status
    // Supports custom webhook or direct polling
    const taskResult = await this._postJson("/v1/image_to_video", payload);
    const taskId = taskResult.id || taskResult.taskId;

    if (!taskId) {
      throw new Error(`Runway API did not return a valid task ID: ${JSON.stringify(taskResult)}`);
    }

    // Poll for completion (up to 90 seconds with backoff)
    const videoUrl = await this._pollTaskStatus(taskId, 90000);
    
    // Download video file directly to outputPath
    await this._downloadFile(videoUrl, outputPath);
    console.log(`[RunwayProvider] Video clip successfully saved to: ${outputPath}`);
    return { provider: "runway", outputPath, duration, success: true };
  }

  _mapCameraMotion(motion) {
    switch (motion) {
      case "zoom_in":
      case "dramatic_zoom_in":
        return { zoom: 1.5, pan: 0, tilt: 0 };
      case "zoom_out":
      case "epic_pull_back":
        return { zoom: -1.5, pan: 0, tilt: 0 };
      case "pan_left":
        return { zoom: 0, pan: -1.5, tilt: 0 };
      case "pan_right":
        return { zoom: 0, pan: 1.5, tilt: 0 };
      case "tilt_up":
        return { zoom: 0, pan: 0, tilt: 1.5 };
      case "tilt_down":
        return { zoom: 0, pan: 0, tilt: -1.5 };
      default:
        return { zoom: 0.8, pan: 0.5, tilt: 0 };
    }
  }

  async _postJson(endpoint, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: endpoint,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "X-Runway-Version": process.env.RUNWAY_VERSION || "2024-11-06",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 25000
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
          } else {
            reject(new Error(`Runway API returned HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Runway API request timed out")); });
      req.write(postData);
      req.end();
    });
  }

  async _pollTaskStatus(taskId, timeoutMs = 90000) {
    const startTime = Date.now();
    let delay = 2500;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(6000, delay * 1.25);

      const status = await this._getJson(`/v1/tasks/${taskId}`);
      if (status.status === "SUCCEEDED" || status.status === "completed") {
        const url = status.output?.[0] || status.videoUrl || status.url;
        if (url) return url;
      } else if (status.status === "FAILED" || status.status === "CANCELLED") {
        throw new Error(`Runway task ${taskId} failed: ${status.failure || status.error || "Unknown error"}`);
      }
    }
    throw new Error(`Runway task ${taskId} timed out after ${timeoutMs / 1000} seconds`);
  }

  async _getJson(endpoint) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: endpoint,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "X-Runway-Version": process.env.RUNWAY_VERSION || "2024-11-06"
        },
        timeout: 15000
      };
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Runway task poll timed out")); });
      req.end();
    });
  }

  async _downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(destPath);
      const client = url.startsWith("https") ? https : http;
      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Failed to download clip, HTTP ${res.statusCode}`));
        }
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      }).on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
}

/**
 * Pika 1.0 / 2.0 AI Video Provider
 */
class PikaProvider extends BaseVideoProvider {
  constructor() {
    super("pika");
    this.apiKey = process.env.PIKA_API_KEY || "";
    this.apiHost = "api.pika.art";
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.length >= 16);
  }

  async generateClip({ prompt, imagePath, duration = 3.0, cameraMotion = "zoom_in", outputPath, seed }) {
    if (!this.isConfigured()) {
      throw new Error("Pika API key is not configured. Set PIKA_API_KEY in environment or .env");
    }

    const pikaCamera = this._mapPikaCamera(cameraMotion);
    let imageBase64 = "";
    if (imagePath && fs.existsSync(imagePath)) {
      imageBase64 = `data:image/png;base64,${fs.readFileSync(imagePath).toString("base64")}`;
    }

    const payload = {
      promptText: prompt || "High quality 3d cartoon animation",
      image: imageBase64 || undefined,
      options: {
        aspectRatio: "9:16",
        frameRate: 30,
        camera: pikaCamera,
        parameters: {
          motion: 2,
          guidanceScale: 16
        }
      }
    };

    console.log(`[PikaProvider] Generating video clip with camera motion: ${JSON.stringify(pikaCamera)}...`);
    const genRes = await this._postJson("/v1/generate", payload);
    const generationId = genRes.id || genRes.generationId;

    if (!generationId) {
      throw new Error(`Pika generation failed to return ID: ${JSON.stringify(genRes)}`);
    }

    const videoUrl = await this._pollGeneration(generationId, 85000);
    await this._downloadFile(videoUrl, outputPath);
    console.log(`[PikaProvider] Video clip successfully saved to: ${outputPath}`);
    return { provider: "pika", outputPath, duration, success: true };
  }

  _mapPikaCamera(motion) {
    switch (motion) {
      case "zoom_in":
      case "dramatic_zoom_in":
        return { zoom: "in" };
      case "zoom_out":
      case "epic_pull_back":
        return { zoom: "out" };
      case "pan_left":
        return { pan: "left" };
      case "pan_right":
        return { pan: "right" };
      case "tilt_up":
        return { tilt: "up" };
      case "tilt_down":
        return { tilt: "down" };
      default:
        return { zoom: "in" };
    }
  }

  async _postJson(endpoint, data) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: endpoint,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 25000
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
          } else {
            reject(new Error(`Pika API returned HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Pika API request timed out")); });
      req.write(postData);
      req.end();
    });
  }

  async _pollGeneration(id, timeoutMs = 85000) {
    const startTime = Date.now();
    let delay = 3000;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(6000, delay * 1.2);

      const status = await this._getJson(`/v1/generations/${id}`);
      if (status.status === "finished" || status.status === "completed") {
        const url = status.video?.url || status.resultUrl || status.url;
        if (url) return url;
      } else if (status.status === "failed") {
        throw new Error(`Pika generation ${id} failed: ${status.error || "Unknown error"}`);
      }
    }
    throw new Error(`Pika generation ${id} timed out`);
  }

  async _getJson(endpoint) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: endpoint,
        method: "GET",
        headers: { "Authorization": `Bearer ${this.apiKey}` },
        timeout: 15000
      };
      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve({ raw: body }); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Pika poll timed out")); });
      req.end();
    });
  }

  async _downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(destPath);
      const client = url.startsWith("https") ? https : http;
      client.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Failed to download clip, HTTP ${res.statusCode}`));
        }
        res.pipe(fileStream);
        fileStream.on("finish", () => fileStream.close(resolve));
      }).on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
}

/**
 * Stable Video Diffusion (SVD / SVD-XT) Provider via Stability AI
 */
class StableVideoProvider extends BaseVideoProvider {
  constructor() {
    super("stable-video");
    this.apiKey = process.env.STABILITY_API_KEY || process.env.STABILITY_AI_API_KEY || "";
    this.apiHost = "api.stability.ai";
  }

  isConfigured() {
    return !!(this.apiKey && this.apiKey.length >= 16);
  }

  async generateClip({ prompt, imagePath, duration = 4.0, cameraMotion = "zoom_in", outputPath, seed }) {
    if (!this.isConfigured()) {
      throw new Error("Stability AI API key is not configured. Set STABILITY_API_KEY in environment or .env");
    }

    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error("Stable Video Diffusion requires a valid input image file.");
    }

    // Motion bucket ID (1-255): higher means more motion
    let motionBucketId = 127;
    if (cameraMotion === "dramatic_zoom_in" || cameraMotion === "pan_right") motionBucketId = 160;
    else if (cameraMotion === "breathing_hero") motionBucketId = 80;

    console.log(`[StableVideoProvider] Generating SVD clip (Motion Bucket: ${motionBucketId})...`);

    // In production, posts multipart image to /v2beta/image-to-video
    // For standard REST call with polling
    const genResult = await this._submitImageToVideo(imagePath, motionBucketId, seed);
    const generationId = genResult.id;

    if (!generationId) {
      throw new Error(`Stability API did not return generation ID: ${JSON.stringify(genResult)}`);
    }

    const videoBuffer = await this._pollVideoResult(generationId, 90000);
    fs.writeFileSync(outputPath, videoBuffer);
    console.log(`[StableVideoProvider] Video clip successfully saved to: ${outputPath}`);
    return { provider: "stable-video", outputPath, duration, success: true };
  }

  async _submitImageToVideo(imagePath, motionBucketId, seed) {
    return new Promise((resolve, reject) => {
      const boundary = "----StabilityFormBoundary" + Date.now();
      const imageBuffer = fs.readFileSync(imagePath);
      const filename = path.basename(imagePath);

      let payload = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`),
        imageBuffer,
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="seed"\r\n\r\n${seed || 0}`),
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="cfg_scale"\r\n\r\n2.5`),
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="motion_bucket_id"\r\n\r\n${motionBucketId}`),
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const options = {
        hostname: this.apiHost,
        port: 443,
        path: "/v2beta/image-to-video",
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": payload.length
        },
        timeout: 30000
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body)); } catch (e) { resolve({ id: body.trim() }); }
          } else {
            reject(new Error(`Stability API error HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Stability API submit timed out")); });
      req.write(payload);
      req.end();
    });
  }

  async _pollVideoResult(id, timeoutMs = 90000) {
    const startTime = Date.now();
    let delay = 3500;

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, delay));
      delay = Math.min(7000, delay * 1.2);

      const res = await this._fetchResult(`/v2beta/image-to-video/result/${id}`);
      if (res.status === 200 && res.isBuffer) {
        return res.buffer;
      } else if (res.status === 202) {
        // Still processing
        continue;
      } else if (res.status >= 400) {
        throw new Error(`Stability video result error HTTP ${res.status}: ${res.body}`);
      }
    }
    throw new Error(`Stability video generation ${id} timed out`);
  }

  async _fetchResult(endpoint) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.apiHost,
        port: 443,
        path: endpoint,
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Accept": "video/*"
        },
        timeout: 20000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          const chunks = [];
          res.on("data", c => chunks.push(c));
          res.on("end", () => resolve({ status: 200, isBuffer: true, buffer: Buffer.concat(chunks) }));
        } else {
          let body = "";
          res.on("data", c => body += c);
          res.on("end", () => resolve({ status: res.statusCode, isBuffer: false, body }));
        }
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Stability poll timed out")); });
      req.end();
    });
  }
}

/**
 * AI Video Provider Manager with Cascade Fallback Chain
 */
class AiVideoManager {
  constructor() {
    this.providers = {
      "veo": new GoogleVeoProvider(),
      "google-veo": new GoogleVeoProvider(),
      "runway": new RunwayProvider(),
      "pika": new PikaProvider(),
      "stable-video": new StableVideoProvider()
    };
  }

  getProvider(name) {
    return this.providers[name.toLowerCase()] || null;
  }

  getProviderStatus() {
    const status = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      status[name] = {
        name,
        configured: provider.isConfigured()
      };
    }
    status["ffmpeg"] = {
      name: "ffmpeg",
      configured: true,
      description: "Organic 2.5D Multi-Axis Cinematic Engine (Always Available)"
    };
    return status;
  }

  /**
   * Generates a video clip attempting the requested provider first,
   * then cascading to other configured providers before signaling fallback.
   */
  async generateClipWithFallback(options) {
    const { preferredProvider = "auto", fallbackCallback } = options;
    const providerChain = [];

    if (preferredProvider !== "auto" && this.providers[preferredProvider.toLowerCase()]) {
      providerChain.push(this.providers[preferredProvider.toLowerCase()]);
    } else if (preferredProvider === "auto" && this.providers["veo"] && this.providers["veo"].isConfigured()) {
      providerChain.push(this.providers["veo"]);
    }

    // Add any other configured providers as secondary
    for (const [name, p] of Object.entries(this.providers)) {
      if (!providerChain.includes(p) && p.isConfigured()) {
        providerChain.push(p);
      }
    }

    const errors = [];
    for (const provider of providerChain) {
      if (!provider.isConfigured()) continue;
      try {
        console.log(`[AiVideoManager] Attempting generation with provider: ${provider.name}...`);
        const result = await provider.generateClip(options);
        return { ...result, fallbackUsed: false };
      } catch (err) {
        console.warn(`[AiVideoManager] Provider ${provider.name} failed (${err.message}). Cascading to next option...`);
        errors.push({ provider: provider.name, error: err.message });
      }
    }

    // If all configured AI cloud providers failed or none were configured,
    // trigger the high-performance local cinematic FFmpeg engine
    console.log("[AiVideoManager] No AI cloud providers available or all failed. Utilizing organic cinematic FFmpeg pipeline.");
    if (typeof fallbackCallback === "function") {
      const fallbackResult = await fallbackCallback(options);
      return {
        ...fallbackResult,
        provider: "ffmpeg_cinematic",
        fallbackUsed: true,
        chainErrors: errors
      };
    }

    throw new Error(`Video generation failed across all providers: ${JSON.stringify(errors)}`);
  }
}

const aiVideoManager = new AiVideoManager();

module.exports = {
  BaseVideoProvider,
  GoogleVeoProvider,
  RunwayProvider,
  PikaProvider,
  StableVideoProvider,
  AiVideoManager,
  aiVideoManager
};
