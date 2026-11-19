const fs = require("fs");
const path = require("path");
const { execFfmpeg } = require("../utils/ffmpegHelper");
const { geminiApiKey, imagesDir, assetsDir } = require("../config");

// Studio-Grade Style Definitions with Positive and Negative Prompts
const CHARACTER_STYLES = {
  "realistic": {
    positive: "cinematic film photography, ultra-realistic human beings, authentic skin pores, fine skin texture, natural human anatomy, realistic facial expression, intricate details, natural ambient sunlight, 85mm f/1.4 portrait lens, depth of field, photorealistic cinematic film still, Hasselblad 8k",
    negative: "cartoon, anime, 3d render, cgi, doll, plastic, wax figure, painting, drawing, illustration, deformed, blurry, bad anatomy, bad eyes, extra fingers, extra limbs, watermark, text, low quality, oversaturated"
  },
  "stylized": {
    positive: "masterpiece, 8k 3D render, Pixar Disney animation style, exaggerated expressive facial features, cute character design, volumetric dramatic lighting, vibrant rich colors, smooth glossy surfaces",
    negative: "photorealistic, live action, noisy, ugly, deformed, bad anatomy, blurry, extra limbs, bad eyes, watermark, text, low quality"
  },
  "anime": {
    positive: "masterpiece modern anime aesthetic, Makoto Shinkai style, large expressive glittering eyes, detailed anime hair, dynamic cinematic lighting, vibrant cel-shaded color palette, crisp line art",
    negative: "3d render, photorealistic, ugly, deformed, blurry, bad anatomy, bad eyes, low resolution, watermark, text"
  },
  "chibi": {
    positive: "ultra cute chibi character style, oversized head and cute small body, giant glossy sparkling eyes, soft clay figurine render, kawaii aesthetics, pastel lighting, 8k smooth 3D render",
    negative: "photorealistic, realistic proportions, ugly, deformed, bad anatomy, blurry, watermark, text"
  },
  "rubber_hose": {
    positive: "1930s vintage rubber hose animation style, Cuphead cartoon aesthetic, pie eyes, white gloves, fluid noodly limbs, expressive playful face, vintage print texture, retro cartoon art",
    negative: "modern 3d, realistic, photorealistic, blurry, deformed, watermark, text"
  },
  "flat_geometric": {
    positive: "masterpiece flat geometric vector illustration, clean geometric shapes, minimalist silhouette, bold Bauhaus color blocking, modern stylish graphic design, crisp sharp edges",
    negative: "3d render, photorealistic, noisy, blurry, gradient, realistic shading, watermark, text"
  },
  "pixel": {
    positive: "masterpiece 16-bit retro arcade pixel art, crisp nostalgic pixel sprites, vibrant color palette, detailed pixel shading, nostalgic 90s video game cutscene",
    negative: "smooth, vector, 3d render, photorealistic, blurry, anti-aliased, watermark, text"
  },
  "low_poly": {
    positive: "stylish 3D low-poly art style, faceted polygon character surfaces, depth and ambient occlusion, beautiful volumetric lighting, trendy isometric 3D game aesthetic, rich vibrant color gradients",
    negative: "smooth surfaces, realistic textures, photorealistic, blurry, deformed, watermark, text"
  }
};

/**
 * Strips cartoon/3D animation keywords when generating photorealistic human scenes
 */
function sanitizePromptForStyle(prompt, styleKey) {
  if (!prompt) return "";
  if (styleKey === "realistic") {
    return prompt
      .replace(/\b(3d render|3d animation|3d model|3d|pixar|disney|cartoon|animated|animation|cgi|chibi|anime|low poly|claymation|figurine|toy|doll|wax figure|plastic)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return prompt;
}

/**
 * Tier 1: Pollinations AI (High-Definition 720x1280)
 * Uses FLUX for realistic human photography; turbo for stylized cartoons
 */
async function generateImageWithPollinations(prompt, styleKey = "stylized", preferredModel = null) {
  const isRealistic = styleKey === "realistic";
  const chosenModel = preferredModel || (isRealistic ? "flux" : "turbo");
  const styleObj = CHARACTER_STYLES[styleKey] || CHARACTER_STYLES["stylized"];
  const cleanScenePrompt = sanitizePromptForStyle(prompt, styleKey);
  const fullPrompt = `${styleObj.positive}, ${cleanScenePrompt}, sharp focus, masterpiece`;
  const cleanPrompt = encodeURIComponent(fullPrompt.slice(0, 1500));
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=720&height=1280&nologo=true&seed=${seed}&model=${chosenModel}`;

  console.log(`🌐 [Pollinations AI (${chosenModel})] Generating scene image: ${cleanScenePrompt.slice(0, 60)}...`);
  const controller = new AbortController();
  const timeoutMs = isRealistic ? 25000 : 16000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Pollinations API returned status: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Tier 2: AI Horde (Distributed Free Stable Diffusion Cluster with High-Quality Sampler)
 */
async function generateImageWithHorde(prompt, styleKey = "stylized") {
  const isRealistic = styleKey === "realistic";
  const styleObj = CHARACTER_STYLES[styleKey] || CHARACTER_STYLES["stylized"];
  const cleanScenePrompt = sanitizePromptForStyle(prompt, styleKey);
  const positive = `${styleObj.positive}, ${cleanScenePrompt}, masterpiece, 8k photographic render, cinematic lighting, sharp focus`;
  const negative = `${styleObj.negative}, blurry, low quality, distorted, bad anatomy, extra limbs, bad eyes, watermark, text, artifacts, noisy, low resolution`;

  console.log(`🌐 [AI Horde (${isRealistic ? 'ICBINP Photorealism' : 'SDXL'})] Generating high-quality image: ${cleanScenePrompt.slice(0, 60)}...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  const payload = {
    prompt: `${positive} ### ${negative}`,
    params: {
      width: 448,
      height: 768,
      steps: 18,
      sampler_name: "k_euler_a",
      cfg_scale: 7.0,
      n: 1
    }
  };

  if (isRealistic) {
    payload.models = [
      "ICBINP - I Can't Believe It's Not Photography",
      "AlbedoBase XL 3.1",
      "Juggernaut XL",
      "epicrealism"
    ];
  }

  try {
    const postRes = await fetch("https://aihorde.net/api/v2/generate/async", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "apikey": "0000000000"
      },
      body: JSON.stringify(payload)
    });

    if (!postRes.ok) throw new Error(`AI Horde request failed: ${postRes.status}`);
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
 * Tier 0: Google Nano Banana 2 (gemini-3.1-flash-image)
 * High-efficiency multi-modal image generation with character reference anchoring
 */
async function generateImageWithNanoBanana2(prompt, characterStyle = "stylized", characterRefPath = null, apiKey = null) {
  const key = apiKey || process.env.GEMINI_API_KEY || geminiApiKey;
  if (!key || key === "your_gemini_api_key_here") {
    throw new Error("No Gemini API key configured for Google Nano Banana 2");
  }

  const styleObj = CHARACTER_STYLES[characterStyle] || CHARACTER_STYLES["stylized"];
  const cleanScenePrompt = sanitizePromptForStyle(prompt, characterStyle);
  const fullPrompt = `${styleObj.positive}, ${cleanScenePrompt}, vibrant atmospheric lighting, 8k render, masterpiece`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${key}`;

  const contentsParts = [];

  // Multimodal Character Consistency: If a locked character turnaround image exists, attach it as visual reference
  if (characterRefPath && fs.existsSync(characterRefPath)) {
    try {
      const refData = fs.readFileSync(characterRefPath).toString("base64");
      const ext = path.extname(characterRefPath).toLowerCase();
      const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
      contentsParts.push({
        inlineData: {
          mimeType,
          data: refData
        }
      });
      contentsParts.push({
        text: `Using the exact character visual identity from the attached reference image (identical face structure, skin tone, hair, and costume), render the following scene: ${fullPrompt}`
      });
    } catch (_) {
      contentsParts.push({ text: fullPrompt });
    }
  } else {
    contentsParts.push({ text: fullPrompt });
  }

  console.log(`🍌 [Google Nano Banana 2 (gemini-3.1-flash-image)] Generating scene image: ${cleanScenePrompt.slice(0, 60)}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: contentsParts }],
      generationConfig: {
        responseMimeType: "image/png"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Nano Banana 2 API error ${response.status}: ${errText.slice(0, 150)}`);
  }

  const data = await response.json();
  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
  const base64Str = part?.inlineData?.data || part?.inline_data?.data;

  if (!base64Str) {
    throw new Error("Google Nano Banana 2 did not return image data");
  }

  return Buffer.from(base64Str, "base64");
}

/**
 * Tier 3: FFmpeg Canvas Fallback
 */
function generateFallbackImageWithFfmpeg(sceneNumber, prompt) {
  const colors = ["midnightblue", "darkslateblue", "navy", "darkcyan", "purple", "indigo", "teal", "darkgreen"];
  const bgColor = colors[(sceneNumber - 1) % colors.length];
  const saveName = `scene${sceneNumber}.png`;
  const savePath = path.join(imagesDir, saveName);

  const safePrompt = (prompt || `Scene ${sceneNumber}`).replace(/[^\w\s]/g, " ").slice(0, 36);

  execFfmpeg([
    "-f", "lavfi",
    "-i", `color=c=${bgColor}:s=1080x1920:d=1`,
    "-vf", `drawtext=text='ACT ${sceneNumber}':fontcolor=gold:fontsize=90:borderw=4:bordercolor=black:x=(w-text_w)/2:y=800,drawtext=text='${safePrompt}':fontcolor=white:fontsize=46:borderw=3:bordercolor=black:x=(w-text_w)/2:y=950`,
    "-vframes", "1",
    "-update", "1",
    "-y", savePath
  ]);

  return fs.readFileSync(savePath);
}

/**
 * Generate image for a specific scene with multi-engine fallback and upscale to 1080x1920 using Lanczos + Unsharp
 */
async function generateImageForScene(sceneNumber, prompt, apiKey, characterStyle = "stylized", characterDetails = "", category = "Animation", previousScenePrompt = "", projectId = null) {
  let imageBuffer = null;
  let engineUsed = "Pollinations AI";

  let rawPrompt = prompt || `Scene ${sceneNumber}`;
  try {
    const { storageDir, outputDir } = require("../config");

    // 1. Read active storyboard context for environment continuity
    let activeStoryboard = null;
    const sbPath = path.join(outputDir, "generated-storyboard.json");
    if (fs.existsSync(sbPath)) {
      try { activeStoryboard = JSON.parse(fs.readFileSync(sbPath, "utf8")); } catch (_) { }
    }

    let envContinuity = "";
    if (previousScenePrompt && previousScenePrompt.trim().length > 0) {
      envContinuity = `Continuing environment and lighting from: ${previousScenePrompt.slice(0, 100)}`;
    } else if (activeStoryboard && Array.isArray(activeStoryboard.scenes) && sceneNumber > 1) {
      const prevScene = activeStoryboard.scenes[sceneNumber - 2];
      if (prevScene) {
        envContinuity = `Continuing environment continuity from Scene ${sceneNumber - 1}: ${prevScene.storyBeat || prevScene.title || ''}`;
      }
    }

    // 2. Read project-scoped or global characters from SQLite/storage
    let chars = [];
    try {
      const characterService = require("./characterService");
      chars = characterService.loadCharacters(projectId || undefined);
    } catch (_) {
      const charsFile = path.join(storageDir, "characters.json");
      if (fs.existsSync(charsFile)) {
        try { chars = JSON.parse(fs.readFileSync(charsFile, "utf8")); } catch (_) {}
      }
    }

    if (Array.isArray(chars) && chars.length > 0) {
      let matchingChars = chars.filter(c => c.name && rawPrompt.toLowerCase().includes(c.name.toLowerCase()));
      if (matchingChars.length === 0) {
        matchingChars = chars.filter(c => {
          const roleWords = (c.role || "").toLowerCase().split(/\s+/).filter(w => w.length > 3);
          const nameWords = (c.name || "").toLowerCase().split(/\s+/).filter(w => w.length > 3);
          return roleWords.some(w => rawPrompt.toLowerCase().includes(w)) || nameWords.some(w => rawPrompt.toLowerCase().includes(w));
        });
      }
      if (matchingChars.length === 0 && chars.length > 0) {
        const pL = rawPrompt.toLowerCase();
        if (pL.includes("she") || pL.includes("he") || pL.includes("girl") || pL.includes("boy") || pL.includes("protagonist") || pL.includes("enters") || pL.includes("standing") || pL.includes("walking") || pL.includes("discovers") || pL.includes("approaches")) {
          matchingChars = [chars[0]];
        }
      }

      if (matchingChars.length > 0) {
        const charAnchors = matchingChars.map(c =>
          `exact character reference for ${c.name} (locked visual identity): identical face structure, eye color, ${c.skinTone || ''}, ${c.hairStyle || ''}, wearing the exact same costume: ${c.costume || ''}, ${c.accessories || ''}, ${c.identifyingFeatures || ''}, no character variation`
        ).join(". ");
        rawPrompt = `${rawPrompt}. ${charAnchors}`;
      } else if (characterDetails && characterDetails.trim().length > 0 && !rawPrompt.includes(characterDetails.slice(0, 20))) {
        rawPrompt = `Consistent character appearance (${characterDetails.trim()}): ${rawPrompt}`;
      }
    } else if (characterDetails && characterDetails.trim().length > 0 && !rawPrompt.includes(characterDetails.slice(0, 20))) {
      rawPrompt = `Consistent character appearance (${characterDetails.trim()}): ${rawPrompt}`;
    }

    if (envContinuity) {
      rawPrompt = `${rawPrompt}. ${envContinuity}`;
    }
    if (category) {
      rawPrompt = `${rawPrompt}. Atmospheric ${category} aesthetic and dramatic cinematic lighting`;
    }
  } catch (_) {
    if (characterDetails && characterDetails.trim().length > 0 && !rawPrompt.includes(characterDetails.slice(0, 20))) {
      rawPrompt = `Consistent character appearance (${characterDetails.trim()}): ${rawPrompt}`;
    }
  }
  const isRealistic = characterStyle === "realistic";
  const preferredModel = isRealistic ? "flux" : "turbo";

  // Resolve locked character reference image for multi-modal visual anchoring
  let characterRefPath = null;
  if (projectId) {
    try {
      const projectService = require("./projectService");
      const pDirs = projectService.getProjectDirs(projectId);
      const possibleRefs = [
        path.join(pDirs.images, "character_ref.png"),
        path.join(pDirs.images, "character_ref.jpg"),
        path.join(pDirs.images, "character_front.png"),
        path.join(imagesDir, "character_ref.png")
      ];
      for (const pr of possibleRefs) {
        if (fs.existsSync(pr)) {
          characterRefPath = pr;
          break;
        }
      }
    } catch (_) {}
  } else {
    const globalRef = path.join(imagesDir, "character_ref.png");
    if (fs.existsSync(globalRef)) characterRefPath = globalRef;
  }

  // Tier 0: Google Nano Banana 2 (gemini-3.1-flash-image)
  const keyToUse = apiKey || process.env.GEMINI_API_KEY || geminiApiKey;
  if (keyToUse && keyToUse !== "your_gemini_api_key_here") {
    try {
      imageBuffer = await generateImageWithNanoBanana2(rawPrompt, characterStyle, characterRefPath, keyToUse);
      engineUsed = "Google Nano Banana 2 (gemini-3.1-flash-image)";
    } catch (bananaErr) {
      console.warn(`[Scene ${sceneNumber}] Google Nano Banana 2 notice (${bananaErr.message}). Cascading to Pollinations...`);
    }
  }

  // Tier 1 & 2 Fallbacks
  if (!imageBuffer) {
    try {
      imageBuffer = await generateImageWithPollinations(rawPrompt, characterStyle, preferredModel);
      engineUsed = isRealistic ? "Pollinations AI (FLUX Photoreal)" : "Pollinations AI";
    } catch (pollErr) {
      console.warn(`[Scene ${sceneNumber}] Pollinations unavailable (${pollErr.message}). Switching to AI Horde...`);
      try {
        imageBuffer = await generateImageWithHorde(rawPrompt, characterStyle);
        engineUsed = isRealistic ? "AI Horde (ICBINP Photoreal)" : "AI Horde";
      } catch (hordeErr) {
        console.warn(`[Scene ${sceneNumber}] AI Horde unavailable (${hordeErr.message}). Using Fallback Canvas...`);
        imageBuffer = generateFallbackImageWithFfmpeg(sceneNumber, rawPrompt);
        engineUsed = "Cinematic Canvas";
      }
    }
  }

  const saveName = `scene${sceneNumber}.png`;
  const storagePath = path.join(imagesDir, saveName);
  const legacyAssetPath = path.join(assetsDir, saveName);

  // High-Quality Upscale to 1080x1920 9:16 with Lanczos filter and unsharp sharpening
  if (engineUsed !== "Cinematic Canvas") {
    const tempPath = path.join(imagesDir, `temp_raw_scene${sceneNumber}.bin`);
    fs.writeFileSync(tempPath, imageBuffer);
    try {
      execFfmpeg([
        "-i", tempPath,
        "-vf", "scale=1080:1920:flags=lanczos,unsharp=5:5:0.8:5:5:0.0",
        "-vframes", "1",
        "-update", "1",
        "-y", storagePath
      ], { stdio: "ignore" });
      try { fs.unlinkSync(tempPath); } catch (_) { }
    } catch (_) {
      fs.writeFileSync(storagePath, imageBuffer);
    }
  } else {
    fs.writeFileSync(storagePath, imageBuffer);
  }

  // Synchronize to assetsDir for full backward compatibility
  try {
    fs.copyFileSync(storagePath, legacyAssetPath);
  } catch (_) { }

  // Synchronize to project-isolated storage directory
  if (projectId) {
    try {
      const projectService = require("./projectService");
      const projDirs = projectService.getProjectDirs(projectId);
      const projImgPath = path.join(projDirs.images, saveName);
      fs.copyFileSync(storagePath, projImgPath);
    } catch (_) { }
  }

  console.log(`✅ [Scene ${sceneNumber}] Image generated and saved (${engineUsed}): ${storagePath}`);

  return {
    success: true,
    sceneNumber,
    engine: engineUsed,
    filename: saveName,
    url: `/assets/${saveName}`,
    storageUrl: `/storage/images/${saveName}`
  };
}

/**
 * Generate images for all scenes with controlled concurrency and staggering to prevent rate limits
 */
async function generateAllSceneImages(scenes, apiKey, characterStyle = "stylized") {
  console.log(`🚀 Starting staggered image generation for ${scenes.length} scenes (Style: ${characterStyle})...`);
  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const sceneNum = sc.sceneNumber || (i + 1);
    const prompt = sc.pixarPrompt || sc.imagePrompt || sc.prompt || `${sc.title || 'cinematic short'}, masterpiece`;

    // Pause briefly between calls if more than 1 scene to prevent API rate-limit bursts (402/429)
    if (i > 0) {
      await new Promise(r => setTimeout(r, 1200));
    }

    try {
      const res = await generateImageForScene(sceneNum, prompt, apiKey, characterStyle);
      results.push(res);
    } catch (err) {
      results.push({ success: false, sceneNumber: sceneNum, error: err.message });
    }
  }
  console.log(`✨ Completed image generation for ${results.length} scenes.`);
  return results;
}

/**
 * Generate Master Character Reference Image for consistent visual appearance across all scenes
 */
async function generateCharacterReference(characterName, description, styleKey = "stylized") {
  const isRealistic = styleKey === "realistic";
  const preferredModel = isRealistic ? "flux" : "turbo";
  const name = characterName || "Lead Protagonist";
  const desc = description || "expressive features, distinctive outfit, detailed character concept";
  const cleanPrompt = `Character concept sheet portrait: ${name}, ${desc}, full upper body shot, eye contact, front-facing, neutral background, masterpiece, studio lighting, highly detailed consistent character design`;
  const saveName = "character_ref.png";
  const storagePath = path.join(imagesDir, saveName);
  const assetPath = path.join(assetsDir, saveName);

  let buffer = null;
  let engine = "Pollinations AI";

  const keyToUse = process.env.GEMINI_API_KEY || geminiApiKey;
  if (keyToUse && keyToUse !== "your_gemini_api_key_here") {
    try {
      buffer = await generateImageWithNanoBanana2(cleanPrompt, styleKey, null, keyToUse);
      engine = "Google Nano Banana 2 (gemini-3.1-flash-image)";
    } catch (bananaErr) {
      console.warn(`[generateCharacterReference] Google Nano Banana 2 note: ${bananaErr.message}`);
    }
  }

  if (!buffer) {
    try {
      buffer = await generateImageWithPollinations(cleanPrompt, styleKey, preferredModel);
      engine = isRealistic ? "Pollinations AI (FLUX)" : "Pollinations AI";
    } catch (err) {
      try {
        buffer = await generateImageWithHorde(cleanPrompt, styleKey);
        engine = "AI Horde";
      } catch (_) {
        buffer = generateFallbackImageWithFfmpeg(1, `Character: ${name}`);
        engine = "Canvas Fallback";
      }
    }
  }

  fs.writeFileSync(storagePath, buffer);
  try { fs.writeFileSync(assetPath, buffer); } catch (_) { }

  return {
    success: true,
    url: `/assets/${saveName}?_t=${Date.now()}`,
    filename: saveName,
    characterName: name,
    description: desc,
    styleKey,
    engine
  };
}

/**
 * Advanced AI Character Replacement:
 * Replaces a character or person in a scene while preserving background, camera angle, lighting, and composition.
 */
async function previewCharacterReplacement(sceneNumber, originalCharacter, newCharacter, expression, action, characterStyle = "realistic", referenceUrl = null) {
  const isRealistic = characterStyle === "realistic";
  const preferredModel = isRealistic ? "flux" : "turbo";

  // Build a composition-preserving prompt
  let promptParts = [];
  if (originalCharacter && originalCharacter.trim()) {
    promptParts.push(`In a scene where ${originalCharacter.trim()} was present, seamlessly replace them with: ${newCharacter.trim()}`);
  } else {
    promptParts.push(`Character in scene replaced with: ${newCharacter.trim()}`);
  }

  if (expression && expression.trim()) {
    promptParts.push(`facial expression: ${expression.trim()}`);
  }
  if (action && action.trim()) {
    promptParts.push(`pose/action: ${action.trim()}`);
  }
  promptParts.push(`preserve original scene environment, dramatic cinematic lighting, photorealistic composition, 8k resolution, cinematic film still`);

  const fullPrompt = promptParts.join(", ");
  console.log(`🎭 [AI Character Replacement] Generating preview for Scene ${sceneNumber}: ${fullPrompt.slice(0, 80)}...`);

  let buffer = null;
  let engine = "Pollinations AI";

  try {
    buffer = await generateImageWithPollinations(fullPrompt, characterStyle, preferredModel);
    engine = isRealistic ? "Pollinations AI (FLUX Photoreal)" : "Pollinations AI";
  } catch (err) {
    try {
      buffer = await generateImageWithHorde(fullPrompt, characterStyle);
      engine = "AI Horde";
    } catch (_) {
      buffer = generateFallbackImageWithFfmpeg(sceneNumber, `Replaced: ${newCharacter}`);
      engine = "Canvas Fallback";
    }
  }

  const previewName = `char_replace_preview_scene${sceneNumber}.png`;
  const previewPath = path.join(imagesDir, previewName);
  const assetPreviewPath = path.join(assetsDir, previewName);

  // Upscale to 1080x1920
  if (engine !== "Canvas Fallback") {
    const tempPath = path.join(imagesDir, `temp_raw_replace_${sceneNumber}.bin`);
    fs.writeFileSync(tempPath, buffer);
    try {
      execFfmpeg([
        "-i", tempPath,
        "-vf", "scale=1080:1920:flags=lanczos,unsharp=5:5:0.8:5:5:0.0",
        "-vframes", "1",
        "-update", "1",
        "-y", previewPath
      ], { stdio: "ignore" });
      try { fs.unlinkSync(tempPath); } catch (_) { }
    } catch (_) {
      fs.writeFileSync(previewPath, buffer);
    }
  } else {
    fs.writeFileSync(previewPath, buffer);
  }

  try { fs.copyFileSync(previewPath, assetPreviewPath); } catch (_) { }

  return {
    success: true,
    sceneNumber,
    previewUrl: `/assets/${previewName}?_t=${Date.now()}`,
    previewFilename: previewName,
    engine,
    prompt: fullPrompt
  };
}

async function applyCharacterReplacement(sceneNumber, previewFilename, adjustments = {}) {
  const saveName = `scene${sceneNumber}.png`;
  const storagePath = path.join(imagesDir, saveName);
  const assetPath = path.join(assetsDir, saveName);
  const previewFile = path.join(imagesDir, previewFilename || `char_replace_preview_scene${sceneNumber}.png`);

  if (!fs.existsSync(previewFile)) {
    throw new Error(`Preview file not found: ${previewFilename}`);
  }

  // Copy preview to target scene
  fs.copyFileSync(previewFile, storagePath);
  try { fs.copyFileSync(previewFile, assetPath); } catch (_) { }

  // Re-render scene clip with FFmpeg for instant video preview sync
  const { renderSceneClip, findSceneMedia } = require("./videoGenerator");
  const { outputDir } = require("../config");
  const clipPath = path.join(outputDir, `scene_clip_${sceneNumber}.mp4`);
  const mediaInfo = findSceneMedia(sceneNumber);

  try {
    renderSceneClip(mediaInfo, sceneNumber, 2.5, "zoom_in", clipPath, adjustments.aspectRatio || "9:16", adjustments);
  } catch (clipErr) {
    console.warn(`[Apply Replace] Clip re-render notice:`, clipErr.message);
  }

  console.log(`✅ [AI Character Replacement] Scene ${sceneNumber} successfully replaced with new character!`);
  return {
    success: true,
    sceneNumber,
    url: `/assets/${saveName}?_t=${Date.now()}`,
    filename: saveName
  };
}

async function applyCharacterReplacementToAll(scenes, newCharacter, characterStyle = "realistic") {
  console.log(`🎭 [AI Character Consistency] Propagating new character across ${scenes.length} scenes...`);
  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const sceneNum = sc.sceneNumber || (i + 1);
    const scenePrompt = `${sc.story || sc.prompt || `Scene ${sceneNum}`}, featuring consistent character: ${newCharacter}`;

    if (i > 0) await new Promise(r => setTimeout(r, 1200));

    try {
      const imgRes = await generateImageForScene(sceneNum, scenePrompt, null, characterStyle, newCharacter);
      results.push(imgRes);
    } catch (e) {
      results.push({ sceneNumber: sceneNum, success: false, error: e.message });
    }
  }
  return results;
}

module.exports = {
  CHARACTER_STYLES,
  generateImageForScene,
  generateAllSceneImages,
  generateImageWithNanoBanana2,
  generateImageWithPollinations,
  generateImageWithHorde,
  generateCharacterReference,
  previewCharacterReplacement,
  applyCharacterReplacement,
  applyCharacterReplacementToAll
};
