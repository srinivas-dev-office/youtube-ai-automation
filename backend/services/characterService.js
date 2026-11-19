const fs = require("fs");
const path = require("path");
const { imagesDir, assetsDir, storageDir, outputDir } = require("../config");
const { execFfmpeg } = require("../utils/ffmpegHelper");
const { generateImageWithPollinations, generateImageWithHorde } = require("./imageGenerator");
const db = require("../db/database");

const CHARACTERS_FILE = path.join(storageDir, "characters.json");

/**
 * Clean starter character presets when starting fresh
 */
const DEFAULT_CHARACTERS = [
  {
    id: "char_protagonist_1",
    name: "Alex the Explorer",
    type: "Lead Hero",
    role: "Lead Protagonist",
    age: "Young Hero (12-14 years)",
    gender: "Any",
    skinTone: "Sun-kissed warm complexion",
    hairStyle: "Messy dark brown hair with a youthful headband",
    faceStructure: "Curious bright hazel eyes, friendly adventurous smile",
    bodyType: "Agile, energetic youthful build",
    costume: "Vibrant yellow adventurer jacket over utility hoodie, durable cargo pants, hiking boots",
    accessories: "Vintage brass adventure compass, weathered explorer journal",
    identifyingFeatures: "Bright curious eyes, yellow jacket, brave energetic posture",
    personality: "Courageous, curious, inventive, always eager to discover new worlds",
    description: "Young brave explorer with messy dark brown hair, bright eyes, wearing a yellow adventurer jacket with brass compass, cinematic lighting.",
    primaryImage: "/storage/images/style_realistic.svg",
    views: [
      { id: "v_front", type: "Front Portrait", url: "/storage/images/style_realistic.svg" }
    ]
  }
];

/**
 * Load all character profiles from SQLite or storage/characters.json fallback
 */
function loadCharacters(projectId) {
  // 1. Try reading from SQLite
  try {
    let rows;
    if (projectId) {
      const safeId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
      rows = db.all("SELECT * FROM characters WHERE project_id = ? ORDER BY created_at ASC", [safeId]);
    } else {
      rows = db.all("SELECT * FROM characters ORDER BY updated_at DESC");
    }

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map(c => {
        const views = db.all("SELECT id, view_type as type, image_path as url FROM character_views WHERE character_id = ?", [c.id]);
        return {
          id: c.id,
          projectId: c.project_id,
          name: c.name,
          role: c.role || "Lead Protagonist",
          type: c.type || "Lead Hero",
          age: c.age || "",
          gender: c.gender || "",
          skinTone: c.skin_tone || "",
          hairStyle: c.hair_style || "",
          faceStructure: c.face_structure || "",
          bodyType: c.body_type || "",
          costume: c.costume || "",
          accessories: c.accessories || "",
          identifyingFeatures: c.identifying_features || "",
          personality: c.personality || "",
          description: c.description || "",
          primaryImage: c.primary_image_path || "/storage/images/style_realistic.svg",
          locked: !!c.locked,
          views: views.length > 0 ? views : [
            { id: `v_${c.id}_0`, type: "Front Portrait", url: c.primary_image_path || "/storage/images/style_realistic.svg" }
          ]
        };
      });
    }
  } catch (err) {
    console.warn("Could not load characters from SQLite:", err.message);
  }

  // 2. Fallback to storage/characters.json
  if (fs.existsSync(CHARACTERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CHARACTERS_FILE, "utf8"));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (err) {
      console.warn("Could not parse characters.json:", err.message);
    }
  }

  // Fallback to active storyboard's characters if available
  const sbPath = path.join(outputDir, "generated-storyboard.json");
  if (fs.existsSync(sbPath)) {
    try {
      const sb = JSON.parse(fs.readFileSync(sbPath, "utf8"));
      if (sb && Array.isArray(sb.characters) && sb.characters.length > 0) {
        saveCharacters(sb.characters);
        return sb.characters;
      }
    } catch (_) {}
  }

  saveCharacters(DEFAULT_CHARACTERS);
  return DEFAULT_CHARACTERS;
}

/**
 * Persist characters array to SQLite and mirror to characters.json
 */
function saveCharacters(charactersList, projectId = "proj_legacy_master") {
  const safeProjId = String(projectId || "proj_legacy_master").replace(/[^a-zA-Z0-9_-]/g, "") || "proj_legacy_master";

  // Ensure project exists in SQLite
  try {
    db.run("INSERT OR IGNORE INTO projects (id, title) VALUES (?, ?)", [safeProjId, "Master Archive & Character Library"]);
  } catch (_) {}

  // Sync to SQLite
  try {
    if (Array.isArray(charactersList)) {
      db.transaction(() => {
        for (const c of charactersList) {
          const cId = c.id || `char_${Date.now()}`;
          const existingChar = db.get("SELECT id FROM characters WHERE id = ?", [cId]);
          if (existingChar) {
            db.run(
              `UPDATE characters 
               SET name = ?, role = ?, type = ?, age = ?, gender = ?, skin_tone = ?, hair_style = ?, 
                   face_structure = ?, body_type = ?, costume = ?, accessories = ?, identifying_features = ?, 
                   personality = ?, description = ?, primary_image_path = ?, locked = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`,
              [
                c.name || "Character", c.role || "Lead Protagonist", c.type || "Lead Hero",
                c.age || "", c.gender || "", c.skinTone || "", c.hairStyle || "", c.faceStructure || "",
                c.bodyType || "", c.costume || "", c.accessories || "", c.identifyingFeatures || "",
                c.personality || "", c.description || "", c.primaryImage || "", c.locked ? 1 : 0, cId
              ]
            );
          } else {
            db.run(
              `INSERT INTO characters (
                id, project_id, name, role, type, age, gender, skin_tone, hair_style,
                face_structure, body_type, costume, accessories, identifying_features,
                personality, description, primary_image_path, locked
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                cId, safeProjId, c.name || "Character", c.role || "Lead Protagonist", c.type || "Lead Hero",
                c.age || "", c.gender || "", c.skinTone || "", c.hairStyle || "", c.faceStructure || "",
                c.bodyType || "", c.costume || "", c.accessories || "", c.identifyingFeatures || "",
                c.personality || "", c.description || "", c.primaryImage || "", c.locked ? 1 : 0
              ]
            );
          }

          if (Array.isArray(c.views)) {
            for (let vIdx = 0; vIdx < c.views.length; vIdx++) {
              const v = c.views[vIdx];
              const vId = v.id || `v_${cId}_${vIdx}`;
              db.run(
                `INSERT OR REPLACE INTO character_views (id, character_id, view_type, image_path, is_primary)
                 VALUES (?, ?, ?, ?, ?)`,
                [vId, cId, v.type || "Front Portrait", v.url || "", vIdx === 0 ? 1 : 0]
              );
            }
          }
        }
      });
    }
  } catch (err) {
    console.warn("Could not sync characters to SQLite:", err.message);
  }

  // Mirror to storage/characters.json for backwards compatibility
  try {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(charactersList, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write characters.json:", err.message);
    return false;
  }
}

/**
 * Update or insert a single character
 */
function upsertCharacter(characterData, projectId) {
  const characters = loadCharacters(projectId);
  const id = characterData.id || `char_${Date.now()}`;
  const idx = characters.findIndex(c => c.id === id);

  const merged = {
    id,
    projectId: projectId || characterData.projectId || "proj_legacy_master",
    name: characterData.name || "Untitled Character",
    type: characterData.type || "Hero",
    role: characterData.role || "Lead Protagonist",
    age: characterData.age || "Young Adult",
    gender: characterData.gender || "Male",
    skinTone: characterData.skinTone || "",
    hairStyle: characterData.hairStyle || "",
    faceStructure: characterData.faceStructure || "",
    bodyType: characterData.bodyType || "",
    costume: characterData.costume || "",
    accessories: characterData.accessories || "",
    identifyingFeatures: characterData.identifyingFeatures || "",
    personality: characterData.personality || "",
    description: characterData.description || "",
    primaryImage: characterData.primaryImage || "/storage/images/character_ref.png",
    locked: !!characterData.locked,
    views: Array.isArray(characterData.views) ? characterData.views : []
  };

  if (idx >= 0) {
    characters[idx] = { ...characters[idx], ...merged };
  } else {
    characters.push(merged);
  }

  saveCharacters(characters, merged.projectId);
  return merged;
}

/**
 * Remove a character by ID
 */
function deleteCharacterById(id) {
  try {
    db.run("DELETE FROM characters WHERE id = ?", [id]);
  } catch (err) {
    console.warn("Could not delete character from SQLite:", err.message);
  }

  let characters = loadCharacters();
  characters = characters.filter(c => c.id !== id);
  try {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(characters, null, 2), "utf8");
  } catch (_) {}
  return true;
}

/**
 * Build rich character prompt based on character profile, view type, visual style, and story category
 */
function buildCharacterPrompt(character, viewType = "front", styleKey = "realistic", category = "Animation") {
  const parts = [];
  const cat = (category || "").toLowerCase();

  // View framing
  if (viewType === "full") {
    parts.push(`full-body standing character concept portrait, head to toe visible, showcasing complete costume, footwear and body proportions`);
  } else if (viewType === "profile") {
    parts.push(`three-quarter side profile view character portrait, showcasing facial structure, jawline and hair silhouette`);
  } else if (viewType === "closeup") {
    parts.push(`extreme close-up portrait of the face, detailed eyes, natural skin texture, expressive facial features`);
  } else if (viewType === "action") {
    parts.push(`dynamic heroic action pose, flowing garments, poised and powerful stance`);
  } else {
    parts.push(`front-facing character reference portrait, eye contact, upper body shot, neutral backdrop`);
  }

  // Genre / Category aesthetic styling
  if (cat.includes("horror")) {
    parts.push(`horror atmosphere, eerie chiaroscuro cinematic lighting, dark moody ambient shadows`);
  } else if (cat.includes("fantasy")) {
    parts.push(`fantasy setting, subtle glowing ethereal particles, enchanted arcane lighting`);
  } else if (cat.includes("comedy")) {
    parts.push(`lively animated comedy style, expressive humorous personality, bright cheerful lighting`);
  } else if (cat.includes("mythology")) {
    parts.push(`sacred mythological presence, celestial divine radiance, golden ambient glow`);
  } else if (cat.includes("action") || cat.includes("adventure")) {
    parts.push(`dynamic cinematic action aesthetic, dramatic golden hour rim lighting`);
  }

  // Character attributes
  parts.push(`character: ${character.name}`);
  if (character.role) parts.push(`role: ${character.role}`);
  if (character.skinTone) parts.push(`skin: ${character.skinTone}`);
  if (character.hairStyle) parts.push(`hair: ${character.hairStyle}`);
  if (character.faceStructure) parts.push(`face & eyes: ${character.faceStructure}`);
  if (character.bodyType) parts.push(`physique: ${character.bodyType}`);
  if (character.costume) parts.push(`costume: ${character.costume}`);
  if (character.accessories) parts.push(`accessories: ${character.accessories}`);
  if (character.identifyingFeatures) parts.push(`distinguishing details: ${character.identifyingFeatures}`);
  if (character.personality) parts.push(`expression & aura: ${character.personality}`);
  if (character.description) parts.push(`${character.description}`);

  parts.push(`masterpiece, highly detailed character concept sheet, studio lighting, sharp focus, 8k resolution, cinematic quality`);

  return parts.join(", ");
}

/**
 * Generate a specific perspective/view image for a character
 */
async function generateCharacterView(characterId, viewType = "front", styleKey = "realistic", category = "Animation") {
  const characters = loadCharacters();
  const character = characters.find(c => c.id === characterId);
  if (!character) throw new Error(`Character not found with ID: ${characterId}`);

  const isRealistic = styleKey === "realistic";
  const preferredModel = isRealistic ? "flux" : "turbo";
  const prompt = buildCharacterPrompt(character, viewType, styleKey, category);

  console.log(`🎨 [Character Studio] Generating ${viewType.toUpperCase()} view for "${character.name}" (${styleKey} / ${category}):\n👉 Prompt: ${prompt.slice(0, 100)}...`);

  let buffer = null;
  let engine = "Pollinations AI";

  try {
    buffer = await generateImageWithPollinations(prompt, styleKey, preferredModel);
    engine = isRealistic ? "Pollinations AI (FLUX Photoreal)" : "Pollinations AI";
  } catch (err) {
    try {
      buffer = await generateImageWithHorde(prompt, styleKey);
      engine = "AI Horde";
    } catch (_) {
      // Fallback canvas if offline
      const { execFfmpeg } = require("../utils/ffmpegHelper");
      const fallbackPath = path.join(imagesDir, `char_${characterId}_fallback.png`);
      execFfmpeg([
        "-f", "lavfi",
        "-i", `color=c=midnightblue:s=1080x1920:d=1`,
        "-vf", `drawtext=text='${character.name.toUpperCase()}':fontcolor=gold:fontsize=80:x=(w-text_w)/2:y=900`,
        "-vframes", "1",
        "-update", "1",
        "-y", fallbackPath
      ], { stdio: "ignore" });
      buffer = fs.readFileSync(fallbackPath);
      engine = "Canvas Fallback";
    }
  }

  const filename = `char_${characterId}_${viewType}_${Date.now()}.png`;
  const storagePath = path.join(imagesDir, filename);
  const assetPath = path.join(assetsDir, filename);

  // High-Quality Upscale to 1080x1920
  const tempPath = path.join(imagesDir, `temp_${filename}.bin`);
  fs.writeFileSync(tempPath, buffer);
  try {
    execFfmpeg([
      "-i", tempPath,
      "-vf", "scale=1080:1920:flags=lanczos,unsharp=5:5:0.8:5:5:0.0",
      "-vframes", "1",
      "-update", "1",
      "-y", storagePath
    ], { stdio: "ignore" });
    try { fs.unlinkSync(tempPath); } catch (_) {}
  } catch (_) {
    fs.writeFileSync(storagePath, buffer);
  }

  try { fs.copyFileSync(storagePath, assetPath); } catch (_) {}

  const url = `/storage/images/${filename}?_t=${Date.now()}`;
  const viewId = `v_${viewType}_${Date.now()}`;

  // Update character views array
  if (!Array.isArray(character.views)) character.views = [];
  const existingViewIdx = character.views.findIndex(v => v.type.toLowerCase().includes(viewType.toLowerCase()));
  if (existingViewIdx >= 0) {
    character.views[existingViewIdx] = { id: viewId, type: formatViewTypeName(viewType), url };
  } else {
    character.views.push({ id: viewId, type: formatViewTypeName(viewType), url });
  }

  // Set as primary image
  character.primaryImage = url;

  // Also sync to character_ref.png for scene consistency
  try {
    fs.copyFileSync(storagePath, path.join(imagesDir, "character_ref.png"));
    fs.copyFileSync(storagePath, path.join(assetsDir, "character_ref.png"));
  } catch (_) {}

  saveCharacters(characters);

  return {
    success: true,
    characterId,
    viewType,
    url,
    filename,
    engine,
    character
  };
}

/**
 * Synchronize characters directly from a newly generated screenplay/storyboard
 * Replaces old characters with the active story's characters!
 */
async function syncCharactersFromStoryboard(storyboard, styleKey = "stylized", category = "Animation") {
  if (!storyboard) return [];

  let rawChars = storyboard.characters;
  if (!Array.isArray(rawChars) || rawChars.length === 0) {
    const { extractFallbackCharacters } = require("./storyGenerator");
    rawChars = extractFallbackCharacters(storyboard.narration || storyboard.title || "", category, styleKey);
  }

  const formattedChars = [];
  for (let i = 0; i < rawChars.length; i++) {
    const raw = rawChars[i];
    const safeName = (raw.name || `Character ${i + 1}`).trim();
    const id = `char_${safeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now() + i}`;

    const charObj = {
      id,
      name: safeName,
      type: raw.type || (i === 0 ? "Lead Hero" : "Supporting"),
      role: raw.role || (i === 0 ? "Lead Protagonist" : "Supporting Character"),
      age: raw.age || "Young Adult",
      gender: raw.gender || "Any",
      skinTone: raw.skinTone || "",
      hairStyle: raw.hairStyle || "",
      faceStructure: raw.faceStructure || "",
      bodyType: raw.bodyType || "",
      costume: raw.costume || "",
      accessories: raw.accessories || "",
      identifyingFeatures: raw.identifyingFeatures || "",
      personality: raw.personality || "",
      description: raw.description || `${safeName}, ${raw.role || 'character'} in ${category} story.`,
      primaryImage: `/storage/images/style_${styleKey}.svg`,
      views: [
        { id: "v_front", type: "Front Portrait", url: `/storage/images/style_${styleKey}.svg` }
      ]
    };

    formattedChars.push(charObj);
  }

  // Save the fresh character list immediately
  saveCharacters(formattedChars);

  // Generate reference image for the lead character and supporting character
  for (const char of formattedChars) {
    try {
      const genRes = await generateCharacterView(char.id, "front", styleKey, category);
      if (genRes && genRes.url) {
        char.primaryImage = genRes.url;
      }
    } catch (err) {
      console.warn(`[Character Sync] Image generation notice for ${char.name}:`, err.message);
    }
  }

  saveCharacters(formattedChars);

  // Attach to storyboard
  storyboard.characters = formattedChars;
  try {
    const sbPath = path.join(outputDir, "generated-storyboard.json");
    fs.writeFileSync(sbPath, JSON.stringify(storyboard, null, 2), "utf8");
  } catch (_) {}

  return formattedChars;
}

function formatViewTypeName(v) {
  if (v === "full") return "Full Body";
  if (v === "profile") return "Side Profile";
  if (v === "closeup") return "Facial Close-up";
  if (v === "action") return "Action Pose";
  return "Front Portrait";
}

/**
 * Set an image as the approved primary reference for a character
 */
function setPrimaryReference(characterId, imageUrl) {
  const characters = loadCharacters();
  const character = characters.find(c => c.id === characterId);
  if (!character) throw new Error(`Character not found: ${characterId}`);

  character.primaryImage = imageUrl;
  character.locked = true;
  saveCharacters(characters);

  // Sync to character_ref.png for backward compatibility with scene generation
  const filename = path.basename(imageUrl.split("?")[0]);
  const srcPath = path.join(imagesDir, filename);
  if (fs.existsSync(srcPath)) {
    try {
      fs.copyFileSync(srcPath, path.join(imagesDir, "character_ref.png"));
      fs.copyFileSync(srcPath, path.join(assetsDir, "character_ref.png"));
    } catch (_) {}
  }

  return { success: true, characterId, primaryImage: imageUrl };
}

/**
 * Upload a custom reference photo for a character
 */
function saveUploadedCharacterPhoto(characterId, filename, base64Data) {
  const characters = loadCharacters();
  const character = characters.find(c => c.id === characterId);
  if (!character) throw new Error(`Character not found: ${characterId}`);

  const allowedExts = [".png", ".jpg", ".jpeg", ".webp"];
  const rawExt = (path.extname(filename || ".png") || ".png").toLowerCase();
  const ext = allowedExts.includes(rawExt) ? rawExt : ".png";
  const safeCharId = String(characterId).replace(/[^a-zA-Z0-9_-]/g, "");
  const saveName = `char_${safeCharId}_upload_${Date.now()}${ext}`;
  const storagePath = path.join(imagesDir, saveName);
  const assetPath = path.join(assetsDir, saveName);

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  fs.writeFileSync(storagePath, buffer);
  try { fs.writeFileSync(assetPath, buffer); } catch (_) {}

  const url = `/storage/images/${saveName}?_t=${Date.now()}`;
  if (!Array.isArray(character.views)) character.views = [];
  character.views.unshift({ id: `v_upload_${Date.now()}`, type: "Uploaded Reference", url });
  character.primaryImage = url;

  saveCharacters(characters);

  // Also sync to character_ref.png
  try {
    fs.copyFileSync(storagePath, path.join(imagesDir, "character_ref.png"));
    fs.copyFileSync(storagePath, path.join(assetsDir, "character_ref.png"));
  } catch (_) {}

  return { success: true, characterId, url, character };
}

/**
 * Toggle or set character lock state
 */
function toggleCharacterLock(characterId, isLocked) {
  const characters = loadCharacters();
  const character = characters.find(c => c.id === characterId);
  if (!character) throw new Error(`Character not found: ${characterId}`);
  character.locked = isLocked !== undefined ? !!isLocked : !character.locked;
  saveCharacters(characters);
  return { success: true, characterId, locked: character.locked, character };
}

/**
 * Get unified project context
 */
function getProjectContext() {
  const characters = loadCharacters();
  let storyboard = null;
  const sbPath = path.join(outputDir, "generated-storyboard.json");
  if (fs.existsSync(sbPath)) {
    try { storyboard = JSON.parse(fs.readFileSync(sbPath, "utf8")); } catch (_) {}
  }

  // Check scene assets
  const scenesWithStatus = (storyboard && Array.isArray(storyboard.scenes)) ? storyboard.scenes.map((s, idx) => {
    const sceneNum = s.sceneNumber || (idx + 1);
    const imgName = `scene${sceneNum}.png`;
    const imgPath = path.join(imagesDir, imgName);
    const clipPath = path.join(outputDir, `scene_clip_${sceneNum}.mp4`);
    const hasImage = fs.existsSync(imgPath);
    const hasClip = fs.existsSync(clipPath);

    return {
      ...s,
      sceneNumber: sceneNum,
      status: hasImage ? "ready" : "pending",
      hasClip,
      imageUrl: hasImage ? `/storage/images/${imgName}` : null
    };
  }) : [];

  const videoFile = path.join(outputDir, "final-cartoon-short.mp4");
  const hasVideo = fs.existsSync(videoFile);

  const pipeline = {
    screenplay: storyboard ? "ready" : "pending",
    characters: characters.length > 0 ? (characters.some(c => c.locked) ? "locked" : "ready") : "pending",
    scenes: scenesWithStatus.length > 0 && scenesWithStatus.every(s => s.status === "ready") ? "ready" : (scenesWithStatus.some(s => s.status === "ready") ? "partial" : "pending"),
    video: hasVideo ? "ready" : "pending"
  };

  return {
    success: true,
    title: storyboard ? storyboard.title : "New Project",
    category: storyboard ? storyboard.category : "Animation",
    duration: storyboard ? storyboard.duration : 20,
    characterStyle: storyboard ? (storyboard.characterStyle || "realistic") : "realistic",
    characters,
    storyboard: storyboard ? { ...storyboard, scenes: scenesWithStatus } : null,
    hasVideo,
    videoUrl: hasVideo ? `/api/video?_t=${Date.now()}` : null,
    pipeline
  };
}

module.exports = {
  loadCharacters,
  saveCharacters,
  upsertCharacter,
  deleteCharacterById,
  generateCharacterView,
  setPrimaryReference,
  saveUploadedCharacterPhoto,
  buildCharacterPrompt,
  syncCharactersFromStoryboard,
  toggleCharacterLock,
  getProjectContext
};
