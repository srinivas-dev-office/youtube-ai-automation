const fs = require("fs");
const path = require("path");
const { storageDir, outputDir } = require("../config");
const db = require("../db/database");

/**
 * Returns isolated directory paths for a specific project.
 * Automatically creates all subdirectories if they do not exist.
 */
function getProjectDirs(projectId = "proj_default") {
  const safeId = String(projectId || "proj_default").replace(/[^a-zA-Z0-9_-]/g, "");
  const base = path.join(storageDir, "projects", safeId);
  const images = path.join(base, "images");
  const scenes = path.join(base, "scenes");
  const audio = path.join(base, "audio");
  const videos = path.join(base, "videos");
  const output = path.join(base, "output");

  [base, images, scenes, audio, videos, output].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  return {
    projectId: safeId,
    projectDir: base,
    baseDir: base,
    images,
    imagesDir: images,
    scenes,
    scenesDir: scenes,
    audio,
    audioDir: audio,
    videos,
    videosDir: videos,
    renders: output,
    output,
    outputDir: output,
    storyboard: base
  };
}

/**
 * Validates and safely resolves an asset path strictly inside the specified project directory.
 * Prevents path traversal and cross-project asset access.
 */
function getProjectAssetPath(projectId, assetType, filename) {
  const safeId = String(projectId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) throw new Error("Invalid or missing project ID");

  if (!filename || typeof filename !== "string") {
    throw new Error("Invalid asset filename");
  }

  // Strict check: reject any directory traversal characters
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || filename.includes("\0")) {
    throw new Error("Access denied: path traversal / cross-project asset access detected");
  }

  const safeName = path.basename(filename);
  if (!safeName || safeName === "." || safeName === "..") {
    throw new Error("Invalid asset filename");
  }

  const dirs = getProjectDirs(safeId);
  const targetDir = dirs[`${assetType}Dir`] || dirs.baseDir;
  const resolved = path.resolve(targetDir, safeName);

  if (!resolved.startsWith(targetDir)) {
    throw new Error("Access denied: path traversal / cross-project asset access detected");
  }

  return resolved;
}

/**
 * Check if a file path strictly belongs to the specified project
 */
function isProjectAssetIsolated(requestingProjectId, targetAssetPath) {
  if (!requestingProjectId || !targetAssetPath) return false;
  const safeId = String(requestingProjectId).replace(/[^a-zA-Z0-9_-]/g, "");
  const projectBase = path.resolve(storageDir, "projects", safeId);
  const normalizedTarget = path.resolve(targetAssetPath);
  return normalizedTarget.startsWith(projectBase);
}

/**
 * Create or update a project record in SQLite
 */
function upsertProject(projectData) {
  const id = projectData.id || `proj_${Date.now()}`;
  const title = projectData.title || projectData.name || "Untitled Project";
  const category = projectData.category || "Animation";
  const characterStyle = projectData.characterStyle || "realistic";
  const aspectRatio = projectData.format || projectData.aspectRatio || "9:16";
  const duration = parseFloat(projectData.duration) || 20.0;
  const language = projectData.language || "telugu";
  const voiceId = projectData.voiceId || "te-IN-MohanNeural";
  const status = projectData.videoStatus || projectData.status || "draft";

  const existing = db.get("SELECT id FROM projects WHERE id = ?", [id]);
  if (existing) {
    db.run(
      `UPDATE projects 
       SET title = ?, category = ?, character_style = ?, aspect_ratio = ?, duration_seconds = ?, 
           language = ?, voice_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [title, category, characterStyle, aspectRatio, duration, language, voiceId, status, id]
    );
  } else {
    db.run(
      `INSERT INTO projects (id, title, category, character_style, aspect_ratio, duration_seconds, language, voice_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, category, characterStyle, aspectRatio, duration, language, voiceId, status]
    );
  }

  // Ensure isolated directories exist
  getProjectDirs(id);

  return getProjectById(id);
}

/**
 * Fetch a single project with its storyboard, scenes and characters
 */
function getProjectById(projectId) {
  const safeId = String(projectId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return null;

  const project = db.get("SELECT * FROM projects WHERE id = ?", [safeId]);
  if (!project) return null;

  const storyboard = db.get("SELECT * FROM storyboards WHERE project_id = ?", [safeId]);
  const scenes = db.all("SELECT * FROM scenes WHERE project_id = ? ORDER BY scene_number ASC", [safeId]);
  let characters = db.all("SELECT * FROM characters WHERE project_id = ?", [safeId]);

  characters = characters.map(c => {
    const views = db.all("SELECT id, view_type as type, image_path as url FROM character_views WHERE character_id = ?", [c.id]);
    return {
      id: c.id,
      name: c.name,
      role: c.role,
      type: c.type,
      age: c.age,
      gender: c.gender,
      skinTone: c.skin_tone,
      hairStyle: c.hair_style,
      faceStructure: c.face_structure,
      bodyType: c.body_type,
      costume: c.costume,
      accessories: c.accessories,
      identifyingFeatures: c.identifying_features,
      personality: c.personality,
      description: c.description,
      primaryImage: c.primary_image_path,
      locked: !!c.locked,
      views
    };
  });

  return {
    id: project.id,
    name: project.title,
    title: project.title,
    category: project.category,
    characterStyle: project.character_style,
    format: project.aspect_ratio,
    duration: `${project.duration_seconds}s`,
    language: project.language,
    voiceId: project.voice_id,
    createdDate: project.created_at ? project.created_at.split(" ")[0] : "",
    videoStatus: project.status,
    thumbnail: `/storage/projects/${project.id}/scenes/scene1.png`,
    storyboard: storyboard ? {
      title: storyboard.title,
      category: storyboard.category,
      tone: storyboard.tone,
      duration: storyboard.duration_seconds,
      narration: storyboard.narration_script,
      characters,
      scenes: scenes.map(s => ({
        sceneNumber: s.scene_number,
        title: s.title,
        storyBeat: s.story_beat,
        duration: s.duration_seconds,
        spokenLine: s.narration_segment,
        effect: s.motion_effect,
        pixarPrompt: s.visual_prompt,
        imagePath: s.image_path,
        videoPath: s.video_clip_path,
        status: s.status
      })),
      subtitles: storyboard.raw_subtitles_json ? JSON.parse(storyboard.raw_subtitles_json) : []
    } : null,
    characterCount: characters.length,
    sceneCount: scenes.length
  };
}

/**
 * List all projects
 */
function listProjects() {
  const projects = db.all("SELECT * FROM projects ORDER BY updated_at DESC");
  return projects.map(p => {
    const charCount = db.get("SELECT COUNT(*) as count FROM characters WHERE project_id = ?", [p.id])?.count || 0;
    const sceneCount = db.get("SELECT COUNT(*) as count FROM scenes WHERE project_id = ?", [p.id])?.count || 0;
    return {
      id: p.id,
      name: p.title,
      title: p.title,
      category: p.category,
      characterStyle: p.character_style,
      format: p.aspect_ratio,
      duration: `${p.duration_seconds}s`,
      language: p.language,
      voiceId: p.voice_id,
      createdDate: p.created_at ? p.created_at.split(" ")[0] : "",
      videoStatus: p.status,
      thumbnail: `/storage/projects/${p.id}/scenes/scene1.png`,
      characterCount: charCount,
      sceneCount
    };
  });
}

/**
 * Delete a project and all its isolated assets
 */
function deleteProjectById(projectId) {
  const safeId = String(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
  // Cascades to characters, character_views, storyboards, scenes, render_jobs via foreign keys
  db.run("DELETE FROM projects WHERE id = ?", [safeId]);

  // Clean isolated project directory
  const projectDir = path.join(storageDir, "projects", safeId);
  if (fs.existsSync(projectDir)) {
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch (_) {}
  }

  return { success: true, deletedProjectId: safeId };
}

/**
 * Save or update a storyboard for a specific project
 */
function saveProjectStoryboard(projectId, storyboardData) {
  return db.transaction(() => {
    const safeId = String(projectId || "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeId) throw new Error("Invalid project ID");

    const sbId = `sb_${safeId}`;
    const title = storyboardData.title || "Storyboard";
    const prompt = storyboardData.narrativePrompt || storyboardData.prompt || "";
    const narration = storyboardData.narration || "";
    const tone = storyboardData.tone || "";
    const category = storyboardData.category || "Animation";
    const duration = parseFloat(storyboardData.duration) || 20.0;
    const subtitlesJson = JSON.stringify(storyboardData.subtitles || []);
    const scenes = storyboardData.scenes || [];

    // Ensure project exists
    upsertProject({ id: safeId, title, category });

    const existingSb = db.get("SELECT id FROM storyboards WHERE project_id = ?", [safeId]);
    if (existingSb) {
      db.run(
        `UPDATE storyboards 
         SET title = ?, narrative_prompt = ?, narration_script = ?, tone = ?, category = ?, 
             duration_seconds = ?, scenes_count = ?, raw_subtitles_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE project_id = ?`,
        [title, prompt, narration, tone, category, duration, scenes.length, subtitlesJson, safeId]
      );
    } else {
      db.run(
        `INSERT INTO storyboards (id, project_id, title, narrative_prompt, narration_script, tone, category, duration_seconds, scenes_count, raw_subtitles_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sbId, safeId, title, prompt, narration, tone, category, duration, scenes.length, subtitlesJson]
      );
    }

    // Save individual scenes
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const sceneNum = parseInt(s.sceneNumber, 10) || (i + 1);
      const sceneId = `sc_${safeId}_${sceneNum}`;
      const sBeat = s.storyBeat || s.title || `Scene ${sceneNum}`;
      const sPrompt = s.pixarPrompt || s.visualPrompt || s.prompt || "";
      const sNarration = s.spokenLine || s.narration || "";
      const sDuration = parseFloat(s.duration) || 2.5;
      const sEffect = s.effect || "zoom_in";

      const existingScene = db.get("SELECT id FROM scenes WHERE project_id = ? AND scene_number = ?", [safeId, sceneNum]);
      if (existingScene) {
        db.run(
          `UPDATE scenes 
           SET story_beat = ?, visual_prompt = ?, narration_segment = ?, duration_seconds = ?, motion_effect = ?, updated_at = CURRENT_TIMESTAMP
           WHERE project_id = ? AND scene_number = ?`,
          [sBeat, sPrompt, sNarration, sDuration, sEffect, safeId, sceneNum]
        );
      } else {
        db.run(
          `INSERT INTO scenes (id, storyboard_id, project_id, scene_number, title, story_beat, visual_prompt, narration_segment, duration_seconds, motion_effect)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sceneId, sbId, safeId, sceneNum, s.title || `Act ${sceneNum}`, sBeat, sPrompt, sNarration, sDuration, sEffect]
        );
      }
    }

    // If characters are provided in storyboard, save them scoped to this project
    if (Array.isArray(storyboardData.characters)) {
      for (const c of storyboardData.characters) {
        const cId = c.id || `char_${safeId}_${Date.now()}`;
        const existingChar = db.get("SELECT id FROM characters WHERE id = ?", [cId]);
        if (!existingChar) {
          db.run(
            `INSERT INTO characters (id, project_id, name, role, type, age, gender, skin_tone, hair_style, face_structure, body_type, costume, accessories, identifying_features, personality, description, primary_image_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cId, safeId, c.name || "Character", c.role || "Lead Protagonist", c.type || "Lead Hero",
              c.age || "", c.gender || "", c.skinTone || "", c.hairStyle || "", c.faceStructure || "",
              c.bodyType || "", c.costume || "", c.accessories || "", c.identifyingFeatures || "",
              c.personality || "", c.description || "", c.primaryImage || ""
            ]
          );
        }
      }
    }

    return getProjectById(safeId);
  });
}

/**
 * Update media paths and status for an individual scene in SQLite
 */
function updateSceneMedia(projectId, sceneNumber, { imagePath, videoClipPath, status } = {}) {
  const safeId = String(projectId || "proj_default").replace(/[^a-zA-Z0-9_-]/g, "");
  const num = parseInt(sceneNumber, 10);
  const fields = [];
  const params = [];

  if (imagePath !== undefined) {
    fields.push("image_path = ?");
    params.push(imagePath);
  }
  if (videoClipPath !== undefined) {
    fields.push("video_clip_path = ?");
    params.push(videoClipPath);
  }
  if (status !== undefined) {
    fields.push("status = ?");
    params.push(status);
  }

  if (fields.length === 0) return;
  fields.push("updated_at = CURRENT_TIMESTAMP");
  params.push(safeId, num);

  db.run(
    `UPDATE scenes SET ${fields.join(", ")} WHERE project_id = ? AND scene_number = ?`,
    params
  );
}

module.exports = {
  getProjectDirs,
  getProjectAssetPath,
  isProjectAssetIsolated,
  upsertProject,
  getProjectById,
  listProjects,
  deleteProjectById,
  saveProjectStoryboard,
  updateSceneMedia
};
