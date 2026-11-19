const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { geminiApiKey, ffmpegPath, outputDir } = require("./config");

const assetsDir = path.join(__dirname, "assets");
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const CHARACTER_STYLES = {
  "realistic": "photorealistic style, natural human proportions, realistic anatomy, cinema photoreal lighting, highly detailed skin textures, 8k photographic render",
  "stylized": "exaggerated stylized 3D animation style, oversized expressive facial features, dynamic animated poses, Pixar-Disney stylized aesthetics, vibrant dramatic lighting, 8k 3D render",
  "anime": "high quality modern anime and manga style, Makoto Shinkai aesthetic, large expressive glittering eyes, simplified elegant facial features, detailed anime hair, vibrant cel-shaded color palette, dynamic cinematic anime scene",
  "chibi": "ultra cute chibi character style, oversized head and small cute body, giant glossy sparkling eyes, soft clay toy render, kawaii aesthetics, bright colorful pastel lighting, clean 3D render",
  "rubber_hose": "1930s vintage rubber hose animation style, Cuphead vintage cartoon aesthetic, pie eyes, white gloves, noodly fluid limbs, expressive playful face, vintage print texture, colorful retro cartoon art",
  "flat_geometric": "flat geometric vector art illustration style, simple geometric shapes, clean minimalist silhouettes, bold Bauhaus color blocking, modern stylish graphic design, crisp sharp edges",
  "pixel": "detailed 16-bit retro video game pixel art style, vibrant pixel colors, sharp nostalgic sprites, 90s arcade aesthetic, clean pixel shading, colorful retro gaming scene",
  "low_poly": "stylish 3D low-poly art style, faceted polygon character surfaces, depth and ambient occlusion, beautiful volumetric lighting, trendy isometric 3D game aesthetic, rich vibrant color gradients"
};

/**
 * Generate vertical image using Google Gemini Imagen 3
 */
async function generateImageWithImagen(prompt, apiKey) {
  const key = apiKey || process.env.GEMINI_API_KEY || geminiApiKey;
  if (!key || key === "your_gemini_api_key_here") {
    throw new Error("No valid Gemini API key configured.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [
        { prompt: prompt || "cute cartoon character, vibrant colors, 8k render" }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
        outputMimeType: "image/jpeg"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen 3 API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const base64Data = data.predictions?.[0]?.bytesBase64Encoded;
  if (!base64Data) throw new Error("No image data returned from Imagen 3 API");

  return Buffer.from(base64Data, "base64");
}

/**
 * Generate vertical image using Pollinations AI (with 12s timeout)
 */
async function generateImageWithPollinations(prompt, model = "turbo") {
  const cleanPrompt = encodeURIComponent(prompt.slice(0, 300));
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=720&height=1280&nologo=true&seed=${seed}&model=${model}`;

  console.log(`🌐 Fetching AI image from Pollinations (${model}): ${prompt.slice(0, 60)}...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Pollinations API returned status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Generate vertical image using AI Horde (Distributed Free Stable Diffusion Cluster)
 */
async function generateImageWithHorde(prompt) {
  console.log(`🌐 Fetching AI image from AI Horde: ${prompt.slice(0, 60)}...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const postRes = await fetch("https://aihorde.net/api/v2/generate/async", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "apikey": "0000000000"
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 380),
        params: {
          width: 384,
          height: 640,
          steps: 15,
          n: 1
        }
      })
    });

    if (!postRes.ok) {
      throw new Error(`AI Horde request failed: ${postRes.status}`);
    }

    const postData = await postRes.json();
    const id = postData.id;
    if (!id) throw new Error("No job ID from AI Horde");

    let imageUrl = null;
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const checkRes = await fetch(`https://aihorde.net/api/v2/generate/check/${id}`, { signal: controller.signal });
      if (!checkRes.ok) continue;
      const checkData = await checkRes.json();
      if (checkData.done) {
        const statusRes = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`, { signal: controller.signal });
        const statusData = await statusRes.json();
        if (statusData.generations && statusData.generations[0]?.img) {
          imageUrl = statusData.generations[0].img;
          break;
        }
      }
    }

    if (!imageUrl) throw new Error("AI Horde timed out waiting for generation");

    const imgRes = await fetch(imageUrl, { signal: controller.signal });
    if (!imgRes.ok) throw new Error("Failed to download AI Horde image");
    const arrayBuffer = await imgRes.arrayBuffer();
    clearTimeout(timeoutId);
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Generate artistic fallback image using FFmpeg
 */
function generateFallbackImageWithFfmpeg(sceneNumber, prompt) {
  const colors = ["midnightblue", "darkslateblue", "navy", "darkcyan", "purple", "indigo", "teal", "darkgreen"];
  const bgColor = colors[(sceneNumber - 1) % colors.length];
  const saveName = `scene${sceneNumber}.png`;
  const savePath = path.join(assetsDir, saveName);

  const safePrompt = (prompt || `Scene ${sceneNumber}`)
    .replace(/[^\w\s]/g, " ")
    .slice(0, 36);

  execFileSync(ffmpegPath, [
    "-f", "lavfi",
    "-i", `color=c=${bgColor}:s=1080x1920:d=1`,
    "-vf", `drawtext=text='ACT ${sceneNumber}':fontcolor=gold:fontsize=90:borderw=4:bordercolor=black:x=(w-text_w)/2:y=800,drawtext=text='${safePrompt}':fontcolor=white:fontsize=46:borderw=3:bordercolor=black:x=(w-text_w)/2:y=950`,
    "-vframes", "1",
    "-update", "1",
    "-y", savePath
  ], { stdio: "inherit" });

  return fs.readFileSync(savePath);
}

/**
 * Generate and save image for a specific scene number (Multi-Engine with Auto-Fallback)
 */
async function generateImageForScene(sceneNumber, prompt, apiKey, characterStyle) {
  let imageBuffer = null;
  let engineUsed = "Imagen 3";

  // Build styled prompt
  const styleDesc = CHARACTER_STYLES[characterStyle] || CHARACTER_STYLES["stylized"];
  let finalPrompt = prompt || `Scene ${sceneNumber}`;
  for (const styleVal of Object.values(CHARACTER_STYLES)) {
    if (finalPrompt.startsWith(styleVal + ", ")) {
      finalPrompt = finalPrompt.substring(styleVal.length + 2);
    }
  }
  if (!finalPrompt.toLowerCase().includes(characterStyle || "")) {
    finalPrompt = `${styleDesc}, ${finalPrompt}`;
  }

  // Try 1: Google Imagen 3 (Google Gemini API)
  try {
    imageBuffer = await generateImageWithImagen(finalPrompt, apiKey);
  } catch (err) {
    console.warn(`[Scene ${sceneNumber}] Imagen 3 unavailable (${err.message}). Trying Pollinations AI...`);
    // Try 2: Pollinations AI
    try {
      imageBuffer = await generateImageWithPollinations(finalPrompt);
      engineUsed = "Pollinations AI";
    } catch (pollErr) {
      console.warn(`[Scene ${sceneNumber}] Pollinations unavailable (${pollErr.message}). Trying AI Horde (Free Stable Diffusion)...`);
      // Try 3: AI Horde (Free Stable Diffusion cluster, no 45s per-IP throttle)
      try {
        imageBuffer = await generateImageWithHorde(finalPrompt);
        engineUsed = "AI Horde";
      } catch (hordeErr) {
        console.warn(`[Scene ${sceneNumber}] AI Horde unavailable (${hordeErr.message}). Generating high-res canvas...`);
        // Try 4: High-res colorful FFmpeg Canvas
        imageBuffer = generateFallbackImageWithFfmpeg(sceneNumber, finalPrompt);
        engineUsed = "Cinematic Canvas";
      }
    }
  }

  const saveName = `scene${sceneNumber}.png`;
  const savePath = path.join(assetsDir, saveName);

  // Clean old versions of scene (including .mp4, .webm, .jpg, .png)
  const files = fs.readdirSync(assetsDir);
  for (const f of files) {
    const l = f.toLowerCase();
    if (l.startsWith(`scene${sceneNumber}.`)) {
      try { fs.unlinkSync(path.join(assetsDir, f)); } catch (_) {}
    }
  }

  // If engine returned a real AI image, format & upscale to 1080x1920 9:16 vertical PNG
  if (engineUsed !== "Cinematic Canvas") {
    const tempPath = path.join(assetsDir, `temp_raw_scene${sceneNumber}.bin`);
    fs.writeFileSync(tempPath, imageBuffer);
    try {
      execFileSync(ffmpegPath, [
        "-i", tempPath,
        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
        "-update", "1",
        "-y", savePath
      ], { stdio: "ignore" });
      try { fs.unlinkSync(tempPath); } catch (_) {}
    } catch (scaleErr) {
      console.warn("Could not scale via ffmpeg, saving directly:", scaleErr.message);
      fs.writeFileSync(savePath, imageBuffer);
    }
  } else {
    fs.writeFileSync(savePath, imageBuffer);
  }

  console.log(`✅ [Scene ${sceneNumber}] Auto-generated image saved (${engineUsed}): ${savePath}`);

  return {
    success: true,
    sceneNumber,
    engine: engineUsed,
    filename: saveName,
    url: `/assets/${saveName}`
  };
}

/**
 * Generate images for all scenes in a storyboard
 */
async function generateAllSceneImages(scenes, apiKey, characterStyle) {
  const results = [];
  console.log(`🎨 Starting batch AI image generation for ${scenes.length} scenes (Style: ${characterStyle || 'stylized'})...`);

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const sceneNum = sc.sceneNumber || (i + 1);
    const prompt = sc.pixarPrompt || sc.prompt || `${sc.title || 'cartoon short'}, masterpiece`;

    try {
      console.log(`[Batch ${i + 1}/${scenes.length}] Generating Scene ${sceneNum}...`);
      const res = await generateImageForScene(sceneNum, prompt, apiKey, characterStyle);
      results.push(res);
    } catch (err) {
      console.error(`Failed to generate Scene ${sceneNum}:`, err.message);
      results.push({ success: false, sceneNumber: sceneNum, error: err.message });
    }
  }

  return results;
}

module.exports = {
  CHARACTER_STYLES,
  generateImageWithImagen,
  generateImageForScene,
  generateAllSceneImages
};
