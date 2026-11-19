# DATABASE SCHEMA & MIGRATION SPECIFICATION
**Engine:** SQLite 3 via `better-sqlite3`  
**Database File:** `storage/tooncraft.db`  
**Purpose:** Replace vulnerable, unindexed flat JSON files (`characters.json`, `projects.json`, `generated-storyboard.json`) with an ACID-compliant relational data store.

---

## 1. Relational Database Schema DDL

```sql
-- Enable foreign key constraint enforcement
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projects Table
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

-- 3. Characters Table
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
    locked INTEGER DEFAULT 0, -- 0 = Unlocked, 1 = Locked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);

-- 4. Character Reference Views (Front, Profile, Closeup, Full Body)
CREATE TABLE IF NOT EXISTS character_views (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    view_type TEXT NOT NULL, -- front, profile, closeup, full, action
    image_path TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- 5. Storyboards Table
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
    raw_subtitles_json TEXT, -- JSON array of subtitle lines
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 6. Scenes Table
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
    status TEXT DEFAULT 'pending', -- pending, generating, ready, failed
    image_path TEXT,
    video_clip_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(storyboard_id, scene_number)
);

CREATE INDEX IF NOT EXISTS idx_scenes_storyboard ON scenes(storyboard_id);

-- 7. Persistent Render Queue Table
CREATE TABLE IF NOT EXISTS render_jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed, cancelled
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
```

---

## 2. One-Time Legacy JSON Migration Plan

### Step 1: Automated Pre-Migration Backup
Before reading or modifying existing JSON structures:
1. Create a timestamped archive: `storage/backups/pre_migration_<timestamp>/`.
2. Copy `storage/characters.json`, `storage/projects.json`, `output/generated-storyboard.json`, and `output/generated-story.json` into the backup directory.
3. Compute SHA-256 hashes of the files to guarantee exact byte preservation.

### Step 2: Database Initialization & Transactional Import
The migration utility (`backend/migrations/migrateJsonToSqlite.js`) will:
1. Initialize `storage/tooncraft.db` and apply schema migrations.
2. Begin a single atomic transaction (`BEGIN TRANSACTION`).
3. **Import Projects**: Read `storage/projects.json`. Insert each item into `projects`. If empty, create `proj_default`.
4. **Import Storyboard**: Read `output/generated-storyboard.json`. Associate it with `proj_default` or matching project ID.
5. **Import Scenes**: For each scene in `storyboard.scenes`, insert a row into `scenes`. Verify if `storage/images/sceneN.png` exists; if so, set status to `ready` and record the path.
6. **Import Characters**: Read `storage/characters.json`. Insert each character into `characters`, associating with `proj_default`.
7. **Commit**: `COMMIT TRANSACTION`. If any error occurs, issue `ROLLBACK` and abort without altering database or source files.

### Step 3: Verification & Record Reconciliation
The migration script will verify:
* `SELECT COUNT(*) FROM projects` matches `projects.json` length.
* `SELECT COUNT(*) FROM characters` matches `characters.json` length.
* Foreign key consistency check: `PRAGMA foreign_key_check;` returns 0 violations.

---

## 3. Backward Compatibility Layer

During Stages C through F, a lightweight compatibility adapter will mirror database queries back to legacy endpoints, ensuring that existing frontend dashboard functions continue operating without disruption while reading from SQLite.
