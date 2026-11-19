const fs = require("fs");
const path = require("path");
const { outputDir, assetsDir, videosDir } = require("../config");
const { generateVoice } = require("./voiceGenerator");
const { renderMultiSceneStoryboard, mergeAudioAndSubtitles } = require("./videoGenerator");
const db = require("../db/database");
const { upsertProject, getProjectDirs } = require("./projectService");

const jobs = new Map();

// Concurrency Throttle: Maximum 2 concurrent active FFmpeg render jobs
const MAX_ACTIVE_PROCESSES = 2;
let activeWorkersCount = 0;
const waitingQueue = [];

/**
 * Acquire worker slot or enqueue if all slots are active
 */
function acquireWorker(jobId) {
  if (activeWorkersCount < MAX_ACTIVE_PROCESSES) {
    activeWorkersCount++;
    console.log(`[RenderQueue] Worker acquired for ${jobId} (Active: ${activeWorkersCount}/${MAX_ACTIVE_PROCESSES})`);
    return Promise.resolve(true);
  }

  console.log(`[RenderQueue] Concurrency limit reached (${activeWorkersCount}/${MAX_ACTIVE_PROCESSES}). Queuing ${jobId}...`);
  updateRenderJobProgress(jobId, 0, "Waiting in queue for an available rendering worker...", "Queued");
  
  // Persist queued status to SQLite
  try {
    db.run(
      `UPDATE render_jobs SET status = 'queued', stage = 'Queued', stage_detail = 'Waiting in queue for available worker...' WHERE id = ?`,
      [jobId]
    );
  } catch (_) {}

  return new Promise((resolve) => {
    waitingQueue.push({ jobId, resolve });
  });
}

/**
 * Release worker slot and dispatch next queued job
 */
function releaseWorker() {
  activeWorkersCount = Math.max(0, activeWorkersCount - 1);
  console.log(`[RenderQueue] Worker released (Active: ${activeWorkersCount}/${MAX_ACTIVE_PROCESSES}, Queued: ${waitingQueue.length})`);

  if (waitingQueue.length > 0 && activeWorkersCount < MAX_ACTIVE_PROCESSES) {
    const next = waitingQueue.shift();
    activeWorkersCount++;
    console.log(`[RenderQueue] Dequeuing and starting job ${next.jobId} (Active: ${activeWorkersCount}/${MAX_ACTIVE_PROCESSES})`);
    
    const job = jobs.get(next.jobId);
    if (job) {
      job.status = "processing";
      job.stage = "Worker Allocated - Initializing";
    }

    try {
      db.run(
        `UPDATE render_jobs SET status = 'processing', stage = 'Worker Allocated - Initializing', stage_detail = 'Worker allocated, beginning rendering...' WHERE id = ?`,
        [next.jobId]
      );
    } catch (_) {}

    next.resolve(true);
  }
}

/**
 * Update progress and stage detail in-memory and SQLite
 */
function updateRenderJobProgress(jobId, progressPercent, stageDetail, stage = null) {
  const job = jobs.get(jobId);
  if (job) {
    job.progress = progressPercent;
    if (stageDetail) job.stageDetail = stageDetail;
    if (stage) job.stage = stage;
  }

  try {
    if (stage) {
      db.run(
        `UPDATE render_jobs SET progress_percent = ?, stage_detail = ?, stage = ? WHERE id = ?`,
        [progressPercent, stageDetail || "", stage, jobId]
      );
    } else {
      db.run(
        `UPDATE render_jobs SET progress_percent = ?, stage_detail = ? WHERE id = ?`,
        [progressPercent, stageDetail || "", jobId]
      );
    }
  } catch (_) {}
}

/**
 * Mark render job as failed with error message and release capacity
 */
function failRenderJob(jobId, errorMessage) {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "failed";
    job.error = errorMessage;
    job.stage = "Rendering Failed";
    job.stageDetail = errorMessage;
  }

  try {
    db.run(
      `UPDATE render_jobs 
       SET status = 'failed', stage = 'Rendering Failed', stage_detail = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [errorMessage, errorMessage, jobId]
    );
  } catch (_) {}
}

/**
 * Mark render job as successfully completed
 */
function completeRenderJob(jobId, outputPath, videoUrl, duration = 0) {
  const job = jobs.get(jobId);
  if (job) {
    job.status = "completed";
    job.progress = 100;
    job.stage = "Master Video Ready";
    job.stageDetail = `Rendered HD Video successfully!`;
    job.videoUrl = videoUrl;
    job.completedTime = Date.now();
    job.duration = duration;
    job.result = {
      success: true,
      path: outputPath,
      videoUrl,
      duration
    };
  }

  try {
    db.run(
      `UPDATE render_jobs 
       SET status = 'completed', stage = 'Master Video Ready', stage_detail = 'Rendered HD Video successfully!', progress_percent = 100, 
           output_video_path = ?, video_url = ?, duration_seconds = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [outputPath, videoUrl, duration, jobId]
    );
  } catch (_) {}
}

/**
 * Execute an async operation with automatic retry and exponential backoff
 */
async function executeWithRetry(operation, maxRetries = 3, initialDelayMs = 1000) {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    try {
      return await operation();
    } catch (err) {
      attempt++;
      console.warn(`[RenderQueue] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt >= maxRetries) throw err;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

/**
 * Start an asynchronous video render background job with SQLite persistence and concurrency throttling
 */
function createRenderJob(body) {
  const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const storyboard = body.storyboard;
  if (!storyboard || !Array.isArray(storyboard.scenes)) {
    throw new Error("No storyboard scenes provided");
  }

  const projectId = String(body.projectId || storyboard.projectId || "proj_default").replace(/[^a-zA-Z0-9_-]/g, "") || "proj_default";
  
  // Ensure project exists in SQLite
  try {
    upsertProject({
      id: projectId,
      title: storyboard.title || "Master Cartoon Video",
      category: storyboard.category || "Animation",
      language: body.language || storyboard.language || "telugu",
      aspectRatio: body.aspectRatio || body.format || "9:16"
    });
  } catch (err) {
    console.warn("Could not upsert project for render job:", err.message);
  }

  const initialStatus = activeWorkersCount < MAX_ACTIVE_PROCESSES ? "processing" : "queued";
  const initialStage = initialStatus === "processing" ? "Story Screenplay Initialized" : "Queued";
  const initialDetail = initialStatus === "processing" ? "Preparing scene assets & narrative timeline..." : "Waiting in queue for an available rendering worker...";

  const job = {
    id: jobId,
    projectId,
    status: initialStatus, // queued, processing, completed, failed, cancelled
    progress: initialStatus === "processing" ? 5 : 0,
    stage: initialStage,
    stageDetail: initialDetail,
    title: storyboard.title || "Master Cartoon Video",
    totalScenes: storyboard.scenes.length,
    currentScene: 0,
    startTime: Date.now(),
    completedTime: null,
    videoUrl: null,
    duration: 0,
    error: null,
    preferredAiProvider: body.preferredAiProvider || "auto",
    stages: [
      { id: "voice", label: "Narration & Voice Generation", status: "pending", progress: 0 },
      { id: "scenes", label: "2.5D Cinematic Motion Clips", status: "pending", progress: 0 },
      { id: "stitch", label: "Cinematic Overlap Transitions", status: "pending", progress: 0 },
      { id: "composite", label: "Subtitles & Sound-Reactive Waveform", status: "pending", progress: 0 },
      { id: "finalize", label: "Final Master MP4 Delivery", status: "pending", progress: 0 }
    ]
  };

  // Persist to SQLite render_jobs table
  try {
    db.run(
      `INSERT INTO render_jobs (id, project_id, status, stage, stage_detail, progress_percent, current_scene, total_scenes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, projectId, initialStatus, initialStage, initialDetail, job.progress, 0, storyboard.scenes.length]
    );
  } catch (err) {
    console.warn("Could not insert render_job in SQLite:", err.message);
  }

  jobs.set(jobId, job);

  // Background Execution with worker slot acquisition & guarantee release
  setImmediate(async () => {
    let workerAcquired = false;
    try {
      await acquireWorker(jobId);
      workerAcquired = true;

      if (job.status === "cancelled") {
        return;
      }

      job.status = "processing";
      job.progress = Math.max(job.progress, 5);

      const isHybridRequested = body.useHybrid === true || body.pipeline === "hybrid" || !!body.preferredAiProvider;

      if (isHybridRequested) {
        // Route to modern hybrid renderer with multi-engine support, long-form subreels & project isolation
        const { renderHybridMovie } = require("./hybridRenderer");
        await renderHybridMovie({
          projectId,
          jobId,
          preferredAiProvider: body.preferredAiProvider || "auto",
          aspectRatio: body.aspectRatio || body.format || "9:16",
          adjustments: body.adjustments || {}
        });
        return;
      }

      // Standard multi-scene storyboard rendering
      fs.writeFileSync(path.join(outputDir, "generated-storyboard.json"), JSON.stringify(storyboard, null, 2), "utf8");

      // 1. Narration voice generation with retry
      job.stage = "Generating Narration Voiceover";
      job.stageDetail = `Synthesizing authentic voice for "${storyboard.title}"...`;
      job.stages[0].status = "processing";
      job.progress = 12;
      updateRenderJobProgress(jobId, 12, job.stageDetail, job.stage);

      const voiceRes = await executeWithRetry(() => generateVoice(storyboard.narration || "", "cartoon-narration.wav", {
        language: body.language || storyboard.language || "telugu",
        voice: body.voice || storyboard.voice
      }), 2, 800);

      const audioPath = voiceRes.audioPath;
      const voiceDuration = voiceRes.duration;
      job.stages[0].status = "completed";
      job.stages[0].progress = 100;
      job.progress = 25;

      if (job.status === "cancelled") {
        try {
          db.run("UPDATE render_jobs SET status = 'cancelled', stage = 'Cancelled by User' WHERE id = ?", [jobId]);
        } catch (_) {}
        return;
      }

      // Calculate dynamic duration (supports up to 1200 seconds / 20 min)
      const rawDuration = storyboard.scenes.reduce((sum, s) => sum + (parseFloat(s.duration) || 3.0), 0) || 20.0;
      const movieDuration = Math.min(1200.0, Math.max(4.0, voiceDuration || rawDuration));
      job.duration = movieDuration;

      // 2. Render Scene Clips & Transitions
      job.stage = "Rendering Cinematic Scene Clips";
      job.stages[1].status = "processing";

      const aspectRatio = body.aspectRatio || body.format || "9:16";
      const adjustments = body.adjustments || {};

      const stitchedVideo = renderMultiSceneStoryboard(
        storyboard.scenes,
        movieDuration,
        aspectRatio,
        adjustments,
        (progressInfo) => {
          if (progressInfo && progressInfo.scene) {
            job.currentScene = progressInfo.scene;
            const scenePct = Math.round((progressInfo.scene / progressInfo.totalScenes) * 45);
            job.progress = 25 + scenePct;
            job.stageDetail = `Rendering scene ${progressInfo.scene} of ${progressInfo.totalScenes} (Fluid 2.5D Motion)...`;
            job.stages[1].progress = Math.round((progressInfo.scene / progressInfo.totalScenes) * 100);
            updateRenderJobProgress(jobId, job.progress, job.stageDetail);
          }
        }
      );

      job.stages[1].status = "completed";
      job.stages[1].progress = 100;
      job.stages[2].status = "completed";
      job.stages[2].progress = 100;
      job.progress = 75;

      if (job.status === "cancelled") {
        try {
          db.run("UPDATE render_jobs SET status = 'cancelled', stage = 'Cancelled by User' WHERE id = ?", [jobId]);
        } catch (_) {}
        return;
      }

      // 3. Audio & Subtitles Compositing with dynamic sidechain ducking
      job.stage = "Compositing Subtitles & Audio Waveform";
      job.stageDetail = "Blending narration, sound-reactive waveform and kinetic subtitles...";
      job.stages[3].status = "processing";
      job.progress = 85;
      updateRenderJobProgress(jobId, 85, job.stageDetail, job.stage);

      let bgmPath = null;
      if (fs.existsSync(assetsDir)) {
        const aFiles = fs.readdirSync(assetsDir);
        for (const f of aFiles) {
          const l = f.toLowerCase();
          if (l.startsWith("bgm") || l.startsWith("music") || l.startsWith("soundtrack") || l.startsWith("audio")) {
            bgmPath = path.join(assetsDir, f);
            break;
          }
        }
      }

      const subOptions = {
        showCaptions: body.showCaptions !== false && body.useCaptions !== false,
        position: body.position || "bottom",
        font: adjustments.font || body.font || "Impact",
        color: adjustments.textColor || body.color || "yellow",
        fontSize: parseInt(adjustments.fontSize || body.fontSize, 10) || 54,
        useBox: body.useBox !== false,
        bgmPath,
        bgmVolume: parseFloat(body.bgmVolume || adjustments.bgmVolume) || 0.35,
        useSidechainDucking: true
      };

      const finalVideo = mergeAudioAndSubtitles(
        stitchedVideo,
        audioPath,
        storyboard.subtitles,
        movieDuration,
        "final-cartoon-short.mp4",
        subOptions
      );

      job.stages[3].status = "completed";
      job.stages[3].progress = 100;
      job.stages[4].status = "completed";
      job.stages[4].progress = 100;

      const videoUrl = `/api/video?_t=${Date.now()}`;
      completeRenderJob(jobId, finalVideo, videoUrl, movieDuration);

      console.log(`🎉 [Render Job ${jobId}] Finished in ${((Date.now() - job.startTime) / 1000).toFixed(1)}s: ${finalVideo}`);
    } catch (err) {
      console.error(`❌ [Render Job ${jobId}] Failed:`, err);
      failRenderJob(jobId, err.message);
    } finally {
      if (workerAcquired) {
        releaseWorker();
      }
    }
  });

  return job;
}

/**
 * Retrieve render job status by ID (in-memory or SQLite fallback on restart)
 */
function getRenderJob(jobId) {
  if (jobs.has(jobId)) {
    return jobs.get(jobId);
  }

  // Fallback to SQLite database (DATA-02: Survives server restart)
  try {
    const row = db.get("SELECT * FROM render_jobs WHERE id = ?", [jobId]);
    if (row) {
      const recoveredJob = {
        id: row.id,
        projectId: row.project_id,
        status: row.status,
        progress: row.progress_percent,
        stage: row.stage,
        stageDetail: row.stage_detail,
        title: "Master Cartoon Video",
        totalScenes: row.total_scenes,
        currentScene: row.current_scene,
        duration: row.duration_seconds || 0,
        videoUrl: row.video_url,
        error: row.error_message,
        completedTime: row.completed_at ? new Date(row.completed_at).getTime() : null,
        recoveredFromDb: true
      };
      return recoveredJob;
    }
  } catch (err) {
    console.warn("Could not query render_job from SQLite:", err.message);
  }

  return null;
}

/**
 * Cancel an active or queued render job
 */
function cancelRenderJob(jobId) {
  // If job is in waiting queue, remove it immediately
  const queueIdx = waitingQueue.findIndex(w => w.jobId === jobId);
  if (queueIdx >= 0) {
    waitingQueue.splice(queueIdx, 1);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "cancelled";
      job.stage = "Cancelled by User while Queued";
    }
    try {
      db.run("UPDATE render_jobs SET status = 'cancelled', stage = 'Cancelled by User' WHERE id = ?", [jobId]);
    } catch (_) {}
    console.log(`[RenderQueue] Removed job ${jobId} from waiting queue.`);
    return true;
  }

  const job = jobs.get(jobId);
  if (job && job.status === "processing") {
    job.status = "cancelled";
    job.stage = "Cancelled by User";
    try {
      db.run("UPDATE render_jobs SET status = 'cancelled', stage = 'Cancelled by User' WHERE id = ?", [jobId]);
    } catch (_) {}
    return true;
  }
  return false;
}

/**
 * Recovers interrupted or queued jobs after a server crash/restart
 */
function recoverRenderQueueOnStartup() {
  try {
    const activeRows = db.all(
      `SELECT * FROM render_jobs WHERE status IN ('processing', 'queued') ORDER BY started_at ASC`
    );
    if (activeRows && activeRows.length > 0) {
      console.log(`[RenderQueue] Found ${activeRows.length} active/queued jobs from previous session.`);
      for (const row of activeRows) {
        if (row.status === "processing") {
          // Interrupted mid-process before restart -> cleanly flag for restart recovery
          db.run(
            `UPDATE render_jobs 
             SET status = 'interrupted', stage = 'Interrupted by Server Restart', stage_detail = 'Server restarted during active transcode. Ready for resume.'
             WHERE id = ?`,
            [row.id]
          );
        }
      }
    }
  } catch (err) {
    console.warn("[RenderQueue] Startup recovery notice:", err.message);
  }
}

// Automatically check on load
recoverRenderQueueOnStartup();

module.exports = {
  createRenderJob,
  getRenderJob,
  cancelRenderJob,
  updateRenderJobProgress,
  failRenderJob,
  completeRenderJob,
  executeWithRetry,
  recoverRenderQueueOnStartup,
  getActiveWorkersCount: () => activeWorkersCount,
  getWaitingQueueLength: () => waitingQueue.length,
  MAX_ACTIVE_PROCESSES
};
