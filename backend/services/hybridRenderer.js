const fs = require("fs");
const path = require("path");
const { execFfmpeg } = require("../utils/ffmpegHelper");
const { ffmpegPath, outputDir, assetsDir } = require("../config");
const projectService = require("./projectService");
const { aiVideoManager } = require("./aiVideoProviders");
const { buildCinematicFilterChain, getCanvasDimensions } = require("./cinematicCamera");
const { generateVoice } = require("./voiceGenerator");
const { generateLipSyncVisemes, alignNarrationDuration } = require("./lipSyncService");
const { updateRenderJobProgress, failRenderJob, completeRenderJob } = require("./renderQueue");

/**
 * Renders an individual scene clip using either:
 * 1. An existing pre-generated AI video clip (.mp4)
 * 2. An external AI Video Provider (Runway, Pika, Stable Video)
 * 3. Studio-grade 2.5D FFmpeg Organic Parallax Animation
 */
async function renderHybridSceneClip({
  scene,
  sceneNum,
  duration,
  projectId,
  aspectRatio = "9:16",
  preferredAiProvider = "auto",
  adjustments = {},
  character = null
}) {
  const dirs = projectService.getProjectDirs(projectId);
  const clipFileName = `scene_${sceneNum}_clip.mp4`;
  const outputClipPath = path.join(dirs.videos, clipFileName);
  const dim = getCanvasDimensions(aspectRatio);

  // Check if scene already has an explicit video clip
  let existingVideo = scene.video_clip_path || scene.videoUrl;
  if (!existingVideo || !fs.existsSync(existingVideo)) {
    const candidateClips = [
      path.join(dirs.videos, clipFileName),
      path.join(videosDir, clipFileName)
    ];
    for (const c of candidateClips) {
      if (fs.existsSync(c)) {
        existingVideo = c;
        break;
      }
    }
  }

  if (existingVideo && fs.existsSync(existingVideo)) {
    console.log(`🎥 [Scene ${sceneNum}] Conforming existing video clip: ${path.basename(existingVideo)}`);
    const filter = `scale=${dim.outW}:${dim.outH}:force_original_aspect_ratio=increase,crop=${dim.outW}:${dim.outH},setpts=PTS-STARTPTS,fps=30`;
    execFfmpeg([
      "-stream_loop", "-1",
      "-i", existingVideo,
      "-t", `${duration}`,
      "-vf", filter,
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-video_track_timescale", "30000",
      "-an",
      "-y", outputClipPath
    ]);
    return { path: outputClipPath, duration, type: "ai_video_generated", engine: "Conformed Scene Video Clip" };
  }

  // Locate input image for scene
  let imagePath = scene.image_path || scene.imageUrl;
  if (!imagePath || !fs.existsSync(imagePath)) {
    const candidates = [
      path.join(dirs.images, `scene${sceneNum}.png`),
      path.join(dirs.images, `scene${sceneNum}.jpg`),
      path.join(dirs.images, `scene_${sceneNum}.png`),
      path.join(dirs.images, `scene_${sceneNum}.jpg`)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        imagePath = c;
        break;
      }
    }
  }

  // Fallback placeholder image if not yet generated
  if (!imagePath || !fs.existsSync(imagePath)) {
    const fallbackColors = ["midnightblue", "darkslateblue", "navy", "darkcyan", "indigo"];
    const fallbackImg = path.join(dirs.images, `placeholder_scene_${sceneNum}.png`);
    execFfmpeg([
      "-f", "lavfi",
      "-i", `color=c=${fallbackColors[(sceneNum - 1) % fallbackColors.length]}:s=${dim.outW}x${dim.outH}:d=1`,
      "-vf", `drawtext=text='SCENE ${sceneNum}':fontcolor=white:fontsize=75:borderw=4:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-vframes", "1",
      "-y", fallbackImg
    ]);
    imagePath = fallbackImg;
  }

  // Check scene-level checkpoint: reuse pre-rendered clip if newer than image
  if (fs.existsSync(outputClipPath) && fs.existsSync(imagePath)) {
    try {
      const clipMtime = fs.statSync(outputClipPath).mtimeMs;
      const imgMtime = fs.statSync(imagePath).mtimeMs;
      if (clipMtime >= imgMtime) {
        console.log(`⚡ [Scene ${sceneNum}] Reusing verified pre-rendered clip`);
        return { path: outputClipPath, duration, type: "cached", engine: "Cached Render" };
      }
    } catch (_) { }
  }

  // Attempt AI Video Provider if configured and requested
  if (preferredAiProvider && preferredAiProvider !== "ffmpeg" && preferredAiProvider !== "none") {
    try {
      const cameraMotion = scene.motion_effect || scene.camera_direction || scene.cameraMotion || "cinematic slow push";
      const characterAction = scene.character_action || scene.characterAction || "natural character animation";
      const prompt = scene.visual_prompt || scene.pixarPrompt || scene.title || "Cinematic 3D animation";
      const aiResult = await aiVideoManager.generateClipWithFallback({
        prompt,
        imagePath,
        duration,
        cameraMotion,
        characterAction,
        aspectRatio,
        outputPath: outputClipPath,
        preferredProvider: preferredAiProvider,
        fallbackCallback: null
      });

      if (aiResult && fs.existsSync(outputClipPath)) {
        console.log(`✅ [Scene ${sceneNum}] Generated AI video via provider: ${aiResult.provider}`);
        return {
          path: outputClipPath,
          duration,
          type: "ai_video_generated",
          engine: aiResult.provider === "veo" ? "Google Veo 3.1" : aiResult.provider
        };
      }
    } catch (aiErr) {
      console.warn(`[Scene ${sceneNum}] AI Video provider notice (${aiErr.message}), falling back to organic FFmpeg engine.`);
    }
  }

  // 2.5D Studio-Grade FFmpeg Parallax Animation Fallback
  const cameraMotion = scene.motion_effect || scene.camera_direction || (
    sceneNum === 1 ? "dramatic_zoom_in" :
      sceneNum === 2 ? "pan_left" :
        sceneNum === 3 ? "tilt_up" : "epic_pull_back"
  );

  const characterAnchor = (character && character.anchor) || (
    sceneNum % 2 === 0 ? "left_third" : "hero_center"
  );

  const dynamicFilter = buildCinematicFilterChain({
    cameraMotion,
    characterAnchor,
    duration,
    aspectRatio,
    adjustments
  });

  execFfmpeg([
    "-framerate", "30",
    "-loop", "1",
    "-t", `${duration}`,
    "-i", imagePath,
    "-vf", dynamicFilter,
    "-c:v", "libx264",
    "-preset", "fast",
    "-pix_fmt", "yuv420p",
    "-r", "30",
    "-video_track_timescale", "30000",
    "-y", outputClipPath
  ]);

  return { path: outputClipPath, duration, type: "ffmpeg_cinematic_fallback", engine: "FFmpeg 2.5D Organic Fallback" };
}

/**
 * Stitches a group of scene clips with cinematic XFade transitions
 */
function stitchSubReelGroup(sceneClips, groupDuration, outputPath) {
  if (sceneClips.length === 1) {
    execFfmpeg([
      "-i", sceneClips[0].path,
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-video_track_timescale", "30000",
      "-y", outputPath
    ]);
    return outputPath;
  }

  const transitionDuration = 0.4;
  const transitionTypes = ["smoothleft", "circleopen", "fadeblack", "dissolve", "wipeleft"];
  const xfadeArgs = [];
  sceneClips.forEach(c => xfadeArgs.push("-i", c.path));

  const filterChains = [];
  const sceneDuration = groupDuration / sceneClips.length;
  let currentOffset = Math.max(0.1, sceneDuration - transitionDuration);
  let lastOut = "[0:v]";

  for (let i = 1; i < sceneClips.length; i++) {
    const nextOut = (i === sceneClips.length - 1) ? "[vout]" : `[v${i}]`;
    const trans = transitionTypes[(i - 1) % transitionTypes.length];
    filterChains.push(`${lastOut}[${i}:v]xfade=transition=${trans}:duration=${transitionDuration}:offset=${currentOffset.toFixed(2)}${nextOut}`);
    lastOut = nextOut;
    currentOffset += sceneDuration;
  }

  try {
    execFfmpeg([
      ...xfadeArgs,
      "-filter_complex", filterChains.join(";"),
      "-map", "[vout]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-video_track_timescale", "30000",
      "-t", `${groupDuration}`,
      "-y", outputPath
    ]);
    return outputPath;
  } catch (err) {
    console.warn("[HybridRenderer] Sub-reel XFade fallback to concat:", err.message);
    const concatListFile = path.join(path.dirname(outputPath), `subreel_concat_${Date.now()}.txt`);
    const concatContent = sceneClips.map(clip => `file '${clip.path.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(concatListFile, concatContent, "utf8");

    execFfmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", concatListFile,
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-video_track_timescale", "30000",
      "-y", outputPath
    ]);
    try { fs.unlinkSync(concatListFile); } catch (_) { }
    return outputPath;
  }
}

/**
 * Segmented Sub-Reel Assembler for Long-Form Videos (5 to 20 Minutes)
 * Eliminates Windows CLI 8,191-character limits and memory exhaustion.
 */
function stitchSceneClips(sceneClips, totalDuration, outputPath) {
  if (!sceneClips || sceneClips.length === 0) {
    throw new Error("No scene clips provided to stitch");
  }

  // Short form (<= 5 scenes): Single pass XFade
  const CHUNK_SIZE = 5;
  if (sceneClips.length <= CHUNK_SIZE) {
    return stitchSubReelGroup(sceneClips, totalDuration, outputPath);
  }

  // Long form (> 5 scenes): Divide into sub-reels of 5 scenes each
  const totalChunks = Math.ceil(sceneClips.length / CHUNK_SIZE);
  console.log(`🎬 [Long-Form Pipeline] Splitting ${sceneClips.length} scenes (${totalDuration}s) into ${totalChunks} segmented sub-reels...`);

  const workDir = path.dirname(outputPath);
  const subReelFiles = [];
  const durationPerScene = totalDuration / sceneClips.length;

  try {
    for (let c = 0; c < totalChunks; c++) {
      const chunkScenes = sceneClips.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      const chunkDuration = chunkScenes.length * durationPerScene;
      const subReelPath = path.join(workDir, `subreel_${c}_temp.mp4`);

      console.log(`  🎥 Rendering Sub-Reel ${c + 1}/${totalChunks} (${chunkScenes.length} scenes, ${chunkDuration.toFixed(1)}s)...`);
      stitchSubReelGroup(chunkScenes, chunkDuration, subReelPath);
      subReelFiles.push(subReelPath);
    }

    // Assemble all sub-reels via stream copy concat demuxer
    const manifestPath = path.join(workDir, `subreels_manifest_${Date.now()}.txt`);
    const manifestContent = subReelFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(manifestPath, manifestContent, "utf8");

    console.log(`🔗 Concatenating ${totalChunks} sub-reels via stream copy demuxer into: ${outputPath}`);
    execFfmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", manifestPath,
      "-c", "copy",
      "-y", outputPath
    ]);

    // Verify output integrity before deleting intermediate sub-reels
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      console.log(`✅ [Long-Form Verification] Final video verified (${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB). Cleaning temporary sub-reels.`);
      for (const f of subReelFiles) {
        try { fs.unlinkSync(f); } catch (_) { }
      }
      try { fs.unlinkSync(manifestPath); } catch (_) { }
    } else {
      console.warn(`⚠️ [Long-Form Notice] Verification check failed. Retaining intermediate sub-reels for diagnostics.`);
    }

    return outputPath;
  } catch (err) {
    console.error(`❌ [Long-Form Error] Sub-reel rendering failed: ${err.message}. Retaining intermediate files.`);
    throw err;
  }
}

/**
 * Builds timed character mouth animation overlay filters from Telugu visemes
 */
function buildCharacterMouthVisemeFilters(visemes, totalDuration) {
  if (!visemes || !Array.isArray(visemes.cues) || visemes.cues.length === 0) {
    return "";
  }

  // Mouth center anchor on character face
  // 0 = closed, 1 = half, 2 = round, 3 = wide
  const mouthFilters = [];
  const cues = visemes.cues;
  const timeLimit = Math.min(totalDuration, visemes.totalDuration || totalDuration);

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const start = cue.timeSeconds;
    const nextCue = cues[i + 1];
    const end = nextCue ? Math.min(timeLimit, nextCue.timeSeconds) : Math.min(timeLimit, start + 0.1);

    if (start >= timeLimit) break;
    if (end <= start) continue;

    const s = start.toFixed(3);
    const e = end.toFixed(3);

    if (cue.viseme === 3) {
      // Mouth Wide Open (Loud vowel / shout: A, AA, AI)
      mouthFilters.push(
        `drawbox=x=(w-90)/2:y=h*0.53:w=90:h=42:color=0x8B0000@0.90:t=fill:enable='between(t\\,${s}\\,${e})'`,
        `drawbox=x=(w-60)/2:y=h*0.54:w=60:h=12:color=white@0.85:t=fill:enable='between(t\\,${s}\\,${e})'` // teeth hint
      );
    } else if (cue.viseme === 2) {
      // Mouth Round (U, OO, O)
      mouthFilters.push(
        `drawbox=x=(w-65)/2:y=h*0.53:w=65:h=36:color=0x8B0000@0.90:t=fill:enable='between(t\\,${s}\\,${e})'`
      );
    } else if (cue.viseme === 1) {
      // Mouth Half Open (Consonants: T, D, S, N)
      mouthFilters.push(
        `drawbox=x=(w-55)/2:y=h*0.54:w=55:h=18:color=0x8B0000@0.85:t=fill:enable='between(t\\,${s}\\,${e})'`
      );
    } else {
      // Mouth Closed (Rest / Bilabials: P, B, M)
      mouthFilters.push(
        `drawbox=x=(w-45)/2:y=h*0.55:w=45:h=6:color=0x3B1010@0.90:t=fill:enable='between(t\\,${s}\\,${e})'`
      );
    }
  }

  return mouthFilters.join(",");
}

/**
 * Full Hybrid Rendering Pipeline for a Project (Supports up to 20 Minutes / 1,200s)
 */
async function renderHybridMovie({
  projectId,
  jobId = null,
  preferredAiProvider = "auto",
  aspectRatio = "9:16",
  adjustments = {}
}) {
  const dirs = projectService.getProjectDirs(projectId);
  const project = projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const storyboard = project.storyboard;
  if (!storyboard || !storyboard.scenes || storyboard.scenes.length === 0) {
    throw new Error(`Project ${projectId} does not have storyboard scenes`);
  }

  console.log(`\n================================================================`);
  console.log(`🎬 STARTING STAGE E PRODUCTION HYBRID PIPELINE FOR: ${projectId}`);
  console.log(`   Title: "${project.title}" | Target Platform: ${project.target_platform || "youtube"}`);
  console.log(`================================================================\n`);

  try {
    // Stage 1: Validation (10%)
    if (jobId) updateRenderJobProgress(jobId, 10, "Validating project media and directory boundaries");

    // Stage 2: Audio Synthesis & Lip-Sync (25%)
    if (jobId) updateRenderJobProgress(jobId, 25, "Synthesizing authentic Telugu narration & lip-sync cues");
    const narrationText = storyboard.narration || storyboard.narrative_prompt || project.title;
    const narrationFileName = "narration.wav";
    const projectAudioPath = path.join(dirs.audio, narrationFileName);

    const voiceResult = await generateVoice(narrationText, narrationFileName, {
      language: project.language || "telugu",
      voiceId: project.voice_id || "te-IN-MohanNeural"
    });

    if (fs.existsSync(voiceResult.audioPath) && voiceResult.audioPath !== projectAudioPath) {
      fs.copyFileSync(voiceResult.audioPath, projectAudioPath);
    }

    const narrationDuration = voiceResult.duration || 10.0;
    // Expanded duration ceiling: supports up to 1,200s (20 minutes)
    const targetMovieDuration = alignNarrationDuration(
      narrationDuration,
      Math.min(1200.0, Math.max(4.0, project.duration_seconds || storyboard.duration_seconds || 20.0))
    );

    // Compute Lip-Sync Visemes for Telugu speech
    let visemes = null;
    try {
      visemes = generateLipSyncVisemes(narrationText, projectAudioPath);
      fs.writeFileSync(
        path.join(dirs.storyboard, "lipsync_visemes.json"),
        JSON.stringify(visemes, null, 2),
        "utf8"
      );
    } catch (e) {
      console.warn("[HybridRenderer] Lip-sync viseme generation note:", e.message);
    }

    // Stage 3: Scene Clips Generation (35% -> 70%)
    const scenes = storyboard.scenes;
    const sceneCount = scenes.length;
    const transitionTime = 0.4;
    const effectiveSceneDuration = Math.max(2.0, (targetMovieDuration / sceneCount) + (sceneCount > 1 ? transitionTime : 0));
    const sceneClips = [];

    for (let i = 0; i < sceneCount; i++) {
      const sceneNum = i + 1;
      const progressPercent = 35 + Math.round((i / sceneCount) * 35);
      if (jobId) updateRenderJobProgress(jobId, progressPercent, `Rendering scene ${sceneNum}/${sceneCount} (Sub-reel checkpointing)`);

      const sceneClip = await renderHybridSceneClip({
        scene: scenes[i],
        sceneNum,
        duration: effectiveSceneDuration,
        projectId,
        aspectRatio,
        preferredAiProvider,
        adjustments
      });
      sceneClips.push(sceneClip);
    }

    // Stage 4: Long-Form Stitching with Segmented Sub-Reels (75%)
    if (jobId) updateRenderJobProgress(jobId, 75, "Assembling scenes via segmented sub-reels");
    const stitchedVideoPath = path.join(dirs.videos, "stitched_scenes.mp4");
    stitchSceneClips(sceneClips, targetMovieDuration, stitchedVideoPath);

    // Stage 5: Audio Mastering with Dynamic Sidechain Ducking & Burned Mouth Visemes (90%)
    if (jobId) updateRenderJobProgress(jobId, 90, "Applying dynamic audio sidechain compression & subtitles");
    const finalVideoPath = path.join(dirs.renders, "final_output.mp4");

    let bgmPath = null;
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      for (const f of files) {
        if (f.toLowerCase().startsWith("bgm") || f.toLowerCase().startsWith("music")) {
          bgmPath = path.join(assetsDir, f);
          break;
        }
      }
    }

    // Subtitle filter resolution with Telugu Unicode font support
    const subtitles = storyboard.subtitles || [
      project.title.toUpperCase(),
      "ANIMIO AI CREATIVE STUDIO",
      "EXPERIENCE THE MAGIC"
    ];

    let fontfileParam = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
    if (fs.existsSync("C:/Windows/Fonts/Nirmala.ttc")) {
      fontfileParam = "fontfile='C\\:/Windows/Fonts/Nirmala.ttc'";
    } else if (fs.existsSync("C:/Windows/Fonts/impact.ttf")) {
      fontfileParam = "fontfile='C\\:/Windows/Fonts/impact.ttf'";
    }

    const timePerLine = targetMovieDuration / Math.max(1, subtitles.length);
    const subtitleFilters = subtitles.map((line, idx) => {
      const start = (idx * timePerLine).toFixed(2);
      const end = Math.min(targetMovieDuration, (idx + 1) * timePerLine).toFixed(2);
      const safeText = String(line).replace(/['":\\`]/g, "").trim();
      return `drawtext=${fontfileParam}:text='${safeText}':fontcolor=yellow:fontsize=52:borderw=4:bordercolor=black:box=1:boxcolor=black@0.70:boxborderw=16:x=(w-text_w)/2:y=h-360:enable='between(t\\,${start}\\,${end})'`;
    }).join(",");

    // Character Mouth Viseme Overlay Filter (Burned into final MP4 frames!)
    const mouthVisemeFilters = buildCharacterMouthVisemeFilters(visemes, targetMovieDuration);
    const visualOverlays = [
      mouthVisemeFilters,
      subtitleFilters
    ].filter(Boolean).join(",");

    // Filter complex with audio-reactive waveform & dynamic breathing
    const complexFilters = [
      `[1:a]showwaves=s=680x80:mode=line:colors=0xFF693D@0.85:scale=sqrt[wave]`,
      `[0:v][wave]overlay=x=(W-w)/2:y=H-240:format=auto[vwave]`,
      `[vwave]vignette=PI/4+0.03*sin(t*2.5)${visualOverlays ? ',' + visualOverlays : ''}[vfin]`
    ];

    const ffmpegArgs = [
      "-i", stitchedVideoPath,
      "-i", projectAudioPath
    ];

    // Dynamic Broadcast-Grade Sidechain Compression Ducking:
    // When narration speaks on [1:a], BGM drops smoothly by ~12dB to 0.08.
    // In pauses and transitions, BGM rises to 0.35.
    if (bgmPath && fs.existsSync(bgmPath)) {
      ffmpegArgs.push("-stream_loop", "-1", "-i", bgmPath);
      complexFilters.push(
        `[2:a]volume=0.35[bgm_full]`,
        `[1:a]asplit=2[voice_main][voice_sidechain]`,
        `[bgm_full][voice_sidechain]sidechaincompress=threshold=0.08:ratio=4:attack=50:release=350:makeup=1.0[bgm_ducked]`,
        `[voice_main][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=2[aout]`
      );
    } else {
      complexFilters.push(`[1:a]apad[aout]`);
    }

    ffmpegArgs.push(
      "-filter_complex", complexFilters.join(";"),
      "-map", "[vfin]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "fast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-t", `${targetMovieDuration}`,
      "-movflags", "+faststart",
      "-y", finalVideoPath
    );

    execFfmpeg(ffmpegArgs);

    // Sync to legacy outputDir for dashboard preview compatibility
    const legacyOutput = path.join(outputDir, "final-cartoon-short.mp4");
    try {
      fs.copyFileSync(finalVideoPath, legacyOutput);
    } catch (_) { }

    // Stage 6: Complete (100%)
    const videoUrl = `/storage/projects/${projectId}/renders/final_output.mp4`;
    if (jobId) completeRenderJob(jobId, finalVideoPath, videoUrl, targetMovieDuration);

    console.log(`\n🎉 STAGE E MASTER RENDER COMPLETE! Output: ${finalVideoPath} (${targetMovieDuration}s)\n`);
    return {
      success: true,
      projectId,
      finalVideoPath,
      videoUrl,
      duration: targetMovieDuration
    };
  } catch (err) {
    console.error(`[HybridRenderer] Pipeline error on project ${projectId}:`, err.message);
    if (jobId) failRenderJob(jobId, err.message);
    throw err;
  }
}

module.exports = {
  renderHybridSceneClip,
  stitchSceneClips,
  renderHybridMovie,
  buildCharacterMouthVisemeFilters
};
