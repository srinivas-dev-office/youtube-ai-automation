const fs = require("fs");
const path = require("path");
const { storageDir, outputDir } = require("../config");
const db = require("../db/database");
const { getProjectDirs } = require("../services/projectService");

console.log("==================================================");
console.log("   🚀 TOONCRAFT DATABASE MIGRATION UTILITY        ");
console.log("==================================================");

function runMigration() {
  const database = db.getDb();

  // Check if migration was already applied
  const migrationRecord = db.get("SELECT version FROM schema_migrations WHERE version = 1");
  if (migrationRecord) {
    console.log("ℹ️ Schema migration version 1 has already been applied. Re-verifying record integrity...");
  }

  let projectsImported = 0;
  let storyboardsImported = 0;
  let scenesImported = 0;
  let charactersImported = 0;

  db.transaction(() => {
    // 1. Migrate Projects from storage/projects.json
    const projectsFile = path.join(storageDir, "projects.json");
    if (fs.existsSync(projectsFile)) {
      try {
        const raw = fs.readFileSync(projectsFile, "utf8");
        const projects = JSON.parse(raw);
        if (Array.isArray(projects)) {
          console.log(`📦 Found ${projects.length} projects in projects.json`);
          for (const p of projects) {
            const pId = p.id || `proj_${Date.now()}`;
            const title = p.title || p.name || "Legacy Project";
            const category = p.category || "Animation";
            const style = p.characterStyle || "realistic";
            const aspect = p.format || "9:16";
            const duration = parseFloat(p.duration) || 20.0;
            const status = p.videoStatus || "draft";

            // Insert Project
            const existingProj = db.get("SELECT id FROM projects WHERE id = ?", [pId]);
            if (!existingProj) {
              db.run(
                `INSERT INTO projects (id, title, category, character_style, aspect_ratio, duration_seconds, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [pId, title, category, style, aspect, duration, status]
              );
              projectsImported++;
            }

            // Create project-isolated directories
            getProjectDirs(pId);

            // Insert Storyboard if attached
            if (p.storyboard && typeof p.storyboard === "object") {
              const sb = p.storyboard;
              const sbId = `sb_${pId}`;
              const sbTitle = sb.title || title;
              const narration = sb.narration || "";
              const tone = sb.tone || "";
              const durationSec = parseFloat(sb.duration) || duration;
              const subtitlesJson = JSON.stringify(sb.subtitles || []);
              const scenes = Array.isArray(sb.scenes) ? sb.scenes : [];

              const existingSb = db.get("SELECT id FROM storyboards WHERE project_id = ?", [pId]);
              if (!existingSb) {
                db.run(
                  `INSERT INTO storyboards (id, project_id, title, narration_script, tone, category, duration_seconds, scenes_count, raw_subtitles_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [sbId, pId, sbTitle, narration, tone, category, durationSec, scenes.length, subtitlesJson]
                );
                storyboardsImported++;
              }

              // Insert Scenes
              for (let i = 0; i < scenes.length; i++) {
                const s = scenes[i];
                const sceneNum = parseInt(s.sceneNumber, 10) || (i + 1);
                const sceneId = `sc_${pId}_${sceneNum}`;
                const sBeat = s.storyBeat || s.title || `Scene ${sceneNum}`;
                const sPrompt = s.pixarPrompt || s.visualPrompt || s.prompt || "";
                const sNarration = s.spokenLine || s.narration || "";
                const sDuration = parseFloat(s.duration) || 2.0;
                const sEffect = s.effect || "zoom_in";

                const existingScene = db.get("SELECT id FROM scenes WHERE project_id = ? AND scene_number = ?", [pId, sceneNum]);
                if (!existingScene) {
                  db.run(
                    `INSERT INTO scenes (id, storyboard_id, project_id, scene_number, title, story_beat, visual_prompt, narration_segment, duration_seconds, motion_effect)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [sceneId, sbId, pId, sceneNum, s.title || `Act ${sceneNum}`, sBeat, sPrompt, sNarration, sDuration, sEffect]
                  );
                  scenesImported++;
                }
              }

              // Insert Characters from storyboard
              if (Array.isArray(sb.characters)) {
                for (const c of sb.characters) {
                  const cId = c.id || `char_${Date.now()}`;
                  const cName = c.name || "Character";
                  const existingChar = db.get("SELECT id FROM characters WHERE id = ?", [cId]);
                  if (!existingChar) {
                    db.run(
                      `INSERT INTO characters (id, project_id, name, role, type, age, gender, skin_tone, hair_style, face_structure, body_type, costume, accessories, identifying_features, personality, description, primary_image_path)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        cId, pId, cName, c.role || "Lead Protagonist", c.type || "Lead Hero",
                        c.age || "", c.gender || "", c.skinTone || "", c.hairStyle || "", c.faceStructure || "",
                        c.bodyType || "", c.costume || "", c.accessories || "", c.identifyingFeatures || "",
                        c.personality || "", c.description || "", c.primaryImage || ""
                      ]
                    );
                    charactersImported++;
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Notice reading projects.json:", err.message);
      }
    }

    // 2. Migrate standalone characters from storage/characters.json
    const charsFile = path.join(storageDir, "characters.json");
    if (fs.existsSync(charsFile)) {
      try {
        const raw = fs.readFileSync(charsFile, "utf8");
        const chars = JSON.parse(raw);
        if (Array.isArray(chars)) {
          console.log(`📦 Found ${chars.length} standalone characters in characters.json`);
          // Ensure default legacy project exists
          const defaultProjectId = "proj_legacy_master";
          const existingDefaultProj = db.get("SELECT id FROM projects WHERE id = ?", [defaultProjectId]);
          if (!existingDefaultProj) {
            db.run(
              `INSERT INTO projects (id, title, category, status)
               VALUES (?, ?, ?, ?)`,
              [defaultProjectId, "Master Archive & Character Library", "Animation", "archived"]
            );
          }
          getProjectDirs(defaultProjectId);

          for (const c of chars) {
            const cId = c.id || `char_${Date.now()}`;
            const existingChar = db.get("SELECT id FROM characters WHERE id = ?", [cId]);
            if (!existingChar) {
              db.run(
                `INSERT INTO characters (id, project_id, name, role, type, age, gender, skin_tone, hair_style, face_structure, body_type, costume, accessories, identifying_features, personality, description, primary_image_path)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  cId, defaultProjectId, c.name || "Character", c.role || "Lead Protagonist", c.type || "Lead Hero",
                  c.age || "", c.gender || "", c.skinTone || "", c.hairStyle || "", c.faceStructure || "",
                  c.bodyType || "", c.costume || "", c.accessories || "", c.identifyingFeatures || "",
                  c.personality || "", c.description || "", c.primaryImage || ""
                ]
              );
              charactersImported++;

              // Views
              if (Array.isArray(c.views)) {
                for (let vIdx = 0; vIdx < c.views.length; vIdx++) {
                  const v = c.views[vIdx];
                  const vId = v.id || `v_${cId}_${vIdx}`;
                  db.run(
                    `INSERT INTO character_views (id, character_id, view_type, image_path, is_primary)
                     VALUES (?, ?, ?, ?, ?)`,
                    [vId, cId, v.type || "Front Portrait", v.url || "", vIdx === 0 ? 1 : 0]
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Notice reading characters.json:", err.message);
      }
    }

    // 3. Record migration version
    db.run(
      `INSERT OR REPLACE INTO schema_migrations (version, description)
       VALUES (?, ?)`,
      [1, "Initial SQLite 3 relational schema with isolated projects, scenes, characters, and render jobs"]
    );
  });

  console.log("==================================================");
  console.log("✅ MIGRATION COMPLETED SUCCESSFULLY!");
  console.log(`   - Projects Registered:    ${projectsImported}`);
  console.log(`   - Storyboards Registered: ${storyboardsImported}`);
  console.log(`   - Scenes Registered:      ${scenesImported}`);
  console.log(`   - Characters Registered:  ${charactersImported}`);
  console.log("==================================================");

  return {
    success: true,
    projectsImported,
    storyboardsImported,
    scenesImported,
    charactersImported
  };
}

module.exports = { runMigration };

if (require.main === module) {
  runMigration();
}
