const fs = require("fs");
const path = require("path");
const { execFfmpeg } = require("../utils/ffmpegHelper");
const { imagesDir, videosDir, audioDir, assetsDir, outputDir } = require("../config");

/**
 * Locate image or video asset for a specific scene
 */
function findSceneMedia(sceneNum) {
  const searchDirs = [imagesDir, assetsDir];

  // Check video clips first (.mp4, .webm, .mov)
  const videoExts = [".mp4", ".webm", ".mov", ".mkv"];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const l = f.toLowerCase();
      const ext = path.extname(l);
      if (l.startsWith(`scene${sceneNum}.`) && videoExts.includes(ext)) {
        return { path: path.join(dir, f), type: "video" };
      }
    }
  }

  // Check image files (.png, .jpg, .jpeg, .webp)
  const imageExts = [".png", ".jpg", ".jpeg", ".webp"];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const l = f.toLowerCase();
      const ext = path.extname(l);
      if (l.startsWith(`scene${sceneNum}.`) && imageExts.includes(ext)) {
        return { path: path.join(dir, f), type: "image" };
      }
    }
  }

  return null;
}

function getDimensions(aspectRatio) {
  if (aspectRatio === "16:9" || aspectRatio === "landscape") {
    return { outW: 1920, outH: 1080, padW: 2560, padH: 1440 };
  } else if (aspectRatio === "1:1" || aspectRatio === "square") {
    return { outW: 1080, outH: 1080, padW: 1440, padH: 1440 };
  }
  return { outW: 1080, outH: 1920, padW: 1440, padH: 2560 };
}

/**
 * Render dynamic cinematic motion clip from scene image
 * Uses multi-axis organic breathing camera motion, 3D micro-tilt, and color grading
 */
function renderSceneClip(mediaInfo, sceneNum, duration, effect, outputClipPath, aspectRatio = "9:16", adjustments = {}) {
  const dim = getDimensions(aspectRatio);

  // Case 1: Real 3D Video Clip
  if (mediaInfo && mediaInfo.type === "video") {
    console.log(`🎥 [Scene ${sceneNum}] Using 3D video clip: ${path.basename(mediaInfo.path)} (${duration}s)...`);
    const filter = `scale=${dim.outW}:${dim.outH}:force_original_aspect_ratio=increase,crop=${dim.outW}:${dim.outH},setpts=PTS-STARTPTS,fps=30`;
    execFfmpeg([
      "-stream_loop", "-1",
      "-i", mediaInfo.path,
      "-t", `${duration}`,
      "-vf", filter,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", outputClipPath
    ]);
    return;
  }

  // Case 2: Organic Cinematic 2.5D Motion from Image (Fluid Animated Video Feel)
  let imagePath = mediaInfo ? mediaInfo.path : null;
  if (!imagePath || !fs.existsSync(imagePath)) {
    const colors = ["midnightblue", "darkslateblue", "navy", "darkcyan"];
    const fallbackImg = path.join(outputDir, `fallback_scene_${sceneNum}.png`);
    execFfmpeg([
      "-f", "lavfi",
      "-i", `color=c=${colors[(sceneNum - 1) % colors.length]}:s=${dim.outW}x${dim.outH}:d=1`,
      "-vf", `drawtext=text='SCENE ${sceneNum}':fontcolor=white:fontsize=80:borderw=4:bordercolor=black:x=(w-text_w)/2:y=900`,
      "-vframes", "1",
      "-y", fallbackImg
    ]);
    imagePath = fallbackImg;
  }

  // Performance Optimization: Check if rendered clip already exists and is fresher than the source image
  if (fs.existsSync(outputClipPath) && fs.existsSync(imagePath)) {
    try {
      const clipMtime = fs.statSync(outputClipPath).mtimeMs;
      const imgMtime = fs.statSync(imagePath).mtimeMs;
      if (clipMtime >= imgMtime) {
        console.log(`⚡ [Scene ${sceneNum}] Reusing pre-rendered clip (${path.basename(outputClipPath)})`);
        return;
      }
    } catch (_) {}
  }

  console.log(`🎬 [Scene ${sceneNum}] Rendering fluid 2.5D camera motion (${dim.outW}x${dim.outH}) for: ${path.basename(imagePath)}`);
  
  let colorGrading = "eq=contrast=1.12:brightness=0.02:saturation=1.3";
  if (adjustments && typeof adjustments === "object") {
    const b = adjustments.brightness !== undefined ? ((adjustments.brightness - 100) / 100) * 0.4 : 0.02;
    const c = adjustments.contrast !== undefined ? Math.max(0.5, (adjustments.contrast / 100) * 1.1) : 1.12;
    const s = adjustments.saturation !== undefined ? Math.max(0.0, (adjustments.saturation / 100) * 1.3) : 1.3;
    colorGrading = `eq=contrast=${c.toFixed(2)}:brightness=${b.toFixed(2)}:saturation=${s.toFixed(2)}`;

    if (adjustments.filter === "noir" || adjustments.filter === "bw") {
      colorGrading += ",hue=s=0";
    } else if (adjustments.filter === "vintage" || adjustments.filter === "sepia") {
      colorGrading += ",colorchannelmixer=.9:.1:.1:0:.1:.8:.1:0:.1:.1:.7";
    } else if (adjustments.filter === "warm") {
      colorGrading += ",colorchannelmixer=1.1:0:0:0:0:1.0:0:0:0:0:0.9";
    } else if (adjustments.filter === "cool") {
      colorGrading += ",colorchannelmixer=0.9:0:0:0:0:1.0:0:0:0:0:1.15";
    } else if (adjustments.filter === "cyberpunk") {
      colorGrading += ",hue=h=90:s=1.6";
    } else if (adjustments.filter === "dramatic") {
      colorGrading += ",eq=contrast=1.35:saturation=1.45";
    }
  }

  const framesCount = Math.round(30 * duration);
  let dynamicFilter = "";

  if (effect === "star_fall" || effect === "diagonal" || sceneNum === 1) {
    // Dynamic floating diagonal drift with breathing pulse & micro-tilt
    dynamicFilter = [
      `scale=${dim.padW}:${dim.padH}:force_original_aspect_ratio=increase,crop=${dim.padW}:${dim.padH}`,
      `zoompan=z='1.12+0.04*sin(in*0.10)':x='(iw-iw/zoom)/2+sin(in*0.07)*35':y='(ih-ih/zoom)/2+cos(in*0.05)*20':d=1:s=${dim.outW}x${dim.outH}:fps=30`,
      `rotate='0.008*sin(t*2)':c=none`,
      colorGrading
    ].join(",");
  } else if (effect === "rabbit_discover" || effect === "pan_left" || sceneNum === 2) {
    // Dramatic action punch-in with lateral sway
    dynamicFilter = [
      `scale=${dim.padW}:${dim.padH}:force_original_aspect_ratio=increase,crop=${dim.padW}:${dim.padH}`,
      `zoompan=z='min(1.08+(in/${framesCount})*0.16,1.25)+0.03*sin(in*0.14)':x='(iw-iw/zoom)/2+sin(in*0.09)*25':y='(ih-ih/zoom)/2+cos(in*0.07)*15':d=1:s=${dim.outW}x${dim.outH}:fps=30`,
      `rotate='-0.008*sin(t*2.2)':c=none`,
      colorGrading
    ].join(",");
  } else if (effect === "star_launch" || effect === "tilt_up" || sceneNum === 3) {
    // Cinematic panoramic sweep with gentle floating rotation
    dynamicFilter = [
      `scale=${dim.padW}:${dim.padH}:force_original_aspect_ratio=increase,crop=${dim.padW}:${dim.padH}`,
      `zoompan=z='1.14+0.03*cos(in*0.08)':x='(iw-iw/zoom)*0.75-(in/${framesCount})*(iw-iw/zoom)*0.5':y='(ih-ih/zoom)/2+sin(in*0.06)*20':d=1:s=${dim.outW}x${dim.outH}:fps=30`,
      `rotate='0.006*cos(t*1.9)':c=none`,
      colorGrading
    ].join(",");
  } else {
    // Triumphant soft pull-back with majestic float
    dynamicFilter = [
      `scale=${dim.padW}:${dim.padH}:force_original_aspect_ratio=increase,crop=${dim.padW}:${dim.padH}`,
      `zoompan=z='max(1.22-(in/${framesCount})*0.12,1.10)+0.03*sin(in*0.09)':x='(iw-iw/zoom)/2+cos(in*0.06)*25':y='(ih-ih/zoom)/2+sin(in*0.05)*20':d=1:s=${dim.outW}x${dim.outH}:fps=30`,
      `rotate='-0.006*cos(t*2)':c=none`,
      colorGrading
    ].join(",");
  }

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
    "-y", outputClipPath
  ]);
}

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
    console.warn("[VideoGenerator] Sub-reel XFade fallback to concat:", err.message);
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
    try { fs.unlinkSync(concatListFile); } catch (_) {}
    return outputPath;
  }
}

/**
 * Render multi-scene clips and stitch with cinematic XFade transitions & long-form sub-reels (up to 20 minutes)
 */
function renderMultiSceneStoryboard(scenes, totalDuration, aspectRatio = "9:16", adjustments = {}, progressCallback = null) {
  // Ceiling expanded to 1,200 seconds (20 minutes) for long-form cartoon productions
  const safeTotalDuration = Math.min(1200.0, Math.max(4.0, parseFloat(totalDuration) || 20.0));
  const sceneClips = [];
  const sceneCount = scenes.length || 3;
  const transitionTime = 0.4; // 0.4s smooth cinematic overlap transition

  // Allocate duration with transition overlap buffer
  const effectiveSceneDuration = Math.max(2.0, (safeTotalDuration / sceneCount) + (sceneCount > 1 ? transitionTime : 0));

  console.log(`🎬 Rendering ${sceneCount} Fluid Motion Scenes (${safeTotalDuration}s target • Aspect: ${aspectRatio})...`);

  scenes.forEach((scene, index) => {
    const sceneNum = index + 1;
    const clipPath = path.join(outputDir, `scene_clip_${sceneNum}.mp4`);
    const mediaInfo = findSceneMedia(sceneNum);
    const duration = effectiveSceneDuration;

    if (typeof progressCallback === "function") {
      progressCallback({ scene: sceneNum, totalScenes: sceneCount });
    }

    renderSceneClip(mediaInfo, sceneNum, duration, scene.effect, clipPath, aspectRatio, adjustments);
    sceneClips.push({ path: clipPath, duration });
  });

  const stitchedVideo = path.join(outputDir, "stitched_storyboard.mp4");

  // If only 1 scene, just copy
  if (sceneClips.length <= 1) {
    execFfmpeg(["-i", sceneClips[0].path, "-c", "copy", "-y", stitchedVideo]);
    return stitchedVideo;
  }

  const CHUNK_SIZE = 5;
  // Short form (<= 5 scenes): Single pass XFade
  if (sceneClips.length <= CHUNK_SIZE) {
    stitchSubReelGroup(sceneClips, safeTotalDuration, stitchedVideo);
    return stitchedVideo;
  }

  // Long form (> 5 scenes): Segmented Sub-Reel chunking (chunks of 5 scenes)
  // Prevents Windows CLI 8,191 char overflow and FFmpeg memory spikes
  const totalChunks = Math.ceil(sceneClips.length / CHUNK_SIZE);
  console.log(`🎬 [Long-Form] Splitting ${sceneClips.length} scenes (${safeTotalDuration}s) into ${totalChunks} sub-reels...`);
  
  const subReelFiles = [];
  const durationPerScene = safeTotalDuration / sceneClips.length;

  try {
    for (let c = 0; c < totalChunks; c++) {
      const chunkScenes = sceneClips.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      const chunkDuration = chunkScenes.length * durationPerScene;
      const subReelPath = path.join(outputDir, `subreel_${c}_temp.mp4`);

      console.log(`  🎥 Rendering Sub-Reel ${c + 1}/${totalChunks} (${chunkScenes.length} scenes, ${chunkDuration.toFixed(1)}s)...`);
      stitchSubReelGroup(chunkScenes, chunkDuration, subReelPath);
      subReelFiles.push(subReelPath);
    }

    // Assemble all sub-reels via stream copy concat demuxer
    const manifestPath = path.join(outputDir, `subreels_manifest_${Date.now()}.txt`);
    const manifestContent = subReelFiles.map(f => `file '${f.replace(/\\/g, "/")}'`).join("\n");
    fs.writeFileSync(manifestPath, manifestContent, "utf8");

    console.log(`🔗 Concatenating ${totalChunks} sub-reels into: ${stitchedVideo}`);
    execFfmpeg([
      "-f", "concat",
      "-safe", "0",
      "-i", manifestPath,
      "-c", "copy",
      "-y", stitchedVideo
    ]);

    // Verify output integrity before deleting intermediate sub-reels
    if (fs.existsSync(stitchedVideo) && fs.statSync(stitchedVideo).size > 1000) {
      console.log(`✅ [Long-Form Verification] Final video verified. Cleaning temporary sub-reels.`);
      for (const f of subReelFiles) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
      try { fs.unlinkSync(manifestPath); } catch (_) {}
    } else {
      console.warn(`⚠️ [Long-Form Notice] Verification failed. Retaining intermediate sub-reels.`);
    }

    return stitchedVideo;
  } catch (err) {
    console.error(`❌ [Long-Form Error] Sub-reel rendering failed: ${err.message}. Retaining intermediate files.`);
    throw err;
  }
}

/**
 * Merge video with narration audio, dynamic sound-reactive waveform, breathing atmosphere, and kinetic subtitles
 */
function mergeAudioAndSubtitles(videoPath, audioPath, subtitles, duration, filename = "final-cartoon-short.mp4", options = {}) {
  const storageVideoFile = path.join(videosDir, filename);
  const outputVideoFile = path.join(outputDir, filename);

  const showCaptions = options.showCaptions !== false && options.useCaptions !== false;
  let posY = "1420";
  if (options.position === "top") posY = "320";
  else if (options.position === "center") posY = "(h-text_h)/2";

  const lines = (Array.isArray(subtitles) && subtitles.length > 0 ? subtitles : [
    "A MAGICAL CARTOON ADVENTURE",
    "CHECK THIS OUT",
    "AMAZING HAPPY ENDING"
  ]).map(l => String(l)
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FAFF}]/gu, "")
    .replace(/['":\\`]/g, "")
    .trim())
    .filter(l => l.length > 0);

  // Robust fontfile resolution for Windows FFmpeg (avoids fontconfig missing errors & CSS comma splits)
  const fontOpt = (options.font || "Impact").split(",")[0].replace(/['"]/g, "").trim().toLowerCase();
  let fontfileParam = "";
  if ((fontOpt.includes("telugu") || fontOpt.includes("nirmala") || fontOpt.includes("hindi") || fontOpt.includes("noto")) && fs.existsSync("C:/Windows/Fonts/Nirmala.ttc")) {
    fontfileParam = "fontfile='C\\:/Windows/Fonts/Nirmala.ttc'";
  } else if (fontOpt.includes("impact") && fs.existsSync("C:/Windows/Fonts/impact.ttf")) {
    fontfileParam = "fontfile='C\\:/Windows/Fonts/impact.ttf'";
  } else if (fontOpt.includes("arial") && fs.existsSync("C:/Windows/Fonts/arial.ttf")) {
    fontfileParam = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
  } else if (fs.existsSync("C:/Windows/Fonts/segoeui.ttf")) {
    fontfileParam = "fontfile='C\\:/Windows/Fonts/segoeui.ttf'";
  } else {
    fontfileParam = "fontfile='C\\:/Windows/Fonts/arial.ttf'";
  }

  const color = options.color || "yellow";
  const fontSize = options.fontSize || 54;
  const useBox = options.useBox !== false;
  const boxParam = useBox ? ":box=1:boxcolor=black@0.75:boxborderw=18" : "";
  const borderw = options.borderw || 4;

  const timePerLine = duration / Math.max(1, lines.length);
  const subtitleFilters = lines.map((safeText, idx) => {
    const start = (idx * timePerLine).toFixed(2);
    const end = Math.min(duration, (idx + 1) * timePerLine).toFixed(2);
    return `drawtext=${fontfileParam}:text='${safeText}':fontcolor=${color}:fontsize=${fontSize}:borderw=${borderw}:bordercolor=black${boxParam}:x=(w-text_w)/2:y=${posY}:enable='between(t\\,${start}\\,${end})'`;
  }).join(",");

  const bgmPath = options.bgmPath;
  const bgmVolume = options.bgmVolume || 0.18;
  const hasBgm = bgmPath && fs.existsSync(bgmPath);

  // Audio-reactive visual filter graph:
  // 1. Voice audio waveform visualizer (Tangerine line pulsating with speech)
  // 2. Animated breathing atmosphere vignette
  // 3. Kinetic pop subtitles
  const complexFilters = [
    // Audio stream 1:a generates the reactive wave
    `[1:a]showwaves=s=680x80:mode=line:colors=0xFF693D@0.85:scale=sqrt[wave]`,
    `[0:v][wave]overlay=x=(W-w)/2:y=H-310:format=auto[vwave]`,
    `[vwave]vignette=PI/4+0.04*sin(t*2.5)${showCaptions && subtitleFilters.length > 0 ? ',' + subtitleFilters : ''}[vfin]`
  ];

  const hasAudio = audioPath && fs.existsSync(audioPath);
  const ffmpegArgs = ["-i", videoPath];
  if (hasAudio) {
    ffmpegArgs.push("-i", audioPath);
  } else {
    ffmpegArgs.push("-f", "lavfi", "-t", `${duration}`, "-i", "anullsrc=r=44100:cl=stereo");
  }
  if (hasBgm) {
    ffmpegArgs.push("-stream_loop", "-1", "-i", bgmPath);
    // Dynamic Broadcast-Grade Sidechain Compression Ducking:
    // When narration speaks on [1:a], BGM drops smoothly by ~12dB.
    // In speech pauses and transitions, BGM smoothly returns to full level.
    complexFilters.push(
      `[2:a]volume=${bgmVolume}[bgm_full]`,
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
    "-t", `${duration}`,
    "-movflags", "+faststart",
    "-y", storageVideoFile
  );

  try {
    execFfmpeg(ffmpegArgs);
  } catch (err) {
    if (hasBgm) {
      console.warn("[VideoGenerator] Dynamic sidechain ducking fallback to static mix:", err.message);
      const fallbackFilters = [
        `[1:a]showwaves=s=680x80:mode=line:colors=0xFF693D@0.85:scale=sqrt[wave]`,
        `[0:v][wave]overlay=x=(W-w)/2:y=H-310:format=auto[vwave]`,
        `[vwave]vignette=PI/4+0.04*sin(t*2.5)${showCaptions && subtitleFilters.length > 0 ? ',' + subtitleFilters : ''}[vfin]`,
        `[1:a]apad[padded_voice]`,
        `[padded_voice]volume=1.0[voice]`,
        `[2:a]volume=${bgmVolume}[bgm]`,
        `[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`
      ];
      execFfmpeg([
        "-i", videoPath,
        "-i", hasAudio ? audioPath : "anullsrc=r=44100:cl=stereo",
        "-stream_loop", "-1", "-i", bgmPath,
        "-filter_complex", fallbackFilters.join(";"),
        "-map", "[vfin]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-t", `${duration}`,
        "-movflags", "+faststart",
        "-y", storageVideoFile
      ]);
    } else {
      throw err;
    }
  }

  // Synchronize to output directory
  try {
    fs.copyFileSync(storageVideoFile, outputVideoFile);
  } catch (_) {}

  console.log("🎬 Master audio-reactive short video created:", storageVideoFile);
  return storageVideoFile;
}

module.exports = {
  findSceneMedia,
  renderMultiSceneStoryboard,
  mergeAudioAndSubtitles
};
