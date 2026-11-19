const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { storageDir } = require("../config");

const dbPath = path.join(storageDir, "tooncraft.db");

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  // Ensure storage directory exists
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);

  // Performance & Integrity Pragmas
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");

  initSchema(dbInstance);
  return dbInstance;
}

function initSchema(db) {
  db.exec(`
    -- 1. Schema Migrations Tracking
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Isolated Projects Table
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'Animation',
      character_style TEXT DEFAULT 'realistic',
      aspect_ratio TEXT DEFAULT '9:16',
      duration_seconds REAL DEFAULT 20.0,
      language TEXT DEFAULT 'telugu',
      voice_id TEXT DEFAULT 'te-IN-MohanNeural',
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Characters Table (Scoped strictly to project_id)
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'Lead Protagonist',
      type TEXT DEFAULT 'Character',
      age TEXT,
      gender TEXT,
      skin_tone TEXT,
      hair_style TEXT,
      face_structure TEXT,
      body_type TEXT,
      costume TEXT,
      accessories TEXT,
      identifying_features TEXT,
      personality TEXT,
      description TEXT,
      primary_image_path TEXT,
      locked INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

    -- 4. Character Views (Turnarounds, poses, profiles)
    CREATE TABLE IF NOT EXISTS character_views (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      view_type TEXT NOT NULL,
      image_path TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_character_views_char ON character_views(character_id);

    -- 5. Storyboards Table (One per project)
    CREATE TABLE IF NOT EXISTS storyboards (
      id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      narrative_prompt TEXT,
      narration_script TEXT,
      tone TEXT,
      category TEXT,
      duration_seconds REAL,
      scenes_count INTEGER DEFAULT 0,
      raw_subtitles_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 6. Scenes Table (Divided per project storyboard)
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      storyboard_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      scene_number INTEGER NOT NULL,
      title TEXT,
      story_beat TEXT,
      duration_seconds REAL DEFAULT 2.5,
      camera_direction TEXT,
      motion_effect TEXT DEFAULT 'zoom_in',
      visual_prompt TEXT NOT NULL,
      narration_segment TEXT,
      status TEXT DEFAULT 'pending',
      image_path TEXT,
      video_clip_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(storyboard_id, scene_number)
    );

    CREATE INDEX IF NOT EXISTS idx_scenes_storyboard ON scenes(storyboard_id);
    CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id);

    -- 7. Persistent Render Queue Table (DATA-02)
    CREATE TABLE IF NOT EXISTS render_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      stage TEXT DEFAULT 'Initialized',
      stage_detail TEXT,
      progress_percent INTEGER DEFAULT 0,
      current_scene INTEGER DEFAULT 0,
      total_scenes INTEGER DEFAULT 0,
      duration_seconds REAL,
      output_video_path TEXT,
      video_url TEXT,
      error_message TEXT,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_render_jobs_project ON render_jobs(project_id);

    -- 8. YouTube Publishing History
    CREATE TABLE IF NOT EXISTS publishing_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      render_job_id TEXT,
      platform TEXT DEFAULT 'youtube',
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      privacy_status TEXT DEFAULT 'public',
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (render_job_id) REFERENCES render_jobs(id) ON DELETE SET NULL
    );
  `);
}

/**
 * Execute synchronous run query with parameterized arguments
 */
function run(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Execute synchronous single row query
 */
function get(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

/**
 * Execute synchronous all rows query
 */
function all(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

/**
 * Execute atomic transaction block
 */
function transaction(callback) {
  const db = getDb();
  db.exec("BEGIN TRANSACTION;");
  try {
    const result = callback(db);
    db.exec("COMMIT;");
    return result;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

function closeDb() {
  if (dbInstance) {
    try { dbInstance.close(); } catch (_) {}
    dbInstance = null;
  }
}

module.exports = {
  getDb,
  run,
  get,
  all,
  transaction,
  closeDb,
  dbPath
};
