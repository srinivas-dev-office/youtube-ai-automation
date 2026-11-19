const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const assetsDir = path.join(__dirname, "assets");

/**
 * Downloads a remote file to a local destination
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    client.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(destPath));
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Generate 3D Video with Replicate Image-to-Video
 */
async function generateVideoWithReplicate(apiToken, prompt, imageBase64, sceneNumber) {
  // Model: minimax/video-01 or stability-ai/stable-video-diffusion
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "minimax/video-01",
      input: {
        prompt: prompt || "3D Pixar animation style, dynamic fluid character action, cinema lighting, 8k render",
        first_frame_image: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`
      }
    })
  });

  const prediction = await response.json();
  if (prediction.error) throw new Error(prediction.error);

  let pollUrl = prediction.urls && prediction.urls.get;
  if (!pollUrl) throw new Error("No polling URL returned by Replicate");

  // Poll until complete
  while (true) {
    await new Promise(r => setTimeout(r, 4000));
    const pollRes = await fetch(pollUrl, {
      headers: { "Authorization": `Token ${apiToken}` }
    });
    const pollData = await pollRes.json();
    if (pollData.status === "succeeded") {
      const videoUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
      const savePath = path.join(assetsDir, `scene${sceneNumber}.mp4`);
      await downloadFile(videoUrl, savePath);
      return { success: true, path: savePath, filename: `scene${sceneNumber}.mp4` };
    } else if (pollData.status === "failed" || pollData.status === "canceled") {
      throw new Error(`Video generation failed: ${pollData.error || "Unknown error"}`);
    }
  }
}

/**
 * Return free web tools info
 */
function getFreeAiVideoTools(prompt) {
  return [
    {
      name: "Kling AI",
      url: "https://klingai.com",
      description: "Generates high-definition 3D Pixar character motion with fluid physics",
      suggestedPrompt: prompt
    },
    {
      name: "Luma Dream Machine",
      url: "https://lumalabs.ai/dream-machine",
      description: "Realistic camera motion, character gestures, and fluid dynamics",
      suggestedPrompt: prompt
    },
    {
      name: "Hailuo Minimax",
      url: "https://hailuoai.video",
      description: "Ultra-crisp 3D action with rapid generation speed",
      suggestedPrompt: prompt
    },
    {
      name: "Runway Gen-3",
      url: "https://runwayml.com",
      description: "Hollywood-grade motion brush and multi-angle camera control",
      suggestedPrompt: prompt
    }
  ];
}

module.exports = {
  generateVideoWithReplicate,
  getFreeAiVideoTools,
  downloadFile
};
